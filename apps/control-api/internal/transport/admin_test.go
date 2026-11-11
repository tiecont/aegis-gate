package transport

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"aegisgate.dev/aegisgate/apps/control-api/internal/persistence"
)

func TestIntegrationAdminHTTPIsolationAndOIDC(t *testing.T) {
	lab := newAdminLab(t)
	a := lab.client(t, "owner-a")
	b := lab.client(t, "owner-b")
	viewer := lab.client(t, "viewer-a")
	call := func(client *http.Client, method, path, body string, headers map[string]string, want int) []byte {
		t.Helper()
		status, raw, responseHeaders := lab.request(t, client, method, path, body, headers)
		if status != want {
			t.Fatalf("%s %s: status %d, want %d", method, path, status, want)
		}
		if responseHeaders.Get("Access-Control-Allow-Origin") != "" || responseHeaders.Get("Cache-Control") != "no-store" {
			t.Fatal("unsafe response headers")
		}
		return raw
	}
	createID := func(client *http.Client, path, body, key string) string {
		t.Helper()
		raw := call(client, "POST", path, body, map[string]string{"Idempotency-Key": key}, 200)
		var result struct {
			ID string `json:"id"`
		}
		if json.Unmarshal(raw, &result) != nil || len(result.ID) != 36 {
			t.Fatal("missing generated ID")
		}
		return result.ID
	}
	orgA := createID(a, "/v1/organizations", `{"name":"A"}`, "")
	orgB := createID(b, "/v1/organizations", `{"name":"B"}`, "")
	projectA := createID(a, "/v1/organizations/"+orgA+"/projects", `{"name":"A"}`, "")
	projectB := createID(b, "/v1/organizations/"+orgB+"/projects", `{"name":"B"}`, "")
	member, _ := json.Marshal(map[string]string{"issuer": lab.idp.URL, "subject": "viewer-a", "role": "viewer"})
	call(a, "POST", "/v1/organizations/"+orgA+"/members", string(member), nil, 200)
	if raw := call(b, "GET", "/v1/organizations", "", nil, 200); strings.Contains(string(raw), orgA) || !strings.Contains(string(raw), orgB) {
		t.Fatal("organization list crossed tenants")
	}
	call(b, "GET", "/v1/organizations/"+orgA+"/projects", "", nil, 404)
	call(b, "POST", "/v1/organizations/"+orgA+"/projects", `{"name":"attack"}`, nil, 404)
	call(b, "POST", "/v1/organizations/"+orgA+"/members", string(member), nil, 404)
	base := "/v1/projects/" + projectA
	var claim struct {
		ID, Hostname, State, Proof string
		TXTName                    string `json:"txt_name"`
	}
	raw := call(a, "POST", base+"/domains", `{"hostname":"API.Example.COM."}`, map[string]string{"Idempotency-Key": "domain-key-http"}, 200)
	if json.Unmarshal(raw, &claim) != nil || claim.Proof == "" {
		t.Fatal("domain proof missing")
	}
	origin := createID(a, base+"/origins", `{"url":"https://origin.example.com"}`, "origin-key-http")
	policy := createID(a, base+"/policies", `{"auth_required":true,"jwt_issuer":"https://identity.example.com","jwt_audience":"traffic"}`, "policy-key-http")
	routeBody := fmt.Sprintf(`{"domain_id":%q,"origin_id":%q,"policy_id":%q,"path":"/v1","methods":["GET"]}`, claim.ID, origin, policy)
	route := createID(a, base+"/routes", routeBody, "route-key-http")
	call(a, "POST", base+"/routes/"+route+"/approve", "", map[string]string{"If-Match": "\"1\""}, 409)
	lab.dns.mu.Lock()
	lab.dns.proofs[claim.TXTName] = claim.Proof
	lab.dns.mu.Unlock()
	job := createID(a, base+"/domains/"+claim.ID+"/verifications", "", "")
	if ran, err := lab.store.RunDomainVerification(context.Background(), lab.dns); err != nil || !ran {
		t.Fatal("async DNS worker failed", err)
	}
	if raw := call(a, "GET", base+"/domain-verifications/"+job, "", nil, 200); !strings.Contains(string(raw), "succeeded") {
		t.Fatal("job result unavailable")
	}
	call(a, "POST", base+"/routes/"+route+"/approve", "", map[string]string{"If-Match": "\"1\""}, 200)
	spoof := map[string]string{"X-Tenant-ID": orgA, "X-Forwarded-Host": "api.example.com", "X-Forwarded-For": "127.0.0.1", "Idempotency-Key": "attacker-key-http", "If-Match": "\"1\""}
	for _, resource := range []struct{ kind, id, body string }{{"domains", claim.ID, `{"hostname":"attack.example.com"}`}, {"origins", origin, `{"url":"https://evil.example.com"}`}, {"policies", policy, `{"auth_required":false}`}, {"routes", route, routeBody}} {
		t.Run("cross tenant "+resource.kind, func(t *testing.T) {
			path := base + "/" + resource.kind
			call(b, "GET", path+"?tenant_id="+orgA, "", spoof, 404)
			call(b, "GET", path+"/"+resource.id, "", spoof, 404)
			call(b, "GET", "/v1/projects/"+projectB+"/"+resource.kind+"/"+resource.id, "", spoof, 404)
			call(b, "GET", path+"/"+resource.id+"/revisions/1", "", spoof, 404)
			call(b, "POST", path, resource.body, spoof, 404)
			if resource.kind != "domains" {
				call(b, "PUT", path+"/"+resource.id, resource.body, spoof, 404)
			}
			call(viewer, "GET", path, "", nil, 200)
			call(viewer, "POST", path, resource.body, spoof, 404)
		})
	}
	call(b, "GET", base+"/audit", "", nil, 404)
	call(b, "GET", base+"/domain-verifications/"+job, "", nil, 404)
	call(b, "POST", base+"/domains/"+claim.ID+"/verifications", "", nil, 404)
	call(viewer, "POST", base+"/routes/"+route+"/approve", "", map[string]string{"If-Match": "\"1\""}, 404)
	call(a, "PUT", base+"/origins/"+origin, `{"url":"https://changed.example.com"}`, map[string]string{"If-Match": "\"1\""}, 200)
	call(a, "PUT", base+"/origins/"+origin, `{"url":"https://stale.example.com"}`, map[string]string{"If-Match": "\"1\""}, 409)
	if raw := call(a, "GET", base+"/origins/"+origin+"/revisions/1", "", nil, 200); strings.Contains(string(raw), "changed.example.com") {
		t.Fatal("immutable HTTP preview changed")
	}
	for _, bad := range []string{`{"url":"http://origin.example.com"}`, `{"url":"https://127.0.0.1"}`, `{"url":"https://origin.example.com","tenant_id":"forged"}`} {
		call(a, "POST", base+"/origins", bad, map[string]string{"Idempotency-Key": "negative-origin-key"}, 400)
	}
	call(a, "POST", base+"/policies", `{"auth_required":false}`, map[string]string{"Idempotency-Key": "negative-policy-key"}, 400)
	call(a, "POST", base+"/origins", `{"url":"https://origin.example.com"}`, map[string]string{"X-CSRF-Token": "forged", "Idempotency-Key": "forged-csrf-key"}, 404)
	call(a, "POST", base+"/origins", `{"url":"https://origin.example.com"}`, map[string]string{"Origin": "https://evil.example", "Idempotency-Key": "forged-origin-key"}, 404)
	if raw := call(a, "GET", base+"/audit", "", nil, 200); !strings.Contains(string(raw), "management_denied") || strings.Contains(string(raw), claim.Proof) {
		t.Fatal("denial audit missing or leaked proof")
	}
	call(a, "GET", base+"/origins?limit=101", "", nil, 400)
	u, _ := url.Parse(lab.server.URL)
	var token string
	for _, cookie := range b.Jar.Cookies(u) {
		if cookie.Name == sessionCookie {
			token = cookie.Value
		}
	}
	if _, err := lab.pool.Exec(context.Background(), "UPDATE admin_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1", persistence.TokenHash(token)); err != nil {
		t.Fatal(err)
	}
	call(b, "GET", base+"/origins", "", nil, 401)
	call(a, "POST", "/v1/logout", "", nil, 200)
	call(a, "GET", "/v1/session", "", nil, 401)
}
