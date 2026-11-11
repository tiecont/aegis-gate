package persistence

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"github.com/jackc/pgx/v5"
)

type RouteSpec struct {
	DomainID     string   `json:"domain_id"`
	OriginID     string   `json:"origin_id"`
	OriginPoolID string   `json:"origin_pool_id,omitempty"`
	PolicyID     string   `json:"policy_id"`
	Path         string   `json:"path"`
	Methods      []string `json:"methods"`
}

func (r RouteSpec) Valid() bool {
	return len(r.DomainID) == 36 && ((len(r.OriginID) == 36 && r.OriginPoolID == "") || (r.OriginID == "" && len(r.OriginPoolID) == 36)) && len(r.PolicyID) == 36 && domain.Route(r.Path, r.Methods)
}

func routeReferences(ctx context.Context, tx pgx.Tx, project string, spec RouteSpec) error {
	for _, ref := range []struct{ id, kind string }{{spec.DomainID, "domain"}, {spec.OriginID, "origin"}, {spec.PolicyID, "policy"}} {
		if ref.id == "" {
			continue
		}
		var found string
		if err := tx.QueryRow(ctx, "SELECT id FROM resources WHERE project_id=$1 AND id=$2 AND kind=$3 FOR SHARE", project, ref.id, ref.kind).Scan(&found); err != nil {
			return domain.ErrDenied
		}
	}
	if spec.OriginPoolID != "" {
		var id string
		if err := tx.QueryRow(ctx, "SELECT id FROM origin_pools WHERE project_id=$1 AND id=$2 AND state='active' FOR SHARE", project, spec.OriginPoolID).Scan(&id); err != nil {
			return domain.ErrDenied
		}
	}
	return nil
}

func (s *Store) CreateRouteDraft(ctx context.Context, p Principal, project, key string, spec RouteSpec) (Resource, error) {
	if !spec.Valid() || len(key) < 8 || len(key) > 128 {
		return Resource{}, domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Resource{}, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, "routes")
	if err != nil {
		return Resource{}, err
	}
	if err := routeReferences(ctx, tx, project, spec); err != nil {
		return Resource{}, denied(ctx, tx, p, org, project, "route_binding_denied")
	}
	raw, err := json.Marshal(spec)
	if err != nil {
		return Resource{}, domain.ErrInvalid
	}
	digest := sha256.Sum256(append([]byte("route\x00"), raw...))
	resource, err := createDraft(ctx, tx, p, org, project, "route", key, raw, digest)
	if err != nil {
		return Resource{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO route_bindings(project_id,route_id,domain_id,origin_id,policy_id,origin_pool_id)
		VALUES($1,$2,$3,NULLIF($4,'')::uuid,$5,NULLIF($6,'')::uuid) ON CONFLICT(project_id,route_id) DO NOTHING`, project, resource.ID, spec.DomainID, spec.OriginID, spec.PolicyID, spec.OriginPoolID); err != nil {
		return Resource{}, opaque(err)
	}
	return resource, opaque(tx.Commit(ctx))
}

type Approval struct {
	DecisionID           int64  `json:"decision_id"`
	RouteID              string `json:"route_id"`
	RouteGeneration      int64  `json:"route_generation"`
	OriginGeneration     int64  `json:"origin_generation"`
	PolicyGeneration     int64  `json:"policy_generation"`
	OriginPoolGeneration int64  `json:"origin_pool_generation"`
}

func (s *Store) ReviseRouteDraft(ctx context.Context, p Principal, project, id string, expected int64, spec RouteSpec) (Resource, error) {
	if !spec.Valid() || expected < 1 || expected >= 9007199254740991 {
		return Resource{}, domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Resource{}, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, "routes")
	if err != nil {
		return Resource{}, err
	}
	if err = routeReferences(ctx, tx, project, spec); err != nil {
		return Resource{}, denied(ctx, tx, p, org, project, "route_binding_denied")
	}
	raw, err := json.Marshal(spec)
	if err != nil {
		return Resource{}, domain.ErrInvalid
	}
	resource, err := reviseDraft(ctx, tx, p, org, project, "route", id, expected, raw)
	if err != nil {
		return Resource{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE route_bindings SET domain_id=$3,origin_id=NULLIF($4,'')::uuid,policy_id=$5,origin_pool_id=NULLIF($6,'')::uuid WHERE project_id=$1 AND route_id=$2`, project, id, spec.DomainID, spec.OriginID, spec.PolicyID, spec.OriginPoolID); err != nil {
		return Resource{}, opaque(err)
	}
	return resource, opaque(tx.Commit(ctx))
}

// ApproveRoute only records an immutable control-plane decision. Publishing
// signed snapshots and serving traffic remain gated by modules03 and04.
func (s *Store) ApproveRoute(ctx context.Context, p Principal, project, id string, expected int64) (Approval, error) {
	var approval Approval
	if expected < 1 {
		return approval, domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return approval, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, "approve")
	if err != nil {
		return approval, err
	}
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,12))", project); err != nil {
		return approval, opaque(err)
	}
	var raw json.RawMessage
	var domainID, originID, policyID, poolID string
	err = tx.QueryRow(ctx, `SELECT r.generation,r.spec,b.domain_id,COALESCE(b.origin_id::text,''),b.policy_id,COALESCE(b.origin_pool_id::text,'')
		FROM resources r JOIN route_bindings b ON b.project_id=r.project_id AND b.route_id=r.id
		WHERE r.project_id=$1 AND r.id=$2 AND r.kind='route' FOR SHARE OF r,b`, project, id).
		Scan(&approval.RouteGeneration, &raw, &domainID, &originID, &policyID, &poolID)
	if err != nil {
		return approval, opaque(err)
	}
	if approval.RouteGeneration != expected {
		return approval, domain.ErrConflict
	}
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,2))", project+":"+domainID); err != nil {
		return approval, opaque(err)
	}
	var route RouteSpec
	if json.Unmarshal(raw, &route) != nil || !route.Valid() || route.DomainID != domainID || route.OriginID != originID || route.PolicyID != policyID || route.OriginPoolID != poolID {
		return approval, domain.ErrInvalid
	}
	var state string
	var expiry time.Time
	if err = tx.QueryRow(ctx, `SELECT state,expires_at FROM domain_claims
		WHERE project_id=$1 AND resource_id=$2 FOR SHARE`, project, domainID).Scan(&state, &expiry); err != nil {
		return approval, opaque(err)
	}
	if (state != "verified" && state != "active") || !expiry.After(time.Now()) {
		return approval, domain.ErrConflict
	}
	var policyRaw json.RawMessage
	if err = tx.QueryRow(ctx, `SELECT generation,spec FROM resources WHERE project_id=$1 AND id=$2 AND kind='policy' FOR SHARE`, project, policyID).Scan(&approval.PolicyGeneration, &policyRaw); err != nil {
		return approval, opaque(err)
	}
	var policy domain.Policy
	if json.Unmarshal(policyRaw, &policy) != nil || policy.Validate() != nil {
		return approval, domain.ErrInvalid
	}
	if poolID == "" {
		if err = tx.QueryRow(ctx, `SELECT generation FROM resources WHERE project_id=$1 AND id=$2 AND kind='origin' FOR SHARE`, project, originID).Scan(&approval.OriginGeneration); err != nil {
			return approval, opaque(err)
		}
	} else {
		if err = tx.QueryRow(ctx, `SELECT p.generation FROM origin_pools p JOIN origin_pool_approvals a ON a.project_id=p.project_id AND a.pool_id=p.id AND a.generation=p.generation WHERE p.project_id=$1 AND p.id=$2 AND p.state='active' FOR SHARE OF p`, project, poolID).Scan(&approval.OriginPoolGeneration); err != nil {
			return approval, domain.ErrConflict
		}
	}
	approval.RouteID = id
	// Reject overlapping methods on the same domain/path among approved routes.
	var collision bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM route_approvals a
		JOIN active_route_approvals live ON live.project_id=a.project_id AND live.route_id=a.route_id AND live.decision_id=a.decision_id AND NOT live.retired
		JOIN domain_claims d ON d.project_id=a.project_id AND d.resource_id=a.domain_id AND d.state='active' AND d.expires_at>now()
		JOIN resource_revisions r ON r.project_id=a.project_id AND r.resource_id=a.route_id AND r.generation=a.route_generation
		WHERE a.project_id=$1 AND a.domain_id=$2 AND a.route_id<>$3 AND r.spec->>'path'=$4
		AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(r.spec->'methods') m WHERE m=ANY($5)))`, project, domainID, id, route.Path, route.Methods).Scan(&collision); err != nil {
		return approval, opaque(err)
	}
	if collision {
		return approval, domain.ErrConflict
	}
	// A retry returns the exact active decision. Changed dependencies create a
	// fresh immutable decision and replace only the active pointer.
	err = tx.QueryRow(ctx, `SELECT a.decision_id FROM route_approvals a JOIN active_route_approvals live ON live.decision_id=a.decision_id AND NOT live.retired WHERE a.project_id=$1 AND a.route_id=$2 AND a.route_generation=$3 AND COALESCE(a.origin_generation,0)=$4 AND a.policy_generation=$5 AND COALESCE(a.origin_pool_generation,0)=$6`, project, id, expected, approval.OriginGeneration, approval.PolicyGeneration, approval.OriginPoolGeneration).Scan(&approval.DecisionID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return approval, opaque(err)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `INSERT INTO route_approvals(project_id,route_id,route_generation,domain_id,origin_id,origin_generation,policy_id,policy_generation,issuer,subject,origin_pool_id,origin_pool_generation)
		VALUES($1,$2,$3,$4,NULLIF($5,'')::uuid,NULLIF($6,0),$7,$8,$9,$10,NULLIF($11,'')::uuid,NULLIF($12,0)) RETURNING decision_id`, project, id, approval.RouteGeneration, domainID, originID, approval.OriginGeneration, policyID, approval.PolicyGeneration, p.Issuer, p.Subject, poolID, approval.OriginPoolGeneration).Scan(&approval.DecisionID)
		if err != nil {
			return approval, opaque(err)
		}
		_, err = tx.Exec(ctx, `INSERT INTO audit_events(organization_id,project_id,issuer,subject,action,outcome,resource_id)
			VALUES($1,$2,$3,$4,'route_approve','allowed',$5)`, org, project, p.Issuer, p.Subject, id)
		if err != nil {
			return approval, opaque(err)
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO active_route_approvals(project_id,route_id,decision_id) VALUES($1,$2,$3) ON CONFLICT(project_id,route_id) DO UPDATE SET decision_id=EXCLUDED.decision_id,retired=false`, project, id, approval.DecisionID); err != nil {
		return approval, opaque(err)
	}
	if _, err = tx.Exec(ctx, "UPDATE domain_claims SET state='active' WHERE project_id=$1 AND resource_id=$2 AND state='verified'", project, domainID); err != nil {
		return approval, opaque(err)
	}
	return approval, opaque(tx.Commit(ctx))
}

func (s *Store) RetireRoute(ctx context.Context, p Principal, project, id string, expected int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, "approve")
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,12))", project); err != nil {
		return opaque(err)
	}
	var domainID string
	var decision int64
	if err = tx.QueryRow(ctx, `SELECT d.domain_id,d.decision_id FROM active_route_approvals a JOIN route_approvals d ON d.decision_id=a.decision_id WHERE a.project_id=$1 AND a.route_id=$2 AND d.route_generation=$3 AND NOT a.retired FOR UPDATE OF a`, project, id, expected).Scan(&domainID, &decision); err != nil {
		return domain.ErrConflict
	}
	if _, err = tx.Exec(ctx, "INSERT INTO route_retirements(project_id,route_id,decision_id,issuer,subject) VALUES($1,$2,$3,$4,$5)", project, id, decision, p.Issuer, p.Subject); err != nil {
		return opaque(err)
	}
	if _, err = tx.Exec(ctx, "UPDATE active_route_approvals SET retired=true WHERE project_id=$1 AND route_id=$2", project, id); err != nil {
		return opaque(err)
	}
	if _, err = tx.Exec(ctx, `UPDATE domain_claims d SET state='verified' WHERE d.project_id=$1 AND d.resource_id=$2 AND d.state='active' AND NOT EXISTS(SELECT 1 FROM active_route_approvals a JOIN route_approvals r ON r.decision_id=a.decision_id WHERE a.project_id=d.project_id AND r.domain_id=d.resource_id AND NOT a.retired)`, project, domainID); err != nil {
		return opaque(err)
	}
	if err = originAudit(ctx, tx, p, org, project, id, "route_retire"); err != nil {
		return err
	}
	return opaque(tx.Commit(ctx))
}

func (s *Store) Revision(ctx context.Context, p Principal, project, kind, id string, generation int64) (Resource, error) {
	var result Resource
	if action(kind) == "invalid" || generation < 1 {
		return result, domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = scoped(ctx, tx, p, project, "read"); err != nil {
		return result, err
	}
	err = tx.QueryRow(ctx, `SELECT r.id,r.project_id,r.kind,v.generation,v.spec
		FROM resources r JOIN resource_revisions v ON v.project_id=r.project_id AND v.resource_id=r.id
		WHERE r.project_id=$1 AND r.kind=$2 AND r.id=$3 AND v.generation=$4`, project, kind, id, generation).
		Scan(&result.ID, &result.ProjectID, &result.Kind, &result.Generation, &result.Spec)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, denied(ctx, tx, p, "", project, "revision_denied")
	}
	return result, opaque(err)
}
