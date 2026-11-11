package transport

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/application"
	"aegisgate.dev/aegisgate/apps/control-api/internal/identity"
	"aegisgate.dev/aegisgate/apps/control-api/internal/persistence"
	"aegisgate.dev/aegisgate/internal/contracts"
	jose "github.com/go-jose/go-jose/v4"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type labDNS struct {
	mu     sync.Mutex
	proofs map[string]string
}

func (d *labDNS) LookupNetIP(context.Context, string, string) ([]netip.Addr, error) {
	return []netip.Addr{netip.MustParseAddr("93.184.216.34")}, nil
}
func (d *labDNS) LookupTXT(_ context.Context, name string) ([]string, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	return []string{d.proofs[name]}, nil
}

type adminLab struct {
	server, idp *httptest.Server
	store       *persistence.Store
	pool        *pgxpool.Pool
	dns         *labDNS
	subject     atomic.Value
	tokenCalls  atomic.Int32
}

func newAdminLab(t *testing.T) *adminLab {
	t.Helper()
	if os.Getenv("AEGIS_TENANCY_INTEGRATION") != "1" {
		t.Skip("explicit local database integration requires AEGIS_TENANCY_INTEGRATION=1")
	}
	secret, err := os.ReadFile(filepath.Join("..", "..", "..", "..", ".local", "postgres-password"))
	if err != nil {
		t.Fatal("fixture secret missing")
	}
	dsn := &url.URL{Scheme: "postgres", User: url.UserPassword("aegisgate_local", strings.TrimSpace(string(secret))), Host: "127.0.0.1:54329", Path: "aegisgate_local"}
	q := dsn.Query()
	q.Set("sslmode", "disable")
	dsn.RawQuery = q.Encode()
	admin, err := pgxpool.New(context.Background(), dsn.String())
	if err != nil {
		t.Fatal("fixture database unavailable")
	}
	id, err := contracts.RequestID()
	if err != nil {
		t.Fatal(err)
	}
	schema := "http_test_" + strings.ReplaceAll(id, "-", "")
	if _, err = admin.Exec(context.Background(), "CREATE SCHEMA "+schema); err != nil {
		t.Fatal("fixture schema failed")
	}
	q.Set("search_path", schema)
	dsn.RawQuery = q.Encode()
	store, err := persistence.Open(context.Background(), dsn.String())
	if err != nil {
		t.Fatal("fixture store unavailable")
	}
	if err = store.Migrate(context.Background()); err != nil {
		t.Fatal(err)
	}
	pool, err := pgxpool.New(context.Background(), dsn.String())
	if err != nil {
		t.Fatal("fixture inspection pool failed")
	}
	lab := &adminLab{store: store, pool: pool, dns: &labDNS{proofs: map[string]string{}}}
	lab.subject.Store("owner-a")
	t.Cleanup(func() {
		pool.Close()
		store.Close()
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
		admin.Close()
	})
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	type grant struct{ nonce, challenge, redirect, subject string }
	var mu sync.Mutex
	codes := map[string]grant{}
	lab.idp = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			_ = json.NewEncoder(w).Encode(map[string]any{"issuer": lab.idp.URL, "jwks_uri": lab.idp.URL + "/jwks", "authorization_endpoint": lab.idp.URL + "/authorize", "token_endpoint": lab.idp.URL + "/token", "id_token_signing_alg_values_supported": []string{"ES256"}})
		case "/jwks":
			_ = json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: "fixture", Algorithm: "ES256", Use: "sig"}}})
		case "/authorize":
			query := r.URL.Query()
			if query.Get("client_id") != "management-client" || query.Get("code_challenge_method") != "S256" || len(query.Get("code_challenge")) != 43 || len(query.Get("nonce")) != 43 {
				w.WriteHeader(400)
				return
			}
			code, err := contracts.RequestID()
			if err != nil {
				w.WriteHeader(503)
				return
			}
			mu.Lock()
			codes[code] = grant{query.Get("nonce"), query.Get("code_challenge"), query.Get("redirect_uri"), lab.subject.Load().(string)}
			mu.Unlock()
			location, err := url.Parse(query.Get("redirect_uri"))
			if err != nil {
				w.WriteHeader(400)
				return
			}
			params := location.Query()
			params.Set("code", code)
			params.Set("state", query.Get("state"))
			location.RawQuery = params.Encode()
			http.Redirect(w, r, location.String(), 302)
		case "/token":
			lab.tokenCalls.Add(1)
			r.Body = http.MaxBytesReader(w, r.Body, 16384)
			if r.ParseForm() != nil {
				w.WriteHeader(400)
				return
			}
			mu.Lock()
			g, ok := codes[r.Form.Get("code")]
			delete(codes, r.Form.Get("code"))
			mu.Unlock()
			sum := sha256.Sum256([]byte(r.Form.Get("code_verifier")))
			if !ok || base64.RawURLEncoding.EncodeToString(sum[:]) != g.challenge || r.Form.Get("client_id") != "management-client" || r.Form.Get("redirect_uri") != g.redirect {
				w.WriteHeader(400)
				return
			}
			token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{"iss": lab.idp.URL, "sub": g.subject, "aud": "management-client", "iat": time.Now().Unix(), "exp": time.Now().Add(10 * time.Minute).Unix(), "nonce": g.nonce})
			token.Header["kid"] = "fixture"
			raw, err := token.SignedString(key)
			if err != nil {
				w.WriteHeader(503)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "fixture-unused", "token_type": "Bearer", "id_token": raw})
		default:
			w.WriteHeader(404)
		}
	}))
	t.Cleanup(lab.idp.Close)
	roots := x509.NewCertPool()
	roots.AddCert(lab.idp.Certificate())
	verifier, err := identity.NewWithRoots(context.Background(), lab.idp.URL, "management-client", roots)
	if err != nil {
		t.Fatal("trusted local OIDC failed")
	}
	var handler atomic.Value
	lab.server = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if value := handler.Load(); value != nil {
			value.(http.Handler).ServeHTTP(w, r)
		} else {
			w.WriteHeader(503)
		}
	}))
	t.Cleanup(lab.server.Close)
	h, err := NewAdminHandler(AdminConfig{Service: &application.Service{Store: store, Resolver: lab.dns}, Identity: verifier, Origin: lab.server.URL, DNS: lab.dns})
	if err != nil {
		t.Fatal(err)
	}
	handler.Store(h)
	return lab
}

func (l *adminLab) client(t *testing.T, subject string) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	roots.AddCert(l.server.Certificate())
	roots.AddCert(l.idp.Certificate())
	transport := l.server.Client().Transport.(*http.Transport).Clone()
	transport.TLSClientConfig.RootCAs = roots
	client := &http.Client{Transport: transport, Jar: jar, Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	t.Cleanup(transport.CloseIdleConnections)
	l.subject.Store(subject)
	resp, err := client.Get(l.server.URL + "/v1/login")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 302 {
		t.Fatal("login start failed", resp.StatusCode)
	}
	resp, err = client.Get(resp.Header.Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 302 {
		t.Fatal("PKCE authorization failed", resp.StatusCode)
	}
	callback := resp.Header.Get("Location")
	resp, err = client.Get(callback)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatal("callback failed", resp.StatusCode)
	}
	calls := l.tokenCalls.Load()
	resp, err = client.Get(callback)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 401 || calls != l.tokenCalls.Load() {
		t.Fatal("callback replay reached token exchange")
	}
	return client
}

func (l *adminLab) request(t *testing.T, client *http.Client, method, path, body string, headers map[string]string) (int, []byte, http.Header) {
	t.Helper()
	request, err := http.NewRequest(method, l.server.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", l.server.URL)
	u, _ := url.Parse(l.server.URL)
	for _, cookie := range client.Jar.Cookies(u) {
		if cookie.Name == csrfCookie {
			request.Header.Set("X-CSRF-Token", cookie.Value)
		}
	}
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	resp, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 32769))
	if err != nil || len(raw) > 32768 {
		t.Fatal("response bound failed")
	}
	assertResponseContract(t, method, path, resp.StatusCode, raw)
	return resp.StatusCode, raw, resp.Header
}
