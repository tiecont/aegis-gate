package persistence

import (
	"context"
	"encoding/json"
	"reflect"
	"sort"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
)

type FieldChange struct {
	Field  string `json:"field"`
	Before any    `json:"before"`
	After  any    `json:"after"`
}
type RevisionPreview struct {
	From       Resource      `json:"from"`
	To         Resource      `json:"to"`
	Changes    []FieldChange `json:"changes"`
	Approvable bool          `json:"approvable"`
	Reasons    []string      `json:"reasons"`
}

func (s *Store) Preview(ctx context.Context, p Principal, project, kind, id string, from, to int64) (RevisionPreview, error) {
	var v RevisionPreview
	var err error
	if from < 1 || to < from {
		return v, domain.ErrInvalid
	}
	v.From, err = s.Revision(ctx, p, project, kind, id, from)
	if err != nil {
		return v, err
	}
	v.To, err = s.Revision(ctx, p, project, kind, id, to)
	if err != nil {
		return v, err
	}
	var a, b map[string]any
	if json.Unmarshal(v.From.Spec, &a) != nil || json.Unmarshal(v.To.Spec, &b) != nil {
		return v, domain.ErrInvalid
	}
	keys := map[string]bool{}
	for key := range a {
		keys[key] = true
	}
	for key := range b {
		keys[key] = true
	}
	ordered := []string{}
	for key := range keys {
		ordered = append(ordered, key)
	}
	sort.Strings(ordered)
	v.Changes = []FieldChange{}
	v.Reasons = []string{}
	for _, key := range ordered {
		if !reflect.DeepEqual(a[key], b[key]) {
			v.Changes = append(v.Changes, FieldChange{key, a[key], b[key]})
		}
	}
	v.Approvable = true
	current, err := s.Get(ctx, p, project, kind, id)
	if err != nil {
		return v, err
	}
	if current.Generation != to {
		v.Reasons = append(v.Reasons, "stale_revision")
	}
	if kind == "route" {
		var route RouteSpec
		if json.Unmarshal(v.To.Spec, &route) != nil || !route.Valid() {
			v.Reasons = append(v.Reasons, "invalid_route")
		} else {
			claim, e := s.DomainClaim(ctx, p, project, route.DomainID)
			if e != nil {
				return v, e
			}
			if (claim.State != "verified" && claim.State != "active") || !claim.ExpiresAt.After(time.Now()) {
				v.Reasons = append(v.Reasons, "domain_not_verified")
			}
			policy, e := s.Get(ctx, p, project, "policy", route.PolicyID)
			if e != nil {
				return v, e
			}
			var spec domain.Policy
			if json.Unmarshal(policy.Spec, &spec) != nil || spec.Validate() != nil {
				v.Reasons = append(v.Reasons, "invalid_policy")
			}
			if route.OriginPoolID != "" {
				pool, e := s.OriginPool(ctx, p, project, route.OriginPoolID)
				if e != nil {
					return v, e
				}
				var approved bool
				e = s.pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM origin_pool_approvals WHERE project_id=$1 AND pool_id=$2 AND generation=$3)", project, route.OriginPoolID, pool.Pool.Generation).Scan(&approved)
				if e != nil {
					return v, opaque(e)
				}
				if !approved || pool.Pool.State != "active" {
					v.Reasons = append(v.Reasons, "pool_not_approved")
				}
			}
			var collision bool
			if e = s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM active_route_approvals live JOIN route_approvals a ON a.decision_id=live.decision_id JOIN resource_revisions r ON r.project_id=a.project_id AND r.resource_id=a.route_id AND r.generation=a.route_generation JOIN domain_claims d ON d.project_id=a.project_id AND d.resource_id=a.domain_id WHERE live.project_id=$1 AND NOT live.retired AND a.domain_id=$2 AND a.route_id<>$3 AND d.state='active' AND d.expires_at>now() AND r.spec->>'path'=$4 AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(r.spec->'methods') m WHERE m=ANY($5)))`, project, route.DomainID, id, route.Path, route.Methods).Scan(&collision); e != nil {
				return v, opaque(e)
			}
			if collision {
				v.Reasons = append(v.Reasons, "route_collision")
			}
		}
	}
	v.Approvable = len(v.Reasons) == 0
	return v, nil
}
