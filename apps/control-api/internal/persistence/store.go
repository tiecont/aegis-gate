// Package persistence exposes authorized tenant-scoped PostgreSQL operations.
// No caller-provided tenant header participates in selecting the scope.
package persistence

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"aegisgate.dev/aegisgate/internal/contracts"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrations embed.FS

type Principal struct {
	Issuer  string `json:"issuer"`
	Subject string `json:"subject"`
}

func (p Principal) valid() bool {
	return p.Issuer != "" && p.Subject != "" && len(p.Issuer) <= 512 && len(p.Subject) <= 256
}

type Store struct{ pool *pgxpool.Pool }

func Open(ctx context.Context, dsn string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, errors.New("invalid database configuration")
	}
	if err = validateTLS(cfg); err != nil {
		return nil, err
	}
	cfg.MaxConns = 8
	cfg.MinConns = 0
	cfg.MaxConnIdleTime = time.Minute
	cfg.ConnConfig.ConnectTimeout = 3 * time.Second
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "3000"
	cfg.ConnConfig.RuntimeParams["lock_timeout"] = "2000"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, errors.New("database unavailable")
	}
	if err = pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, errors.New("database unavailable")
	}
	return &Store{pool: pool}, nil
}

func validateTLS(cfg *pgxpool.Config) error {
	check := func(host string, config *tls.Config) error {
		if config == nil {
			if host == "127.0.0.1" || host == "::1" {
				return nil
			}
			return errors.New("non-loopback database requires TLS")
		}
		if config.InsecureSkipVerify || config.ServerName == "" {
			return errors.New("database TLS verification required")
		}
		config.MinVersion = tls.VersionTLS12
		return nil
	}
	if err := check(cfg.ConnConfig.Host, cfg.ConnConfig.TLSConfig); err != nil {
		return err
	}
	// pgx expands multi-host and opportunistic TLS modes into fallback entries.
	// Every possible connection must obey the same authentication policy.
	for _, fallback := range cfg.ConnConfig.Fallbacks {
		if err := check(fallback.Host, fallback.TLSConfig); err != nil {
			return err
		}
	}
	return nil
}
func (s *Store) Close() { s.pool.Close() }
func (s *Store) Migrate(ctx context.Context) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(4122026002)"); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "CREATE TABLE IF NOT EXISTS aegis_migrations(version integer PRIMARY KEY,sha256 text NOT NULL)"); err != nil {
		return err
	}
	entries, err := migrations.ReadDir("migrations")
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		version, err := strconv.Atoi(strings.SplitN(entry.Name(), "_", 2)[0])
		if err != nil || version < 1 {
			return errors.New("invalid migration version")
		}
		if err := applyMigration(ctx, tx, entry.Name(), version); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func applyMigration(ctx context.Context, tx pgx.Tx, name string, version int) error {
	sql, err := migrations.ReadFile("migrations/" + name)
	if err != nil {
		return err
	}
	hash := fmt.Sprintf("%x", sha256.Sum256(sql))
	var previous string
	err = tx.QueryRow(ctx, "SELECT sha256 FROM aegis_migrations WHERE version=$1", version).Scan(&previous)
	if err == nil {
		if previous != hash {
			return errors.New("migration checksum mismatch")
		}
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if _, err = tx.Exec(ctx, string(sql)); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "INSERT INTO aegis_migrations(version,sha256) VALUES($1,$2)", version, hash); err != nil {
		return err
	}
	return nil
}

func opaque(err error) error {
	if err == nil {
		return nil
	}
	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		switch pg.Code {
		case "23505", "40001", "40P01":
			return domain.ErrConflict
		case "23503", "22P02", "23514":
			return domain.ErrInvalid
		}
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrDenied
	}
	return errors.New("database operation unavailable")
}

func (s *Store) CreateOrganization(ctx context.Context, p Principal, name string) (string, error) {
	if !p.valid() || len(name) == 0 || len(name) > 128 {
		return "", domain.ErrInvalid
	}
	id, err := contracts.RequestID()
	if err != nil {
		return "", err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", opaque(err)
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, "INSERT INTO organizations(id,name)VALUES($1,$2)", id, name)
	if err != nil {
		return "", opaque(err)
	}
	_, err = tx.Exec(ctx, "INSERT INTO memberships(organization_id,issuer,subject,role)VALUES($1,$2,$3,'owner')", id, p.Issuer, p.Subject)
	if err != nil {
		return "", opaque(err)
	}
	_, err = tx.Exec(ctx, "INSERT INTO audit_events(organization_id,issuer,subject,action,outcome)VALUES($1,$2,$3,'organization_create','allowed')", id, p.Issuer, p.Subject)
	if err != nil {
		return "", opaque(err)
	}
	return id, opaque(tx.Commit(ctx))
}

func orgRole(ctx context.Context, tx pgx.Tx, p Principal, org string) (domain.Role, error) {
	if !p.valid() {
		return "", domain.ErrDenied
	}
	var role domain.Role
	err := tx.QueryRow(ctx, "SELECT m.role FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=$1 AND m.issuer=$2 AND m.subject=$3 AND m.active AND o.status='active' FOR SHARE OF m,o", org, p.Issuer, p.Subject).Scan(&role)
	if err != nil {
		return "", domain.ErrDenied
	}
	return role, nil
}

func (s *Store) AddMember(ctx context.Context, p Principal, org string, member Principal, role domain.Role) error {
	if !member.valid() || !role.Valid() {
		return domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return opaque(err)
	}
	defer tx.Rollback(ctx)
	actorRole, err := orgRole(ctx, tx, p, org)
	if err != nil || !actorRole.Allows("members") {
		return domain.ErrDenied
	}
	// Ownership transfers need a separate reviewed workflow; never remove the
	// owner's last authority through an ordinary membership update.
	if member == p || role == domain.Owner {
		return domain.ErrDenied
	}
	_, err = tx.Exec(ctx, "INSERT INTO memberships(organization_id,issuer,subject,role)VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,issuer,subject)DO UPDATE SET role=EXCLUDED.role,active=true WHERE memberships.role<>'owner'", org, member.Issuer, member.Subject, string(role))
	if err != nil {
		return opaque(err)
	}
	_, err = tx.Exec(ctx, "INSERT INTO audit_events(organization_id,issuer,subject,action,outcome)VALUES($1,$2,$3,'membership_change','allowed')", org, p.Issuer, p.Subject)
	if err != nil {
		return opaque(err)
	}
	return opaque(tx.Commit(ctx))
}

func (s *Store) CreateProject(ctx context.Context, p Principal, org, name string) (string, error) {
	if len(name) == 0 || len(name) > 128 {
		return "", domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", opaque(err)
	}
	defer tx.Rollback(ctx)
	role, err := orgRole(ctx, tx, p, org)
	if err != nil || !role.Allows("projects") {
		return "", domain.ErrDenied
	}
	id, err := contracts.RequestID()
	if err != nil {
		return "", err
	}
	_, err = tx.Exec(ctx, "INSERT INTO projects(id,organization_id,name)VALUES($1,$2,$3)", id, org, name)
	if err != nil {
		return "", opaque(err)
	}
	_, err = tx.Exec(ctx, "INSERT INTO audit_events(organization_id,project_id,issuer,subject,action,outcome,resource_id)VALUES($1,$2,$3,$4,'project_create','allowed',$2)", org, id, p.Issuer, p.Subject)
	if err != nil {
		return "", opaque(err)
	}
	return id, opaque(tx.Commit(ctx))
}

func scoped(ctx context.Context, tx pgx.Tx, p Principal, project, action string) (string, error) {
	if !p.valid() {
		return "", domain.ErrDenied
	}
	var org string
	var role domain.Role
	err := tx.QueryRow(ctx, `SELECT p.organization_id,m.role FROM projects p JOIN organizations o ON o.id=p.organization_id JOIN memberships m ON m.organization_id=p.organization_id WHERE p.id=$1 AND m.issuer=$2 AND m.subject=$3 AND m.active AND p.status='active' AND o.status='active' FOR SHARE OF p,o,m`, project, p.Issuer, p.Subject).Scan(&org, &role)
	if err != nil || !role.Allows(action) {
		return "", domain.ErrDenied
	}
	return org, nil
}

type Resource struct {
	ID         string          `json:"id"`
	ProjectID  string          `json:"project_id"`
	Kind       string          `json:"kind"`
	Generation int64           `json:"generation"`
	Spec       json.RawMessage `json:"spec"`
}

func action(kind string) string {
	switch kind {
	case "domain":
		return "domains"
	case "origin":
		return "origins"
	case "route":
		return "routes"
	case "policy":
		return "policies"
	}
	return "invalid"
}

// CreateDraft accepts only already validated specifications from the application
// layer. Every write/retry remains bound to the authenticated issuer+subject.
func (s *Store) CreateDraft(ctx context.Context, p Principal, project, kind, key string, spec json.RawMessage) (Resource, error) {
	var empty Resource
	if (kind != "origin" && kind != "policy") || len(key) < 8 || len(key) > 128 || len(spec) > 16384 || !json.Valid(spec) {
		return empty, domain.ErrInvalid
	}
	digest := sha256.Sum256(append([]byte(kind+"\x00"), spec...))
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return empty, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, action(kind))
	if err != nil {
		return empty, err
	}
	result, err := createDraft(ctx, tx, p, org, project, kind, key, spec, digest)
	if err != nil {
		return empty, err
	}
	return result, opaque(tx.Commit(ctx))
}

func createDraft(ctx context.Context, tx pgx.Tx, p Principal, org, project, kind, key string, spec json.RawMessage, digest [32]byte) (Resource, error) {
	var empty Resource
	// Serializes retries for one actor/project/key without blocking other tenants.
	lockKey, err := json.Marshal([]string{project, p.Issuer, p.Subject, key})
	if err != nil {
		return empty, domain.ErrInvalid
	}
	_, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", string(lockKey))
	if err != nil {
		return empty, opaque(err)
	}
	var oldHash []byte
	var oldID string
	err = tx.QueryRow(ctx, "SELECT request_hash,resource_id FROM mutation_keys WHERE project_id=$1 AND issuer=$2 AND subject=$3 AND idempotency_key=$4", project, p.Issuer, p.Subject, key).Scan(&oldHash, &oldID)
	if err == nil {
		if subtle.ConstantTimeCompare(oldHash, digest[:]) != 1 {
			return empty, domain.ErrConflict
		}
		var result Resource
		err = tx.QueryRow(ctx, `SELECT r.id,r.project_id,r.kind,v.generation,v.spec FROM resources r
			JOIN resource_revisions v ON v.project_id=r.project_id AND v.resource_id=r.id AND v.generation=1
			WHERE r.project_id=$1 AND r.id=$2`, project, oldID).Scan(&result.ID, &result.ProjectID, &result.Kind, &result.Generation, &result.Spec)
		return result, opaque(err)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return empty, opaque(err)
	}
	id, err := contracts.RequestID()
	if err != nil {
		return empty, err
	}
	_, err = tx.Exec(ctx, "INSERT INTO resources(id,project_id,kind,generation,spec)VALUES($1,$2,$3,1,$4)", id, project, kind, spec)
	if err != nil {
		return empty, opaque(err)
	}
	_, err = tx.Exec(ctx, "INSERT INTO resource_revisions(project_id,resource_id,generation,spec)VALUES($1,$2,1,$3)", project, id, spec)
	if err != nil {
		return empty, opaque(err)
	}
	_, err = tx.Exec(ctx, "INSERT INTO mutation_keys(project_id,issuer,subject,idempotency_key,request_hash,resource_id)VALUES($1,$2,$3,$4,$5,$6)", project, p.Issuer, p.Subject, key, digest[:], id)
	if err != nil {
		return empty, opaque(err)
	}
	_, err = tx.Exec(ctx, "INSERT INTO audit_events(organization_id,project_id,issuer,subject,action,outcome,resource_id)VALUES($1,$2,$3,$4,$5,'allowed',$6)", org, project, p.Issuer, p.Subject, kind+"_create", id)
	if err != nil {
		return empty, opaque(err)
	}
	return Resource{ID: id, ProjectID: project, Kind: kind, Generation: 1, Spec: spec}, nil
}

func (s *Store) Get(ctx context.Context, p Principal, project, kind, id string) (Resource, error) {
	var result Resource
	if action(kind) == "invalid" {
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
	err = tx.QueryRow(ctx, "SELECT id,project_id,kind,generation,spec FROM resources WHERE project_id=$1 AND kind=$2 AND id=$3", project, kind, id).Scan(&result.ID, &result.ProjectID, &result.Kind, &result.Generation, &result.Spec)
	return result, opaque(err)
}

func (s *Store) List(ctx context.Context, p Principal, project, kind, after string, limit int) ([]Resource, error) {
	if action(kind) == "invalid" || limit < 1 || limit > 100 {
		return nil, domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = scoped(ctx, tx, p, project, "read"); err != nil {
		return nil, err
	}
	if after == "" {
		after = "00000000-0000-0000-0000-000000000000"
	}
	rows, err := tx.Query(ctx, "SELECT id,project_id,kind,generation,spec FROM resources WHERE project_id=$1 AND kind=$2 AND id>$3 ORDER BY id LIMIT $4", project, kind, after, limit)
	if err != nil {
		return nil, opaque(err)
	}
	defer rows.Close()
	result := []Resource{}
	for rows.Next() {
		var r Resource
		if err = rows.Scan(&r.ID, &r.ProjectID, &r.Kind, &r.Generation, &r.Spec); err != nil {
			return nil, opaque(err)
		}
		result = append(result, r)
	}
	return result, opaque(rows.Err())
}

func (s *Store) Revise(ctx context.Context, p Principal, project, kind, id string, expected int64, spec json.RawMessage) (Resource, error) {
	var result Resource
	if (kind != "origin" && kind != "policy") || expected < 1 || expected >= 9007199254740991 || len(spec) > 16384 || !json.Valid(spec) {
		return result, domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return result, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, action(kind))
	if err != nil {
		return result, err
	}
	result, err = reviseDraft(ctx, tx, p, org, project, kind, id, expected, spec)
	if err != nil {
		return result, err
	}
	return result, opaque(tx.Commit(ctx))
}

func reviseDraft(ctx context.Context, tx pgx.Tx, p Principal, org, project, kind, id string, expected int64, spec json.RawMessage) (Resource, error) {
	var result Resource
	err := tx.QueryRow(ctx, "UPDATE resources SET generation=generation+1,spec=$5 WHERE project_id=$1 AND kind=$2 AND id=$3 AND generation=$4 RETURNING id,project_id,kind,generation,spec", project, kind, id, expected, spec).Scan(&result.ID, &result.ProjectID, &result.Kind, &result.Generation, &result.Spec)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, domain.ErrConflict
	}
	if err != nil {
		return result, opaque(err)
	}
	_, err = tx.Exec(ctx, "INSERT INTO resource_revisions(project_id,resource_id,generation,spec)VALUES($1,$2,$3,$4)", project, id, result.Generation, spec)
	if err != nil {
		return result, opaque(err)
	}
	_, err = tx.Exec(ctx, "INSERT INTO audit_events(organization_id,project_id,issuer,subject,action,outcome,resource_id)VALUES($1,$2,$3,$4,$5,'allowed',$6)", org, project, p.Issuer, p.Subject, kind+"_revise", id)
	if err != nil {
		return result, opaque(err)
	}
	return result, nil
}

func TokenHash(token string) []byte { sum := sha256.Sum256([]byte(token)); return sum[:] }
func (s *Store) CreateSession(ctx context.Context, p Principal, token string, expiry time.Time) error {
	if !p.valid() || len(token) < 40 || len(token) > 128 || !expiry.After(time.Now()) || expiry.After(time.Now().Add(time.Hour)) {
		return domain.ErrInvalid
	}
	_, err := s.pool.Exec(ctx, "INSERT INTO admin_sessions(token_hash,issuer,subject,expires_at)VALUES($1,$2,$3,$4)", TokenHash(token), p.Issuer, p.Subject, expiry)
	return opaque(err)
}
func (s *Store) Session(ctx context.Context, token string) (Principal, error) {
	var p Principal
	if len(token) < 40 || len(token) > 128 {
		return p, domain.ErrDenied
	}
	err := s.pool.QueryRow(ctx, "SELECT issuer,subject FROM admin_sessions WHERE token_hash=$1 AND expires_at>now() AND revoked_at IS NULL", TokenHash(token)).Scan(&p.Issuer, &p.Subject)
	if err != nil {
		return Principal{}, domain.ErrDenied
	}
	return p, nil
}
func (s *Store) RevokeSession(ctx context.Context, p Principal, token string) error {
	_, err := s.pool.Exec(ctx, "UPDATE admin_sessions SET revoked_at=now() WHERE token_hash=$1 AND issuer=$2 AND subject=$3", TokenHash(token), p.Issuer, p.Subject)
	return opaque(err)
}

// TrimDiagnostic keeps SQL/DSN details out of callers; domain errors are opaque.
func TrimDiagnostic(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, domain.ErrDenied) {
		return "resource unavailable"
	}
	return strings.TrimSpace("operation unavailable")
}
