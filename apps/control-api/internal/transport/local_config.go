package transport

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/application"
	"aegisgate.dev/aegisgate/apps/control-api/internal/identity"
	"aegisgate.dev/aegisgate/apps/control-api/internal/persistence"
)

type LocalAdminConfig struct {
	Origin         string `json:"origin"`
	DatabaseDSN    string `json:"database_dsn"`
	OIDCIssuer     string `json:"oidc_issuer"`
	OIDCClientID   string `json:"oidc_client_id"`
	OIDCCABundle   string `json:"oidc_ca_bundle,omitempty"`
	TLSCertificate string `json:"tls_certificate"`
	TLSPrivateKey  string `json:"tls_private_key"`
	DNSResolver    string `json:"dns_resolver"`
}

func privateFile(path string) ([]byte, error) {
	before, err := os.Lstat(path)
	if err != nil || !before.Mode().IsRegular() || before.Mode().Perm()&0077 != 0 || before.Size() > 16384 {
		return nil, errors.New("private file must be a bounded regular owner-only file")
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, errors.New("private file unavailable")
	}
	defer file.Close()
	after, err := file.Stat()
	if err != nil || !os.SameFile(before, after) || !after.Mode().IsRegular() || after.Mode().Perm()&0077 != 0 {
		return nil, errors.New("private file identity changed")
	}
	raw, err := io.ReadAll(io.LimitReader(file, 16385))
	if err != nil || len(raw) > 16384 {
		return nil, errors.New("private file exceeds limit")
	}
	return raw, nil
}

// LocalAdminServer never opens a public listener. Production management network
// policy and deployment remain later module gates.
func LocalAdminServer(ctx context.Context, addr, path string) (*http.Server, *persistence.Store, *net.Resolver, error) {
	if LocalAddress(addr) != nil {
		return nil, nil, nil, errors.New("management listener must be loopback")
	}
	raw, err := privateFile(path)
	if err != nil {
		return nil, nil, nil, err
	}
	var config LocalAdminConfig
	if application.Decode(raw, &config) != nil {
		return nil, nil, nil, errors.New("invalid local management configuration")
	}
	resolverHost, _, err := net.SplitHostPort(config.DNSResolver)
	if err != nil || net.ParseIP(resolverHost) == nil {
		return nil, nil, nil, errors.New("DNS resolver requires a configured literal address and port")
	}
	resolver := &net.Resolver{PreferGo: true, StrictErrors: true, Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
		return (&net.Dialer{Timeout: 2 * time.Second}).DialContext(ctx, network, config.DNSResolver)
	}}
	cert, err := os.ReadFile(config.TLSCertificate)
	if err != nil || len(cert) > 65536 {
		return nil, nil, nil, errors.New("management certificate unavailable")
	}
	key, err := privateFile(config.TLSPrivateKey)
	if err != nil {
		return nil, nil, nil, err
	}
	pair, err := tls.X509KeyPair(cert, key)
	if err != nil {
		return nil, nil, nil, errors.New("management TLS configuration invalid")
	}
	var roots *x509.CertPool
	if config.OIDCCABundle != "" {
		pem, err := os.ReadFile(config.OIDCCABundle)
		if err != nil || len(pem) > 65536 {
			return nil, nil, nil, errors.New("OIDC trust unavailable")
		}
		roots = x509.NewCertPool()
		if !roots.AppendCertsFromPEM(pem) {
			return nil, nil, nil, errors.New("OIDC trust invalid")
		}
	}
	verifier, err := identity.NewWithRoots(ctx, config.OIDCIssuer, config.OIDCClientID, roots)
	if err != nil {
		return nil, nil, nil, identity.ErrLogin
	}
	store, err := persistence.Open(ctx, config.DatabaseDSN)
	if err != nil {
		return nil, nil, nil, errors.New("management database unavailable")
	}
	handler, err := NewAdminHandler(AdminConfig{Service: &application.Service{Store: store, Resolver: resolver}, Identity: verifier, Origin: config.Origin, DNS: resolver})
	if err != nil {
		store.Close()
		return nil, nil, nil, err
	}
	server, err := NewServer(addr)
	if err != nil {
		store.Close()
		return nil, nil, nil, err
	}
	server.Handler = handler
	server.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12, Certificates: []tls.Certificate{pair}, NextProtos: []string{"h2", "http/1.1"}}
	return server, store, resolver, nil
}
