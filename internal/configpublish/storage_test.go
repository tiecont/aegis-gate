package configpublish

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestNegativeImmutableStorageCrashRecoveryAndRetention(t *testing.T) {
	root := t.TempDir()
	if err := os.Chmod(root, 0700); err != nil {
		t.Fatal(err)
	}
	s, err := OpenLocalStore(root, "https://artifacts.example.com", 2)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	raw := []byte(`{"deployment_id":"tenant-a","value":1}`)
	sum := sha256.Sum256(raw)
	digest := hex.EncodeToString(sum[:])
	// Simulate abrupt process death leaving a partial stage file.
	if err = os.WriteFile(filepath.Join(root, ".stage-"+digest), []byte("partial"), 0600); err != nil {
		t.Fatal(err)
	}
	location, err := s.Put(context.Background(), raw)
	if err != nil || location != "https://artifacts.example.com/artifacts/"+digest {
		t.Fatal("crash retry", err)
	}
	if _, err = s.Put(context.Background(), raw); err != nil {
		t.Fatal("idempotent store", err)
	}
	if _, err = os.Lstat(filepath.Join(root, ".stage-"+digest)); !os.IsNotExist(err) {
		t.Fatal("staged file retained")
	}
	second := []byte(`{"deployment_id":"tenant-a","value":2}`)
	loc2, err := s.Put(context.Background(), second)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.Put(context.Background(), []byte(`{"value":3}`)); err == nil {
		t.Fatal("quota unbounded")
	}
	if err = os.Chmod(filepath.Join(root, digest), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Put(context.Background(), raw); err == nil {
		t.Fatal("insecure stored permission accepted")
	}
	if err = os.Chmod(filepath.Join(root, digest), 0600); err != nil {
		t.Fatal(err)
	}
	// Retention preserves explicit active/pending/rollback references and only
	// removes old unreferenced artifacts, within the caller's requested batch.
	old := time.Now().Add(-72 * time.Hour)
	if err = os.Chtimes(filepath.Join(root, digest), old, old); err != nil {
		t.Fatal(err)
	}
	digest2 := strings.TrimPrefix(loc2, "https://artifacts.example.com/artifacts/")
	if err = os.Chtimes(filepath.Join(root, digest2), old, old); err != nil {
		t.Fatal(err)
	}
	n, err := s.Prune(context.Background(), []string{digest}, time.Now().Add(-48*time.Hour), 1)
	if err != nil || n != 1 {
		t.Fatal("retention", n, err)
	}
	if _, err = os.Stat(filepath.Join(root, digest)); err != nil {
		t.Fatal("active artifact removed")
	}
	if _, err = os.Stat(filepath.Join(root, digest2)); !os.IsNotExist(err) {
		t.Fatal("unreferenced old artifact retained")
	}
	if _, err = s.Prune(context.Background(), nil, time.Now(), 1); err == nil {
		t.Fatal("retention less than24h")
	}
	if err = os.WriteFile(filepath.Join(root, digest), []byte(`{"tampered":true}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Put(context.Background(), raw); err == nil {
		t.Fatal("artifact replacement repaired silently")
	}
}

func TestNegativeArtifactHandlerRequiresVerifiedIdentityAndDeployment(t *testing.T) {
	root := t.TempDir()
	_ = os.Chmod(root, 0700)
	store, err := OpenLocalStore(root, "https://artifacts.example.com", 8)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	raw := []byte(`{"deployment_id":"tenant-a"}`)
	location, err := store.Put(context.Background(), raw)
	if err != nil {
		t.Fatal(err)
	}
	handler := store.Handler(map[string][]string{"spiffe://aegisgate.local/edge-a": {"tenant-a"}, "spiffe://aegisgate.local/edge-b": {"tenant-b"}})
	uri, _ := url.Parse("spiffe://aegisgate.local/edge-a")
	cert := &x509.Certificate{URIs: []*url.URL{uri}}
	for _, tc := range []struct {
		name   string
		state  *tls.ConnectionState
		path   string
		status int
	}{
		{"plaintext", nil, location, http.StatusForbidden},
		{"unverified", &tls.ConnectionState{PeerCertificates: []*x509.Certificate{cert}}, location, http.StatusForbidden},
		{"valid", &tls.ConnectionState{PeerCertificates: []*x509.Certificate{cert}, VerifiedChains: [][]*x509.Certificate{{cert}}}, location, http.StatusOK},
		{"traversal", &tls.ConnectionState{PeerCertificates: []*x509.Certificate{cert}, VerifiedChains: [][]*x509.Certificate{{cert}}}, "https://artifacts.example.com/artifacts/../secrets", http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			req.TLS = tc.state
			out := httptest.NewRecorder()
			handler.ServeHTTP(out, req)
			if out.Code != tc.status {
				t.Fatal(out.Code)
			}
			if out.Code == 200 {
				got, _ := io.ReadAll(out.Result().Body)
				if string(got) != string(raw) {
					t.Fatal("bytes changed")
				}
			}
		})
	}
	foreign, _ := url.Parse("spiffe://aegisgate.local/edge-b")
	cert.URIs = []*url.URL{foreign}
	request := httptest.NewRequest(http.MethodGet, location, nil)
	request.TLS = &tls.ConnectionState{PeerCertificates: []*x509.Certificate{cert}, VerifiedChains: [][]*x509.Certificate{{cert}}}
	out := httptest.NewRecorder()
	handler.ServeHTTP(out, request)
	if out.Code != 403 {
		t.Fatal("cross-deployment artifact leak")
	}
}
