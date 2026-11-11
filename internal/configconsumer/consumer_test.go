package configconsumer

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/internal/configsnapshot"
)

type memoryCache struct {
	raw  []byte
	fail bool
}

func (s *memoryCache) Save(_ context.Context, raw []byte) error {
	if s.fail {
		return errors.New("injected outage")
	}
	s.raw = bytes.Clone(raw)
	return nil
}
func (s *memoryCache) Load(context.Context) ([]byte, error) {
	if len(s.raw) == 0 {
		return nil, os.ErrNotExist
	}
	return bytes.Clone(s.raw), nil
}

type keySource []byte

func (s keySource) CacheKey(context.Context) ([]byte, error) { return s, nil }

type fixture struct {
	now    time.Time
	signer *configsnapshot.LocalSigner
	trust  *configsnapshot.TrustStore
	c      *Consumer
	store  *memoryCache
}

func setup(t *testing.T) *fixture {
	t.Helper()
	f := &fixture{now: time.Date(2026, 11, 11, 8, 0, 0, 0, time.UTC), store: &memoryCache{}}
	var err error
	f.signer, err = configsnapshot.NewLocalSigner("test-signing")
	if err != nil {
		t.Fatal(err)
	}
	f.trust, err = configsnapshot.NewTrustStore([]configsnapshot.TrustedKey{{ID: f.signer.KeyID(), PublicKey: f.signer.PublicKey(), NotBefore: f.now.Add(-time.Hour), NotAfter: f.now.Add(24 * time.Hour)}})
	if err != nil {
		t.Fatal(err)
	}
	f.c, err = New(Options{DeploymentID: "deployment-test", Trust: f.trust, Persistence: f.store, MaxStaleness: time.Hour, MaxReaders: 64, MaxRetainedGenerations: 3, Clock: func() time.Time { return f.now }})
	if err != nil {
		t.Fatal(err)
	}
	return f
}
func (f *fixture) artifact(t *testing.T, gen uint64) ([]byte, Notice) {
	t.Helper()
	id := "tenant-a"
	payload := configsnapshot.Payload{Tenants: []configsnapshot.Tenant{{ID: id,
		Domains:     []configsnapshot.Domain{{ID: "domain-a", TenantID: id, Hostname: "api.example.com", VerifiedUntil: f.now.Add(4 * time.Hour)}},
		OriginPools: []configsnapshot.OriginPool{{ID: "pool-a", TenantID: id, Generation: gen, Endpoints: []configsnapshot.Endpoint{{ID: "endpoint-a", TenantID: id, Generation: gen, URL: "https://origin.example.com"}}}},
		Policies:    []configsnapshot.Policy{{ID: "policy-a", TenantID: id, Generation: gen, AuthRequired: true, JWTIssuer: "https://issuer.example.com", JWTAudience: "api"}},
		Routes:      []configsnapshot.Route{{ID: "route-a", TenantID: id, Generation: gen, DomainID: "domain-a", OriginPoolID: "pool-a", PolicyID: "policy-a", Path: "/v1", Methods: []string{"GET"}}},
	}}}
	raw, err := configsnapshot.Sign(context.Background(), configsnapshot.Envelope{Generation: gen, DeploymentID: "deployment-test", CreatedAt: f.now, ValidFrom: f.now, ExpiresAt: f.now.Add(2 * time.Hour), Payload: payload}, f.signer)
	if err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(raw)
	return raw, Notice{DeploymentID: "deployment-test", Generation: gen, Digest: hex.EncodeToString(digest[:]), Location: "https://store.example.com/artifacts/" + hex.EncodeToString(digest[:])}
}
func apply(t *testing.T, f *fixture, gen uint64) {
	t.Helper()
	raw, notice := f.artifact(t, gen)
	if ack := f.c.Apply(context.Background(), notice, raw); !ack.Accepted {
		t.Fatalf("apply %d: %+v", gen, ack)
	}
}

func TestNegativeTamperReplayCrossTenantAndPriorLKG(t *testing.T) {
	f := setup(t)
	apply(t, f, 1)
	raw, notice := f.artifact(t, 2)
	for _, kind := range []string{"digest", "signature", "cross_tenant", "schema", "wrong_generation", "wrong_deployment", "missing_auth", "oversized"} {
		t.Run(kind, func(t *testing.T) {
			candidate := bytes.Clone(raw)
			n := notice
			switch kind {
			case "digest":
				candidate[len(candidate)-2] ^= 1
			case "signature":
				candidate = bytes.Replace(candidate, []byte(`"signature":"`), []byte(`"signature":"A`), 1)
			case "cross_tenant":
				candidate = bytes.ReplaceAll(candidate, []byte(`"tenant_id":"tenant-a"`), []byte(`"tenant_id":"tenant-b"`))
			case "schema":
				candidate = bytes.Replace(candidate, []byte(`"schema_version":"1.0"`), []byte(`"schema_version":"0.9"`), 1)
			case "wrong_generation":
				n.Generation = 3
			case "wrong_deployment":
				n.DeploymentID = "attacker"
			case "missing_auth":
				candidate = bytes.Replace(candidate, []byte(`"auth_required":true,`), nil, 1)
			case "oversized":
				candidate = make([]byte, configsnapshot.MaxArtifactBytes+1)
			}
			if kind != "digest" {
				sum := sha256.Sum256(candidate)
				n.Digest = hex.EncodeToString(sum[:])
			}
			if ack := f.c.Apply(context.Background(), n, candidate); ack.Accepted {
				t.Fatal("malicious candidate accepted")
			}
			if !f.c.Metrics().Ready || f.c.Metrics().AppliedGeneration != 1 {
				t.Fatal("prior LKG lost")
			}
		})
	}
	raw, notice = f.artifact(t, 1)
	if f.c.Apply(context.Background(), notice, raw).Accepted {
		t.Fatal("replay accepted")
	}
}

func TestConcurrentAtomicGenerationAndReaderBounds(t *testing.T) {
	f := setup(t)
	apply(t, f, 1)
	var workers sync.WaitGroup
	for i := 0; i < 16; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for j := 0; j < 20; j++ {
				capture, err := f.c.Capture()
				if err != nil {
					continue
				}
				first, ok := capture.Resolve("api.example.com", "/v1", "GET")
				if !ok || first.Generation != first.Route.Generation || first.Generation != first.Policy.Generation || first.Generation != first.Pool.Generation {
					t.Error("mixed generation")
				}
				second, ok := capture.Resolve("api.example.com", "/v1", "GET")
				if !ok || first.Generation != second.Generation {
					t.Error("captured generation changed")
				}
				first.Pool.Endpoints[0].URL = "https://attacker.example.com"
				third, _ := capture.Resolve("api.example.com", "/v1", "GET")
				if third.Pool.Endpoints[0].URL == first.Pool.Endpoints[0].URL {
					t.Error("caller mutated active state")
				}
				capture.Close()
			}
		}()
	}
	for gen := uint64(2); gen <= 8; gen++ {
		raw, notice := f.artifact(t, gen)
		ack := f.c.Apply(context.Background(), notice, raw)
		if !ack.Accepted && ack.Code != "retention_busy" {
			t.Errorf("unexpected apply: %+v", ack)
		}
	}
	workers.Wait()
	f.c.options.MaxReaders = 1
	one, err := f.c.Capture()
	if err != nil {
		t.Fatal(err)
	}
	if _, err = f.c.Capture(); err == nil {
		t.Fatal("unbounded readers")
	}
	one.Close()
}

func TestCrashStagingAndColdRestart(t *testing.T) {
	f := setup(t)
	if f.c.Metrics().Ready || f.c.Restore(context.Background()) == nil {
		t.Fatal("empty startup ready")
	}
	apply(t, f, 1)
	f.store.fail = true
	raw, notice := f.artifact(t, 2)
	if f.c.Apply(context.Background(), notice, raw).Accepted || f.c.Metrics().AppliedGeneration != 1 {
		t.Fatal("staging failure changed active generation")
	}
	f.store.fail = false
	// Simulate process loss after durable staging and before the pointer swap.
	if err := f.store.Save(context.Background(), raw); err != nil {
		t.Fatal(err)
	}
	restarted, err := New(f.c.options)
	if err != nil {
		t.Fatal(err)
	}
	if err = restarted.Restore(context.Background()); err != nil {
		t.Fatal(err)
	}
	if restarted.Metrics().AppliedGeneration != 2 || !restarted.Metrics().Ready {
		t.Fatal("durable staging lost")
	}
	if restarted.Apply(context.Background(), notice, raw).Accepted {
		t.Fatal("restart replay accepted")
	}
}

func TestNegativeRetirementStalenessAndExpiredOwnership(t *testing.T) {
	f := setup(t)
	apply(t, f, 1)
	keys, err := configsnapshot.NewTrustStore([]configsnapshot.TrustedKey{{ID: f.signer.KeyID(), PublicKey: f.signer.PublicKey(), NotBefore: f.now.Add(-time.Hour), NotAfter: f.now.Add(24 * time.Hour), RetiredAt: f.now}})
	if err != nil {
		t.Fatal(err)
	}
	if err = f.c.UpdateTrust(keys); err != nil {
		t.Fatal(err)
	}
	if f.c.Metrics().Ready {
		t.Fatal("retired active key stays ready")
	}
	if _, err = f.c.Capture(); err == nil {
		t.Fatal("retired active key captured")
	}
	if err = f.c.UpdateTrust(f.trust); err != nil {
		t.Fatal(err)
	}
	f.now = f.now.Add(time.Hour + time.Second)
	if f.c.Metrics().Ready {
		t.Fatal("stale LKG ready")
	}
	if f.c.Restore(context.Background()) == nil {
		t.Fatal("reinitialize active consumer")
	}
	restarted, _ := New(f.c.options)
	if restarted.Restore(context.Background()) == nil || restarted.Metrics().Ready {
		t.Fatal("stale disk checkpoint ready")
	}
}

func TestEncryptedRestrictedLKG(t *testing.T) {
	dir := t.TempDir()
	if err := os.Chmod(dir, 0700); err != nil {
		t.Fatal(err)
	}
	key := make(keySource, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	store, err := NewDiskLKG(dir, "edge-a/deployment-test", key, 4<<20)
	if err != nil {
		t.Fatal(err)
	}
	f := setup(t)
	f.c.options.Persistence = store
	apply(t, f, 1)
	ciphertext, err := os.ReadFile(filepath.Join(dir, "checkpoint.aead"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(ciphertext, []byte("tenant-a")) || json.Valid(ciphertext) {
		t.Fatal("plaintext cache")
	}
	restarted, _ := New(f.c.options)
	if err = restarted.Restore(context.Background()); err != nil {
		t.Fatal(err)
	}
	wrongIdentity, _ := NewDiskLKG(dir, "edge-b/deployment-test", key, 4<<20)
	if _, err = wrongIdentity.Load(context.Background()); err == nil {
		t.Fatal("cache identity not bound")
	}
	wrongKey := make(keySource, 32)
	rand.Read(wrongKey)
	wrongStore, _ := NewDiskLKG(dir, "edge-a/deployment-test", wrongKey, 4<<20)
	if _, err = wrongStore.Load(context.Background()); err == nil {
		t.Fatal("wrong cache key accepted")
	}
	ciphertext[len(ciphertext)-1] ^= 1
	os.WriteFile(filepath.Join(dir, "checkpoint.aead"), ciphertext, 0600)
	if _, err = store.Load(context.Background()); err == nil {
		t.Fatal("cache tampering accepted")
	}
	os.Chmod(filepath.Join(dir, "checkpoint.aead"), 0644)
	if _, err = store.Load(context.Background()); err == nil {
		t.Fatal("public cache accepted")
	}
	os.Chmod(dir, 0755)
	if _, err = NewDiskLKG(dir, "edge", key, 4<<20); err == nil {
		t.Fatal("public cache directory accepted")
	}
}

type brokenFetcher struct{}

func (brokenFetcher) Fetch(context.Context, string) (io.ReadCloser, error) {
	return nil, errors.New("outage")
}
func TestNotificationAndControlPlaneOutageRetainLKG(t *testing.T) {
	f := setup(t)
	apply(t, f, 1)
	_, notice := f.artifact(t, 2)
	for i := 0; i < 3; i++ {
		ack := f.c.FetchApply(context.Background(), notice, brokenFetcher{})
		if ack.Accepted || !f.c.Metrics().Ready || f.c.Metrics().AppliedGeneration != 1 {
			t.Fatal("outage removed active LKG")
		}
	}
	if f.c.Metrics().NACKs != 3 {
		t.Fatal("NACKs not observed")
	}
}

func TestKeyRotationOverlapAndRetiredCandidate(t *testing.T) {
	f := setup(t)
	apply(t, f, 1)
	old := f.signer
	next, err := configsnapshot.NewLocalSigner("next-key")
	if err != nil {
		t.Fatal(err)
	}
	oldKey := configsnapshot.TrustedKey{ID: old.KeyID(), PublicKey: old.PublicKey(), NotBefore: f.now.Add(-time.Hour), NotAfter: f.now.Add(2 * time.Hour)}
	newKey := configsnapshot.TrustedKey{ID: next.KeyID(), PublicKey: next.PublicKey(), NotBefore: f.now, NotAfter: f.now.Add(24 * time.Hour)}
	overlap, err := configsnapshot.NewTrustStore([]configsnapshot.TrustedKey{oldKey, newKey})
	if err != nil {
		t.Fatal(err)
	}
	f.c.UpdateTrust(overlap)
	if !f.c.Metrics().Ready {
		t.Fatal("permitted overlap rejected prior LKG")
	}
	f.signer = next
	apply(t, f, 2)
	oldKey.RetiredAt = f.now
	retired, err := configsnapshot.NewTrustStore([]configsnapshot.TrustedKey{oldKey, newKey})
	if err != nil {
		t.Fatal(err)
	}
	f.c.UpdateTrust(retired)
	f.signer = old
	raw, notice := f.artifact(t, 3)
	if f.c.Apply(context.Background(), notice, raw).Accepted {
		t.Fatal("retired candidate accepted")
	}
	if !f.c.Metrics().Ready || f.c.Metrics().AppliedGeneration != 2 {
		t.Fatal("rotation lost new LKG")
	}
}

func TestRetentionBudgetAndStartupReplayWithoutExplicitRestore(t *testing.T) {
	f := setup(t)
	f.c.options.MaxRetainedGenerations = 2
	apply(t, f, 1)
	first, err := f.c.Capture()
	if err != nil {
		t.Fatal(err)
	}
	apply(t, f, 2)
	second, err := f.c.Capture()
	if err != nil {
		t.Fatal(err)
	}
	raw, notice := f.artifact(t, 3)
	if ack := f.c.Apply(context.Background(), notice, raw); ack.Accepted || ack.Code != "retention_busy" {
		t.Fatalf("retention unbounded: %+v", ack)
	}
	first.Close()
	if ack := f.c.Apply(context.Background(), notice, raw); !ack.Accepted {
		t.Fatalf("retention did not recover: %+v", ack)
	}
	second.Close()
	restart, err := New(f.c.options)
	if err != nil {
		t.Fatal(err)
	}
	old, oldNotice := f.artifact(t, 1)
	if restart.Apply(context.Background(), oldNotice, old).Accepted {
		t.Fatal("startup bypassed persisted high-water mark")
	}
	if restart.Metrics().AppliedGeneration != 3 {
		t.Fatal("startup did not restore newest checkpoint")
	}
	// A corrupt local checkpoint requires explicit authenticated reprovisioning;
	// a signed old notice cannot make a consumer forget the damaged state.
	f.store.raw = []byte("corrupt")
	blocked, _ := New(f.c.options)
	if blocked.Apply(context.Background(), notice, raw).Accepted || blocked.Metrics().Ready {
		t.Fatal("corrupt checkpoint bypassed")
	}
}

type oversizedFetcher struct{}

func (oversizedFetcher) Fetch(context.Context, string) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewReader(make([]byte, configsnapshot.MaxArtifactBytes+1))), nil
}
func TestNegativeBoundedArtifactDownload(t *testing.T) {
	f := setup(t)
	apply(t, f, 1)
	_, notice := f.artifact(t, 2)
	ack := f.c.FetchApply(context.Background(), notice, oversizedFetcher{})
	if ack.Accepted || ack.Code != "artifact_size" || f.c.Metrics().AppliedGeneration != 1 {
		t.Fatal("oversized fetch affected active snapshot")
	}
}
