package configsnapshot

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"net/netip"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/santhosh-tekuri/jsonschema/v6"
	"golang.org/x/net/idna"
)

//go:embed schema-v1.json
var schemaBytes []byte

// SchemaBytes returns a defensive copy of the exact versioned wire schema.
func SchemaBytes() []byte { return bytes.Clone(schemaBytes) }

var schemaOnce sync.Once
var compiled *jsonschema.Schema
var schemaError error

func validateRequired(raw []byte) error {
	schemaOnce.Do(func() {
		var document any
		schemaError = json.Unmarshal(schemaBytes, &document)
		if schemaError != nil {
			return
		}
		c := jsonschema.NewCompiler()
		schemaError = c.AddResource("https://aegisgate.invalid/config-v1.json", document)
		if schemaError == nil {
			compiled, schemaError = c.Compile("https://aegisgate.invalid/config-v1.json")
		}
	})
	if schemaError != nil {
		return fail("internal")
	}
	var value any
	if json.Unmarshal(raw, &value) != nil || compiled.Validate(value) != nil {
		return fail("schema")
	}
	return nil
}

var idPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$`)

func identifier(s string) bool { return idPattern.MatchString(s) }
func gen(n uint64) bool        { return n > 0 && n <= MaxGeneration }
func hostname(s string) bool {
	if len(s) > 253 || !strings.Contains(s, ".") || strings.ToLower(s) != s || strings.HasSuffix(s, ".") {
		return false
	}
	if _, err := netip.ParseAddr(s); err == nil {
		return false
	}
	ascii, err := idna.Lookup.ToASCII(s)
	if err != nil || ascii != s {
		return false
	}
	for _, label := range strings.Split(s, ".") {
		if len(label) < 1 || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, r := range label {
			if !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-') {
				return false
			}
		}
	}
	for _, suffix := range []string{".localhost", ".local", ".internal", ".invalid", ".test", ".home.arpa"} {
		if strings.HasSuffix(s, suffix) {
			return false
		}
	}
	return true
}
func secureURL(raw string, origin bool) bool {
	if len(raw) == 0 || len(raw) > 2048 || strings.ContainsAny(raw, "\\?#") || strings.IndexFunc(raw, unicode.IsControl) >= 0 {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.User != nil || u.Opaque != "" || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || u.RawFragment != "" || !hostname(u.Hostname()) || (u.Port() != "" && u.Port() != "443") {
		return false
	}
	if origin && (u.Path != "" && u.Path != "/" || u.RawPath != "") {
		return false
	}
	return true
}
func pathAndMethods(path string, methods []string) bool {
	if len(path) == 0 || len(path) > 1024 || path[0] != '/' || strings.ContainsAny(path, "?#%\\") || strings.IndexFunc(path, unicode.IsControl) >= 0 || strings.Contains(path, "//") || len(methods) == 0 || len(methods) > 7 {
		return false
	}
	for _, part := range strings.Split(path, "/") {
		if part == "." || part == ".." {
			return false
		}
	}
	seen := map[string]bool{}
	for _, method := range methods {
		if seen[method] {
			return false
		}
		seen[method] = true
		switch method {
		case "GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS":
		default:
			return false
		}
	}
	return true
}

// Validate checks the complete read-model without performing DNS or any network
// IO. Public-origin concrete dial-address validation remains mandatory in 04.
func Validate(payload Payload, now time.Time) error {
	if len(payload.Tenants) > 128 {
		return fail("bounds")
	}
	tenants := map[string]bool{}
	hosts := map[string]bool{}
	total := 0
	for _, t := range payload.Tenants {
		if !identifier(t.ID) || tenants[t.ID] {
			return fail("tenant")
		}
		tenants[t.ID] = true
		total += len(t.Domains) + len(t.OriginPools) + len(t.Policies) + len(t.Routes)
		if total > 8192 || len(t.Domains) > 1024 || len(t.OriginPools) > 1024 || len(t.Policies) > 1024 || len(t.Routes) > 4096 {
			return fail("bounds")
		}
		domains := map[string]Domain{}
		pools := map[string]bool{}
		policies := map[string]bool{}
		routes := map[string]bool{}
		matches := map[string]bool{}
		for _, d := range t.Domains {
			if d.TenantID != t.ID || !identifier(d.ID) {
				return fail("tenant_reference")
			}
			if _, ok := domains[d.ID]; ok {
				return fail("duplicate")
			}
			if !hostname(d.Hostname) || hosts[d.Hostname] {
				return fail("hostname")
			}
			if d.VerifiedUntil.IsZero() || !d.VerifiedUntil.After(now) || d.VerifiedUntil.Location() != time.UTC || d.VerifiedUntil.Nanosecond() != 0 {
				return fail("domain_expired")
			}
			hosts[d.Hostname] = true
			domains[d.ID] = d
		}
		for _, p := range t.OriginPools {
			if p.TenantID != t.ID || !identifier(p.ID) {
				return fail("tenant_reference")
			}
			if pools[p.ID] {
				return fail("duplicate")
			}
			if !gen(p.Generation) || len(p.Endpoints) == 0 || len(p.Endpoints) > 64 {
				return fail("origin")
			}
			pools[p.ID] = true
			endpoints := map[string]bool{}
			urls := map[string]bool{}
			total += len(p.Endpoints)
			if total > 8192 {
				return fail("bounds")
			}
			for _, ep := range p.Endpoints {
				if ep.TenantID != t.ID || !identifier(ep.ID) {
					return fail("tenant_reference")
				}
				if endpoints[ep.ID] || urls[ep.URL] {
					return fail("duplicate")
				}
				if !gen(ep.Generation) || !secureURL(ep.URL, true) {
					return fail("origin")
				}
				endpoints[ep.ID] = true
				urls[ep.URL] = true
			}
		}
		for _, p := range t.Policies {
			if p.TenantID != t.ID || !identifier(p.ID) {
				return fail("tenant_reference")
			}
			if policies[p.ID] {
				return fail("duplicate")
			}
			if !gen(p.Generation) || !p.AuthRequired || !secureURL(p.JWTIssuer, false) || len(p.JWTAudience) == 0 || len(p.JWTAudience) > 256 || strings.IndexFunc(p.JWTAudience, unicode.IsControl) >= 0 {
				return fail("auth_policy")
			}
			policies[p.ID] = true
		}
		for _, r := range t.Routes {
			if r.TenantID != t.ID || !identifier(r.ID) {
				return fail("tenant_reference")
			}
			if routes[r.ID] {
				return fail("duplicate")
			}
			routes[r.ID] = true
			if !gen(r.Generation) || !pathAndMethods(r.Path, r.Methods) {
				return fail("route")
			}
			if _, ok := domains[r.DomainID]; !ok {
				return fail("tenant_reference")
			}
			if !pools[r.OriginPoolID] || !policies[r.PolicyID] {
				return fail("tenant_reference")
			}
			for _, method := range r.Methods {
				key := r.DomainID + "\x00" + r.Path + "\x00" + method
				if matches[key] {
					return fail("route_collision")
				}
				matches[key] = true
			}
		}
	}
	return nil
}
