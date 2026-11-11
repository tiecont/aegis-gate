// Package domain owns control-plane invariants. Public edge destination
// verification must additionally happen on the concrete dial address in module04.
package domain

import (
	"context"
	"errors"
	"net"
	"net/netip"
	"net/url"
	"strings"
	"unicode"

	"golang.org/x/net/idna"
)

var ErrInvalid = errors.New("invalid resource")
var ErrDenied = errors.New("resource unavailable")
var ErrConflict = errors.New("resource conflict")

type Role string

const (
	Owner         Role = "owner"
	Admin         Role = "admin"
	SecurityAdmin Role = "security-admin"
	Developer     Role = "developer"
	BillingAdmin  Role = "billing-admin"
	Viewer        Role = "viewer"
)

func (r Role) Valid() bool {
	return r == Owner || r == Admin || r == SecurityAdmin || r == Developer || r == BillingAdmin || r == Viewer
}

// Explicit grants prevent a new action from inheriting an accidental permission.
func (r Role) Allows(action string) bool {
	if !r.Valid() {
		return false
	}
	switch action {
	case "read":
		return true
	case "members":
		return r == Owner
	case "projects", "domains", "origins", "routes":
		return r == Owner || r == Admin || r == Developer
	case "policies", "approve":
		return r == Owner || r == Admin || r == SecurityAdmin
	case "billing":
		return r == Owner || r == BillingAdmin
	default:
		return false
	}
}

func Hostname(raw string) (string, error) {
	if raw == "" || len(raw) > 1024 || strings.TrimSpace(raw) != raw || strings.ContainsAny(raw, "/\\:@?#%\x00") {
		return "", ErrInvalid
	}
	host, err := idna.Lookup.ToASCII(strings.TrimSuffix(raw, "."))
	if err != nil {
		return "", ErrInvalid
	}
	host = strings.ToLower(host)
	if len(host) > 253 || !strings.Contains(host, ".") {
		return "", ErrInvalid
	}
	if _, err := netip.ParseAddr(host); err == nil {
		return "", ErrInvalid
	}
	for _, label := range strings.Split(host, ".") {
		if len(label) == 0 || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return "", ErrInvalid
		}
		for _, c := range label {
			if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-') {
				return "", ErrInvalid
			}
		}
	}
	for _, suffix := range []string{".localhost", ".local", ".internal", ".invalid", ".test", ".home.arpa"} {
		if strings.HasSuffix(host, suffix) {
			return "", ErrInvalid
		}
	}
	return host, nil
}

var blockedPrefixes = func() []netip.Prefix {
	var result []netip.Prefix
	for _, cidr := range []string{
		"0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4",
		"::/96", "::ffff:0:0/96", "64:ff9b::/96", "64:ff9b:1::/48", "100::/64", "2001::/23", "2001:db8::/32", "2002::/16", "fc00::/7", "fe80::/10", "ff00::/8",
	} {
		result = append(result, netip.MustParsePrefix(cidr))
	}
	return result
}()

func PublicAddress(address netip.Addr) bool {
	if !address.IsValid() || address.Zone() != "" || !address.IsGlobalUnicast() || address.IsPrivate() || address.IsLoopback() || address.IsLinkLocalUnicast() || address.Is4In6() {
		return false
	}
	for _, prefix := range blockedPrefixes {
		if prefix.Contains(address) {
			return false
		}
	}
	return true
}

type Resolver interface {
	LookupNetIP(context.Context, string, string) ([]netip.Addr, error)
}

func Origin(ctx context.Context, raw string, resolver Resolver) (string, error) {
	if len(raw) > 2048 || strings.IndexFunc(raw, unicode.IsControl) >= 0 || strings.Contains(raw, "\\") {
		return "", ErrInvalid
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.User != nil || u.Opaque != "" || u.Fragment != "" || u.RawQuery != "" || (u.Path != "" && u.Path != "/") || u.RawPath != "" || (u.Port() != "" && u.Port() != "443") {
		return "", ErrInvalid
	}
	host, err := Hostname(u.Hostname())
	if err != nil {
		return "", ErrInvalid
	}
	if resolver == nil {
		resolver = net.DefaultResolver
	}
	addresses, err := resolver.LookupNetIP(ctx, "ip", host)
	if err != nil || len(addresses) == 0 || len(addresses) > 32 {
		return "", ErrInvalid
	}
	for _, address := range addresses {
		if !PublicAddress(address) {
			return "", ErrInvalid
		}
	}
	return "https://" + host, nil
}

func Route(path string, methods []string) bool {
	if len(path) == 0 || len(path) > 1024 || path[0] != '/' || strings.ContainsAny(path, "?#%\\") || strings.IndexFunc(path, unicode.IsControl) >= 0 || strings.Contains(path, "//") {
		return false
	}
	for _, part := range strings.Split(path, "/") {
		if part == "." || part == ".." {
			return false
		}
	}
	if len(methods) == 0 || len(methods) > 7 {
		return false
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

type Policy struct {
	AuthRequired bool   `json:"auth_required"`
	JWTIssuer    string `json:"jwt_issuer"`
	JWTAudience  string `json:"jwt_audience"`
}

func (p Policy) Validate() error {
	if !p.AuthRequired || p.JWTAudience == "" || len(p.JWTAudience) > 256 || strings.IndexFunc(p.JWTAudience, unicode.IsControl) >= 0 {
		return ErrInvalid
	}
	u, err := url.Parse(p.JWTIssuer)
	if err != nil || u.Scheme != "https" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return ErrInvalid
	}
	if _, err := Hostname(u.Hostname()); err != nil {
		return ErrInvalid
	}
	return nil
}
