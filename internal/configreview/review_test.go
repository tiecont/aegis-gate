// Package configreview contains independent Sprint03-B security regressions.
package configreview

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/internal/configconsumer"
	"aegisgate.dev/aegisgate/internal/configsnapshot"
	jcs "github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
)

var reviewClock = time.Date(2026, 11, 11, 10, 0, 0, 0, time.UTC)

type reviewKey []byte

func (k reviewKey) CacheKey(context.Context) ([]byte, error) { return k, nil }

type securityFixture struct {
	now      time.Time
	private  ed25519.PrivateKey
	trust    *configsnapshot.TrustStore
	consumer *configconsumer.Consumer
	options  configconsumer.Options
}

func newSecurityFixture(t *testing.T) *securityFixture {
	t.Helper()
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	trust, err := configsnapshot.NewTrustStore([]configsnapshot.TrustedKey{{ID: "review-key", PublicKey: public, NotBefore: reviewClock.Add(-time.Hour), NotAfter: reviewClock.Add(20 * time.Hour)}})
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	if err = os.Chmod(dir, 0700); err != nil {
		t.Fatal(err)
	}
	key := make(reviewKey, 32)
	if _, err = rand.Read(key); err != nil {
		t.Fatal(err)
	}
	cache, err := configconsumer.NewDiskLKG(dir, "review-edge/review-deployment", key, configsnapshot.MaxArtifactBytes)
	if err != nil {
		t.Fatal(err)
	}
	f := &securityFixture{now: reviewClock, private: private, trust: trust}
	f.options = configconsumer.Options{DeploymentID: "review-deployment", Trust: trust, Persistence: cache, MaxStaleness: time.Hour, MaxReaders: 8, MaxRetainedGenerations: 2, Clock: func() time.Time { return f.now }}
	f.consumer, err = configconsumer.New(f.options)
	if err != nil {
		t.Fatal(err)
	}
	return f
}

// signedArtifact deliberately bypasses the production Sign/Validate path. A
// valid cryptographic signature must not excuse semantically unsafe payloads.
func (f *securityFixture) signedArtifact(t *testing.T, generation uint64, mutate func(map[string]any)) ([]byte, configconsumer.Notice) {
	t.Helper()
	document := map[string]any{
		"schema_version": "1.0", "context": "AEGISGATE_CONFIG_V1", "deployment_id": "review-deployment", "generation": generation,
		"created_at": f.now.Format(time.RFC3339), "valid_from": f.now.Format(time.RFC3339), "expires_at": f.now.Add(4 * time.Hour).Format(time.RFC3339), "signing_key_id": "review-key",
		"payload": map[string]any{"tenants": []any{map[string]any{
			"id":           "tenant-a",
			"domains":      []any{map[string]any{"id": "domain-a", "tenant_id": "tenant-a", "hostname": "api.a.example", "verified_until": f.now.Add(12 * time.Hour).Format(time.RFC3339)}},
			"origin_pools": []any{map[string]any{"id": "pool-a", "tenant_id": "tenant-a", "generation": generation, "endpoints": []any{map[string]any{"id": "endpoint-a", "tenant_id": "tenant-a", "generation": generation, "url": "https://origin.a.example"}}}},
			"policies":     []any{map[string]any{"id": "policy-a", "tenant_id": "tenant-a", "generation": generation, "auth_required": true, "jwt_issuer": "https://issuer.a.example", "jwt_audience": "tenant-a"}},
			"routes":       []any{map[string]any{"id": "route-a", "tenant_id": "tenant-a", "generation": generation, "domain_id": "domain-a", "origin_pool_id": "pool-a", "policy_id": "policy-a", "path": "/v1", "methods": []any{"GET"}}},
		}}},
	}
	if mutate != nil {
		mutate(document)
	}
	payload, err := json.Marshal(document["payload"])
	if err != nil {
		t.Fatal(err)
	}
	payload, err = jcs.Transform(payload)
	if err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(payload)
	document["content_sha256"] = hex.EncodeToString(digest[:])
	unsigned, err := json.Marshal(document)
	if err != nil {
		t.Fatal(err)
	}
	unsigned, err = jcs.Transform(unsigned)
	if err != nil {
		t.Fatal(err)
	}
	message := append([]byte("AEGISGATE_CONFIG_V1\x00"), unsigned...)
	document["signature"] = base64.StdEncoding.EncodeToString(ed25519.Sign(f.private, message))
	raw, err := json.Marshal(document)
	if err != nil {
		t.Fatal(err)
	}
	raw, err = jcs.Transform(raw)
	if err != nil {
		t.Fatal(err)
	}
	artifactDigest := sha256.Sum256(raw)
	return raw, configconsumer.Notice{DeploymentID: "review-deployment", Generation: generation, Digest: hex.EncodeToString(artifactDigest[:]), Location: "https://artifacts.example/artifacts/" + hex.EncodeToString(artifactDigest[:])}
}

func tenant(document map[string]any) map[string]any {
	return document["payload"].(map[string]any)["tenants"].([]any)[0].(map[string]any)
}
func resource(document map[string]any, name string) map[string]any {
	return tenant(document)[name].([]any)[0].(map[string]any)
}

func TestIndependentSignedUnsafePayloadsRetainEncryptedLKG(t *testing.T) {
	f := newSecurityFixture(t)
	raw, notice := f.signedArtifact(t, 7, nil)
	if ack := f.consumer.Apply(context.Background(), notice, raw); !ack.Accepted {
		t.Fatalf("positive control: %+v", ack)
	}
	cases := map[string]func(map[string]any){
		"signed_cross_tenant_domain":   func(d map[string]any) { resource(d, "domains")["tenant_id"] = "tenant-b" },
		"signed_missing_policy":        func(d map[string]any) { resource(d, "routes")["policy_id"] = "other-tenant-policy" },
		"signed_anonymous_policy":      func(d map[string]any) { resource(d, "policies")["auth_required"] = false },
		"signed_missing_auth_property": func(d map[string]any) { delete(resource(d, "policies"), "auth_required") },
		"signed_unsupported_operator":  func(d map[string]any) { resource(d, "policies")["allow_if"] = "true" },
		"signed_private_origin": func(d map[string]any) {
			pool := resource(d, "origin_pools")
			pool["endpoints"].([]any)[0].(map[string]any)["url"] = "https://127.0.0.1"
		},
		"signed_expired_ownership": func(d map[string]any) { resource(d, "domains")["verified_until"] = f.now.Format(time.RFC3339) },
		"signed_duplicate_hostname": func(d map[string]any) {
			first := resource(d, "domains")
			duplicate := map[string]any{}
			for k, v := range first {
				duplicate[k] = v
			}
			duplicate["id"] = "domain-duplicate"
			tenant(d)["domains"] = append(tenant(d)["domains"].([]any), duplicate)
		},
		"signed_wrong_context":    func(d map[string]any) { d["context"] = "AEGISGATE_OTHER_V1" },
		"signed_schema_downgrade": func(d map[string]any) { d["schema_version"] = "0.9" },
		"signed_wrong_deployment": func(d map[string]any) { d["deployment_id"] = "review-other" },
		"signed_excess_validity":  func(d map[string]any) { d["expires_at"] = f.now.Add(25 * time.Hour).Format(time.RFC3339) },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			unsafe, n := f.signedArtifact(t, 8, mutate)
			if ack := f.consumer.Apply(context.Background(), n, unsafe); ack.Accepted {
				t.Fatalf("valid signature bypassed semantic safety: %+v", ack)
			}
			metrics := f.consumer.Metrics()
			if !metrics.Ready || metrics.AppliedGeneration != 7 {
				t.Fatalf("rejection lost prior LKG: %+v", metrics)
			}
		})
	}
	restarted, err := configconsumer.New(f.options)
	if err != nil {
		t.Fatal(err)
	}
	if err = restarted.Restore(context.Background()); err != nil {
		t.Fatal(err)
	}
	if restarted.Metrics().AppliedGeneration != 7 {
		t.Fatal("malicious candidate altered durable checkpoint")
	}
}

func TestIndependentRestartGenerationAndStaleRecovery(t *testing.T) {
	f := newSecurityFixture(t)
	raw, n := f.signedArtifact(t, 20, nil)
	if !f.consumer.Apply(context.Background(), n, raw).Accepted {
		t.Fatal("positive control")
	}
	f.now = f.now.Add(5 * time.Hour)
	restarted, err := configconsumer.New(f.options)
	if err != nil {
		t.Fatal(err)
	}
	if restarted.Restore(context.Background()) == nil || restarted.Metrics().Ready {
		t.Fatal("expired checkpoint served")
	}
	old, oldNotice := f.signedArtifact(t, 19, nil)
	if restarted.Apply(context.Background(), oldNotice, old).Accepted {
		t.Fatal("fresh signature erased expired generation floor")
	}
	newer, newNotice := f.signedArtifact(t, 21, nil)
	if ack := restarted.Apply(context.Background(), newNotice, newer); !ack.Accepted {
		t.Fatalf("new generation failed recovery: %+v", ack)
	}
	if _, ok := restarted.CurrentAck(n); ok {
		t.Fatal("old ACK confirmed after recovery")
	}
	if ack, ok := restarted.CurrentAck(newNotice); !ok || !ack.Accepted {
		t.Fatal("current ACK cannot be safely retried")
	}
}

func TestIndependentEnvelopeBindingAndDuplicateKeys(t *testing.T) {
	f := newSecurityFixture(t)
	raw, _ := f.signedArtifact(t, 1, nil)
	for _, replacement := range [][2]string{{`"generation":1`, `"generation":2`}, {`"deployment_id":"review-deployment"`, `"deployment_id":"review-other"`}, {`"signing_key_id":"review-key"`, `"signing_key_id":"other-key"`}, {`"jwt_audience":"tenant-a"`, `"jwt_audience":"tenant-b"`}} {
		changed := []byte(strings.Replace(string(raw), replacement[0], replacement[1], 1))
		if _, err := configsnapshot.Verify(changed, f.trust, "review-deployment", 0, f.now); err == nil {
			t.Fatal("unsigned mutation accepted")
		}
	}
	duplicate := append([]byte(`{"generation":1,`), raw[1:]...)
	if _, err := configsnapshot.Verify(duplicate, f.trust, "review-deployment", 0, f.now); err == nil {
		t.Fatal("duplicate key accepted")
	}
}
