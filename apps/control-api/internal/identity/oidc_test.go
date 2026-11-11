package identity

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	jose "github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
)

func TestNegativeOIDCConfiguration(t *testing.T) {
	for _, issuer := range []string{"http://identity.example/", "https://user:password@identity.example/", "https://identity.example/#fragment", "https://identity.example/?token=secret", ""} {
		if _, err := New(context.Background(), issuer, "management-client"); err == nil {
			t.Fatal("accepted unsafe issuer")
		}
	}
}

type oidcFixture struct {
	server *httptest.Server
	roots  *x509.CertPool
	key    *ecdsa.PrivateKey
	mode   atomic.Int32
	traps  atomic.Int32
}

func newFixture(t *testing.T, expired, wrongHost bool) *oidcFixture {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1), NotBefore: now.Add(-time.Hour), NotAfter: now.Add(time.Hour),
		KeyUsage:    x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		IsCA:        true, BasicConstraintsValid: true,
	}
	if wrongHost {
		template.DNSNames = []string{"wrong.example"}
	} else {
		template.IPAddresses = []net.IP{net.ParseIP("127.0.0.1")}
	}
	if expired {
		template.NotAfter = now.Add(-time.Minute)
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	cert, err := x509.ParseCertificate(der)
	if err != nil {
		t.Fatal(err)
	}
	f := &oidcFixture{key: key, roots: x509.NewCertPool()}
	f.roots.AddCert(cert)
	f.server = httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			switch f.mode.Load() {
			case 1:
				http.Redirect(w, r, f.server.URL+"/trap", http.StatusFound)
				return
			case 2:
				_, _ = io.WriteString(w, strings.Repeat("x", (1<<20)+2))
				return
			}
			jwks := f.server.URL + "/jwks"
			if f.mode.Load() == 3 {
				jwks = "http://127.0.0.1:1/jwks"
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"issuer": f.server.URL, "jwks_uri": jwks,
				"authorization_endpoint": f.server.URL + "/authorize", "token_endpoint": f.server.URL + "/token",
				"id_token_signing_alg_values_supported": []string{"ES256"},
			})
		case "/jwks":
			if f.mode.Load() == 4 {
				w.WriteHeader(http.StatusServiceUnavailable)
				return
			}
			_ = json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: "fixture", Algorithm: "ES256", Use: "sig"}}})
		case "/trap":
			f.traps.Add(1)
			w.WriteHeader(http.StatusInternalServerError)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	f.server.Config.ErrorLog = log.New(io.Discard, "", 0)
	f.server.TLS = &tls.Config{MinVersion: tls.VersionTLS12, Certificates: []tls.Certificate{{Certificate: [][]byte{der}, PrivateKey: key}}}
	f.server.StartTLS()
	t.Cleanup(f.server.Close)
	return f
}

func (f *oidcFixture) token(t *testing.T, changes map[string]any, forged bool) string {
	t.Helper()
	key := f.key
	if forged {
		var err error
		key, err = ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			t.Fatal(err)
		}
	}
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: jose.JSONWebKey{Key: key, KeyID: "fixture"}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	claims := map[string]any{
		"iss": f.server.URL, "sub": "management-user", "aud": "management-client",
		"iat": now.Unix(), "exp": now.Add(time.Hour).Unix(), "nonce": strings.Repeat("n", 43),
	}
	for key, value := range changes {
		claims[key] = value
	}
	raw, err := jwt.Signed(signer).Claims(claims).Serialize()
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestIntegrationOIDCTLSAndClaims(t *testing.T) {
	f := newFixture(t, false, false)
	v, err := newWithRoots(context.Background(), f.server.URL, "management-client", f.roots)
	if err != nil {
		t.Fatal("trusted OIDC discovery failed")
	}
	login, err := v.Verify(context.Background(), f.token(t, nil, false), strings.Repeat("n", 43))
	if err != nil || login.Issuer != f.server.URL || login.Subject != "management-user" || time.Until(login.ExpiresAt) > 15*time.Minute {
		t.Fatal("valid OIDC login or bounded session failed")
	}
	for _, tc := range []struct {
		name   string
		claims map[string]any
		forged bool
	}{
		{"signature", nil, true},
		{"issuer", map[string]any{"iss": "https://wrong.example"}, false},
		{"audience", map[string]any{"aud": "traffic-client"}, false},
		{"expiry", map[string]any{"exp": time.Now().Add(-time.Minute).Unix()}, false},
		{"nonce", map[string]any{"nonce": strings.Repeat("x", 43)}, false},
		{"subject", map[string]any{"sub": ""}, false},
		{"old issuance", map[string]any{"iat": time.Now().Add(-time.Hour).Unix()}, false},
		{"future issuance", map[string]any{"iat": time.Now().Add(time.Minute).Unix()}, false},
		{"not before", map[string]any{"nbf": time.Now().Add(time.Minute).Unix()}, false},
		{"authorized party", map[string]any{"azp": "traffic-client"}, false},
		{"multiple audience", map[string]any{"aud": []string{"management-client", "traffic-client"}}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := v.Verify(context.Background(), f.token(t, tc.claims, tc.forged), strings.Repeat("n", 43)); err == nil {
				t.Fatal("invalid ID token accepted")
			}
		})
	}
}

func TestNegativeOIDCTLSAndFetching(t *testing.T) {
	t.Run("untrusted issuer certificate", func(t *testing.T) {
		f := newFixture(t, false, false)
		if _, err := New(context.Background(), f.server.URL, "management-client"); err == nil {
			t.Fatal("untrusted certificate accepted")
		}
	})
	for _, wrongHost := range []bool{false, true} {
		name := "expired certificate"
		if wrongHost {
			name = "wrong hostname certificate"
		}
		t.Run(name, func(t *testing.T) {
			f := newFixture(t, !wrongHost, wrongHost)
			if _, err := newWithRoots(context.Background(), f.server.URL, "management-client", f.roots); err == nil {
				t.Fatal("invalid trusted certificate accepted")
			}
		})
	}
	for _, tc := range []struct {
		name string
		mode int32
	}{{"redirect", 1}, {"oversize discovery", 2}, {"plaintext JWKS", 3}, {"unavailable JWKS", 4}} {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(t, false, false)
			f.mode.Store(tc.mode)
			v, err := newWithRoots(context.Background(), f.server.URL, "management-client", f.roots)
			if err == nil {
				_, err = v.Verify(context.Background(), f.token(t, nil, false), strings.Repeat("n", 43))
			}
			if err == nil || f.traps.Load() != 0 {
				t.Fatal("unsafe or failed OIDC fetch accepted")
			}
		})
	}
}
