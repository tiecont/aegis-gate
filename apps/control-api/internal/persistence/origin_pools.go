package persistence

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/url"
	"strings"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"aegisgate.dev/aegisgate/internal/contracts"
	"github.com/jackc/pgx/v5"
)

type OriginPool struct {
	ID         string    `json:"id"`
	ProjectID  string    `json:"project_id"`
	Name       string    `json:"name"`
	State      string    `json:"state"`
	Generation int64     `json:"generation"`
	CreatedAt  time.Time `json:"created_at"`
}
type Endpoint struct {
	ID         string    `json:"id"`
	PoolID     string    `json:"pool_id"`
	ProjectID  string    `json:"project_id"`
	URL        string    `json:"url"`
	Hostname   string    `json:"hostname"`
	Port       int       `json:"port"`
	State      string    `json:"state"`
	Generation int64     `json:"generation"`
	CreatedAt  time.Time `json:"created_at"`
}
type PoolRevision struct {
	Pool      OriginPool `json:"pool"`
	Endpoints []Endpoint `json:"endpoints"`
}

func validState(state string) bool {
	return state == "active" || state == "disabled" || state == "retired"
}
func validPoolName(name string) bool {
	return len(name) > 0 && len(name) <= 128 && strings.TrimSpace(name) == name && !strings.ContainsAny(name, "\x00\r\n")
}
func scanPool(row pgx.Row) (OriginPool, error) {
	var v OriginPool
	err := row.Scan(&v.ID, &v.ProjectID, &v.Name, &v.State, &v.Generation, &v.CreatedAt)
	return v, opaque(err)
}
func scanEndpoint(row pgx.Row) (Endpoint, error) {
	var v Endpoint
	err := row.Scan(&v.ID, &v.PoolID, &v.ProjectID, &v.URL, &v.Hostname, &v.Port, &v.State, &v.Generation, &v.CreatedAt)
	return v, opaque(err)
}

func originKey(ctx context.Context, tx pgx.Tx, p Principal, project, key string, request any) (json.RawMessage, []byte, error) {
	if len(key) < 8 || len(key) > 128 {
		return nil, nil, domain.ErrInvalid
	}
	raw, _ := json.Marshal(request)
	sum := sha256.Sum256(raw)
	lock, _ := json.Marshal([]string{project, p.Issuer, p.Subject, key})
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,4))", string(lock)); err != nil {
		return nil, nil, opaque(err)
	}
	var hash []byte
	var response json.RawMessage
	err := tx.QueryRow(ctx, "SELECT request_hash,response FROM origin_mutation_keys WHERE project_id=$1 AND issuer=$2 AND subject=$3 AND key=$4", project, p.Issuer, p.Subject, key).Scan(&hash, &response)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, sum[:], nil
	}
	if err != nil {
		return nil, nil, opaque(err)
	}
	if subtle.ConstantTimeCompare(hash, sum[:]) != 1 {
		return nil, nil, domain.ErrConflict
	}
	return response, sum[:], nil
}
func saveOriginKey(ctx context.Context, tx pgx.Tx, p Principal, project, key string, hash []byte, value any) error {
	raw, _ := json.Marshal(value)
	_, err := tx.Exec(ctx, "INSERT INTO origin_mutation_keys(project_id,issuer,subject,key,request_hash,response) VALUES($1,$2,$3,$4,$5,$6)", project, p.Issuer, p.Subject, key, hash, raw)
	return opaque(err)
}
func originAudit(ctx context.Context, tx pgx.Tx, p Principal, org, project, id, action string) error {
	_, err := tx.Exec(ctx, "INSERT INTO audit_events(organization_id,project_id,issuer,subject,action,outcome,resource_id) VALUES($1,$2,$3,$4,$5,'allowed',$6)", org, project, p.Issuer, p.Subject, action, id)
	return opaque(err)
}

func poolSnapshot(ctx context.Context, tx pgx.Tx, project, id string) (PoolRevision, error) {
	var result PoolRevision
	var err error
	result.Pool, err = scanPool(tx.QueryRow(ctx, "SELECT id,project_id,name,state,generation,created_at FROM origin_pools WHERE project_id=$1 AND id=$2", project, id))
	if err != nil {
		return result, err
	}
	rows, err := tx.Query(ctx, "SELECT id,pool_id,project_id,url,hostname,port,state,generation,created_at FROM origin_endpoints WHERE project_id=$1 AND pool_id=$2 ORDER BY id", project, id)
	if err != nil {
		return result, opaque(err)
	}
	defer rows.Close()
	result.Endpoints = []Endpoint{}
	for rows.Next() {
		v, e := scanEndpoint(rows)
		if e != nil {
			return result, e
		}
		result.Endpoints = append(result.Endpoints, v)
	}
	return result, opaque(rows.Err())
}
func recordPool(ctx context.Context, tx pgx.Tx, project, id string, bump bool) error {
	if bump {
		if _, err := tx.Exec(ctx, "UPDATE origin_pools SET generation=generation+1 WHERE project_id=$1 AND id=$2", project, id); err != nil {
			return opaque(err)
		}
	}
	v, err := poolSnapshot(ctx, tx, project, id)
	if err != nil {
		return err
	}
	raw, _ := json.Marshal(v)
	_, err = tx.Exec(ctx, "INSERT INTO origin_pool_revisions(project_id,pool_id,generation,spec) VALUES($1,$2,$3,$4)", project, id, v.Pool.Generation, raw)
	return opaque(err)
}

func (s *Store) CreateOriginPool(ctx context.Context, p Principal, project, name, key string) (OriginPool, error) {
	var v OriginPool
	if !validPoolName(name) {
		return v, domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return v, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, "origins")
	if err != nil {
		return v, err
	}
	old, hash, err := originKey(ctx, tx, p, project, key, []string{"pool", name})
	if err != nil {
		return v, err
	}
	if old != nil {
		err = json.Unmarshal(old, &v)
		return v, err
	}
	id, err := contracts.RequestID()
	if err != nil {
		return v, err
	}
	v, err = scanPool(tx.QueryRow(ctx, "INSERT INTO origin_pools(project_id,id,name) VALUES($1,$2,$3) RETURNING id,project_id,name,state,generation,created_at", project, id, name))
	if err != nil {
		return v, err
	}
	if err = recordPool(ctx, tx, project, id, false); err != nil {
		return v, err
	}
	if err = originAudit(ctx, tx, p, org, project, id, "origin_pool_create"); err != nil {
		return v, err
	}
	if err = saveOriginKey(ctx, tx, p, project, key, hash, v); err != nil {
		return v, err
	}
	return v, opaque(tx.Commit(ctx))
}
func (s *Store) OriginPool(ctx context.Context, p Principal, project, id string) (PoolRevision, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return PoolRevision{}, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = scoped(ctx, tx, p, project, "read"); err != nil {
		return PoolRevision{}, err
	}
	return poolSnapshot(ctx, tx, project, id)
}
func (s *Store) ListOriginPools(ctx context.Context, p Principal, project, after string, limit int) ([]OriginPool, error) {
	if limit < 1 || limit > 100 {
		return nil, domain.ErrInvalid
	}
	if after == "" {
		after = "00000000-0000-0000-0000-000000000000"
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = scoped(ctx, tx, p, project, "read"); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, "SELECT id,project_id,name,state,generation,created_at FROM origin_pools WHERE project_id=$1 AND id>$2 ORDER BY id LIMIT $3", project, after, limit)
	if err != nil {
		return nil, opaque(err)
	}
	defer rows.Close()
	items := []OriginPool{}
	for rows.Next() {
		v, e := scanPool(rows)
		if e != nil {
			return nil, e
		}
		items = append(items, v)
	}
	return items, opaque(rows.Err())
}
func lockPool(ctx context.Context, tx pgx.Tx, project, pool string, expected int64) error {
	var generation int64
	var state string
	if err := tx.QueryRow(ctx, "SELECT generation,state FROM origin_pools WHERE project_id=$1 AND id=$2 FOR UPDATE", project, pool).Scan(&generation, &state); err != nil {
		return opaque(err)
	}
	if generation != expected || state == "retired" {
		return domain.ErrConflict
	}
	return nil
}
func (s *Store) ReviseOriginPool(ctx context.Context, p Principal, project, id, name, state string, expected int64) (PoolRevision, error) {
	if !validPoolName(name) || !validState(state) {
		return PoolRevision{}, domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return PoolRevision{}, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, "origins")
	if err != nil {
		return PoolRevision{}, err
	}
	if err = lockPool(ctx, tx, project, id, expected); err != nil {
		return PoolRevision{}, err
	}
	if state != "active" {
		var used bool
		if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM active_route_approvals a JOIN route_approvals d ON d.project_id=a.project_id AND d.route_id=a.route_id AND d.decision_id=a.decision_id WHERE a.project_id=$1 AND NOT a.retired AND d.origin_pool_id=$2)", project, id).Scan(&used); err != nil {
			return PoolRevision{}, opaque(err)
		}
		if used {
			return PoolRevision{}, domain.ErrConflict
		}
	}
	if _, err = tx.Exec(ctx, "UPDATE origin_pools SET name=$3,state=$4 WHERE project_id=$1 AND id=$2", project, id, name, state); err != nil {
		return PoolRevision{}, opaque(err)
	}
	if err = recordPool(ctx, tx, project, id, true); err != nil {
		return PoolRevision{}, err
	}
	if err = originAudit(ctx, tx, p, org, project, id, "origin_pool_revise"); err != nil {
		return PoolRevision{}, err
	}
	v, err := poolSnapshot(ctx, tx, project, id)
	if err != nil {
		return v, err
	}
	return v, opaque(tx.Commit(ctx))
}
func (s *Store) CreateEndpoint(ctx context.Context, p Principal, project, pool, raw, key string, expected int64, resolver domain.Resolver) (Endpoint, error) {
	var v Endpoint
	// Scope before DNS, including direct persistence callers.
	if err := s.Authorize(ctx, p, project, "origin"); err != nil {
		return v, err
	}
	lookup, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	canonical, err := domain.Origin(lookup, raw, resolver)
	if err != nil {
		return v, err
	}
	u, _ := url.Parse(canonical)
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return v, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, "origins")
	if err != nil {
		return v, err
	}
	old, hash, err := originKey(ctx, tx, p, project, key, []any{"endpoint", pool, canonical, expected})
	if err != nil {
		return v, err
	}
	if old != nil {
		err = json.Unmarshal(old, &v)
		return v, err
	}
	if err = lockPool(ctx, tx, project, pool, expected); err != nil {
		return v, err
	}
	id, err := contracts.RequestID()
	if err != nil {
		return v, err
	}
	v, err = scanEndpoint(tx.QueryRow(ctx, "INSERT INTO origin_endpoints(project_id,pool_id,id,url,hostname) VALUES($1,$2,$3,$4,$5) RETURNING id,pool_id,project_id,url,hostname,port,state,generation,created_at", project, pool, id, canonical, u.Hostname()))
	if err != nil {
		return v, err
	}
	if _, err = tx.Exec(ctx, "INSERT INTO origin_endpoint_revisions(project_id,endpoint_id,generation,url,state) VALUES($1,$2,1,$3,'active')", project, id, canonical); err != nil {
		return v, opaque(err)
	}
	if err = recordPool(ctx, tx, project, pool, true); err != nil {
		return v, err
	}
	if err = originAudit(ctx, tx, p, org, project, id, "origin_endpoint_create"); err != nil {
		return v, err
	}
	if err = saveOriginKey(ctx, tx, p, project, key, hash, v); err != nil {
		return v, err
	}
	return v, opaque(tx.Commit(ctx))
}
func (s *Store) ReviseEndpoint(ctx context.Context, p Principal, project, pool, id, raw, state string, expected int64, resolver domain.Resolver) (Endpoint, error) {
	var v Endpoint
	if !validState(state) {
		return v, domain.ErrInvalid
	}
	if err := s.Authorize(ctx, p, project, "origin"); err != nil {
		return v, err
	}
	lookup, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	canonical, err := domain.Origin(lookup, raw, resolver)
	if err != nil {
		return v, err
	}
	u, _ := url.Parse(canonical)
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return v, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, "origins")
	if err != nil {
		return v, err
	}
	var parentID string
	if err = tx.QueryRow(ctx, "SELECT id FROM origin_pools WHERE project_id=$1 AND id=$2 AND state<>'retired' FOR UPDATE", project, pool).Scan(&parentID); errors.Is(err, pgx.ErrNoRows) {
		return v, domain.ErrConflict
	} else if err != nil {
		return v, opaque(err)
	}
	var oldState string
	if err = tx.QueryRow(ctx, "SELECT state FROM origin_endpoints WHERE project_id=$1 AND pool_id=$2 AND id=$3", project, pool, id).Scan(&oldState); err != nil {
		return v, opaque(err)
	}
	if oldState == "retired" {
		return v, domain.ErrConflict
	}
	v, err = scanEndpoint(tx.QueryRow(ctx, "UPDATE origin_endpoints SET url=$5,hostname=$6,state=$7,generation=generation+1 WHERE project_id=$1 AND pool_id=$2 AND id=$3 AND generation=$4 RETURNING id,pool_id,project_id,url,hostname,port,state,generation,created_at", project, pool, id, expected, canonical, u.Hostname(), state))
	if errors.Is(err, domain.ErrDenied) {
		return v, domain.ErrConflict
	}
	if err != nil {
		return v, err
	}
	if _, err = tx.Exec(ctx, "INSERT INTO origin_endpoint_revisions(project_id,endpoint_id,generation,url,state) VALUES($1,$2,$3,$4,$5)", project, id, v.Generation, v.URL, v.State); err != nil {
		return v, opaque(err)
	}
	if err = recordPool(ctx, tx, project, pool, true); err != nil {
		return v, err
	}
	if err = originAudit(ctx, tx, p, org, project, id, "origin_endpoint_revise"); err != nil {
		return v, err
	}
	return v, opaque(tx.Commit(ctx))
}
func (s *Store) ApproveOriginPool(ctx context.Context, p Principal, project, id string, expected int64) (PoolRevision, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return PoolRevision{}, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, "approve")
	if err != nil {
		return PoolRevision{}, err
	}
	if err = lockPool(ctx, tx, project, id, expected); err != nil {
		return PoolRevision{}, err
	}
	v, err := poolSnapshot(ctx, tx, project, id)
	if err != nil {
		return v, err
	}
	count := 0
	for _, ep := range v.Endpoints {
		if ep.State == "active" {
			count++
		}
	}
	if v.Pool.State != "active" || count == 0 {
		return v, domain.ErrConflict
	}
	if _, err = tx.Exec(ctx, "INSERT INTO origin_pool_approvals(project_id,pool_id,generation,issuer,subject) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", project, id, expected, p.Issuer, p.Subject); err != nil {
		return v, opaque(err)
	}
	if err = originAudit(ctx, tx, p, org, project, id, "origin_pool_approve"); err != nil {
		return v, err
	}
	return v, opaque(tx.Commit(ctx))
}
func (s *Store) OriginPoolRevision(ctx context.Context, p Principal, project, id string, generation int64) (PoolRevision, error) {
	var v PoolRevision
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return v, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = scoped(ctx, tx, p, project, "read"); err != nil {
		return v, err
	}
	var raw []byte
	if err = tx.QueryRow(ctx, "SELECT spec FROM origin_pool_revisions WHERE project_id=$1 AND pool_id=$2 AND generation=$3", project, id, generation).Scan(&raw); err != nil {
		return v, opaque(err)
	}
	err = json.Unmarshal(raw, &v)
	return v, err
}

func (s *Store) Endpoints(ctx context.Context, p Principal, project, pool, after string, limit int) ([]Endpoint, error) {
	if limit < 1 || limit > 100 {
		return nil, domain.ErrInvalid
	}
	v, err := s.OriginPool(ctx, p, project, pool)
	if err != nil {
		return nil, err
	}
	items := []Endpoint{}
	for _, ep := range v.Endpoints {
		if ep.ID > after && len(items) < limit {
			items = append(items, ep)
		}
	}
	return items, nil
}
func (s *Store) Endpoint(ctx context.Context, p Principal, project, pool, id string, generation int64) (Endpoint, error) {
	var v Endpoint
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return v, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = scoped(ctx, tx, p, project, "read"); err != nil {
		return v, err
	}
	v, err = scanEndpoint(tx.QueryRow(ctx, "SELECT id,pool_id,project_id,url,hostname,port,state,generation,created_at FROM origin_endpoints WHERE project_id=$1 AND pool_id=$2 AND id=$3", project, pool, id))
	if err != nil || generation == 0 {
		return v, err
	}
	if err = tx.QueryRow(ctx, "SELECT url,state,generation FROM origin_endpoint_revisions WHERE project_id=$1 AND endpoint_id=$2 AND generation=$3", project, id, generation).Scan(&v.URL, &v.State, &v.Generation); err != nil {
		return v, opaque(err)
	}
	u, _ := url.Parse(v.URL)
	v.Hostname = u.Hostname()
	return v, nil
}

type PoolPreviewResult struct {
	From    PoolRevision  `json:"from"`
	To      PoolRevision  `json:"to"`
	Changes []FieldChange `json:"changes"`
}

func (s *Store) PoolPreview(ctx context.Context, p Principal, project, id string, from, to int64) (PoolPreviewResult, error) {
	var v PoolPreviewResult
	var err error
	if from < 1 || to < from {
		return v, domain.ErrInvalid
	}
	v.From, err = s.OriginPoolRevision(ctx, p, project, id, from)
	if err != nil {
		return v, err
	}
	v.To, err = s.OriginPoolRevision(ctx, p, project, id, to)
	if err != nil {
		return v, err
	}
	v.Changes = []FieldChange{}
	if v.From.Pool.Name != v.To.Pool.Name {
		v.Changes = append(v.Changes, FieldChange{"name", v.From.Pool.Name, v.To.Pool.Name})
	}
	if v.From.Pool.State != v.To.Pool.State {
		v.Changes = append(v.Changes, FieldChange{"state", v.From.Pool.State, v.To.Pool.State})
	}
	a, _ := json.Marshal(v.From.Endpoints)
	b, _ := json.Marshal(v.To.Endpoints)
	if string(a) != string(b) {
		v.Changes = append(v.Changes, FieldChange{"endpoints", v.From.Endpoints, v.To.Endpoints})
	}
	return v, nil
}
