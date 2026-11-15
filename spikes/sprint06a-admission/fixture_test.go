//go:build aegisgate_sprint06a_feasibility

package admission

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/internal/configconsumer"
	"aegisgate.dev/aegisgate/internal/configsnapshot"
	"github.com/golang-jwt/jwt/v5"
)

type keySource []byte

func (k keySource) CacheKey(context.Context) ([]byte, error) { return k, nil }

type state struct {
	now                atomic.Int64
	start              time.Time
	signer, next, root *configsnapshot.LocalSigner
	trust              *configsnapshot.TrustStore
	disk               *configconsumer.DiskLKG
	c                  *configconsumer.Consumer
	a                  *Adapter
	jwtKey             *ecdsa.PrivateKey
}

func setup(t *testing.T) *state {
	t.Helper()
	f := &state{start: time.Now().UTC().Truncate(time.Second)}
	f.now.Store(f.start.Unix())
	var err error
	f.signer, err = configsnapshot.NewLocalSigner("snapshot-old")
	must(t, err)
	f.next, err = configsnapshot.NewLocalSigner("snapshot-new")
	must(t, err)
	f.root, err = configsnapshot.NewLocalSigner("pinned-root")
	must(t, err)
	bundle, err := configsnapshot.SignTrustBundle(context.Background(), configsnapshot.TrustBundle{Environment: "sprint06a", Version: 1, IssuedAt: f.start, ExpiresAt: f.start.Add(6 * time.Hour), Keys: []configsnapshot.TrustedKey{f.trusted(f.signer), f.trusted(f.next)}}, f.root)
	must(t, err)
	f.trust, err = configsnapshot.Bootstrap(f.root.PublicKey(), "sprint06a", bundle, f.clock())
	must(t, err)
	key := make(keySource, 32)
	_, err = rand.Read(key)
	must(t, err)
	t.Cleanup(func() { clear(key) })
	dir := t.TempDir()
	must(t, os.Chmod(dir, 0700))
	f.disk, err = configconsumer.NewDiskLKG(dir, "sprint06a-b", key, 4<<20)
	must(t, err)
	f.c = f.consumer(t, 0)
	f.a = New(f.c, f.trust, "deployment-06a", f.clock)
	f.jwtKey, err = ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	must(t, err)
	return f
}
func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
func (f *state) clock() time.Time { return time.Unix(f.now.Load(), 0).UTC() }
func (f *state) trusted(s *configsnapshot.LocalSigner) configsnapshot.TrustedKey {
	return configsnapshot.TrustedKey{ID: s.KeyID(), PublicKey: s.PublicKey(), NotBefore: f.start.Add(-time.Hour), NotAfter: f.start.Add(12 * time.Hour)}
}
func (f *state) consumer(t *testing.T, floor uint64) *configconsumer.Consumer {
	t.Helper()
	c, err := configconsumer.New(configconsumer.Options{DeploymentID: "deployment-06a", Trust: f.trust, Persistence: f.disk, MaxStaleness: time.Hour, MaxReaders: 6, MaxRetainedGenerations: 3, MinimumGeneration: floor, Clock: f.clock})
	must(t, err)
	return c
}
func (f *state) artifact(t *testing.T, generation, resource uint64, signer *configsnapshot.LocalSigner) ([]byte, configconsumer.Notice, []byte) {
	t.Helper()
	e := configsnapshot.Envelope{DeploymentID: "deployment-06a", Generation: generation, CreatedAt: f.clock(), ValidFrom: f.clock(), ExpiresAt: f.clock().Add(2 * time.Hour)}
	s := Sidecar{Deployment: e.DeploymentID, Generation: generation, CreatedAt: e.CreatedAt, ExpiresAt: e.ExpiresAt}
	for _, id := range []string{"a", "b"} {
		tenant := "tenant-" + id
		host := "api-" + id + ".example.com"
		e.Payload.Tenants = append(e.Payload.Tenants, configsnapshot.Tenant{ID: tenant, Domains: []configsnapshot.Domain{{ID: "domain", TenantID: tenant, Hostname: host, VerifiedUntil: f.clock().Add(3 * time.Hour)}}, OriginPools: []configsnapshot.OriginPool{{ID: "pool", TenantID: tenant, Generation: resource, Endpoints: []configsnapshot.Endpoint{{ID: "endpoint", TenantID: tenant, Generation: resource, URL: "https://origin-" + id + ".example.com"}}}}, Policies: []configsnapshot.Policy{{ID: "policy", TenantID: tenant, Generation: resource, AuthRequired: true, JWTIssuer: "https://issuer-" + id + ".example.com", JWTAudience: "audience-" + id}}, Routes: []configsnapshot.Route{{ID: "route", TenantID: tenant, Generation: resource, DomainID: "domain", PolicyID: "policy", OriginPoolID: "pool", Path: "/v1", Methods: []string{"POST", "GET"}}}})
		s.Bindings = append(s.Bindings, Binding{Tenant: tenant, Route: "route", RouteGeneration: resource, PolicyGeneration: resource, PoolGeneration: resource, EndpointGeneration: resource, Profile: "strict_finite", MaxWireBytes: MaxWireBytes, RequestMillis: RequestMillis})
	}
	raw, err := configsnapshot.Sign(context.Background(), e, signer)
	must(t, err)
	s.SnapshotDigest = digest(raw)
	sidecar, err := SignSidecar(context.Background(), s, signer)
	must(t, err)
	return raw, configconsumer.Notice{DeploymentID: e.DeploymentID, Generation: generation, Digest: digest(raw), Location: "https://store.example.com/" + digest(raw)}, sidecar
}
func (f *state) apply(t *testing.T, g, r uint64, signer *configsnapshot.LocalSigner) {
	t.Helper()
	raw, n, sidecar := f.artifact(t, g, r, signer)
	must(t, f.a.Apply(context.Background(), n, raw, sidecar))
}
func (f *state) token(t *testing.T, id, kind string) string {
	t.Helper()
	claims := jwt.RegisteredClaims{Issuer: "https://issuer-" + id + ".example.com", Audience: jwt.ClaimStrings{"audience-" + id}, Subject: "fixture-subject", IssuedAt: jwt.NewNumericDate(f.clock()), NotBefore: jwt.NewNumericDate(f.clock().Add(-time.Minute)), ExpiresAt: jwt.NewNumericDate(f.clock().Add(time.Minute))}
	if kind == "expired" {
		claims.ExpiresAt = jwt.NewNumericDate(f.clock().Add(-time.Second))
	}
	if kind == "audience" {
		claims.Audience = jwt.ClaimStrings{"foreign"}
	}
	if kind == "issuer" {
		claims.Issuer = "https://foreign.example.com"
	}
	if kind == "future" {
		claims.NotBefore = jwt.NewNumericDate(f.clock().Add(time.Minute))
	}
	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	token.Header["kid"] = "fixture-jwt"
	if kind == "kid" {
		token.Header["kid"] = "unknown"
	}
	raw, err := token.SignedString(f.jwtKey)
	must(t, err)
	if kind == "tampered" {
		parts := bytes.Split([]byte(raw), []byte("."))
		parts[2][0] ^= 1
		raw = string(bytes.Join(parts, []byte(".")))
	}
	return "Bearer " + raw
}

type pki struct {
	ca     []byte
	pool   *x509.CertPool
	caCert *x509.Certificate
	caKey  *ecdsa.PrivateKey
	dir    string
}

func certificates(t *testing.T) *pki {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	must(t, err)
	cert := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "sprint06a-b disposable CA"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), IsCA: true, BasicConstraintsValid: true, KeyUsage: x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature}
	der, err := x509.CreateCertificate(rand.Reader, cert, cert, &key.PublicKey, key)
	must(t, err)
	ca := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(ca) {
		t.Fatal("fixture CA")
	}
	p := &pki{ca: ca, pool: pool, caCert: cert, caKey: key, dir: t.TempDir()}
	must(t, os.Chmod(p.dir, 0700))
	must(t, os.WriteFile(filepath.Join(p.dir, "ca.pem"), ca, 0600))
	return p
}
func (p *pki) issue(t *testing.T, name string) tls.Certificate {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	must(t, err)
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 120))
	must(t, err)
	template := &x509.Certificate{SerialNumber: serial, DNSNames: []string{name}, Subject: pkix.Name{CommonName: name}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
	der, err := x509.CreateCertificate(rand.Reader, template, p.caCert, &key.PublicKey, p.caKey)
	must(t, err)
	keyDER, err := x509.MarshalECPrivateKey(key)
	must(t, err)
	certBytes := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyBytes := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
	defer clear(keyBytes)
	must(t, os.WriteFile(filepath.Join(p.dir, name+".pem"), certBytes, 0600))
	must(t, os.WriteFile(filepath.Join(p.dir, name+".key"), keyBytes, 0600))
	pair, err := tls.X509KeyPair(certBytes, keyBytes)
	must(t, err)
	return pair
}
func tlsServer(t *testing.T, p *pki, name string, h http.Handler) (string, *http.Server) {
	t.Helper()
	listener, err := net.Listen("tcp4", "127.0.0.1:0")
	must(t, err)
	server := &http.Server{Handler: h, TLSConfig: &tls.Config{Certificates: []tls.Certificate{p.issue(t, name)}, MinVersion: tls.VersionTLS12, NextProtos: []string{"http/1.1"}}, ReadHeaderTimeout: time.Second, ReadTimeout: 4 * time.Second, WriteTimeout: 4 * time.Second, MaxHeaderBytes: 24576, ErrorLog: log.New(io.Discard, "", 0)}
	done := make(chan struct{})
	go func() { defer close(done); _ = server.Serve(tls.NewListener(listener, server.TLSConfig)) }()
	t.Cleanup(func() {
		_ = server.Close()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Error("fixture server join")
		}
	})
	return listener.Addr().String(), server
}
func safeJSON(t *testing.T, path string, v any) {
	t.Helper()
	raw, err := json.Marshal(v)
	must(t, err)
	must(t, os.WriteFile(path, raw, 0600))
}
