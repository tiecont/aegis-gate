package transport

import (
	"encoding/json"
	"fmt"
	"testing"
)

func TestIntegrationHTTPExplicitRoleMatrix(t *testing.T) {
	lab := newAdminLab(t)
	owner := lab.client(t, "owner")
	status, raw, _ := lab.request(t, owner, "POST", "/v1/organizations", `{"name":"roles"}`, nil)
	if status != 200 {
		t.Fatal(status)
	}
	var org struct{ ID string }
	json.Unmarshal(raw, &org)
	status, raw, _ = lab.request(t, owner, "POST", "/v1/organizations/"+org.ID+"/projects", `{"name":"roles"}`, nil)
	if status != 200 {
		t.Fatal(status)
	}
	var project struct{ ID string }
	json.Unmarshal(raw, &project)
	base := "/v1/projects/" + project.ID
	for _, role := range []string{"owner", "admin", "security-admin", "developer", "billing-admin", "viewer"} {
		t.Run(role, func(t *testing.T) {
			client := owner
			if role != "owner" {
				body := fmt.Sprintf(`{"issuer":%q,"subject":%q,"role":%q}`, lab.idp.URL, role, role)
				status, _, _ = lab.request(t, owner, "POST", "/v1/organizations/"+org.ID+"/members", body, nil)
				if status != 200 {
					t.Fatal("role seed", status)
				}
				client = lab.client(t, role)
			}
			status, _, _ = lab.request(t, client, "GET", base+"/origin-pools", "", nil)
			if status != 200 {
				t.Fatal("member read", status)
			}
			want := 404
			if role == "owner" || role == "admin" || role == "developer" {
				want = 200
			}
			status, _, _ = lab.request(t, client, "POST", base+"/origin-pools", fmt.Sprintf(`{"name":%q}`, role), map[string]string{"Idempotency-Key": "role-pool-" + role})
			if status != want {
				t.Fatal("origin role permission", status, want)
			}
			want = 404
			if role == "owner" || role == "admin" || role == "security-admin" {
				want = 200
			}
			status, _, _ = lab.request(t, client, "POST", base+"/policies", `{"auth_required":true,"jwt_issuer":"https://identity.example.com","jwt_audience":"traffic"}`, map[string]string{"Idempotency-Key": "role-policy-" + role})
			if status != want {
				t.Fatal("security role permission", status, want)
			}
			want = 404
			if role == "owner" {
				want = 200
			}
			status, _, _ = lab.request(t, client, "POST", "/v1/organizations/"+org.ID+"/members", fmt.Sprintf(`{"issuer":%q,"subject":%q,"role":"viewer"}`, lab.idp.URL, "created-by-"+role), nil)
			if status != want {
				t.Fatal("membership role permission", status, want)
			}
		})
	}
}
