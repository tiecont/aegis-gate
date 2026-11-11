package persistence

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"aegisgate.dev/aegisgate/internal/contracts"
	"github.com/jackc/pgx/v5/pgxpool"
)

func localStore(t *testing.T) (*Store, string) {
	t.Helper()
	if os.Getenv("AEGIS_TENANCY_INTEGRATION") != "1" {
		t.Skip("explicit local PostgreSQL integration requires AEGIS_TENANCY_INTEGRATION=1")
	}
	secret, err := os.ReadFile(filepath.Join("..", "..", "..", "..", ".local", "postgres-password"))
	if err != nil {
		t.Fatal("local PostgreSQL fixture secret unavailable")
	}
	dsn := &url.URL{Scheme: "postgres", User: url.UserPassword("aegisgate_local", strings.TrimSpace(string(secret))), Host: "127.0.0.1:54329", Path: "aegisgate_local"}
	q := dsn.Query()
	q.Set("sslmode", "disable")
	dsn.RawQuery = q.Encode()
	ctx := context.Background()
	admin, err := Open(ctx, dsn.String())
	if err != nil {
		t.Fatal("local PostgreSQL unavailable")
	}
	id, err := contracts.RequestID()
	if err != nil {
		t.Fatal(err)
	}
	schema := "tenant_test_" + strings.ReplaceAll(id, "-", "")
	if _, err = admin.pool.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	q.Set("search_path", schema)
	dsn.RawQuery = q.Encode()
	store, err := Open(ctx, dsn.String())
	if err != nil {
		t.Fatal("isolated store unavailable")
	}
	t.Cleanup(func() { store.Close(); _, _ = admin.pool.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE"); admin.Close() })
	if err = store.Migrate(ctx); err != nil {
		t.Fatalf("migration: %v", err)
	}
	if err = store.Migrate(ctx); err != nil {
		t.Fatal("migration not idempotent")
	}
	return store, dsn.String()
}

func TestIntegrationTenantIsolationIdempotencyAndSession(t *testing.T) {
	s, dsn := localStore(t)
	ctx := context.Background()
	a := Principal{"https://management.example/", "owner-a"}
	b := Principal{"https://management.example/", "owner-b"}
	viewer := Principal{a.Issuer, "viewer-a"}
	orgA, err := s.CreateOrganization(ctx, a, "Tenant A")
	if err != nil {
		t.Fatal(err)
	}
	orgB, err := s.CreateOrganization(ctx, b, "Tenant B")
	if err != nil {
		t.Fatal(err)
	}
	if err = s.AddMember(ctx, a, orgA, viewer, domain.Viewer); err != nil {
		t.Fatal(err)
	}
	projectA, err := s.CreateProject(ctx, a, orgA, "A project")
	if err != nil {
		t.Fatal(err)
	}
	projectB, err := s.CreateProject(ctx, b, orgB, "B project")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.CreateProject(ctx, b, orgA, "cross tenant"); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross-tenant project created")
	}
	if _, err = s.CreateProject(ctx, viewer, orgA, "viewer mutate"); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("viewer created project")
	}
	spec := json.RawMessage(`{"url":"https://origin.example"}`)
	r, err := s.CreateDraft(ctx, a, projectA, "origin", "idem-key-a", spec)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.Get(ctx, b, projectA, "origin", r.ID); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross-tenant read")
	}
	if _, err = s.Get(ctx, b, projectB, "origin", r.ID); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross-project IDOR")
	}
	if _, err = s.List(ctx, b, projectA, "origin", "", 10); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross-tenant list")
	}
	if _, err = s.CreateDraft(ctx, b, projectA, "origin", "cross-key", spec); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross-tenant mutation")
	}
	if _, err = s.Revise(ctx, b, projectA, "origin", r.ID, 1, spec); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross-tenant revision")
	}
	if _, err = s.CreateDraft(ctx, viewer, projectA, "origin", "viewer-key", spec); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("viewer mutation")
	}
	items, err := s.List(ctx, viewer, projectA, "origin", "", 1)
	if err != nil || len(items) != 1 {
		t.Fatal("authorized paginated read")
	}
	if _, err = s.CreateDraft(ctx, a, projectA, "origin", "idem-key-a", json.RawMessage(`{"url":"https://changed.example"}`)); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("idempotency payload substitution")
	}
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for range 8 {
		wg.Go(func() {
			same, e := s.CreateDraft(ctx, a, projectA, "origin", "idem-key-a", spec)
			if e == nil && same.ID != r.ID {
				e = errors.New("idempotency duplicated resource")
			}
			errs <- e
		})
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	updated, err := s.Revise(ctx, a, projectA, "origin", r.ID, 1, json.RawMessage(`{"url":"https://new.example"}`))
	if err != nil || updated.Generation != 2 {
		t.Fatal("revision failed", err)
	}
	if _, err = s.Revise(ctx, a, projectA, "origin", r.ID, 1, spec); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("stale ETag accepted")
	}
	if _, err = s.pool.Exec(ctx, "UPDATE resource_revisions SET spec='{}' WHERE project_id=$1 AND resource_id=$2", projectA, r.ID); err == nil {
		t.Fatal("revision mutable")
	}
	if _, err = s.pool.Exec(ctx, "DELETE FROM audit_events WHERE organization_id=$1", orgA); err == nil {
		t.Fatal("audit mutable")
	}
	reopened, err := Open(ctx, dsn)
	if err != nil {
		t.Fatal("reopen failed")
	}
	defer reopened.Close()
	if got, err := reopened.Get(ctx, a, projectA, "origin", r.ID); err != nil || got.Generation != 2 {
		t.Fatal("durable state missing")
	}
	token := strings.Repeat("a", 43)
	if err = s.CreateSession(ctx, a, token, time.Now().Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if principal, err := reopened.Session(ctx, token); err != nil || principal != a {
		t.Fatal("session not durable")
	}
	if _, err = s.Session(ctx, strings.Repeat("b", 43)); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("forged session accepted")
	}
	if err = s.RevokeSession(ctx, a, token); err != nil {
		t.Fatal(err)
	}
	if _, err = reopened.Session(ctx, token); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("revoked session accepted")
	}
	if err = s.CreateSession(ctx, a, strings.Repeat("c", 43), time.Now().Add(-time.Second)); !errors.Is(err, domain.ErrInvalid) {
		t.Fatal("expired session accepted")
	}
	var hash []byte
	if err = s.pool.QueryRow(ctx, "SELECT token_hash FROM admin_sessions LIMIT 1").Scan(&hash); err != nil || string(hash) == token || len(hash) != 32 {
		t.Fatal("plaintext session storage")
	}
}

func TestNegativeDatabaseTLS(t *testing.T) {
	for _, dsn := range []string{
		"host=db.example dbname=db sslmode=disable",
		"host=db.example dbname=db sslmode=require",
		"host=db.example dbname=db sslmode=verify-ca",
		"host=db.example dbname=db sslmode=prefer",
		"host=db.example dbname=db sslmode=allow",
		"host=127.0.0.1,db.example dbname=db sslmode=disable",
		"host=127.0.0.1,db.example dbname=db sslmode=prefer",
	} {
		cfg, err := pgxpool.ParseConfig(dsn)
		if err != nil {
			t.Fatal("fixture configuration failed")
		}
		if err = validateTLS(cfg); err == nil {
			t.Fatal("nonverifying database TLS or fallback accepted")
		}
	}
	for _, dsn := range []string{
		"host=127.0.0.1 dbname=db sslmode=disable",
		"host=db.example,replica.example dbname=db sslmode=verify-full",
	} {
		cfg, err := pgxpool.ParseConfig(dsn)
		if err != nil || validateTLS(cfg) != nil {
			t.Fatal("safe database configuration rejected")
		}
	}
}
