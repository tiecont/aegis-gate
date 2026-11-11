package lab

import (
	"crypto/tls"
	"crypto/x509"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestIntegrationLocalPKIAndJWT(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "pki")
	if err := Generate(dir); err != nil {
		t.Fatal(err)
	}
	if err := Generate(dir); err == nil {
		t.Fatal("overwrote keys")
	}
	info, err := os.Stat(dir)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0700 {
		t.Fatal("unsafe directory mode")
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			t.Fatal(err)
		}
		if info.Mode().Perm() != 0600 {
			t.Fatalf("unsafe mode: %s", entry.Name())
		}
	}
	ca, err := os.ReadFile(filepath.Join(dir, "ca.pem"))
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	if !roots.AppendCertsFromPEM(ca) {
		t.Fatal("invalid CA")
	}
	key, err := os.ReadFile(filepath.Join(dir, "jwt.key"))
	if err != nil {
		t.Fatal(err)
	}
	private, err := jwt.ParseRSAPrivateKeyFromPEM(key)
	if err != nil {
		t.Fatal(err)
	}
	token, err := os.ReadFile(filepath.Join(dir, "valid.jwt"))
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := jwt.Parse(string(token), func(token *jwt.Token) (any, error) { return &private.PublicKey, nil }, jwt.WithValidMethods([]string{"RS256"}), jwt.WithIssuer("https://issuer.test/"), jwt.WithAudience("unsafe-local-api"), jwt.WithExpirationRequired())
	if err != nil || !parsed.Valid {
		t.Fatal("local JWT fixture verification failed")
	}
	for _, profile := range []struct {
		name, host string
		trusted    bool
		valid      bool
	}{{"origin-a", "origin-a.test", true, true}, {"origin-b", "origin-b.test", true, true}, {"origin-a", "wrong.test", true, false}, {"wrong-host", "origin-a.test", true, false}, {"expired", "origin-a.test", true, false}, {"origin-a", "origin-a.test", false, false}} {
		t.Run(profile.name+"-"+profile.host+"-trusted="+boolName(profile.trusted), func(t *testing.T) {
			cert, err := tls.LoadX509KeyPair(filepath.Join(dir, profile.name+".pem"), filepath.Join(dir, profile.name+".key"))
			if err != nil {
				t.Fatal(err)
			}
			srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(204) }))
			srv.TLS = &tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12}
			srv.StartTLS()
			defer srv.Close()
			conf := &tls.Config{MinVersion: tls.VersionTLS12, ServerName: profile.host}
			if profile.trusted {
				conf.RootCAs = roots
			}
			client := &http.Client{Transport: &http.Transport{TLSClientConfig: conf}, Timeout: 2 * time.Second}
			response, err := client.Get(srv.URL)
			if profile.valid {
				if err != nil {
					t.Fatal(err)
				}
				response.Body.Close()
			} else {
				if err == nil {
					response.Body.Close()
					t.Fatal("invalid TLS certificate accepted")
				}
			}
		})
	}
}
func boolName(v bool) string {
	if v {
		return "yes"
	}
	return "no"
}
