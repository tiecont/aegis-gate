package configsnapshot

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"testing"
	"time"
)

func bundle(t *testing.T, root Signer, version uint64, keys []TrustedKey) []byte {
	t.Helper()
	raw, err := SignTrustBundle(context.Background(), TrustBundle{Environment: "local", Version: version, IssuedAt: clock, ExpiresAt: clock.Add(12 * time.Hour), Keys: keys}, root)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}
func TestAuthenticatedTrustRotation(t *testing.T) {
	root, err := NewLocalSigner("root")
	if err != nil {
		t.Fatal(err)
	}
	old, err := NewLocalSigner("old")
	if err != nil {
		t.Fatal(err)
	}
	next, err := NewLocalSigner("next")
	if err != nil {
		t.Fatal(err)
	}
	a := TrustedKey{ID: "old", PublicKey: old.PublicKey(), NotBefore: clock.Add(-12 * time.Hour), NotAfter: clock.Add(12 * time.Hour)}
	b := TrustedKey{ID: "next", PublicKey: next.PublicKey(), NotBefore: clock, NotAfter: clock.Add(24 * time.Hour)}
	trust, err := Bootstrap(root.PublicKey(), "local", bundle(t, root, 1, []TrustedKey{a}), clock)
	if err != nil {
		t.Fatal(err)
	}
	oldRaw, err := Sign(context.Background(), example(), old)
	if err != nil {
		t.Fatal(err)
	}
	nextRaw, err := Sign(context.Background(), example(), next)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = Verify(nextRaw, trust, "deployment-local", 0, clock); Code(err) != "signing_key" {
		t.Fatal("unknown key", err)
	}
	overlap, err := trust.WithBundle(bundle(t, root, 2, []TrustedKey{a, b}), clock)
	if err != nil {
		t.Fatal(err)
	}
	for _, raw := range [][]byte{oldRaw, nextRaw} {
		if _, err = Verify(raw, overlap, "deployment-local", 0, clock); err != nil {
			t.Fatal("valid overlap rejected", err)
		}
	}
	// Rotation is immutable; prior trust object did not acquire the next key.
	if _, err = Verify(nextRaw, trust, "deployment-local", 0, clock); Code(err) != "signing_key" {
		t.Fatal("trust mutated", err)
	}
	retired := a
	retired.RetiredAt = clock
	retirement, err := overlap.WithBundle(bundle(t, root, 3, []TrustedKey{retired, b}), clock)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = Verify(oldRaw, retirement, "deployment-local", 0, clock); Code(err) != "signing_key" {
		t.Fatal("retired key accepted", err)
	}
	if _, err = Verify(nextRaw, retirement, "deployment-local", 0, clock); err != nil {
		t.Fatal(err)
	}
	if _, err = retirement.WithBundle(bundle(t, root, 4, []TrustedKey{a, b}), clock); Code(err) != "trust_retired" && Code(err) != "trust_key_reuse" {
		t.Fatal("retirement undone", err)
	}
	omitted, err := overlap.WithBundle(bundle(t, root, 3, []TrustedKey{b}), clock)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = omitted.WithBundle(bundle(t, root, 4, []TrustedKey{a, b}), clock); Code(err) != "trust_retired" {
		t.Fatal("omitted key resurrected", err)
	}
}
func TestNegativeTrustBootstrap(t *testing.T) {
	root, _ := NewLocalSigner("root")
	s, _, raw := setup(t)
	key := TrustedKey{ID: s.KeyID(), PublicKey: s.PublicKey(), NotBefore: clock.Add(-time.Hour), NotAfter: clock.Add(24 * time.Hour)}
	valid := bundle(t, root, 1, []TrustedKey{key})
	trust, err := Bootstrap(root.PublicKey(), "local", valid, clock)
	if err != nil {
		t.Fatal(err)
	}
	badRoot, _ := NewLocalSigner("bad-root")
	if _, err = Bootstrap(badRoot.PublicKey(), "local", valid, clock); Code(err) != "trust_signature" {
		t.Fatal("wrong root", err)
	}
	if _, err = Bootstrap(root.PublicKey(), "another-env", valid, clock); Code(err) != "trust_version" {
		t.Fatal("wrong env", err)
	}
	if _, err = trust.WithBundle(valid, clock); Code(err) != "trust_version" {
		t.Fatal("trust replay", err)
	}
	if _, err = Bootstrap(root.PublicKey(), "local", valid, clock.Add(12*time.Hour)); Code(err) != "trust_time" {
		t.Fatal("expired bundle", err)
	}
	if _, err = Bootstrap(root.PublicKey(), "local", valid, clock.Add(-time.Second)); Code(err) != "trust_time" {
		t.Fatal("future bundle", err)
	}
	if _, err = trust.WithBundle(bytes.Repeat([]byte("x"), MaxTrustBytes+1), clock); Code(err) != "trust_bounds" {
		t.Fatal("unbounded bundle", err)
	}
	changed := mutate(t, valid, func(v map[string]any) { v["version"] = float64(2); v["context"] = "AEGISGATE_CONFIG_V1" })
	if _, err = trust.WithBundle(changed, clock); err == nil {
		t.Fatal("context accepted")
	}
	changed = mutate(t, valid, func(v map[string]any) {
		v["version"] = float64(2)
		keys := v["keys"].([]any)
		keys[0].(map[string]any)["public_key"] = base64.StdEncoding.EncodeToString(badRoot.PublicKey())
	})
	if _, err = trust.WithBundle(changed, clock); err == nil {
		t.Fatal("tampered root bundle accepted")
	}
	changed = mutate(t, valid, func(v map[string]any) { delete(v, "version") })
	if _, err = Bootstrap(root.PublicKey(), "local", changed, clock); err == nil {
		t.Fatal("missing trust field accepted")
	}
	changed = mutate(t, valid, func(v map[string]any) { v["notification_root"] = true })
	if _, err = Bootstrap(root.PublicKey(), "local", changed, clock); err == nil {
		t.Fatal("unknown trust field accepted")
	}
	// Signature trust expires even while an artifact's own validity remains.
	e := example()
	e.ExpiresAt = clock.Add(24 * time.Hour)
	snapshot, err := Sign(context.Background(), e, s)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = Verify(snapshot, trust, "deployment-local", 0, clock.Add(12*time.Hour)); Code(err) != "signing_key" {
		t.Fatal("expired trust accepted", err)
	}
	_ = raw
}
func TestNegativeTrustKeyBounds(t *testing.T) {
	s, _, _ := setup(t)
	key := TrustedKey{ID: s.KeyID(), PublicKey: s.PublicKey(), NotBefore: clock.Add(-time.Hour), NotAfter: clock.Add(24 * time.Hour)}
	for name, keys := range map[string][]TrustedKey{"none": {}, "duplicate": {key, key}, "unbounded": {{ID: "x", PublicKey: s.PublicKey(), NotBefore: clock, NotAfter: clock.Add(MaxKeyValidity + time.Second)}}, "bad_key": {{ID: "x", PublicKey: ed25519.PublicKey{1}, NotBefore: clock, NotAfter: clock.Add(time.Hour)}}, "unbounded_overlap": {key, {ID: "other", PublicKey: s.PublicKey(), NotBefore: key.NotBefore, NotAfter: key.NotAfter}}} {
		t.Run(name, func(t *testing.T) {
			if _, err := NewTrustStore(keys); err == nil {
				t.Fatal("invalid trust accepted")
			}
		})
	}
}
func TestNegativeValidSignatureCannotAuthorizeUnsafePayload(t *testing.T) {
	s, trust, _ := setup(t)
	for name, fn := range map[string]func(*Envelope){"cross_tenant": func(e *Envelope) { e.Payload.Tenants[0].Routes[0].TenantID = "tenant-b" }, "missing_auth": func(e *Envelope) { e.Payload.Tenants[0].Policies = nil }, "disabled_auth": func(e *Envelope) { e.Payload.Tenants[0].Policies[0].AuthRequired = false }, "duplicate_host": func(e *Envelope) {
		d := e.Payload.Tenants[0].Domains[0]
		d.ID = "second-domain"
		e.Payload.Tenants[0].Domains = append(e.Payload.Tenants[0].Domains, d)
	}} {
		t.Run(name, func(t *testing.T) {
			e := example()
			e.SchemaVersion = SchemaVersion
			e.Context = Context
			e.SigningKeyID = s.KeyID()
			fn(&e)
			payload, err := canonical(e.Payload)
			if err != nil {
				t.Fatal(err)
			}
			sum := sha256.Sum256(payload)
			e.ContentSHA256 = hex.EncodeToString(sum[:])
			message, err := signingBytes(e)
			if err != nil {
				t.Fatal(err)
			}
			sig, err := s.Sign(context.Background(), message)
			if err != nil {
				t.Fatal(err)
			}
			e.Signature = base64.StdEncoding.EncodeToString(sig)
			raw, err := json.Marshal(e)
			if err != nil {
				t.Fatal(err)
			}
			if _, err = Verify(raw, trust, "deployment-local", 0, clock); err == nil {
				t.Fatal("validly signed unsafe payload accepted")
			}
		})
	}
}
