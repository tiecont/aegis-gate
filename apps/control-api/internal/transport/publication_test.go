package transport

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"aegisgate.dev/aegisgate/apps/control-api/internal/persistence"
)

func TestIntegrationPublicationHTTPPreviewApprovalRollbackNegative(t *testing.T) {
	lab := newAdminLab(t)
	owner := lab.client(t, "owner-a")
	foreign := lab.client(t, "owner-b")
	viewer := lab.client(t, "viewer-a")
	call := func(client *http.Client, method, path, body string, headers map[string]string, want int) []byte {
		t.Helper()
		status, raw, _ := lab.request(t, client, method, path, body, headers)
		if status != want {
			t.Fatalf("%s %s status%d want%d: %s", method, path, status, want, raw)
		}
		return raw
	}
	create := func(path, body, key string) string {
		t.Helper()
		raw := call(owner, "POST", path, body, map[string]string{"Idempotency-Key": key}, 200)
		var result struct{ ID string }
		if json.Unmarshal(raw, &result) != nil || result.ID == "" {
			t.Fatal("missing created id")
		}
		return result.ID
	}
	org := create("/v1/organizations", `{"name":"publication"}`, "")
	project := create("/v1/organizations/"+org+"/projects", `{"name":"config"}`, "")
	member, _ := json.Marshal(map[string]string{"issuer": lab.idp.URL, "subject": "viewer-a", "role": "viewer"})
	call(owner, "POST", "/v1/organizations/"+org+"/members", string(member), nil, 200)
	base := "/v1/projects/" + project
	var claim persistence.DomainClaim
	raw := call(owner, "POST", base+"/domains", `{"hostname":"publication.example.com"}`, map[string]string{"Idempotency-Key": "domain-publication"}, 200)
	if json.Unmarshal(raw, &claim) != nil {
		t.Fatal("domain response")
	}
	lab.dns.mu.Lock()
	lab.dns.proofs[claim.TXTName] = claim.Proof
	lab.dns.mu.Unlock()
	call(owner, "POST", base+"/domains/"+claim.ResourceID+"/verifications", "", nil, 200)
	if ran, err := lab.store.RunDomainVerification(context.Background(), lab.dns); err != nil || !ran {
		t.Fatal("owned DNS verification", err)
	}
	origin := create(base+"/origins", `{"url":"https://origin.example.com"}`, "origin-publication")
	policy := create(base+"/policies", `{"auth_required":true,"jwt_issuer":"https://identity.example.com","jwt_audience":"api"}`, "policy-publication")
	route := create(base+"/routes", fmt.Sprintf(`{"domain_id":%q,"origin_id":%q,"policy_id":%q,"path":"/v1","methods":["GET"]}`, claim.ResourceID, origin, policy), "route-publication")
	call(owner, "POST", base+"/routes/"+route+"/approve", "", map[string]string{"If-Match": "\"1\""}, 200)
	path := base + "/publications"
	var preview persistence.PublicationPreview
	raw = call(owner, "GET", path+"/preview", "", nil, 200)
	if json.Unmarshal(raw, &preview) != nil || len(preview.Payload.Tenants) != 1 || len(preview.Payload.Tenants[0].Routes) != 1 {
		t.Fatal("whole snapshot preview missing approved route")
	}
	call(viewer, "GET", path+"/preview", "", nil, 200)
	spoof := map[string]string{"X-Tenant-ID": project, "X-Forwarded-Host": claim.Hostname, "Idempotency-Key": "attack-publication"}
	call(foreign, "GET", path+"/preview", "", spoof, 404)
	request := fmt.Sprintf(`{"digest":%q,"ttl_seconds":3600}`, preview.Digest)
	call(foreign, "POST", path, request, spoof, 404)
	call(viewer, "POST", path, request, spoof, 404)
	call(owner, "POST", path, request, map[string]string{"Idempotency-Key": "csrf-publication", "X-CSRF-Token": "forged"}, 404)
	for _, invalid := range []string{`{"digest":"bad","ttl_seconds":3600}`, `{"digest":"` + preview.Digest + `","ttl_seconds":0}`, `{"digest":"` + preview.Digest + `","ttl_seconds":86401}`, `{"digest":"` + preview.Digest + `","ttl_seconds":3600,"auth_required":false}`} {
		call(owner, "POST", path, invalid, map[string]string{"Idempotency-Key": "invalid-publication"}, 400)
	}
	call(owner, "POST", path, request, nil, 400)
	call(owner, "POST", path, `{"digest":"`+strings.Repeat("0", 64)+`","ttl_seconds":3600}`, map[string]string{"Idempotency-Key": "stale-publication"}, 409)
	lab.claimsMode.Store("no-mfa")
	withoutMFA := lab.client(t, "owner-a")
	lab.claimsMode.Store("")
	call(withoutMFA, "POST", path, request, map[string]string{"Idempotency-Key": "mfa-publication", "X-MFA": "true"}, 404)
	var approved persistence.Publication
	raw = call(owner, "POST", path, request, map[string]string{"Idempotency-Key": "approve-publication"}, 200)
	if json.Unmarshal(raw, &approved) != nil || approved.Generation != 1 || approved.DeploymentID != project {
		t.Fatal("approved generation")
	}
	raw = call(owner, "POST", path, request, map[string]string{"Idempotency-Key": "approve-publication"}, 200)
	var retry persistence.Publication
	json.Unmarshal(raw, &retry)
	if retry != approved {
		t.Fatal("idempotent approval changed")
	}
	rollback := `{"generation":1,"ttl_seconds":3600}`
	call(foreign, "POST", path+"/rollback", rollback, spoof, 404)
	call(viewer, "POST", path+"/rollback", rollback, spoof, 404)
	call(owner, "POST", path+"/rollback", `{"generation":0,"ttl_seconds":3600}`, map[string]string{"Idempotency-Key": "rollback-publication"}, 400)
	raw = call(owner, "POST", path+"/rollback", rollback, map[string]string{"Idempotency-Key": "rollback-publication"}, 200)
	var rolled persistence.Publication
	json.Unmarshal(raw, &rolled)
	if rolled.Generation != 2 || rolled.RollbackOf != 1 || rolled.Digest != approved.Digest {
		t.Fatal("rollback was not new monotonic approved content")
	}
	var revisions, outbox int
	if err := lab.pool.QueryRow(context.Background(), "SELECT count(*) FROM config_revisions WHERE project_id=$1", project).Scan(&revisions); err != nil {
		t.Fatal(err)
	}
	if err := lab.pool.QueryRow(context.Background(), "SELECT count(*) FROM config_outbox WHERE project_id=$1", project).Scan(&outbox); err != nil {
		t.Fatal(err)
	}
	if revisions != 2 || outbox != 2 {
		t.Fatal("denied HTTP publication created durable work")
	}
}
