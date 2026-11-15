//go:build aegisgate_sprint06a_feasibility

package admission

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/internal/configsnapshot"
)

func TestSignedSidecarNegativesAndBindings(t *testing.T) {
	f := setup(t)
	f.apply(t, 7, 7, f.signer)
	raw, n, sidecar := f.artifact(t, 8, 8, f.signer)
	for _, kind := range []string{"missing", "unsigned", "tampered", "unknown_version", "downgrade", "unknown_context", "missing_profile", "unknown_profile", "streaming", "cross_tenant", "cross_route", "snapshot_digest", "deployment", "generation", "route_generation", "policy_generation", "pool_generation", "endpoint_generation", "wire_limit", "deadline", "duplicate_binding", "unknown_field", "missing_field", "duplicate_field", "oversized", "deep", "wrong_signature_context"} {
		t.Run(kind, func(t *testing.T) {
			candidate := bytes.Clone(sidecar)
			var s Sidecar
			must(t, json.Unmarshal(sidecar, &s))
			switch kind {
			case "missing":
				candidate = nil
			case "unsigned":
				s.Signature = ""
				candidate, _ = canonical(s)
			case "tampered":
				candidate = bytes.Replace(candidate, []byte("strict_finite"), []byte("strict_finitx"), 1)
			case "unknown_field":
				candidate = append([]byte(`{"unknown":1,`), candidate[1:]...)
			case "missing_field":
				var m map[string]any
				must(t, json.Unmarshal(candidate, &m))
				delete(m, "version")
				candidate, _ = canonical(m)
			case "duplicate_field":
				candidate = append([]byte(`{"version":"1-experimental",`), candidate[1:]...)
			case "oversized":
				candidate = bytes.Repeat([]byte(" "), (32<<10)+1)
			case "deep":
				candidate = append(bytes.Repeat([]byte("["), 25), bytes.Repeat([]byte("]"), 25)...)
			default:
				switch kind {
				case "unknown_version":
					s.Version = "2"
				case "downgrade":
					s.Version = "0"
				case "unknown_context":
					s.Context = "OTHER"
				case "missing_profile":
					s.Bindings[0].Profile = ""
				case "unknown_profile":
					s.Bindings[0].Profile = "automatic"
				case "streaming":
					s.Bindings[0].Profile = "streaming"
				case "cross_tenant":
					s.Bindings[0].Tenant = "tenant-c"
				case "cross_route":
					s.Bindings[0].Route = "foreign-route"
				case "snapshot_digest":
					s.SnapshotDigest = digest(sidecar)
				case "deployment":
					s.Deployment = "foreign"
				case "generation":
					s.Generation++
				case "route_generation":
					s.Bindings[0].RouteGeneration++
				case "policy_generation":
					s.Bindings[0].PolicyGeneration++
				case "pool_generation":
					s.Bindings[0].PoolGeneration++
				case "endpoint_generation":
					s.Bindings[0].EndpointGeneration++
				case "wire_limit":
					s.Bindings[0].MaxWireBytes++
				case "deadline":
					s.Bindings[0].RequestMillis++
				case "duplicate_binding":
					s.Bindings = append(s.Bindings, s.Bindings[0])
				}
				message, err := unsigned(s)
				must(t, err)
				var signing []byte
				if kind == "wrong_signature_context" {
					signing = append([]byte(configsnapshot.Context+"\x00"), message...)
				} else {
					signing, err = configsnapshot.Sprint06AAdmissionSigningBytes(message)
					must(t, err)
				}
				sig, err := f.signer.Sign(context.Background(), signing)
				must(t, err)
				s.Signature = base64.StdEncoding.EncodeToString(sig)
				candidate, err = canonical(s)
				must(t, err)
			}
			if err := f.a.Apply(context.Background(), n, raw, candidate); err == nil {
				t.Fatal("invalid profile accepted")
			}
			l, err := f.a.Capture("api-a.example.com", "api-a.example.com", "/v1", "POST")
			must(t, err)
			defer l.Close()
			if l.Route.Generation != 7 {
				t.Fatal("candidate changed LKG")
			}
		})
	}
	must(t, f.a.Apply(context.Background(), n, raw, sidecar))
	l, err := f.a.Capture("api-a.example.com", "api-a.example.com", "/v1", "POST")
	must(t, err)
	defer l.Close()
	if l.Route.Generation != 8 || l.Binding.Profile != "strict_finite" || !l.Route.Policy.AuthRequired {
		t.Fatal("signed finite positive binding")
	}
	for _, authority := range []struct{ sni, host, path, method string }{{"api-a.example.com", "api-b.example.com", "/v1", "POST"}, {"unknown.example.com", "unknown.example.com", "/v1", "POST"}, {"api-a.example.com", "api-a.example.com", "/v2", "POST"}, {"api-a.example.com", "api-a.example.com", "/v1", "CONNECT"}} {
		if lease, err := f.a.Capture(authority.sni, authority.host, authority.path, authority.method); err == nil {
			lease.Close()
			t.Fatal("unknown/cross authority allowed")
		}
	}
	for _, kind := range []string{"expired", "audience", "issuer", "future", "kid", "tampered"} {
		if Authenticate(l, f.token(t, "a", kind), &f.jwtKey.PublicKey, f.clock()) == nil {
			t.Fatalf("invalid JWT accepted: %s", kind)
		}
	}
	if Authenticate(l, "", &f.jwtKey.PublicKey, f.clock()) == nil {
		t.Fatal("missing JWT accepted")
	}
	must(t, Authenticate(l, f.token(t, "a", "valid"), &f.jwtKey.PublicKey, f.clock()))
	if Authenticate(l, f.token(t, "b", "valid"), &f.jwtKey.PublicKey, f.clock()) == nil {
		t.Fatal("tenant-b JWT admitted to tenant-a")
	}
}

func TestCaptureRollbackCancellationRecoveryAndFloor(t *testing.T) {
	f := setup(t)
	raw7, n7, side7 := f.artifact(t, 7, 7, f.signer)
	must(t, f.a.Apply(context.Background(), n7, raw7, side7))
	old, err := f.a.Capture("api-a.example.com", "api-a.example.com", "/v1", "POST")
	must(t, err)
	f.apply(t, 8, 8, f.signer)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	raw9, n9, side9 := f.artifact(t, 9, 7, f.signer)
	if f.a.Apply(ctx, n9, raw9, side9) == nil {
		t.Fatal("cancelled update applied")
	}
	must(t, f.a.Apply(context.Background(), n9, raw9, side9))
	if f.a.Apply(context.Background(), n7, raw7, side7) == nil {
		t.Fatal("old generation rollback allowed")
	}
	var wg sync.WaitGroup
	for range 12 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range 12 {
				route, ok := old.Capture.Resolve("api-a.example.com", "/v1", "POST")
				if !ok || route.Generation != 7 || route.Policy.Generation != 7 || route.Pool.Generation != 7 {
					t.Error("mixed captured generation")
				}
			}
		}()
	}
	wg.Wait()
	old.Close()
	old.Close()
	newer, err := f.a.Capture("api-a.example.com", "api-a.example.com", "/v1", "POST")
	must(t, err)
	if newer.Route.Generation != 9 || newer.Route.Route.Generation != 7 {
		t.Fatal("rollback not newer deployment/old resource")
	}
	newer.Close()
	restarted := New(f.consumer(t, 9), f.trust, "deployment-06a", f.clock)
	must(t, restarted.Restore(context.Background(), raw9, side9))
	lease, err := restarted.Capture("api-a.example.com", "api-a.example.com", "/v1", "POST")
	must(t, err)
	lease.Close()
	withoutProfile := New(f.consumer(t, 9), f.trust, "deployment-06a", f.clock)
	if withoutProfile.Restore(context.Background(), raw9, nil) == nil {
		t.Fatal("missing sidecar recovered")
	}
	if _, err := withoutProfile.Capture("api-a.example.com", "api-a.example.com", "/v1", "POST"); err == nil {
		t.Fatal("missing sidecar admits")
	}
	provisioned := New(f.consumer(t, 10), f.trust, "deployment-06a", f.clock)
	if provisioned.Restore(context.Background(), raw9, side9) == nil {
		t.Fatal("checkpoint below provisioning floor restored")
	}
	f.now.Store(f.start.Add(61 * time.Minute).Unix())
	if _, err := f.a.Capture("api-a.example.com", "api-a.example.com", "/v1", "POST"); err == nil {
		t.Fatal("stale consumer admitted")
	}
	f.now.Store(f.start.Add(2 * time.Hour).Unix())
	if _, err := verifySidecar(side9, raw9, f.trust, "deployment-06a", f.clock()); err == nil {
		t.Fatal("expired sidecar accepted")
	}
}

func TestTrustRotationSharedAcrossSnapshotAndSidecar(t *testing.T) {
	f := setup(t)
	raw, n, sidecar := f.artifact(t, 7, 7, f.signer)
	must(t, f.a.Apply(context.Background(), n, raw, sidecar))
	oldLease, err := f.a.Capture("api-a.example.com", "api-a.example.com", "/v1", "POST")
	must(t, err)
	defer oldLease.Close()
	bundle, err := configsnapshot.SignTrustBundle(context.Background(), configsnapshot.TrustBundle{Environment: "sprint06a", Version: 2, IssuedAt: f.clock(), ExpiresAt: f.start.Add(6 * time.Hour), Keys: []configsnapshot.TrustedKey{f.trusted(f.next)}}, f.root)
	must(t, err)
	next, err := f.trust.WithBundle(bundle, f.clock())
	must(t, err)
	must(t, f.a.UpdateTrust(next))
	if _, err := f.a.Capture("api-a.example.com", "api-a.example.com", "/v1", "POST"); err == nil {
		t.Fatal("retired snapshot/sidecar key admitted")
	}
	if _, err := verifySidecar(sidecar, raw, next, "deployment-06a", f.clock()); err == nil {
		t.Fatal("retired detached key trusted")
	}
	f.trust = next
	f.apply(t, 8, 8, f.next)
	lease, err := f.a.Capture("api-a.example.com", "api-a.example.com", "/v1", "POST")
	must(t, err)
	lease.Close()
	f.now.Store(f.start.Add(6 * time.Hour).Unix())
	if _, err := f.a.Capture("api-a.example.com", "api-a.example.com", "/v1", "POST"); err == nil {
		t.Fatal("expired trust bundle admitted")
	}
}
