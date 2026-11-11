package configrollout

import (
	"context"
	"crypto/rand"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func postgresFixture(t *testing.T) (*PostgreSQLStore, *PostgreSQLStore, *pgxpool.Pool, string) {
	t.Helper()
	if os.Getenv("AEGIS_TENANCY_INTEGRATION") != "1" {
		t.Skip("explicit owned local PostgreSQL fixture requires AEGIS_TENANCY_INTEGRATION=1")
	}
	fixtureRoot := os.Getenv("AEGIS_FIXTURE_ROOT")
	if fixtureRoot == "" {
		fixtureRoot = filepath.Join("..", "..")
	}
	secret, err := os.ReadFile(filepath.Join(fixtureRoot, ".local", "postgres-password"))
	if err != nil {
		t.Fatal("local PostgreSQL fixture secret unavailable")
	}
	u := &url.URL{Scheme: "postgres", User: url.UserPassword("aegisgate_local", strings.TrimSpace(string(secret))), Host: "127.0.0.1:54329", Path: "aegisgate_local"}
	q := u.Query()
	q.Set("sslmode", "disable")
	u.RawQuery = q.Encode()
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, u.String())
	if err != nil {
		t.Fatal("fixture pool unavailable")
	}
	token := strings.ToLower(rand.Text()[:16])
	schema := "rollout_test_" + token
	role := "rollout_run_" + token
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize()); err != nil {
		t.Fatal("fixture schema unavailable")
	}
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	ownerPool, err := pgxpool.New(ctx, u.String())
	if err != nil {
		t.Fatal("owner pool unavailable")
	}
	owner, _ := NewPostgreSQLStore(ownerPool)
	if err = owner.Migrate(ctx); err != nil {
		t.Fatal("rollout migration failed", err)
	}
	password := rand.Text()
	if _, err = admin.Exec(ctx, "CREATE ROLE "+pgx.Identifier{role}.Sanitize()+" LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION PASSWORD '"+password+"'"); err != nil {
		t.Fatal("fixture runtime role unavailable")
	}
	for _, sql := range []string{"GRANT USAGE ON SCHEMA " + pgx.Identifier{schema}.Sanitize() + " TO " + pgx.Identifier{role}.Sanitize(), "GRANT SELECT,INSERT,UPDATE ON " + pgx.Identifier{schema, "config_rollout_state"}.Sanitize() + " TO " + pgx.Identifier{role}.Sanitize(), "GRANT SELECT,INSERT ON " + pgx.Identifier{schema, "config_rollout_audit"}.Sanitize() + " TO " + pgx.Identifier{role}.Sanitize()} {
		if _, err = admin.Exec(ctx, sql); err != nil {
			t.Fatal("fixture grant failed")
		}
	}
	u.User = url.UserPassword(role, password)
	runtimePool, err := pgxpool.New(ctx, u.String())
	if err != nil {
		t.Fatal("runtime pool unavailable")
	}
	runtime, _ := NewPostgreSQLStore(runtimePool)
	t.Cleanup(func() {
		runtimePool.Close()
		ownerPool.Close()
		admin.Exec(ctx, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
		admin.Exec(ctx, "DROP ROLE "+pgx.Identifier{role}.Sanitize())
		admin.Close()
	})
	return runtime, owner, ownerPool, role
}

func TestIntegrationDurableCASAuditRecoveryAndPermissions(t *testing.T) {
	runtime, owner, ownerPool, role := postgresFixture(t)
	ctx := context.Background()
	now := time.Now().UTC()
	deliver := &delivery{}
	c, _ := New(runtime, deliver, testAdmission{}, func() time.Time { return now })
	n := notice(1)
	if err := c.Begin(ctx, n, edges(), policy(), 0); err != nil {
		t.Fatal(err)
	}
	if err := c.Tick(ctx, n.DeploymentID); err != nil {
		t.Fatal(err)
	}
	state, err := runtime.Load(ctx, n.DeploymentID)
	if err != nil {
		t.Fatal(err)
	}
	var successes int
	var mu sync.Mutex
	var workers sync.WaitGroup
	for i := 0; i < 2; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			next := cloneState(state)
			next.Version++
			next.Sequence++
			next.EventCount++
			event := Event{Sequence: next.Sequence, At: now, Type: "concurrent_test", Generation: n.Generation, Digest: n.Digest}
			if runtime.Commit(ctx, state.Version, next, []Event{event}) == nil {
				mu.Lock()
				successes++
				mu.Unlock()
			}
		}()
	}
	workers.Wait()
	if successes != 1 {
		t.Fatal("CAS accepted conflicting writers", successes)
	}
	before, _ := runtime.Load(ctx, n.DeploymentID)
	if _, err = ownerPool.Exec(ctx, "REVOKE INSERT ON config_rollout_audit FROM "+pgx.Identifier{role}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	if c.Record(ctx, "canary-a", report(n, true, "applied"), true) == nil {
		t.Fatal("audit failure accepted state transition")
	}
	after, _ := runtime.Load(ctx, n.DeploymentID)
	if before.Version != after.Version {
		t.Fatal("partial state survived transaction rollback")
	}
	ownerPool.Exec(ctx, "GRANT INSERT ON config_rollout_audit TO "+pgx.Identifier{role}.Sanitize())
	restarted, _ := New(runtime, deliver, testAdmission{}, func() time.Time { return now })
	if err = restarted.Record(ctx, "canary-a", report(n, true, "applied"), true); err != nil {
		t.Fatal(err)
	}
	if err = restarted.Record(ctx, "canary-b", report(n, true, "applied"), true); err != nil {
		t.Fatal(err)
	}
	if err = restarted.Tick(ctx, n.DeploymentID); err != nil {
		t.Fatal(err)
	}
	for _, query := range []string{"UPDATE config_rollout_audit SET event='{}'::jsonb", "DELETE FROM config_rollout_audit", "CREATE TABLE unauthorized_test(id int)"} {
		if _, err = runtime.pool.Exec(ctx, query); err == nil {
			t.Fatal("runtime exceeded least privilege")
		}
	}
	if _, err = restarted.Telemetry(ctx, n.DeploymentID); err != nil {
		t.Fatal(err)
	}
	if err = restarted.Begin(ctx, notice(2), edges(), policy(), 1); err != nil {
		t.Fatal(err)
	}
	archive := strings.Repeat("b", 64)
	if _, err = runtime.CleanupAudit(ctx, n.DeploymentID, now.Add(31*24*time.Hour), archive, now.Add(61*24*time.Hour)); err == nil {
		t.Fatal("runtime obtained audit cleanup privilege")
	}
	count, err := owner.CleanupAudit(ctx, n.DeploymentID, now.Add(31*24*time.Hour), archive, now.Add(61*24*time.Hour))
	if err != nil || count == 0 {
		t.Fatal("bounded archival cleanup failed", count, err)
	}
	var remaining int
	if err = ownerPool.QueryRow(ctx, "SELECT count(*) FROM config_rollout_audit WHERE generation=2").Scan(&remaining); err != nil || remaining == 0 {
		t.Fatal("cleanup removed current generation history")
	}
	// Closing the runtime pool injects a real storage connection outage. Durable
	// state remains available to a newly provisioned connection/owner.
	runtime.pool.Close()
	if restarted.Tick(ctx, n.DeploymentID) == nil {
		t.Fatal("storage outage ignored")
	}
	if persisted, err := owner.Load(ctx, n.DeploymentID); err != nil || persisted.Notice.Generation != 2 {
		t.Fatal("durable rollout lost on connection outage")
	}
}
