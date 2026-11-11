package persistence

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"aegisgate.dev/aegisgate/internal/configpublish"
	"aegisgate.dev/aegisgate/internal/configsnapshot"
)

func publicationFixture(t *testing.T, s *Store) (Principal, string, Resource) {
	t.Helper()
	ctx := context.Background()
	p := Principal{"https://identity.example.com", "publication-owner"}
	org, err := s.CreateOrganization(ctx, p, "Publication Tenant")
	if err != nil {
		t.Fatal(err)
	}
	project, err := s.CreateProject(ctx, p, org, "Publication project")
	if err != nil {
		t.Fatal(err)
	}
	d, err := s.CreateDomainClaim(ctx, p, project, "publish.example.com", "publication-domain")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.VerifyDomainClaim(ctx, p, project, d.ResourceID, txtResolverFunc(func(context.Context, string) ([]string, error) { return []string{d.Proof}, nil })); err != nil {
		t.Fatal(err)
	}
	o, err := s.CreateDraft(ctx, p, project, "origin", "publication-origin", json.RawMessage(`{"url":"https://origin.example.com"}`))
	if err != nil {
		t.Fatal(err)
	}
	policy, err := s.CreateDraft(testMFA(p), p, project, "policy", "publication-policy", json.RawMessage(`{"auth_required":true,"jwt_issuer":"https://identity.example.com","jwt_audience":"gateway"}`))
	if err != nil {
		t.Fatal(err)
	}
	route, err := s.CreateRouteDraft(ctx, p, project, "publication-route", RouteSpec{DomainID: d.ResourceID, OriginID: o.ID, PolicyID: policy.ID, Path: "/v1", Methods: []string{"GET"}})
	if err != nil {
		t.Fatal(err)
	}
	return p, project, route
}

type captureNotifier struct {
	mu      sync.Mutex
	notices []configpublish.Notification
	fail    bool
}

func (n *captureNotifier) Publish(_ context.Context, notice configpublish.Notification) error {
	n.mu.Lock()
	defer n.mu.Unlock()
	if n.fail {
		return configpublish.ErrUnavailable
	}
	n.notices = append(n.notices, notice)
	return nil
}

type unavailableStore struct{}

func (unavailableStore) Put(context.Context, []byte) (string, error) {
	return "", configpublish.ErrUnavailable
}

func TestIntegrationConfigPublicationNegativeAndRecovery(t *testing.T) {
	s, dsn := localStore(t)
	owner := testOwner(t, dsn)
	ctx := context.Background()
	p, project, route := publicationFixture(t, s)
	// Draft route cannot enter a usable approved payload. Empty tenant is an
	// explicit deny-all snapshot, not implicit publication of the draft.
	preview, err := s.PreviewPublication(ctx, p, project)
	if err != nil || len(preview.Payload.Tenants[0].Routes) != 0 {
		t.Fatal("draft route compiled", err)
	}
	if _, err = s.ApproveRoute(testMFA(p), p, project, route.ID, 1); err != nil {
		t.Fatal(err)
	}
	preview, err = s.PreviewPublication(ctx, p, project)
	if err != nil || len(preview.Payload.Tenants[0].Routes) != 1 {
		t.Fatal("approved route missing", err)
	}
	// Missing MFA, foreign identities and stale preview fail before outbox writes.
	foreign := Principal{p.Issuer, "foreign"}
	for _, actor := range []Principal{foreign, p} {
		if _, err = s.ApprovePublication(ctx, actor, project, "bad-publication-key", preview.Digest, time.Hour); !errors.Is(err, domain.ErrDenied) {
			t.Fatal("unauthorized publication", err)
		}
	}
	if _, err = s.ApprovePublication(testMFA(p), p, project, "stale-publication-key", string(make([]byte, 64)), time.Hour); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("stale preview", err)
	}
	// Inject transactional failure after revision/head insertion; no partial
	// approved revision, generation, outbox or success audit may survive.
	if _, err = owner.pool.Exec(ctx, `CREATE FUNCTION reject_test_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'local injection'; END $$; CREATE TRIGGER reject_test_outbox BEFORE INSERT ON config_outbox FOR EACH ROW EXECUTE FUNCTION reject_test_outbox()`); err != nil {
		t.Fatal(err)
	}
	if _, err = s.ApprovePublication(testMFA(p), p, project, "failed-publication-key", preview.Digest, time.Hour); err == nil {
		t.Fatal("injection ignored")
	}
	for _, table := range []string{"config_revisions", "config_deployments", "config_outbox"} {
		var n int
		if err = s.pool.QueryRow(ctx, "SELECT count(*) FROM "+table).Scan(&n); err != nil || n != 0 {
			t.Fatal("partial transaction", table, n, err)
		}
	}
	if _, err = owner.pool.Exec(ctx, "DROP TRIGGER reject_test_outbox ON config_outbox; DROP FUNCTION reject_test_outbox()"); err != nil {
		t.Fatal(err)
	}
	approved, err := s.ApprovePublication(testMFA(p), p, project, "valid-publication-key", preview.Digest, time.Hour)
	if err != nil || approved.Generation != 1 {
		t.Fatal("approval", err)
	}
	retried, err := s.ApprovePublication(testMFA(p), p, project, "valid-publication-key", preview.Digest, time.Hour)
	if err != nil || retried != approved {
		t.Fatal("idempotency", err)
	}
	if _, err = s.ApprovePublication(testMFA(p), p, project, "valid-publication-key", preview.Digest, 2*time.Hour); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("changed TTL accepted for existing idempotency key", err)
	}
	if _, err = s.pool.Exec(ctx, "UPDATE config_revisions SET payload='{}' WHERE project_id=$1", project); err == nil {
		t.Fatal("approved history mutable")
	}
	queue := s.PublicationQueue()
	// Concurrent independent workers claim at most one live lease.
	var wg sync.WaitGroup
	claimed := make(chan configpublish.Job, 2)
	errs := make(chan error, 2)
	for _, name := range []string{"worker-a", "worker-b"} {
		wg.Go(func() {
			j, e := queue.Claim(ctx, name, 5*time.Second)
			if e == nil {
				claimed <- j
			}
			errs <- e
		})
	}
	wg.Wait()
	close(claimed)
	close(errs)
	if len(claimed) != 1 {
		t.Fatal("conflicting live leases")
	}
	job := <-claimed
	for e := range errs {
		if e != nil && !errors.Is(e, configpublish.ErrEmpty) {
			t.Fatal(e)
		}
	}
	// Crash before stage: expire lease as fixture owner; recovered worker gets a
	// new fencing token. The old worker cannot stage/finish/retry the new claim.
	if _, err = owner.pool.Exec(ctx, "UPDATE config_outbox SET lease_until=now()-interval '1 second' WHERE project_id=$1", project); err != nil {
		t.Fatal(err)
	}
	recovered, err := queue.Claim(ctx, "worker-recovered", 5*time.Second)
	if err != nil || recovered.Token == job.Token {
		t.Fatal("lease recovery", err)
	}
	signer, err := configsnapshot.NewLocalSigner("local-signing")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Truncate(time.Second)
	trust, err := configsnapshot.NewTrustStore([]configsnapshot.TrustedKey{{ID: signer.KeyID(), PublicKey: signer.PublicKey(), NotBefore: now.Add(-time.Minute), NotAfter: now.Add(24 * time.Hour)}})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := configsnapshot.Sign(ctx, recovered.Envelope, signer)
	if err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(raw)
	digest := hex.EncodeToString(sum[:])
	recovered.Digest = digest
	if err = queue.Stage(ctx, job, raw, digest); !errors.Is(err, configpublish.ErrLease) {
		t.Fatal("stale stage", err)
	}
	if err = queue.Stage(ctx, recovered, raw, digest); err != nil {
		t.Fatal(err)
	}
	notice := configpublish.Notification{DeploymentID: project, Generation: 1, Digest: digest, Location: "https://artifacts.example.com/artifacts/" + digest}
	job.Digest = digest
	if err = queue.Finish(ctx, job, notice); !errors.Is(err, configpublish.ErrLease) {
		t.Fatal("stale ACK", err)
	}
	if err = queue.Retry(ctx, job, time.Second); !errors.Is(err, configpublish.ErrLease) {
		t.Fatal("stale retry", err)
	}
	// Crash after signing/staging: the exact artifact survives and is never
	// re-signed under a different key. Network outages preserve the queue.
	if _, err = owner.pool.Exec(ctx, "UPDATE config_outbox SET lease_until=now()-interval '1 second' WHERE project_id=$1", project); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	if err = os.Chmod(root, 0700); err != nil {
		t.Fatal(err)
	}
	store, err := configpublish.OpenLocalStore(root, "https://artifacts.example.com", 16)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	notifier := &captureNotifier{}
	worker := configpublish.Worker{Queue: queue, Store: unavailableStore{}, Notifier: notifier, Signer: signer, Trust: trust, Identity: "worker-service", Lease: 10 * time.Second}
	if err = worker.RunOnce(ctx); err == nil {
		t.Fatal("store outage ignored")
	}
	if len(notifier.notices) != 0 {
		t.Fatal("notified unstored artifact")
	}
	if _, err = owner.pool.Exec(ctx, "UPDATE config_outbox SET available_at=now() WHERE project_id=$1", project); err != nil {
		t.Fatal(err)
	}
	worker.Store = store
	notifier.fail = true
	if err = worker.RunOnce(ctx); err == nil {
		t.Fatal("messaging outage ignored")
	}
	if _, err = owner.pool.Exec(ctx, "UPDATE config_outbox SET available_at=now() WHERE project_id=$1", project); err != nil {
		t.Fatal(err)
	}
	notifier.fail = false
	if err = worker.RunOnce(ctx); err != nil {
		t.Fatal("publish recovery", err)
	}
	if len(notifier.notices) != 1 || notifier.notices[0] != notice {
		t.Fatal("wrong notice", notifier.notices)
	}
	stored, err := os.ReadFile(filepath.Join(root, digest))
	if err != nil || string(stored) != string(raw) {
		t.Fatal("immutable artifact changed", err)
	}
	if err = worker.RunOnce(ctx); !errors.Is(err, configpublish.ErrEmpty) {
		t.Fatal("duplicate published job", err)
	}
	// Rollback is a new approved monotonic generation with old payload, and audit.
	rollback, err := s.RollbackPublication(testMFA(p), p, project, "rollback-publication-key", 1, time.Hour)
	if err != nil || rollback.Generation != 2 || rollback.RollbackOf != 1 || rollback.Digest != approved.Digest {
		t.Fatal("rollback monotonicity", err)
	}
	if _, err = s.RollbackPublication(testMFA(foreign), foreign, project, "foreign-rollback-key", 1, time.Hour); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross tenant rollback", err)
	}
	if err = worker.RunOnce(ctx); err != nil {
		t.Fatal(err)
	}
	var audit int
	if err = s.pool.QueryRow(ctx, "SELECT count(*) FROM audit_events WHERE project_id=$1 AND action='publication_rollback' AND outcome='allowed'", project).Scan(&audit); err != nil || audit != 1 {
		t.Fatal("rollback audit", err)
	}
	// Direct DB corruption of a referenced policy fails compiler closed; it does
	// not silently omit auth fields or mix foreign tenant references.
	if _, err = owner.pool.Exec(ctx, "ALTER TABLE resource_revisions DISABLE TRIGGER immutable_revision"); err != nil {
		t.Fatal(err)
	}
	if _, err = owner.pool.Exec(ctx, "UPDATE resource_revisions SET spec=spec||'{\"unknown_auth_operator\":true}'::jsonb WHERE project_id=$1 AND spec ? 'auth_required'", project); err != nil {
		t.Fatal(err)
	}
	if _, err = s.PreviewPublication(ctx, p, project); !errors.Is(err, domain.ErrInvalid) {
		t.Fatal("unsupported auth semantics accepted", err)
	}
}
