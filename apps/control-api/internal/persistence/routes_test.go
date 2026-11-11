package persistence

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
)

func TestIntegrationRouteReferencesApprovalAndImmutablePreview(t *testing.T) {
	s, _ := localStore(t)
	ctx := context.Background()
	a, b := Principal{"https://management.example", "owner-a"}, Principal{"https://management.example", "owner-b"}
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
	viewer, developer, security := Principal{a.Issuer, "viewer"}, Principal{a.Issuer, "developer"}, Principal{a.Issuer, "security"}
	for _, member := range []struct {
		p    Principal
		role domain.Role
	}{{viewer, domain.Viewer}, {developer, domain.Developer}, {security, domain.SecurityAdmin}} {
		if err := s.AddMember(testMFA(a), a, orgA, member.p, member.role); err != nil {
			t.Fatal(err)
		}
	}
	claim, err := s.CreateDomainClaim(ctx, a, projectA, "route.example.com", "route-domain-key")
	if err != nil {
		t.Fatal(err)
	}
	origin, err := s.CreateDraft(ctx, a, projectA, "origin", "origin-key-a", json.RawMessage(`{"url":"https://origin.example.com"}`))
	if err != nil {
		t.Fatal(err)
	}
	policy, err := s.CreateDraft(testMFA(a), a, projectA, "policy", "policy-key-a", json.RawMessage(`{"auth_required":true,"jwt_issuer":"https://identity.example.com","jwt_audience":"traffic"}`))
	if err != nil {
		t.Fatal(err)
	}
	foreign, err := s.CreateDraft(ctx, b, projectB, "origin", "origin-key-b", origin.Spec)
	if err != nil {
		t.Fatal(err)
	}
	spec := RouteSpec{DomainID: claim.ResourceID, OriginID: origin.ID, PolicyID: policy.ID, Path: "/v1", Methods: []string{"GET"}}
	bad := spec
	bad.OriginID = foreign.ID
	if _, err = s.CreateRouteDraft(ctx, a, projectA, "cross-route-key", bad); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross-tenant route reference accepted")
	}
	if _, err = s.CreateRouteDraft(ctx, b, projectA, "cross-route-key", spec); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross-tenant route mutation")
	}
	route, err := s.CreateRouteDraft(ctx, developer, projectA, "route-key-a", spec)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.ApproveRoute(testMFA(a), a, projectA, route.ID, 1); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("pending domain approved")
	}
	if _, err = s.VerifyDomainClaim(ctx, a, projectA, claim.ResourceID, txtResolverFunc(func(context.Context, string) ([]string, error) { return []string{claim.Proof}, nil })); err != nil {
		t.Fatal(err)
	}
	for _, p := range []Principal{b, viewer, developer} {
		if _, err = s.ApproveRoute(ctx, p, projectA, route.ID, 1); !errors.Is(err, domain.ErrDenied) {
			t.Fatal("unauthorized approval")
		}
	}
	approved, err := s.ApproveRoute(testMFA(security), security, projectA, route.ID, 1)
	if err != nil || approved.PolicyGeneration != 1 || approved.OriginGeneration != 1 {
		t.Fatal("valid route approval failed", err)
	}
	if _, err = s.ApproveRoute(testMFA(a), a, projectA, route.ID, 2); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("stale revision approval")
	}
	spec.Path = "/v2"
	revised, err := s.ReviseRouteDraft(ctx, developer, projectA, route.ID, 1, spec)
	if err != nil || revised.Generation != 2 {
		t.Fatal("route revision failed", err)
	}
	old, err := s.Revision(ctx, viewer, projectA, "route", route.ID, 1)
	if err != nil || string(old.Spec) == string(revised.Spec) {
		t.Fatal("immutable revision preview lost", err)
	}
	if _, err = s.Revision(ctx, b, projectA, "route", route.ID, 1); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross-tenant revision preview")
	}
	if _, err = s.ReviseRouteDraft(ctx, a, projectA, route.ID, 1, spec); !errors.Is(err, domain.ErrConflict) {
		t.Fatal("stale route ETag accepted")
	}
	if _, err = s.ReviseRouteDraft(ctx, a, projectA, route.ID, 2, bad); !errors.Is(err, domain.ErrDenied) {
		t.Fatal("cross-tenant revised binding")
	}
	initial := spec
	initial.Path = "/v1"
	retried, err := s.CreateRouteDraft(ctx, developer, projectA, "route-key-a", initial)
	if err != nil || retried.Generation != 1 {
		t.Fatal("idempotent creation returned mutable revision", err)
	}
	if _, err = s.pool.Exec(ctx, "DELETE FROM route_approvals WHERE project_id=$1", projectA); err == nil {
		t.Fatal("approval history mutable")
	}
	var count int
	if err = s.pool.QueryRow(ctx, "SELECT count(*) FROM route_approvals WHERE project_id=$1 AND route_id=$2 AND route_generation=1", projectA, route.ID).Scan(&count); err != nil || count != 1 {
		t.Fatal("approval changed with draft")
	}
	first, second := spec, spec
	first.Path = "/collision"
	second.Path = first.Path
	r1, err := s.CreateRouteDraft(ctx, a, projectA, "collision-key-1", first)
	if err != nil {
		t.Fatal(err)
	}
	r2, err := s.CreateRouteDraft(ctx, a, projectA, "collision-key-2", second)
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for _, id := range []string{r1.ID, r2.ID} {
		wg.Go(func() { _, err := s.ApproveRoute(testMFA(a), a, projectA, id, 1); errs <- err })
	}
	wg.Wait()
	close(errs)
	allowed, conflicted := 0, 0
	for err := range errs {
		if err == nil {
			allowed++
		} else if errors.Is(err, domain.ErrConflict) {
			conflicted++
		} else {
			t.Fatal(err)
		}
	}
	if allowed != 1 || conflicted != 1 {
		t.Fatal("concurrent conflicting routes both approved")
	}
	var winner string
	if err = s.pool.QueryRow(ctx, "SELECT route_id FROM active_route_approvals WHERE project_id=$1 AND route_id=ANY($2::uuid[]) AND NOT retired", projectA, []string{r1.ID, r2.ID}).Scan(&winner); err != nil {
		t.Fatal(err)
	}
	loser := r1.ID
	if loser == winner {
		loser = r2.ID
	}
	if err = s.RetireRoute(testMFA(a), a, projectA, winner, 1); err != nil {
		t.Fatal("retire collision", err)
	}
	if _, err = s.ApproveRoute(testMFA(a), a, projectA, loser, 1); err != nil {
		t.Fatal("retirement did not release collision", err)
	}
	moved := first
	moved.Path = "/moved"
	if _, err = s.ReviseRouteDraft(ctx, a, projectA, loser, 1, moved); err != nil {
		t.Fatal(err)
	}
	if _, err = s.ApproveRoute(testMFA(a), a, projectA, loser, 2); err != nil {
		t.Fatal("replace active approval", err)
	}
	if _, err = s.ApproveRoute(testMFA(a), a, projectA, winner, 1); err != nil {
		t.Fatal("historical approval still reserves collision", err)
	}
	if _, err = s.pool.Exec(ctx, "UPDATE route_retirements SET subject='forged'"); err == nil {
		t.Fatal("mutable retirement history")
	}
}
