package transport

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"aegisgate.dev/aegisgate/apps/control-api/internal/persistence"
)

func TestIntegrationAdminNegativeSessionAuthorityAndMembership(t *testing.T) {
	lab := newAdminLab(t)
	client := lab.client(t, "owner-a")
	u, _ := url.Parse(lab.server.URL)
	var session, csrf string
	for _, cookie := range client.Jar.Cookies(u) {
		if cookie.Name == sessionCookie {
			session = cookie.Value
		}
		if cookie.Name == csrfCookie {
			csrf = cookie.Value
		}
	}
	request := func(method, path, body string, modify func(*http.Request), want int) {
		t.Helper()
		r, err := http.NewRequest(method, lab.server.URL+path, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		r.Header.Set("Cookie", sessionCookie+"="+session)
		r.Header.Set("X-CSRF-Token", csrf)
		r.Header.Set("Origin", lab.server.URL)
		r.Header.Set("Content-Type", "application/json")
		if modify != nil {
			modify(r)
		}
		plain := *client
		plain.Jar = nil
		resp, err := plain.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != want {
			t.Fatalf("negative %s: got %d want %d", path, resp.StatusCode, want)
		}
	}
	request("GET", "/v1/session", "", func(r *http.Request) { r.Header.Del("Cookie"); r.Header.Set("Authorization", "Bearer forged") }, 401)
	request("GET", "/v1/session", "", func(r *http.Request) { r.Header.Add("Cookie", sessionCookie+"="+session) }, 401)
	request("GET", "/v1/session", "", func(r *http.Request) { r.Host = "other.example" }, 404)
	request("POST", "/v1/organizations", `{"name":"A"}`, func(r *http.Request) { r.Header.Del("X-CSRF-Token") }, 404)
	request("POST", "/v1/organizations", strings.Repeat("x", 16385), nil, 400)
	request("POST", "/v1/organizations", `{"name":"A","tenant_id":"forged"}`, nil, 400)
	request("OPTIONS", "/v1/organizations", "", nil, 404)
	p := persistence.Principal{Issuer: lab.idp.URL, Subject: "owner-a"}
	org, err := lab.store.CreateOrganization(context.Background(), p, "A")
	if err != nil {
		t.Fatal(err)
	}
	project, err := lab.store.CreateProject(context.Background(), p, org, "A")
	if err != nil {
		t.Fatal(err)
	}
	member := persistence.Principal{Issuer: lab.idp.URL, Subject: "member"}
	if err = lab.store.AddMember(context.Background(), p, org, member, "developer"); err != nil {
		t.Fatal(err)
	}
	memberClient := lab.client(t, "member")
	status, _, _ := lab.request(t, memberClient, "GET", "/v1/projects/"+project+"/origins", "", nil)
	if status != 200 {
		t.Fatal("authorized member denied")
	}
	if err = lab.store.RevokeMember(context.Background(), p, org, member); err != nil {
		t.Fatal(err)
	}
	status, _, _ = lab.request(t, memberClient, "GET", "/v1/projects/"+project+"/origins", "", nil)
	if status != 404 {
		t.Fatal("revoked membership still authorized")
	}
}
