package persistence

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
)

func TestIntegrationLoginReplayBrowserBindingAndWebSession(t *testing.T) {
	s, dsn := localStore(t)
	owner := testOwner(t, dsn)
	ctx := context.Background()
	attempt, err := s.BeginLogin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(attempt.State) != 43 || len(attempt.Verifier) != 43 || attempt.State == attempt.Browser || attempt.Nonce == attempt.Verifier {
		t.Fatal("unbounded or reused OAuth entropy")
	}
	if _, err = s.ConsumeLogin(ctx, attempt.State, strings.Repeat("x", 43)); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("browser binding ignored")
	}
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for range 8 {
		wg.Go(func() { _, err := s.ConsumeLogin(ctx, attempt.State, attempt.Browser); errs <- err })
	}
	wg.Wait()
	close(errs)
	allowed := 0
	for err := range errs {
		if err == nil {
			allowed++
		} else if !errors.Is(err, domain.ErrDenied) {
			t.Fatal(err)
		}
	}
	if allowed != 1 {
		t.Fatal("OAuth state consumed more than once")
	}
	expired, err := s.BeginLogin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = owner.pool.Exec(ctx, "UPDATE login_attempts SET expires_at=now()-interval '1 second' WHERE state_hash=$1", TokenHash(expired.State)); err != nil {
		t.Fatal(err)
	}
	if _, err = s.ConsumeLogin(ctx, expired.State, expired.Browser); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("expired login accepted")
	}
	p := Principal{"https://management.example", "user"}
	session, csrf, err := s.CreateWebSession(ctx, p, time.Now().Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if err = s.CheckCSRF(ctx, session, csrf); err != nil {
		t.Fatal("valid CSRF denied")
	}
	if err = s.CheckCSRF(ctx, session, strings.Repeat("z", 43)); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("forged CSRF accepted")
	}
	other, otherCSRF, err := s.CreateWebSession(ctx, p, time.Now().Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if err = s.CheckCSRF(ctx, session, otherCSRF); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("CSRF from another session accepted")
	}
	if err = s.RevokeSession(ctx, p, session); err != nil {
		t.Fatal(err)
	}
	if err = s.CheckCSRF(ctx, session, csrf); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("revoked CSRF accepted")
	}
	if _, err = s.pool.Exec(ctx, "UPDATE admin_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1", TokenHash(other)); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Session(ctx, other); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("expired session accepted")
	}
}

func TestIntegrationDomainJobLeaseRetryAndScope(t *testing.T) {
	s, _ := localStore(t)
	ctx := context.Background()
	p := Principal{"https://management.example", "owner"}
	org, err := s.CreateOrganization(ctx, p, "tenant")
	if err != nil {
		t.Fatal(err)
	}
	project, err := s.CreateProject(ctx, p, org, "project")
	if err != nil {
		t.Fatal(err)
	}
	claim, err := s.CreateDomainClaim(ctx, p, project, "job.example.com", "job-domain-key")
	if err != nil {
		t.Fatal(err)
	}
	job, err := s.QueueDomainVerification(ctx, p, project, claim.ResourceID)
	if err != nil {
		t.Fatal(err)
	}
	retry, err := s.QueueDomainVerification(ctx, p, project, claim.ResourceID)
	if err != nil || retry.ID != job.ID {
		t.Fatal("job not deduplicated")
	}
	outsider := Principal{p.Issuer, "outsider"}
	if _, err = s.VerificationJob(ctx, outsider, project, job.ID); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross-tenant job read")
	}
	if _, err = s.QueueDomainVerification(ctx, outsider, project, claim.ResourceID); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross-tenant job queue")
	}
	if ran, err := s.RunDomainVerification(ctx, txtResolverFunc(func(context.Context, string) ([]string, error) { return []string{claim.Proof}, nil })); err != nil || !ran {
		t.Fatal("worker failed", err)
	}
	got, err := s.VerificationJob(ctx, p, project, job.ID)
	if err != nil || got.State != "succeeded" || got.Attempts != 1 {
		t.Fatal("job result wrong")
	}
	if ran, err := s.RunDomainVerification(ctx, txtResolverFunc(func(context.Context, string) ([]string, error) { t.Error("completed job retried"); return nil, nil })); err != nil || ran {
		t.Fatal("completed queue not empty")
	}
	claim, err = s.CreateDomainClaim(ctx, p, project, "failure.example.com", "failure-domain-key")
	if err != nil {
		t.Fatal(err)
	}
	job, err = s.QueueDomainVerification(ctx, p, project, claim.ResourceID)
	if err != nil {
		t.Fatal(err)
	}
	for attempt := 1; attempt <= 3; attempt++ {
		if ran, err := s.RunDomainVerification(ctx, txtResolverFunc(func(context.Context, string) ([]string, error) { return []string{"wrong"}, nil })); err != nil || !ran {
			t.Fatal("bounded retry failed", err)
		}
		got, err = s.VerificationJob(ctx, p, project, job.ID)
		if err != nil || got.Attempts != attempt {
			t.Fatal("attempt count wrong")
		}
		if _, err = s.pool.Exec(ctx, "UPDATE domain_verification_jobs SET available_at=now() WHERE id=$1", job.ID); err != nil {
			t.Fatal(err)
		}
	}
	if got.State != "failed" {
		t.Fatal("unbounded DNS retries")
	}
	if _, err = s.pool.Exec(ctx, "UPDATE domain_verification_jobs SET state='running',lease_until=now()-interval '1 second' WHERE id=$1", job.ID); err != nil {
		t.Fatal(err)
	}
	if _, err = s.RunDomainVerification(ctx, txtResolverFunc(func(context.Context, string) ([]string, error) {
		t.Error("exhausted lease fetched DNS")
		return nil, nil
	})); err != nil {
		t.Fatal(err)
	}
	got, err = s.VerificationJob(ctx, p, project, job.ID)
	if err != nil || got.State != "failed" {
		t.Fatal("exhausted lease not released")
	}
}
