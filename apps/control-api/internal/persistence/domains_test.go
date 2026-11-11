package persistence

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
)

type txtResolverFunc func(context.Context, string) ([]string, error)

func (f txtResolverFunc) LookupTXT(ctx context.Context, name string) ([]string, error) {
	return f(ctx, name)
}

func TestIntegrationDomainClaimLifecycleAndIsolation(t *testing.T) {
	s, _ := localStore(t)
	ctx := context.Background()
	a, b := Principal{"https://management.example", "owner-a"}, Principal{"https://management.example", "owner-b"}
	viewer := Principal{a.Issuer, "viewer-a"}
	orgA, err := s.CreateOrganization(ctx, a, "A")
	if err != nil {
		t.Fatal(err)
	}
	orgB, err := s.CreateOrganization(ctx, b, "B")
	if err != nil {
		t.Fatal(err)
	}
	projectA, err := s.CreateProject(ctx, a, orgA, "A")
	if err != nil {
		t.Fatal(err)
	}
	projectB, err := s.CreateProject(ctx, b, orgB, "B")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.AddMember(ctx, a, orgA, viewer, domain.Viewer); err != nil {
		t.Fatal(err)
	}
	claim, err := s.CreateDomainClaim(ctx, a, projectA, "API.Example.COM.", "domain-key-a")
	if err != nil || claim.Hostname != "api.example.com" || claim.State != "pending" || len(claim.Proof) != len("aegisgate-verification=")+43 || time.Until(claim.ExpiresAt) > 15*time.Minute {
		t.Fatal("normalized bounded claim creation failed", err)
	}
	if claim.TXTName != "_aegisgate-challenge.api.example.com" {
		t.Fatal("unexpected TXT name")
	}
	retry, err := s.CreateDomainClaim(ctx, a, projectA, "api.example.com", "domain-key-a")
	if err != nil || retry.ResourceID != claim.ResourceID || retry.Proof != "" {
		t.Fatal("claim retry duplicated or exposed secret", err)
	}
	stored, err := s.Get(ctx, a, projectA, "domain", claim.ResourceID)
	if err != nil || strings.Contains(string(stored.Spec), claim.Proof) || !json.Valid(stored.Spec) {
		t.Fatal("proof entered resource JSON")
	}
	var hash []byte
	if err = s.pool.QueryRow(ctx, "SELECT challenge_hash FROM domain_claims WHERE project_id=$1 AND resource_id=$2", projectA, claim.ResourceID).Scan(&hash); err != nil || len(hash) != 32 || string(hash) == claim.Proof {
		t.Fatal("proof not hashed")
	}
	if _, err = s.CreateDomainClaim(ctx, a, projectA, "other.example.com", "domain-key-a"); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("idempotency substitution accepted")
	}
	if _, err = s.CreateDomainClaim(ctx, b, projectB, "API.EXAMPLE.COM", "domain-key-b"); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("cross-tenant hostname reserved twice")
	}
	neverResolve := txtResolverFunc(func(context.Context, string) ([]string, error) { t.Error("unauthorized DNS query"); return nil, nil })
	for _, principal := range []Principal{b, viewer} {
		if _, err = s.VerifyDomainClaim(ctx, principal, projectA, claim.ResourceID, neverResolve); !errors.Is(err, domain.ErrDenied) {
			t.Fatal("unauthorized verification")
		}
	}
	if _, err = s.DomainClaim(ctx, b, projectA, claim.ResourceID); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross-tenant claim read")
	}
	if _, err = s.DomainClaim(ctx, b, projectB, claim.ResourceID); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("claim IDOR")
	}
	wrong := txtResolverFunc(func(context.Context, string) ([]string, error) { return []string{"aegisgate-verification=wrong"}, nil })
	if _, err = s.VerifyDomainClaim(ctx, a, projectA, claim.ResourceID, wrong); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("wrong DNS proof accepted")
	}
	correct := txtResolverFunc(func(ctx context.Context, name string) ([]string, error) {
		deadline, ok := ctx.Deadline()
		if name != claim.TXTName || !ok || time.Until(deadline) > 3*time.Second {
			t.Error("unbounded or wrong DNS lookup")
		}
		return []string{claim.Proof}, nil
	})
	verified, err := s.VerifyDomainClaim(ctx, a, projectA, claim.ResourceID, correct)
	if err != nil || verified.State != "verified" || verified.Proof != "" || time.Until(verified.ExpiresAt) > 24*time.Hour {
		t.Fatal("domain verification failed", err)
	}
	if _, err = s.VerifyDomainClaim(ctx, a, projectA, claim.ResourceID, neverResolve); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("proof replay accepted")
	}
	if _, err = s.pool.Exec(ctx, "UPDATE domain_claims SET expires_at=now()-interval '1 second' WHERE project_id=$1 AND resource_id=$2", projectA, claim.ResourceID); err != nil {
		t.Fatal(err)
	}
	if _, err = s.VerifyDomainClaim(ctx, a, projectA, claim.ResourceID, neverResolve); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("expired proof accepted")
	}
	reclaimed, err := s.CreateDomainClaim(ctx, b, projectB, claim.Hostname, "reclaim-key-b")
	if err != nil || reclaimed.Proof == claim.Proof {
		t.Fatal("expired hostname not safely reclaimed", err)
	}
	if _, err = s.VerifyDomainClaim(ctx, b, projectB, reclaimed.ResourceID, correct); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("old tenant proof verified new claim")
	}
	old, err := s.DomainClaim(ctx, a, projectA, claim.ResourceID)
	if err != nil || old.State != "expired" {
		t.Fatal("old tenant history lost")
	}
	var forbidden int
	if err = s.pool.QueryRow(ctx, "SELECT count(*) FROM audit_events WHERE action='domain_verify' AND outcome='denied' AND project_id=$1", projectA).Scan(&forbidden); err != nil || forbidden == 0 {
		t.Fatal("failed verification not audited")
	}
}

func TestIntegrationDomainConcurrentClaimsAndMembershipRevocation(t *testing.T) {
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
	var wg sync.WaitGroup
	results := make(chan DomainClaim, 8)
	errs := make(chan error, 8)
	for range 8 {
		wg.Go(func() {
			claim, err := s.CreateDomainClaim(ctx, p, project, "concurrent.example.com", "same-domain-key")
			results <- claim
			errs <- err
		})
	}
	wg.Wait()
	close(results)
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	var id, proof string
	issued := 0
	for claim := range results {
		if id != "" && id != claim.ResourceID {
			t.Fatal("duplicate domain resources")
		}
		id = claim.ResourceID
		if claim.Proof != "" {
			issued++
			proof = claim.Proof
		}
	}
	if issued != 1 {
		t.Fatal("proof was not returned exactly once")
	}
	resolver := txtResolverFunc(func(context.Context, string) ([]string, error) {
		_, err := s.pool.Exec(ctx, "UPDATE memberships SET active=false WHERE organization_id=$1 AND issuer=$2 AND subject=$3", org, p.Issuer, p.Subject)
		return []string{proof}, err
	})
	if _, err = s.VerifyDomainClaim(ctx, p, project, id, resolver); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("membership revocation during DNS ignored")
	}
	var state string
	if err = s.pool.QueryRow(ctx, "SELECT state FROM domain_claims WHERE project_id=$1 AND resource_id=$2", project, id).Scan(&state); err != nil || state != "pending" {
		t.Fatal("revoked actor changed state")
	}
}
