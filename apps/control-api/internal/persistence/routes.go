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
	DomainID string   `json:"domain_id"`
	OriginID string   `json:"origin_id"`
	PolicyID string   `json:"policy_id"`
	Path     string   `json:"path"`
	Methods  []string `json:"methods"`
}

func (r RouteSpec) Valid() bool {
	return len(r.DomainID) == 36 && len(r.OriginID) == 36 && len(r.PolicyID) == 36 && domain.Route(r.Path, r.Methods)
}

func routeReferences(ctx context.Context, tx pgx.Tx, project string, spec RouteSpec) error {
	for _, ref := range []struct{ id, kind string }{{spec.DomainID, "domain"}, {spec.OriginID, "origin"}, {spec.PolicyID, "policy"}} {
		var found string
		if err := tx.QueryRow(ctx, "SELECT id FROM resources WHERE project_id=$1 AND id=$2 AND kind=$3 FOR SHARE", project, ref.id, ref.kind).Scan(&found); err != nil {
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
		return Resource{}, err
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
	if _, err = tx.Exec(ctx, `INSERT INTO route_bindings(project_id,route_id,domain_id,origin_id,policy_id)
		VALUES($1,$2,$3,$4,$5) ON CONFLICT(project_id,route_id) DO NOTHING`, project, resource.ID, spec.DomainID, spec.OriginID, spec.PolicyID); err != nil {
		return Resource{}, opaque(err)
	}
	return resource, opaque(tx.Commit(ctx))
}

type Approval struct {
	RouteID          string `json:"route_id"`
	RouteGeneration  int64  `json:"route_generation"`
	OriginGeneration int64  `json:"origin_generation"`
	PolicyGeneration int64  `json:"policy_generation"`
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
		return Resource{}, err
	}
	raw, err := json.Marshal(spec)
	if err != nil {
		return Resource{}, domain.ErrInvalid
	}
	resource, err := reviseDraft(ctx, tx, p, org, project, "route", id, expected, raw)
	if err != nil {
		return Resource{}, err
	}
	if _, err = tx.Exec(ctx, `UPDATE route_bindings SET domain_id=$3,origin_id=$4,policy_id=$5 WHERE project_id=$1 AND route_id=$2`, project, id, spec.DomainID, spec.OriginID, spec.PolicyID); err != nil {
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
	var raw json.RawMessage
	var domainID, originID, policyID string
	err = tx.QueryRow(ctx, `SELECT r.generation,r.spec,b.domain_id,b.origin_id,b.policy_id
		FROM resources r JOIN route_bindings b ON b.project_id=r.project_id AND b.route_id=r.id
		WHERE r.project_id=$1 AND r.id=$2 AND r.kind='route' FOR SHARE OF r,b`, project, id).
		Scan(&approval.RouteGeneration, &raw, &domainID, &originID, &policyID)
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
	if json.Unmarshal(raw, &route) != nil || !route.Valid() || route.DomainID != domainID || route.OriginID != originID || route.PolicyID != policyID {
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
	if err = tx.QueryRow(ctx, `SELECT generation FROM resources WHERE project_id=$1 AND id=$2 AND kind='origin' FOR SHARE`, project, originID).Scan(&approval.OriginGeneration); err != nil {
		return approval, opaque(err)
	}
	approval.RouteID = id
	// Reject overlapping methods on the same domain/path among approved routes.
	var collision bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM route_approvals a
		JOIN resource_revisions r ON r.project_id=a.project_id AND r.resource_id=a.route_id AND r.generation=a.route_generation
		WHERE a.project_id=$1 AND a.domain_id=$2 AND a.route_id<>$3 AND r.spec->>'path'=$4
		AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(r.spec->'methods') m WHERE m=ANY($5)))`, project, domainID, id, route.Path, route.Methods).Scan(&collision); err != nil {
		return approval, opaque(err)
	}
	if collision {
		return approval, domain.ErrConflict
	}
	command, err := tx.Exec(ctx, `INSERT INTO route_approvals(project_id,route_id,route_generation,domain_id,origin_id,origin_generation,policy_id,policy_generation,issuer,subject)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`, project, id, approval.RouteGeneration, domainID, originID, approval.OriginGeneration, policyID, approval.PolicyGeneration, p.Issuer, p.Subject)
	if err != nil {
		return approval, opaque(err)
	}
	if command.RowsAffected() == 1 {
		_, err = tx.Exec(ctx, `INSERT INTO audit_events(organization_id,project_id,issuer,subject,action,outcome,resource_id)
			VALUES($1,$2,$3,$4,'route_approve','allowed',$5)`, org, project, p.Issuer, p.Subject, id)
		if err != nil {
			return approval, opaque(err)
		}
	}
	return approval, opaque(tx.Commit(ctx))
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
		return result, domain.ErrDenied
	}
	return result, opaque(err)
}
