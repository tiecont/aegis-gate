package persistence

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"net/netip"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"aegisgate.dev/aegisgate/apps/control-api/internal/identity"
	"github.com/jackc/pgx/v5"
)

type publicResolver struct{ calls atomic.Int32 }

func (r *publicResolver) LookupNetIP(context.Context, string, string) ([]netip.Addr, error) {
	r.calls.Add(1)
	return []netip.Addr{netip.MustParseAddr("93.184.216.34")}, nil
}

func TestIntegrationOriginPoolLifecycleAndRuntimePermissions(t *testing.T) {
	s, dsn := localStore(t)
	owner := testOwner(t, dsn)
	ctx := context.Background()
	a := Principal{"https://management.example", "a"}
	b := Principal{a.Issuer, "b"}
	org, err := s.CreateOrganization(ctx, a, "A")
	if err != nil {
		t.Fatal(err)
	}
	project, err := s.CreateProject(ctx, a, org, "A")
	if err != nil {
		t.Fatal(err)
	}
	pool, err := s.CreateOriginPool(ctx, a, project, "primary", "pool-key-a")
	if err != nil {
		t.Fatal(err)
	}
	retry, err := s.CreateOriginPool(ctx, a, project, "primary", "pool-key-a")
	if err != nil || retry.ID != pool.ID {
		t.Fatal("pool idempotency", err)
	}
	resolver := &publicResolver{}
	if _, err = s.CreateEndpoint(ctx, b, project, pool.ID, "https://origin.example.com", "endpoint-key-b", 1, resolver); !errors.Is(err, domain.ErrDenied) || resolver.calls.Load() != 0 {
		t.Fatal("unauthorized DNS side channel", err)
	}
	ep, err := s.CreateEndpoint(ctx, a, project, pool.ID, "https://ORIGIN.example.com:443/", "endpoint-key-a", 1, resolver)
	if err != nil || ep.URL != "https://origin.example.com" {
		t.Fatal("endpoint registration", err)
	}
	again, err := s.CreateEndpoint(ctx, a, project, pool.ID, ep.URL, "endpoint-key-a", 1, resolver)
	if err != nil || again.ID != ep.ID {
		t.Fatal("endpoint idempotency", err)
	}
	if _, err = s.CreateEndpoint(ctx, a, project, pool.ID, "https://other.example.com", "endpoint-key-z", 1, resolver); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("pool ETag ignored", err)
	}
	if _, err = s.ApproveOriginPool(ctx, a, project, pool.ID, 2); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("MFA required", err)
	}
	approved, err := s.ApproveOriginPool(testMFA(a), a, project, pool.ID, 2)
	if err != nil || len(approved.Endpoints) != 1 {
		t.Fatal("pool approval", err)
	}
	ep, err = s.ReviseEndpoint(ctx, a, project, pool.ID, ep.ID, "https://changed.example.com", "disabled", 1, resolver)
	if err != nil || ep.Generation != 2 {
		t.Fatal("endpoint state", err)
	}
	old, err := s.OriginPoolRevision(ctx, a, project, pool.ID, 2)
	if err != nil || old.Endpoints[0].URL != "https://origin.example.com" || old.Endpoints[0].State != "active" {
		t.Fatal("immutable pool snapshot", err)
	}
	oldEP, err := s.Endpoint(ctx, a, project, pool.ID, ep.ID, 1)
	if err != nil || oldEP.URL != "https://origin.example.com" {
		t.Fatal("immutable endpoint revision", err)
	}
	if _, err = s.ReviseEndpoint(ctx, a, project, pool.ID, ep.ID, ep.URL, "active", 1, resolver); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("stale endpoint", err)
	}
	for _, statement := range []string{"CREATE TABLE forbidden(id int)", "ALTER TABLE origin_pools ADD COLUMN forbidden int", "UPDATE origin_pool_revisions SET spec='{}'", "DELETE FROM origin_endpoint_revisions", "UPDATE audit_events SET action='forged'", "DELETE FROM audit_events", "TRUNCATE admin_sessions", "SELECT cleanup_control_state()", "SET ROLE aegisgate_local"} {
		if _, err = s.pool.Exec(ctx, statement); err == nil {
			t.Errorf("runtime operation accepted: %s", statement)
		}
	}
	u, _ := url.Parse(dsn)
	runtimeRole := u.User.Username()
	if _, err = owner.pool.Exec(ctx, "GRANT UPDATE ON resource_revisions TO "+pgx.Identifier{runtimeRole}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	if s.RequireRuntimeRole(ctx) == nil {
		t.Fatal("unsafe runtime grant accepted")
	}
	if _, err = owner.pool.Exec(ctx, "REVOKE UPDATE ON resource_revisions FROM "+pgx.Identifier{runtimeRole}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	maintenanceRole := "maint_" + strings.TrimPrefix(runtimeRole, "run_")
	for _, attribute := range []string{"SUPERUSER", "CREATEDB", "CREATEROLE", "BYPASSRLS", "REPLICATION", "INHERIT"} {
		if _, err = owner.pool.Exec(ctx, "ALTER ROLE "+pgx.Identifier{runtimeRole}.Sanitize()+" "+attribute); err != nil {
			t.Fatal(err)
		}
		if s.RequireRuntimeRole(ctx) == nil {
			t.Errorf("unsafe attribute accepted: %s", attribute)
		}
		if _, err = owner.pool.Exec(ctx, "ALTER ROLE "+pgx.Identifier{runtimeRole}.Sanitize()+" NO"+attribute); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = owner.pool.Exec(ctx, "GRANT "+pgx.Identifier{maintenanceRole}.Sanitize()+" TO "+pgx.Identifier{runtimeRole}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	if s.RequireRuntimeRole(ctx) == nil {
		t.Fatal("SET ROLE escalation membership accepted")
	}
	if _, err = owner.pool.Exec(ctx, "REVOKE "+pgx.Identifier{maintenanceRole}.Sanitize()+" FROM "+pgx.Identifier{runtimeRole}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	if _, err = owner.pool.Exec(ctx, "ALTER TABLE origin_pools OWNER TO "+pgx.Identifier{runtimeRole}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	if s.RequireRuntimeRole(ctx) == nil {
		t.Fatal("object ownership accepted")
	}
	if _, err = owner.pool.Exec(ctx, "ALTER TABLE origin_pools OWNER TO "+pgx.Identifier{owner.pool.Config().ConnConfig.User}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	// Ownership transfer removes the former owner's explicit ACL entries.
	if err = owner.GrantRoles(ctx, runtimeRole, maintenanceRole); err != nil {
		t.Fatal("restore runtime grants", err)
	}
	if err = s.RequireRuntimeRole(ctx); err != nil {
		t.Fatal("restored runtime privileges", err)
	}
	password, _ := u.User.Password()
	u.User = url.UserPassword(maintenanceRole, password)
	maint, err := Open(ctx, u.String())
	if err != nil {
		t.Fatal("maintenance connection")
	}
	defer maint.Close()
	if _, err = maint.pool.Exec(ctx, "SET ROLE "+pgx.Identifier{runtimeRole}.Sanitize()); err == nil {
		t.Fatal("maintenance runtime escalation")
	}
	conn, err := maint.pool.Acquire(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Release()
	// Temp shadow relations and triggers must never run as the cleanup owner.
	if _, err = conn.Exec(ctx, `CREATE TEMP TABLE audit_events(sequence bigint,organization_id uuid,at timestamptz);CREATE TEMP TABLE login_attempts(state_hash bytea,expires_at timestamptz);INSERT INTO login_attempts VALUES('\x00',now()-interval '1 day');CREATE FUNCTION pg_temp.trap() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''shadow executed''; END';CREATE TRIGGER trap BEFORE DELETE ON login_attempts FOR EACH ROW EXECUTE FUNCTION pg_temp.trap()`); err != nil {
		t.Fatal("shadow setup", err)
	}
	if _, err = conn.Exec(ctx, "SELECT cleanup_control_state()"); err != nil {
		t.Fatal("cleanup temp-shadow protection", err)
	}
	if _, err = owner.pool.Exec(ctx, `INSERT INTO audit_events(organization_id,issuer,subject,action,outcome,at)VALUES($1,'fixture','fixture','retention_old','allowed',now()-interval '400 days'),($1,'fixture','fixture','retention_recent','allowed',now())`, org); err != nil {
		t.Fatal(err)
	}
	if _, err = conn.Exec(ctx, "SELECT cleanup_control_state()"); err != nil {
		t.Fatal("retention cleanup", err)
	}
	var oldCount, recentCount int
	if err = owner.pool.QueryRow(ctx, "SELECT count(*) FILTER(WHERE action='retention_old'),count(*) FILTER(WHERE action='retention_recent') FROM audit_events WHERE organization_id=$1", org).Scan(&oldCount, &recentCount); err != nil || oldCount != 0 || recentCount != 1 {
		t.Fatal("retention removed wrong audit state", oldCount, recentCount, err)
	}
	var count int
	if err = conn.QueryRow(ctx, "SELECT count(*) FROM pg_temp.login_attempts").Scan(&count); err != nil || count != 1 {
		t.Fatal("cleanup used temp relation", err)
	}
	if _, err = s.ReviseOriginPool(ctx, a, project, pool.ID, "primary", "retired", 3); err != nil {
		t.Fatal("pool retirement", err)
	}
	if _, err = s.ReviseOriginPool(ctx, a, project, pool.ID, "primary", "active", 4); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("retired pool resurrected", err)
	}
	if _, err = s.ReviseEndpoint(ctx, a, project, pool.ID, ep.ID, ep.URL, "active", ep.Generation, resolver); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("endpoint changed under retired pool", err)
	}
}

func TestIntegrationNonSuperuserMigrationOwner(t *testing.T) {
	s, dsn := localStore(t)
	admin := testOwner(t, dsn)
	ctx := context.Background()
	id := strings.TrimPrefix(strings.Split(s.pool.Config().ConnConfig.RuntimeParams["search_path"], ",")[0], "tenant_test_")
	role := "migration_" + id
	schema := "migration_test_" + id
	password := rand.Text()
	if _, err := admin.pool.Exec(ctx, "CREATE ROLE "+pgx.Identifier{role}.Sanitize()+" LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION PASSWORD '"+password+"'"); err != nil {
		t.Fatal("migration login fixture")
	}
	if _, err := admin.pool.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize()+" AUTHORIZATION "+pgx.Identifier{role}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = admin.pool.Exec(ctx, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
		_, _ = admin.pool.Exec(ctx, "DROP ROLE "+pgx.Identifier{role}.Sanitize())
	})
	u, _ := url.Parse(dsn)
	runtimeRole := u.User.Username()
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	u.User = url.UserPassword(role, password)
	migration, err := Open(ctx, u.String())
	if err != nil {
		t.Fatal("migration owner connect")
	}
	defer migration.Close()
	if err = migration.Migrate(ctx); err != nil {
		t.Fatal("non-superuser migration", err)
	}
	if err = migration.Migrate(ctx); err != nil {
		t.Fatal("migration repeat", err)
	}
	if err = migration.GrantRoles(ctx, runtimeRole, "maint_"+strings.TrimPrefix(runtimeRole, "run_")); err != nil {
		t.Fatal("non-superuser grants", err)
	}
	runtimeURL, _ := url.Parse(dsn)
	runtimeURL.RawQuery = q.Encode()
	runtime, err := Open(ctx, runtimeURL.String())
	if err != nil {
		t.Fatal("runtime connect")
	}
	defer runtime.Close()
	if err = runtime.RequireRuntimeRole(ctx); err != nil {
		t.Fatal(err)
	}
	if err = runtime.Migrate(ctx); err == nil {
		t.Fatal("runtime migrated schema")
	}
	p := Principal{"https://management.example", "migration-proof"}
	if _, err = runtime.CreateOrganization(ctx, p, "proof"); err != nil {
		t.Fatal("runtime after separate migration", err)
	}
}

func TestIntegrationQuotaConcurrentKeysAndMissingDefaults(t *testing.T) {
	s, dsn := localStore(t)
	owner := testOwner(t, dsn)
	ctx := context.Background()
	p := Principal{"https://management.example", "quota"}
	org, err := s.CreateOrganization(ctx, p, "quota")
	if err != nil {
		t.Fatal(err)
	}
	project, err := s.CreateProject(ctx, p, org, "quota")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = owner.pool.Exec(ctx, "UPDATE organization_quotas SET max_resources=1 WHERE organization_id=$1", org); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	results := make(chan error, 8)
	for i := range 8 {
		wg.Go(func() {
			_, e := s.CreateOriginPool(ctx, p, project, fmt.Sprintf("pool-%d", i), fmt.Sprintf("quota-key-%d", i))
			results <- e
		})
	}
	wg.Wait()
	close(results)
	allowed := 0
	for e := range results {
		if e == nil {
			allowed++
		} else if !errors.Is(e, domain.ErrConflict) {
			t.Fatal(e)
		}
	}
	if allowed != 1 {
		t.Fatal("quota race", allowed)
	}
	if _, err = owner.pool.Exec(ctx, "DELETE FROM organization_quotas WHERE organization_id=$1", org); err != nil {
		t.Fatal(err)
	}
	if _, err = s.CreateOriginPool(ctx, p, project, "missing", "missing-key"); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("missing quota accepted", err)
	}
}

func TestIntegrationSensitiveDirectCallerAuditAndFreshness(t *testing.T) {
	s, dsn := localStore(t)
	owner := testOwner(t, dsn)
	ctx := context.Background()
	a := Principal{"https://management.example", "a"}
	b := Principal{a.Issuer, "b"}
	org, err := s.CreateOrganization(ctx, a, "A")
	if err != nil {
		t.Fatal(err)
	}
	project, err := s.CreateProject(ctx, a, org, "A")
	if err != nil {
		t.Fatal(err)
	}
	for _, auth := range []context.Context{ctx, WithVerifiedLogin(ctx, identity.Login{Issuer: a.Issuer, Subject: a.Subject, MFAAt: time.Now().Add(-6 * time.Minute)}), testMFA(b)} {
		if err = s.AddMember(auth, a, org, b, domain.Admin); !errors.Is(err, domain.ErrDenied) {
			t.Fatal("missing/stale/mismatched MFA", err)
		}
	}
	if _, err = s.CreateProject(ctx, b, org, "attack"); !errors.Is(err, domain.ErrDenied) {
		t.Fatal(err)
	}
	if err = s.AddMember(ctx, b, org, a, domain.Admin); !errors.Is(err, domain.ErrDenied) {
		t.Fatal(err)
	}
	if err = s.RevokeMember(ctx, b, org, a); !errors.Is(err, domain.ErrDenied) {
		t.Fatal(err)
	}
	var count int
	if err = owner.pool.QueryRow(ctx, "SELECT count(*) FROM audit_events WHERE organization_id=$1 AND outcome='denied'", org).Scan(&count); err != nil || count < 6 {
		t.Fatal("direct denial audit", count, err)
	}
	policy := json.RawMessage(`{"auth_required":true,"jwt_issuer":"https://identity.example.com","jwt_audience":"traffic"}`)
	if _, err = s.CreateDraft(ctx, a, project, "policy", "no-mfa-policy", policy); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("policy MFA", err)
	}
	if _, err = s.CreateDraft(testMFA(a), a, project, "policy", "mfa-policy-ok", policy); err != nil {
		t.Fatal("policy MFA positive", err)
	}
	for i := range 128 {
		if _, _, err = s.CreateWebSession(ctx, a, time.Now().Add(time.Minute)); err != nil {
			t.Fatal("session quota early", i, err)
		}
	}
	if _, _, err = s.CreateWebSession(ctx, a, time.Now().Add(time.Minute)); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("session quota not enforced", err)
	}
}

func TestIntegrationDNSLeaseFenceAndReverification(t *testing.T) {
	s, dsn := localStore(t)
	owner := testOwner(t, dsn)
	ctx := context.Background()
	p := Principal{"https://management.example", "dns"}
	org, err := s.CreateOrganization(ctx, p, "dns")
	if err != nil {
		t.Fatal(err)
	}
	project, err := s.CreateProject(ctx, p, org, "dns")
	if err != nil {
		t.Fatal(err)
	}
	claim, err := s.CreateDomainClaim(ctx, p, project, "fence.example.com", "fence-domain-key")
	if err != nil {
		t.Fatal(err)
	}
	job, err := s.QueueDomainVerification(ctx, p, project, claim.ResourceID)
	if err != nil {
		t.Fatal(err)
	}
	entered, release := make(chan struct{}), make(chan struct{})
	done := make(chan error, 1)
	go func() {
		_, e := s.RunDomainVerification(ctx, txtResolverFunc(func(context.Context, string) ([]string, error) {
			close(entered)
			<-release
			return []string{claim.Proof}, nil
		}))
		done <- e
	}()
	<-entered
	newClaim, err := s.ReverifyDomain(ctx, p, project, claim.ResourceID, 1)
	if err != nil {
		close(release)
		t.Fatal(err)
	}
	close(release)
	if err = <-done; err != nil {
		t.Fatal(err)
	}
	current, err := s.DomainClaim(ctx, p, project, claim.ResourceID)
	if err != nil || current.State != "pending" || current.Generation != 2 {
		t.Fatal("stale worker changed new proof", err)
	}
	if _, err = s.VerifyDomainClaim(ctx, p, project, claim.ResourceID, txtResolverFunc(func(context.Context, string) ([]string, error) { return []string{claim.Proof}, nil })); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("stale proof accepted", err)
	}
	job, err = s.QueueDomainVerification(ctx, p, project, claim.ResourceID)
	if err != nil {
		t.Fatal(err)
	}
	// Simulate a process crash after leasing but before DNS/ACK, then reclaim.
	if _, err = owner.pool.Exec(ctx, "UPDATE domain_verification_jobs SET state='running',attempts=1,lease_until=now()-interval '1 second' WHERE id=$1", job.ID); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	calls := atomic.Int32{}
	for range 4 {
		wg.Go(func() {
			_, e := s.RunDomainVerification(ctx, txtResolverFunc(func(context.Context, string) ([]string, error) { calls.Add(1); return []string{newClaim.Proof}, nil }))
			if e != nil {
				t.Error(e)
			}
		})
	}
	wg.Wait()
	if calls.Load() != 1 {
		t.Fatal("concurrent workers repeated active lease", calls.Load())
	}
	current, err = s.DomainClaim(ctx, p, project, claim.ResourceID)
	if err != nil || current.State != "verified" {
		t.Fatal("lease recovery", err)
	}
	j, err := s.VerificationJob(ctx, p, project, job.ID)
	if err != nil || j.State != "succeeded" || j.Attempts != 2 {
		t.Fatal("lease recovery ACK", j, err)
	}
	newClaim, err = s.ReverifyDomain(ctx, p, project, claim.ResourceID, 2)
	if err != nil {
		t.Fatal(err)
	}
	job, err = s.QueueDomainVerification(ctx, p, project, claim.ResourceID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.RunDomainVerification(ctx, txtResolverFunc(func(context.Context, string) ([]string, error) {
		_, e := owner.pool.Exec(ctx, "UPDATE domain_verification_jobs SET lease_until=now()-interval '1 second' WHERE id=$1", job.ID)
		if e != nil {
			t.Error(e)
		}
		return []string{newClaim.Proof}, nil
	})); err != nil {
		t.Fatal(err)
	}
	current, err = s.DomainClaim(ctx, p, project, claim.ResourceID)
	if err != nil || current.State != "pending" {
		t.Fatal("expired lease committed DNS proof", err)
	}
	for i := 0; i < 2; i++ {
		if _, err = s.RunDomainVerification(ctx, txtResolverFunc(func(context.Context, string) ([]string, error) { return []string{"wrong"}, nil })); err != nil {
			t.Fatal(err)
		}
		if _, err = owner.pool.Exec(ctx, "UPDATE domain_verification_jobs SET available_at=now() WHERE id=$1", job.ID); err != nil {
			t.Fatal(err)
		}
	}
	current, err = s.DomainClaim(ctx, p, project, claim.ResourceID)
	if err != nil || current.State != "failed" {
		t.Fatal("exhausted claim not failed", err)
	}
	if _, err = s.ReverifyDomain(ctx, p, project, claim.ResourceID, 3); err != nil {
		t.Fatal("failed reverify", err)
	}
	if _, err = owner.pool.Exec(ctx, "UPDATE domain_claims SET expires_at=now()-interval '1 second' WHERE resource_id=$1", claim.ResourceID); err != nil {
		t.Fatal(err)
	}
	if err = s.ExpireDomainClaims(ctx); err != nil {
		t.Fatal(err)
	}
	current, err = s.DomainClaim(ctx, p, project, claim.ResourceID)
	if err != nil || current.State != "expired" {
		t.Fatal("expiry lifecycle", err)
	}
}
