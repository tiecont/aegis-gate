package persistence

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"sort"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"aegisgate.dev/aegisgate/internal/configsnapshot"
	jcs "github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
	"github.com/jackc/pgx/v5"
)

type PublicationPreview struct {
	Payload configsnapshot.Payload `json:"payload"`
	Digest  string                 `json:"digest"`
}
type Publication struct {
	DeploymentID string `json:"deployment_id"`
	Generation   uint64 `json:"generation"`
	Digest       string `json:"payload_digest"`
	RollbackOf   uint64 `json:"rollback_of,omitempty"`
}

func strictSpec(raw []byte, v any) error {
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if d.Decode(v) != nil || d.Decode(new(any)) != io.EOF {
		return domain.ErrInvalid
	}
	return nil
}
func payloadPreview(payload configsnapshot.Payload, now time.Time) (PublicationPreview, error) {
	if err := configsnapshot.Validate(payload, now); err != nil {
		return PublicationPreview{}, domain.ErrInvalid
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return PublicationPreview{}, domain.ErrInvalid
	}
	raw, err = jcs.Transform(raw)
	if err != nil || len(raw) > configsnapshot.MaxArtifactBytes-8192 {
		return PublicationPreview{}, domain.ErrInvalid
	}
	sum := sha256.Sum256(raw)
	return PublicationPreview{payload, hex.EncodeToString(sum[:])}, nil
}

// compilePublication reads only immutable approved route/dependency revisions.
// The project approval lock serializes route approve/retire and publication.
// Domain rows are locked so ownership cannot change mid-approval.
func compilePublication(ctx context.Context, tx pgx.Tx, project string, now time.Time) (PublicationPreview, error) {
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,12))", project); err != nil {
		return PublicationPreview{}, opaque(err)
	}
	type routeRevision struct {
		routeID, domainID, originID, poolID, policyID string
		routeGen, originGen, poolGen, policyGen       uint64
	}
	rows, err := tx.Query(ctx, `SELECT a.route_id,a.route_generation,a.domain_id,COALESCE(a.origin_id::text,''),COALESCE(a.origin_generation,0),COALESCE(a.origin_pool_id::text,''),COALESCE(a.origin_pool_generation,0),a.policy_id,a.policy_generation
 FROM active_route_approvals live JOIN route_approvals a ON a.project_id=live.project_id AND a.route_id=live.route_id AND a.decision_id=live.decision_id WHERE live.project_id=$1 AND NOT live.retired ORDER BY a.route_id LIMIT 4097`, project)
	if err != nil {
		return PublicationPreview{}, opaque(err)
	}
	revisions := []routeRevision{}
	for rows.Next() {
		var r routeRevision
		if err = rows.Scan(&r.routeID, &r.routeGen, &r.domainID, &r.originID, &r.originGen, &r.poolID, &r.poolGen, &r.policyID, &r.policyGen); err != nil {
			rows.Close()
			return PublicationPreview{}, opaque(err)
		}
		revisions = append(revisions, r)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return PublicationPreview{}, opaque(err)
	}
	if len(revisions) > 4096 {
		return PublicationPreview{}, domain.ErrInvalid
	}
	tenant := configsnapshot.Tenant{ID: project, Domains: []configsnapshot.Domain{}, OriginPools: []configsnapshot.OriginPool{}, Policies: []configsnapshot.Policy{}, Routes: []configsnapshot.Route{}}
	domains := map[string]bool{}
	pools := map[string]uint64{}
	policies := map[string]uint64{}
	for _, r := range revisions {
		var raw []byte
		if err = tx.QueryRow(ctx, "SELECT spec FROM resource_revisions WHERE project_id=$1 AND resource_id=$2 AND generation=$3", project, r.routeID, r.routeGen).Scan(&raw); err != nil {
			return PublicationPreview{}, opaque(err)
		}
		var route RouteSpec
		if strictSpec(raw, &route) != nil || !route.Valid() || route.DomainID != r.domainID || route.OriginID != r.originID || route.OriginPoolID != r.poolID || route.PolicyID != r.policyID {
			return PublicationPreview{}, domain.ErrInvalid
		}
		if !domains[r.domainID] {
			d := configsnapshot.Domain{ID: r.domainID, TenantID: project}
			var state string
			if err = tx.QueryRow(ctx, "SELECT hostname,expires_at,state FROM domain_claims WHERE project_id=$1 AND resource_id=$2 FOR SHARE", project, r.domainID).Scan(&d.Hostname, &d.VerifiedUntil, &state); err != nil {
				return PublicationPreview{}, opaque(err)
			}
			d.VerifiedUntil = d.VerifiedUntil.UTC().Truncate(time.Second)
			if state != "active" || !d.VerifiedUntil.After(now) {
				return PublicationPreview{}, domain.ErrConflict
			}
			tenant.Domains = append(tenant.Domains, d)
			domains[d.ID] = true
		}
		poolID, poolGen := r.poolID, r.poolGen
		if poolID == "" {
			poolID, poolGen = r.originID, r.originGen
		}
		if old, ok := pools[poolID]; ok && old != poolGen {
			return PublicationPreview{}, domain.ErrConflict
		} else if !ok {
			pool := configsnapshot.OriginPool{ID: poolID, TenantID: project, Generation: poolGen, Endpoints: []configsnapshot.Endpoint{}}
			if r.poolID == "" {
				if err = tx.QueryRow(ctx, "SELECT spec FROM resource_revisions WHERE project_id=$1 AND resource_id=$2 AND generation=$3", project, r.originID, r.originGen).Scan(&raw); err != nil {
					return PublicationPreview{}, opaque(err)
				}
				var origin struct {
					URL string `json:"url"`
				}
				if strictSpec(raw, &origin) != nil {
					return PublicationPreview{}, domain.ErrInvalid
				}
				pool.Endpoints = append(pool.Endpoints, configsnapshot.Endpoint{ID: r.originID, TenantID: project, Generation: r.originGen, URL: origin.URL})
			} else {
				if err = tx.QueryRow(ctx, `SELECT r.spec FROM origin_pool_revisions r JOIN origin_pool_approvals a ON a.project_id=r.project_id AND a.pool_id=r.pool_id AND a.generation=r.generation WHERE r.project_id=$1 AND r.pool_id=$2 AND r.generation=$3`, project, r.poolID, r.poolGen).Scan(&raw); err != nil {
					return PublicationPreview{}, opaque(err)
				}
				var frozen PoolRevision
				if strictSpec(raw, &frozen) != nil || frozen.Pool.ID != r.poolID || frozen.Pool.ProjectID != project || frozen.Pool.Generation != int64(r.poolGen) || frozen.Pool.State != "active" {
					return PublicationPreview{}, domain.ErrInvalid
				}
				for _, ep := range frozen.Endpoints {
					if ep.ProjectID != project || ep.PoolID != r.poolID {
						return PublicationPreview{}, domain.ErrInvalid
					}
					if ep.State == "active" {
						pool.Endpoints = append(pool.Endpoints, configsnapshot.Endpoint{ID: ep.ID, TenantID: project, URL: ep.URL, Generation: uint64(ep.Generation)})
					}
				}
			}
			tenant.OriginPools = append(tenant.OriginPools, pool)
			pools[poolID] = poolGen
		}
		if old, ok := policies[r.policyID]; ok && old != r.policyGen {
			return PublicationPreview{}, domain.ErrConflict
		} else if !ok {
			if err = tx.QueryRow(ctx, "SELECT spec FROM resource_revisions WHERE project_id=$1 AND resource_id=$2 AND generation=$3", project, r.policyID, r.policyGen).Scan(&raw); err != nil {
				return PublicationPreview{}, opaque(err)
			}
			var policy domain.Policy
			if strictSpec(raw, &policy) != nil || policy.Validate() != nil {
				return PublicationPreview{}, domain.ErrInvalid
			}
			tenant.Policies = append(tenant.Policies, configsnapshot.Policy{ID: r.policyID, TenantID: project, Generation: r.policyGen, AuthRequired: policy.AuthRequired, JWTIssuer: policy.JWTIssuer, JWTAudience: policy.JWTAudience})
			policies[r.policyID] = r.policyGen
		}
		methods := append([]string{}, route.Methods...)
		sort.Strings(methods)
		tenant.Routes = append(tenant.Routes, configsnapshot.Route{ID: r.routeID, TenantID: project, Generation: r.routeGen, DomainID: r.domainID, OriginPoolID: poolID, PolicyID: r.policyID, Path: route.Path, Methods: methods})
	}
	sort.Slice(tenant.Domains, func(i, j int) bool { return tenant.Domains[i].ID < tenant.Domains[j].ID })
	sort.Slice(tenant.OriginPools, func(i, j int) bool { return tenant.OriginPools[i].ID < tenant.OriginPools[j].ID })
	sort.Slice(tenant.Policies, func(i, j int) bool { return tenant.Policies[i].ID < tenant.Policies[j].ID })
	return payloadPreview(configsnapshot.Payload{Tenants: []configsnapshot.Tenant{tenant}}, now)
}

func (s *Store) PreviewPublication(ctx context.Context, p Principal, project string) (PublicationPreview, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return PublicationPreview{}, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = scoped(ctx, tx, p, project, "read"); err != nil {
		return PublicationPreview{}, err
	}
	return compilePublication(ctx, tx, project, time.Now().UTC().Truncate(time.Second))
}

// ApprovePublication is the publication authorization boundary. A preview digest
// is mandatory, preventing a stale UI/agent from approving a changed read-model.
// Immutable approval, next generation, outbox and audit commit together.
func (s *Store) ApprovePublication(ctx context.Context, p Principal, project, key, digest string, ttl time.Duration) (Publication, error) {
	return s.approvePublication(ctx, p, project, key, digest, ttl, 0)
}

func (s *Store) RollbackPublication(ctx context.Context, p Principal, project, key string, oldGeneration uint64, ttl time.Duration) (Publication, error) {
	if oldGeneration == 0 || oldGeneration > configsnapshot.MaxGeneration {
		return Publication{}, domain.ErrInvalid
	}
	return s.approvePublication(ctx, p, project, key, "", ttl, oldGeneration)
}
func (s *Store) approvePublication(ctx context.Context, p Principal, project, key, digest string, ttl time.Duration, rollback uint64) (Publication, error) {
	if len(key) < 8 || len(key) > 128 || ttl < time.Minute || ttl > configsnapshot.MaxValidity || ttl%time.Second != 0 {
		return Publication{}, domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Publication{}, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, "approve")
	if err != nil {
		return Publication{}, err
	}
	if err = sensitive(ctx, tx, p, org, project, "publication_denied"); err != nil {
		return Publication{}, err
	}
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,12))", project); err != nil {
		return Publication{}, opaque(err)
	}
	var result Publication
	result.DeploymentID = project
	var oldRollback uint64
	err = tx.QueryRow(ctx, "SELECT generation,payload_digest,COALESCE(rollback_of,0) FROM config_revisions WHERE project_id=$1 AND issuer=$2 AND subject=$3 AND request_key=$4", project, p.Issuer, p.Subject, key).Scan(&result.Generation, &result.Digest, &oldRollback)
	if err == nil {
		if oldRollback != rollback || rollback == 0 && result.Digest != digest {
			return Publication{}, domain.ErrConflict
		}
		result.RollbackOf = oldRollback
		return result, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return Publication{}, opaque(err)
	}
	now := time.Now().UTC().Truncate(time.Second)
	var preview PublicationPreview
	if rollback == 0 {
		preview, err = compilePublication(ctx, tx, project, now)
		if err != nil {
			return Publication{}, err
		}
		if preview.Digest != digest {
			return Publication{}, domain.ErrConflict
		}
	} else {
		var raw []byte
		if err = tx.QueryRow(ctx, "SELECT payload FROM config_revisions WHERE project_id=$1 AND generation=$2", project, rollback).Scan(&raw); err != nil {
			return Publication{}, opaque(err)
		}
		var payload configsnapshot.Payload
		if strictSpec(raw, &payload) != nil || len(payload.Tenants) != 1 || payload.Tenants[0].ID != project {
			return Publication{}, domain.ErrInvalid
		}
		// Recheck ownership NOW. A historical signature must never resurrect a
		// hostname after ownership expired, was retired or transferred.
		for _, d := range payload.Tenants[0].Domains {
			var hostname, state string
			var expiry time.Time
			if err = tx.QueryRow(ctx, "SELECT hostname,state,expires_at FROM domain_claims WHERE project_id=$1 AND resource_id=$2 FOR SHARE", project, d.ID).Scan(&hostname, &state, &expiry); err != nil || hostname != d.Hostname || (state != "active" && state != "verified") || !expiry.After(now) || d.VerifiedUntil.After(expiry) {
				return Publication{}, domain.ErrConflict
			}
		}
		preview, err = payloadPreview(payload, now)
		if err != nil {
			return Publication{}, err
		}
	}
	if _, err = tx.Exec(ctx, "INSERT INTO config_deployments(project_id) VALUES($1) ON CONFLICT DO NOTHING", project); err != nil {
		return Publication{}, opaque(err)
	}
	if err = tx.QueryRow(ctx, "UPDATE config_deployments SET generation=generation+1 WHERE project_id=$1 AND generation<9007199254740991 RETURNING generation", project).Scan(&result.Generation); err != nil {
		return Publication{}, opaque(err)
	}
	result.Digest = preview.Digest
	result.RollbackOf = rollback
	raw, err := json.Marshal(preview.Payload)
	if err != nil {
		return Publication{}, domain.ErrInvalid
	}
	if _, err = tx.Exec(ctx, `INSERT INTO config_revisions(project_id,generation,issuer,subject,request_key,payload,payload_digest,created_at,expires_at,rollback_of) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NULLIF($10,0))`, project, result.Generation, p.Issuer, p.Subject, key, raw, result.Digest, now, now.Add(ttl), rollback); err != nil {
		return Publication{}, opaque(err)
	}
	if _, err = tx.Exec(ctx, "INSERT INTO config_outbox(project_id,generation)VALUES($1,$2)", project, result.Generation); err != nil {
		return Publication{}, opaque(err)
	}
	action := "publication_approve"
	if rollback > 0 {
		action = "publication_rollback"
	}
	if err = originAudit(ctx, tx, p, org, project, project, action); err != nil {
		return Publication{}, err
	}
	return result, opaque(tx.Commit(ctx))
}
