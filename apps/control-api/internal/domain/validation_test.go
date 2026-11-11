package domain

import (
	"context"
	"net/netip"
	"testing"
)

type fixedResolver []netip.Addr

func (r fixedResolver) LookupNetIP(context.Context, string, string) ([]netip.Addr, error) {
	return r, nil
}

func TestHostnameAndOrigin(t *testing.T) {
	for raw, want := range map[string]string{"API.Example.COM.": "api.example.com", "bücher.example": "xn--bcher-kva.example"} {
		got, err := Hostname(raw)
		if err != nil || got != want {
			t.Fatalf("%s: %s %v", raw, got, err)
		}
	}
	got, err := Origin(context.Background(), "https://ORIGIN.example:443/", fixedResolver{netip.MustParseAddr("8.8.8.8")})
	if err != nil || got != "https://origin.example" {
		t.Fatal(got, err)
	}
}

func TestNegativeHostAndSSRF(t *testing.T) {
	for _, host := range []string{"localhost", "api.localhost", "a.internal", "a..example", "-a.example", "a.example:443", "127.0.0.1", "[::1]", "a.example\n", "a%2eexample", "a.example/path"} {
		if _, err := Hostname(host); err == nil {
			t.Fatalf("accepted host %q", host)
		}
	}
	for _, address := range []string{"127.0.0.1", "10.0.0.1", "169.254.169.254", "100.100.100.200", "192.0.2.1", "::", "::1", "::ffff:8.8.8.8", "fe80::1", "fc00::1", "64:ff9b::a00:1", "2002:7f00:1::"} {
		if PublicAddress(netip.MustParseAddr(address)) {
			t.Fatalf("accepted SSRF address %s", address)
		}
	}
	for _, raw := range []string{"http://origin.example", "https://user:password@origin.example", "https://origin.example:8443", "https://origin.example/path", "https://origin.example/?token=secret", "https://origin.example/#fragment", "https://origin.example\\@internal.local", "https://127.0.0.1"} {
		if _, err := Origin(context.Background(), raw, fixedResolver{netip.MustParseAddr("8.8.8.8")}); err == nil {
			t.Fatalf("accepted origin %s", raw)
		}
	}
	for _, addresses := range []fixedResolver{nil, {netip.MustParseAddr("8.8.8.8"), netip.MustParseAddr("127.0.0.1")}} {
		if _, err := Origin(context.Background(), "https://origin.example", addresses); err == nil {
			t.Fatal("accepted empty/mixed DNS")
		}
	}
}

func TestNegativeRolesAndPolicies(t *testing.T) {
	for _, role := range []Role{Owner, Admin, SecurityAdmin, Developer, BillingAdmin, Viewer} {
		if !role.Allows("read") || role.Allows("unknown-action") {
			t.Fatal(role)
		}
	}
	if Viewer.Allows("policies") || Developer.Allows("approve") || SecurityAdmin.Allows("billing") || Admin.Allows("members") || Role("superuser").Allows("read") {
		t.Fatal("role escalation")
	}
	for _, p := range []Policy{{}, {AuthRequired: true}, {AuthRequired: true, JWTIssuer: "http://id.example", JWTAudience: "api"}, {AuthRequired: true, JWTIssuer: "https://id.example/", JWTAudience: "a\nb"}} {
		if p.Validate() == nil {
			t.Fatal("accepted incomplete policy")
		}
	}
	for _, path := range []string{"", "//a", "/../a", "/a%2fb", "/a?secret=1"} {
		if Route(path, []string{"GET"}) {
			t.Fatal(path)
		}
	}
	if !Route("/v1/", []string{"GET", "POST"}) || Route("/v1", []string{"CONNECT"}) || Route("/v1", []string{"GET", "GET"}) {
		t.Fatal("method validation")
	}
}
