package transport

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/persistence"
)

func TestIntegrationPoolHTTPRoutesPreviewAndRetirement(t *testing.T) {
	lab := newAdminLab(t)
	a := lab.client(t, "owner-a")
	b := lab.client(t, "owner-b")
	viewer := lab.client(t, "viewer-a")
	call := func(c *http.Client, method, path, body string, headers map[string]string, want int) []byte {
		t.Helper()
		status, raw, _ := lab.request(t, c, method, path, body, headers)
		if status != want {
			t.Fatalf("%s %s status=%d want=%d", method, path, status, want)
		}
		return raw
	}
	create := func(c *http.Client, path, body, key string) string {
		t.Helper()
		raw := call(c, "POST", path, body, map[string]string{"Idempotency-Key": key}, 200)
		var v struct {
			ID string `json:"id"`
		}
		if json.Unmarshal(raw, &v) != nil || len(v.ID) != 36 {
			t.Fatal("missing ID")
		}
		return v.ID
	}
	org := create(a, "/v1/organizations", `{"name":"A"}`, "")
	other := create(b, "/v1/organizations", `{"name":"B"}`, "")
	project := create(a, "/v1/organizations/"+org+"/projects", `{"name":"A"}`, "")
	otherProject := create(b, "/v1/organizations/"+other+"/projects", `{"name":"B"}`, "")
	member, _ := json.Marshal(map[string]string{"issuer": lab.idp.URL, "subject": "viewer-a", "role": "viewer"})
	call(a, "POST", "/v1/organizations/"+org+"/members", string(member), nil, 200)
	base := "/v1/projects/" + project
	pool := create(a, base+"/origin-pools", `{"name":"primary"}`, "pool-http-key")
	poolPath := base + "/origin-pools/" + pool
	var ep persistence.Endpoint
	raw := call(a, "POST", poolPath+"/endpoints", `{"url":"https://origin.example.com"}`, map[string]string{"Idempotency-Key": "endpoint-http-key", "If-Match": "\"1\""}, 200)
	if json.Unmarshal(raw, &ep) != nil || ep.ID == "" {
		t.Fatal("endpoint response")
	}
	call(a, "POST", poolPath+"/approve", "", map[string]string{"If-Match": "\"2\""}, 200)
	var claim persistence.DomainClaim
	raw = call(a, "POST", base+"/domains", `{"hostname":"pool-route.example.com"}`, map[string]string{"Idempotency-Key": "pool-domain-http"}, 200)
	if json.Unmarshal(raw, &claim) != nil {
		t.Fatal("claim response")
	}
	lab.dns.mu.Lock()
	lab.dns.proofs[claim.TXTName] = claim.Proof
	lab.dns.mu.Unlock()
	call(a, "POST", base+"/domains/"+claim.ResourceID+"/verifications", "", nil, 200)
	if ran, err := lab.store.RunDomainVerification(context.Background(), lab.dns); err != nil || !ran {
		t.Fatal("owned DNS worker", err)
	}
	policy := create(a, base+"/policies", `{"auth_required":true,"jwt_issuer":"https://identity.example.com","jwt_audience":"traffic"}`, "pool-policy-http")
	routeBody := fmt.Sprintf(`{"domain_id":%q,"origin_pool_id":%q,"policy_id":%q,"path":"/v1","methods":["GET"]}`, claim.ResourceID, pool, policy)
	route := create(a, base+"/routes", routeBody, "pool-route-http")
	routePath := base + "/routes/" + route
	if raw = call(a, "GET", routePath+"/preview?from=1&to=1", "", nil, 200); !strings.Contains(string(raw), `"approvable":true`) {
		t.Fatal("route preview", string(raw))
	}
	call(a, "POST", routePath+"/approve", "", map[string]string{"If-Match": "\"1\""}, 200)
	if raw = call(a, "GET", base+"/domains/"+claim.ResourceID, "", nil, 200); !strings.Contains(string(raw), `"active"`) {
		t.Fatal("active domain")
	}
	spoof := map[string]string{"X-Tenant-ID": org, "X-Forwarded-Host": claim.Hostname, "Idempotency-Key": "bola-http-key", "If-Match": "\"1\""}
	for _, path := range []string{base + "/origin-pools", poolPath, poolPath + "/endpoints", poolPath + "/endpoints/" + ep.ID, poolPath + "/endpoints/" + ep.ID + "/revisions/1", poolPath + "/revisions/2", poolPath + "/preview?from=1&to=2", routePath + "/preview?from=1&to=1", "/v1/organizations/" + org + "/audit"} {
		call(b, "GET", path, "", spoof, 404)
		call(viewer, "GET", path, "", nil, 200)
	}
	call(b, "GET", "/v1/projects/"+otherProject+"/origin-pools/"+pool, "", spoof, 404)
	call(b, "POST", base+"/origin-pools", `{"name":"attack"}`, spoof, 404)
	call(b, "POST", poolPath+"/endpoints", `{"url":"https://attack.example.com"}`, spoof, 404)
	call(b, "PUT", poolPath+"/endpoints/"+ep.ID, `{"url":"https://attack.example.com","state":"active"}`, spoof, 404)
	call(b, "PUT", poolPath, `{"name":"attack","state":"retired"}`, spoof, 404)
	call(b, "POST", poolPath+"/approve", "", spoof, 404)
	call(b, "POST", routePath+"/retire", "", spoof, 404)
	call(b, "POST", base+"/domains/"+claim.ResourceID+"/reverify", "", spoof, 404)
	call(viewer, "POST", poolPath+"/approve", "", map[string]string{"If-Match": "\"2\""}, 404)
	call(a, "PUT", poolPath+"/endpoints/"+ep.ID, `{"url":"https://changed.example.com","state":"active"}`, map[string]string{"If-Match": "\"1\""}, 200)
	call(a, "POST", routePath+"/approve", "", map[string]string{"If-Match": "\"1\""}, 409)
	call(a, "POST", poolPath+"/approve", "", map[string]string{"If-Match": "\"3\""}, 200)
	call(a, "POST", routePath+"/approve", "", map[string]string{"If-Match": "\"1\""}, 200)
	if raw = call(a, "GET", poolPath+"/preview?from=2&to=3", "", nil, 200); !strings.Contains(string(raw), `"endpoints"`) {
		t.Fatal("pool diff")
	}
	call(a, "POST", routePath+"/retire", "", map[string]string{"If-Match": "\"1\""}, 200)
	if raw = call(a, "GET", base+"/domains/"+claim.ResourceID, "", nil, 200); !strings.Contains(string(raw), `"verified"`) {
		t.Fatal("retired last route did not release active domain")
	}
	call(a, "PUT", poolPath, `{"name":"primary","state":"retired"}`, map[string]string{"If-Match": "\"3\""}, 200)
	call(a, "POST", base+"/domains/"+claim.ResourceID+"/reverify", "", map[string]string{"If-Match": "\"1\""}, 200)
}

func TestIntegrationOIDCRotationOutageCallbacksAndMFA(t *testing.T) {
	t.Run("rotation-and-outage", func(t *testing.T) {
		lab := newAdminLab(t)
		a := lab.client(t, "owner-a")
		initial := lab.jwksCalls.Load()
		time.Sleep(1100 * time.Millisecond)
		key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			t.Fatal(err)
		}
		lab.signing.Store(key)
		lab.kid.Add(1)
		lab.client(t, "owner-b")
		if lab.jwksCalls.Load() <= initial {
			t.Fatal("key rotation did not refresh")
		}
		lab.tokenOutage.Store(true)
		lab.clientStatus(t, "failed", 401)
		calls := lab.tokenCalls.Load()
		lab.clientStatus(t, "failed-again", 401)
		if lab.tokenCalls.Load() != calls {
			t.Fatal("IdP outage fetch backoff absent")
		}
		status, _, _ := lab.request(t, a, "GET", "/v1/session", "", nil)
		if status != 200 {
			t.Fatal("existing bounded session lost on IdP outage")
		}
	})
	t.Run("jwks-outage", func(t *testing.T) {
		lab := newAdminLab(t)
		lab.client(t, "owner-a")
		time.Sleep(1100 * time.Millisecond)
		key, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		lab.signing.Store(key)
		lab.kid.Add(1)
		lab.jwksOutage.Store(true)
		lab.clientStatus(t, "failed", 401)
		calls := lab.jwksCalls.Load()
		lab.clientStatus(t, "failed-again", 401)
		if calls != lab.jwksCalls.Load() {
			t.Fatal("JWKS outage backoff absent")
		}
		lab.jwksOutage.Store(false)
		time.Sleep(2100 * time.Millisecond)
		lab.client(t, "recovered")
	})
	for _, mode := range []string{"nonce", "audience", "expired", "signature"} {
		t.Run(mode, func(t *testing.T) {
			lab := newAdminLab(t)
			lab.claimsMode.Store(mode)
			c := lab.clientStatus(t, "invalid", 401)
			status, _, _ := lab.request(t, c, "GET", "/v1/session", "", nil)
			if status != 401 {
				t.Fatal("invalid callback minted session")
			}
		})
	}
	for _, mode := range []string{"no-mfa", "stale-mfa", "future-mfa"} {
		t.Run(mode, func(t *testing.T) {
			lab := newAdminLab(t)
			lab.claimsMode.Store(mode)
			c := lab.client(t, "owner-a")
			status, raw, _ := lab.request(t, c, "POST", "/v1/organizations", `{"name":"MFA"}`, nil)
			if status != 200 {
				t.Fatal("normal session denied")
			}
			var org struct{ ID string }
			json.Unmarshal(raw, &org)
			headers := map[string]string{"X-MFA": "true", "X-Auth-Time": fmt.Sprint(time.Now().Unix())}
			body := fmt.Sprintf(`{"issuer":%q,"subject":"member","role":"admin"}`, lab.idp.URL)
			status, _, _ = lab.request(t, c, "POST", "/v1/organizations/"+org.ID+"/members", body, headers)
			if status != 404 {
				t.Fatal("unverified or stale MFA accepted")
			}
		})
	}
	t.Run("callback-query", func(t *testing.T) {
		lab := newAdminLab(t)
		c := lab.client(t, "owner-a")
		calls := lab.tokenCalls.Load()
		for _, query := range []string{"state=wrong&code=wrong", "state=a&state=b&code=c", "state=a&code=c&error=denied", "state=a&code=c&bad=%zz", "state=a", "code=x"} {
			resp, err := c.Get(lab.server.URL + "/v1/callback?" + query)
			if err != nil {
				t.Fatal(err)
			}
			resp.Body.Close()
			if resp.StatusCode != 401 {
				t.Fatal("malformed callback accepted")
			}
		}
		if lab.tokenCalls.Load() != calls {
			t.Fatal("invalid callback reached token endpoint")
		}
		u, _ := url.Parse(lab.server.URL)
		for _, cookie := range c.Jar.Cookies(u) {
			if cookie.Name == loginCookie {
				t.Fatal("login browser cookie retained")
			}
		}
	})
}
