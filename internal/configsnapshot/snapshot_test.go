package configsnapshot

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

var clock = time.Date(2026, 11, 11, 0, 0, 0, 0, time.UTC)

func example() Envelope {
	return Envelope{Generation: 1, DeploymentID: "deployment-local", CreatedAt: clock, ValidFrom: clock, ExpiresAt: clock.Add(time.Hour), Payload: Payload{Tenants: []Tenant{{ID: "tenant-a", Domains: []Domain{{ID: "domain-a", TenantID: "tenant-a", Hostname: "api.a.example", VerifiedUntil: clock.Add(24 * time.Hour)}}, OriginPools: []OriginPool{{ID: "pool-a", TenantID: "tenant-a", Generation: 1, Endpoints: []Endpoint{{ID: "endpoint-a", TenantID: "tenant-a", URL: "https://origin.a.example", Generation: 1}}}}, Policies: []Policy{{ID: "policy-a", TenantID: "tenant-a", Generation: 1, AuthRequired: true, JWTIssuer: "https://id.a.example", JWTAudience: "a-api"}}, Routes: []Route{{ID: "route-a", TenantID: "tenant-a", Generation: 1, DomainID: "domain-a", OriginPoolID: "pool-a", PolicyID: "policy-a", Path: "/v1", Methods: []string{"GET"}}}}}}}
}
func setup(t *testing.T) (*LocalSigner, *TrustStore, []byte) {
	t.Helper()
	s, err := NewLocalSigner("key-a")
	if err != nil {
		t.Fatal(err)
	}
	trust, err := NewTrustStore([]TrustedKey{{ID: s.KeyID(), PublicKey: s.PublicKey(), NotBefore: clock.Add(-time.Hour), NotAfter: clock.Add(24 * time.Hour)}})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := Sign(context.Background(), example(), s)
	if err != nil {
		t.Fatal(err)
	}
	return s, trust, raw
}
func mutate(t *testing.T, raw []byte, fn func(map[string]any)) []byte {
	t.Helper()
	var v map[string]any
	if json.Unmarshal(raw, &v) != nil {
		t.Fatal("unmarshal")
	}
	fn(v)
	out, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return out
}
func TestSignedSnapshotRoundTrip(t *testing.T) {
	_, trust, raw := setup(t)
	got, err := Verify(raw, trust, "deployment-local", 0, clock)
	if err != nil {
		t.Fatal(err)
	}
	if got.Generation != 1 || got.Payload.Tenants[0].Policies[0].JWTAudience != "a-api" {
		t.Fatal("roundtrip")
	}
	var pretty bytes.Buffer
	if err = json.Indent(&pretty, raw, "", "  "); err != nil {
		t.Fatal(err)
	}
	if _, err = Verify(pretty.Bytes(), trust, "deployment-local", 0, clock); err != nil {
		t.Fatal("equivalent JSON", err)
	}
}
func TestNegativeSnapshotEnvelope(t *testing.T) {
	_, trust, raw := setup(t)
	cases := map[string][]byte{
		"single_byte":       bytes.Replace(raw, []byte("a-api"), []byte("b-api"), 1),
		"digest":            mutate(t, raw, func(v map[string]any) { v["content_sha256"] = strings.Repeat("0", 64) }),
		"signature":         mutate(t, raw, func(v map[string]any) { v["signature"] = base64.StdEncoding.EncodeToString(make([]byte, 64)) }),
		"context":           mutate(t, raw, func(v map[string]any) { v["context"] = "OTHER" }),
		"unknown_key":       mutate(t, raw, func(v map[string]any) { v["signing_key_id"] = "unknown" }),
		"schema_downgrade":  mutate(t, raw, func(v map[string]any) { v["schema_version"] = "0.9" }),
		"unknown_field":     mutate(t, raw, func(v map[string]any) { v["operator"] = "eval" }),
		"oversize":          bytes.Repeat([]byte("a"), MaxArtifactBytes+1),
		"malformed":         []byte("{"),
		"duplicate":         bytes.Replace(raw, []byte(`"generation":1`), []byte(`"generation":1,"generation":1`), 1),
		"duplicate_escaped": bytes.Replace(raw, []byte(`"generation":1`), []byte(`"generation":1,"generat\u0069on":1`), 1),
		"missing_auth": mutate(t, raw, func(v map[string]any) {
			p := v["payload"].(map[string]any)["tenants"].([]any)[0].(map[string]any)["policies"].([]any)[0].(map[string]any)
			delete(p, "auth_required")
		}),
		"operator": mutate(t, raw, func(v map[string]any) {
			p := v["payload"].(map[string]any)["tenants"].([]any)[0].(map[string]any)["policies"].([]any)[0].(map[string]any)
			p["operator"] = "allow"
		}),
		"depth":            []byte(strings.Repeat("[", 25) + strings.Repeat("]", 25)),
		"invalid_utf8":     append([]byte(`{"x":"`), 0xff, '"', '}'),
		"lone_surrogate":   []byte(`{"x":"\ud800"}`),
		"timestamp_offset": bytes.Replace(raw, []byte("2026-11-11T00:00:00Z"), []byte("2026-11-11T00:00:00+00:00"), 1),
	}
	for name, bad := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := Verify(bad, trust, "deployment-local", 0, clock); err == nil {
				t.Fatal("accepted invalid artifact")
			}
		})
	}
	if _, err := Verify(raw, trust, "deployment-local", 1, clock); Code(err) != "generation" {
		t.Fatal("replay", err)
	}
	if _, err := Verify(raw, trust, "another-deployment", 0, clock); Code(err) != "deployment" {
		t.Fatal("wrong deployment", err)
	}
	if _, err := Verify(raw, trust, "deployment-local", 0, clock.Add(time.Hour)); Code(err) != "time" {
		t.Fatal("expired", err)
	}
	if _, err := Verify(raw, trust, "deployment-local", 0, clock.Add(-time.Second)); Code(err) != "time" {
		t.Fatal("future", err)
	}
}
func TestNegativePayloadValidation(t *testing.T) {
	s, _, _ := setup(t)
	cases := map[string]func(*Envelope){
		"duplicate_hostname": func(e *Envelope) {
			t := e.Payload.Tenants[0]
			t.ID = "tenant-b"
			t.Domains = []Domain{{ID: "domain-b", TenantID: "tenant-b", Hostname: "api.a.example", VerifiedUntil: clock.Add(time.Hour)}}
			t.Routes = nil
			t.OriginPools = nil
			t.Policies = nil
			e.Payload.Tenants = append(e.Payload.Tenants, t)
		},
		"cross_tenant_resource":  func(e *Envelope) { e.Payload.Tenants[0].OriginPools[0].Endpoints[0].TenantID = "tenant-b" },
		"cross_tenant_reference": func(e *Envelope) { e.Payload.Tenants[0].Routes[0].PolicyID = "tenant-b-policy" },
		"invalid_auth":           func(e *Envelope) { e.Payload.Tenants[0].Policies[0].AuthRequired = false },
		"missing_auth":           func(e *Envelope) { e.Payload.Tenants[0].Policies = nil },
		"issuer_http":            func(e *Envelope) { e.Payload.Tenants[0].Policies[0].JWTIssuer = "http://id.a.example" },
		"issuer_credentials":     func(e *Envelope) { e.Payload.Tenants[0].Policies[0].JWTIssuer = "https://secret@id.a.example" },
		"origin_private":         func(e *Envelope) { e.Payload.Tenants[0].OriginPools[0].Endpoints[0].URL = "https://127.0.0.1" },
		"origin_internal":        func(e *Envelope) { e.Payload.Tenants[0].OriginPools[0].Endpoints[0].URL = "https://host.internal" },
		"domain_expired":         func(e *Envelope) { e.Payload.Tenants[0].Domains[0].VerifiedUntil = clock },
		"duplicate_route": func(e *Envelope) {
			r := e.Payload.Tenants[0].Routes[0]
			r.ID = "route-b"
			e.Payload.Tenants[0].Routes = append(e.Payload.Tenants[0].Routes, r)
		},
		"unsafe_generation":  func(e *Envelope) { e.Generation = MaxGeneration + 1 },
		"validity_unbounded": func(e *Envelope) { e.ExpiresAt = clock.Add(MaxValidity + time.Second) },
		"resource_bounds":    func(e *Envelope) { e.Payload.Tenants = make([]Tenant, 129) },
	}
	for name, fn := range cases {
		t.Run(name, func(t *testing.T) {
			e := example()
			fn(&e)
			if _, err := Sign(context.Background(), e, s); err == nil {
				t.Fatal("signed invalid config")
			}
		})
	}
}
func TestSignatureBindsEveryEnvelopeField(t *testing.T) {
	_, trust, raw := setup(t)
	for _, field := range []string{"generation", "deployment_id", "created_at", "valid_from", "expires_at", "content_sha256", "signing_key_id", "context", "schema_version", "payload"} {
		t.Run(field, func(t *testing.T) {
			bad := mutate(t, raw, func(v map[string]any) {
				switch field {
				case "generation":
					v[field] = float64(2)
				case "created_at":
					v[field] = "2026-11-10T23:59:59Z"
				case "valid_from":
					v[field] = "2026-11-10T23:59:59Z"
				case "expires_at":
					v[field] = "2026-11-11T00:59:59Z"
				case "payload":
					v[field] = map[string]any{"tenants": []any{}}
				default:
					v[field] = "changed"
				}
			})
			if _, err := Verify(bad, trust, "deployment-local", 0, clock); err == nil {
				t.Fatal("unsigned field change accepted")
			}
		})
	}
}
func TestTrustCopiesPublicKey(t *testing.T) {
	s, _, raw := setup(t)
	public := s.PublicKey()
	trust, err := NewTrustStore([]TrustedKey{{ID: s.KeyID(), PublicKey: public, NotBefore: clock.Add(-time.Hour), NotAfter: clock.Add(time.Hour)}})
	if err != nil {
		t.Fatal(err)
	}
	public[0] ^= 0xff
	if _, err = Verify(raw, trust, "deployment-local", 0, clock); err != nil {
		t.Fatal("caller mutated pinned key", err)
	}
}

// The seed is derived from a public fixture label. This is an intentionally
// public deterministic test identity, never a deployed credential.
type vectorSigner struct{ key ed25519.PrivateKey }

func (v vectorSigner) KeyID() string { return "public-vector-key" }
func (v vectorSigner) Sign(_ context.Context, b []byte) ([]byte, error) {
	return ed25519.Sign(v.key, b), nil
}
func TestGoldenVector(t *testing.T) {
	seed := sha256.Sum256([]byte("AEGISGATE PUBLIC TEST VECTOR; NEVER TRUST IN DEPLOYMENT"))
	signer := vectorSigner{ed25519.NewKeyFromSeed(seed[:])}
	raw, err := Sign(context.Background(), example(), signer)
	if err != nil {
		t.Fatal(err)
	}
	public := signer.key.Public().(ed25519.PublicKey)
	trust, err := NewTrustStore([]TrustedKey{{ID: signer.KeyID(), PublicKey: public, NotBefore: clock.Add(-time.Hour), NotAfter: clock.Add(24 * time.Hour)}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = Verify(raw, trust, "deployment-local", 0, clock); err != nil {
		t.Fatal(err)
	}
	var env Envelope
	if json.Unmarshal(raw, &env) != nil {
		t.Fatal("decode")
	}
	message, err := signingBytes(env)
	if err != nil {
		t.Fatal(err)
	}
	vectors := map[string][]byte{"snapshot-v1.json": append(raw, '\n'), "snapshot-v1.signing-input.hex": []byte(hex.EncodeToString(message) + "\n"), "snapshot-v1.public-key.hex": []byte(hex.EncodeToString(public) + "\n")}
	for path, want := range vectors {
		path = filepath.Join("testdata", path)
		if os.Getenv("AEGIS_UPDATE_PUBLIC_VECTORS") == "1" {
			if err = os.MkdirAll("testdata", 0755); err != nil {
				t.Fatal(err)
			}
			if err = os.WriteFile(path, want, 0644); err != nil {
				t.Fatal(err)
			}
		}
		got, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(got, want) {
			t.Fatal("golden mismatch", path)
		}
	}
}
func TestRFC8785Golden(t *testing.T) {
	raw := []byte(`{"numbers":[333333333.33333329,1E30,4.50,2e-3,0.000000000000000000000000001],"string":"\u20ac$\u000F\u000aA'\u0042\u0022\u005c\\\"\/","literals":[null,true,false]}`)
	want := `{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\u000f\nA'B\"\\\\\"/"}`
	got, err := canonicalRaw(raw)
	if err != nil || string(got) != want {
		t.Fatalf("RFC8785: %s %v", got, err)
	}
}
