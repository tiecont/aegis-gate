package identity

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNegativeOIDCCrossOriginJWKS(t *testing.T) {
	keys := newFixture(t, false, false)
	var issuer *httptest.Server
	issuer = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issuer": issuer.URL, "jwks_uri": keys.server.URL + "/jwks",
			"id_token_signing_alg_values_supported": []string{"ES256"},
		})
	}))
	t.Cleanup(issuer.Close)
	keys.roots.AddCert(issuer.Certificate())
	v, err := newWithRoots(context.Background(), issuer.URL, "management-client", keys.roots)
	if err == nil {
		_, err = v.Verify(context.Background(), keys.token(t, map[string]any{"iss": issuer.URL}, false), strings.Repeat("n", 43))
	}
	if err == nil {
		t.Fatal("discovery metadata expanded the configured trusted origin")
	}
}

func TestNegativeOIDCUnknownLengthDiscoveryLimit(t *testing.T) {
	var issuer *httptest.Server
	issuer = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		_ = json.NewEncoder(w).Encode(map[string]any{
			"issuer": issuer.URL, "jwks_uri": issuer.URL + "/jwks",
			"id_token_signing_alg_values_supported": []string{"ES256"},
		})
		_, _ = w.Write([]byte(strings.Repeat(" ", (1<<20)+2)))
	}))
	t.Cleanup(issuer.Close)
	roots := newFixture(t, false, false).roots
	roots.AddCert(issuer.Certificate())
	if _, err := newWithRoots(context.Background(), issuer.URL, "management-client", roots); err == nil {
		t.Fatal("oversized chunked discovery was truncated into an accepted document")
	}
}
