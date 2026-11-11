package transport

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"aegisgate.dev/aegisgate/internal/contracts"
)

func TestHealth(t *testing.T) {
	for _, tt := range []struct {
		path   string
		status int
	}{{"/healthz", 200}, {"/readyz", 503}, {"/v1/projects", 404}} {
		rr := httptest.NewRecorder()
		NewHandler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, tt.path, nil))
		if rr.Code != tt.status {
			t.Fatalf("%s got %d", tt.path, rr.Code)
		}
		if rr.Header().Get("X-Request-ID") == "" {
			t.Fatal("missing correlation id")
		}
	}
}

func TestNegativeSpoofedTenantAndSecrets(t *testing.T) {
	const secret = "fixture-secret-never-reflect"
	for _, tenant := range []string{"tenant-a", "tenant-b"} {
		req := httptest.NewRequest(http.MethodGet, "/v1/projects/other?token="+secret, nil)
		req.Header.Set("X-Tenant-ID", tenant)
		req.Header.Set("X-Request-ID", secret)
		req.Header.Set("Authorization", "Bearer "+secret)
		rr := httptest.NewRecorder()
		NewHandler().ServeHTTP(rr, req)
		if rr.Code != 404 {
			t.Fatalf("tenant header gained access: %d", rr.Code)
		}
		if strings.Contains(rr.Body.String(), secret) || strings.Contains(rr.Body.String(), tenant) || strings.Contains(rr.Header().Get("X-Request-ID"), secret) {
			t.Fatal("untrusted input reflected")
		}
		var envelope contracts.ErrorEnvelope
		if err := json.Unmarshal(rr.Body.Bytes(), &envelope); err != nil {
			t.Fatal(err)
		}
		if envelope.Error.Code != "not_found" {
			t.Fatal("unexpected error")
		}
	}
}

func TestNegativePublicListener(t *testing.T) {
	for _, addr := range []string{"0.0.0.0:8080", ":8080", "[::]:8080", "192.0.2.1:8080", "localhost:8080", "invalid"} {
		if _, err := NewServer(addr); err == nil {
			t.Fatalf("accepted unsafe listener %q", addr)
		}
	}
	for _, addr := range []string{"127.0.0.1:0", "[::1]:8080"} {
		if _, err := NewServer(addr); err != nil {
			t.Fatal(err)
		}
	}
}

func TestIntegrationHTTP(t *testing.T) {
	srv := httptest.NewServer(NewHandler())
	defer srv.Close()
	response, err := srv.Client().Get(srv.URL + "/readyz")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != 503 {
		t.Fatal("foundation falsely ready")
	}
}
