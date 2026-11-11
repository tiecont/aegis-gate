package configsnapshot

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"time"
)

const TrustContext = "AEGISGATE_TRUST_V1"
const MaxTrustBytes = 32 << 10
const MaxKeyValidity = 30 * 24 * time.Hour
const MaxKeyOverlap = 24 * time.Hour

type TrustedKey struct {
	ID        string            `json:"id"`
	PublicKey ed25519.PublicKey `json:"public_key"`
	NotBefore time.Time         `json:"not_before"`
	NotAfter  time.Time         `json:"not_after"`
	RetiredAt time.Time         `json:"retired_at"`
}

// TrustStore is immutable. Readers may share it; rotation produces a new value.
type TrustStore struct {
	keys        map[string]TrustedKey
	root        ed25519.PublicKey
	environment string
	version     uint64
	expiresAt   time.Time
	retired     map[string]bool
}

// NewTrustStore accepts ONLY an authenticated out-of-band provisioned trust
// configuration. Notifications and signed snapshot bodies are never such input.
// Network bootstrap/rotation should use Bootstrap and WithBundle instead.
func NewTrustStore(keys []TrustedKey) (*TrustStore, error) {
	if len(keys) == 0 || len(keys) > 2 {
		return nil, fail("trust_bounds")
	}
	store := &TrustStore{keys: map[string]TrustedKey{}, retired: map[string]bool{}}
	for _, k := range keys {
		if !identifier(k.ID) || len(k.PublicKey) != ed25519.PublicKeySize || !k.NotAfter.After(k.NotBefore) || k.NotAfter.Sub(k.NotBefore) > MaxKeyValidity || (!k.RetiredAt.IsZero() && (k.RetiredAt.Before(k.NotBefore) || k.RetiredAt.After(k.NotAfter))) {
			return nil, fail("trust_key")
		}
		if _, ok := store.keys[k.ID]; ok {
			return nil, fail("trust_key")
		}
		k.PublicKey = bytes.Clone(k.PublicKey)
		store.keys[k.ID] = k
	}
	if len(keys) == 2 {
		start := keys[0].NotBefore
		if keys[1].NotBefore.After(start) {
			start = keys[1].NotBefore
		}
		end := keys[0].NotAfter
		if keys[1].NotAfter.Before(end) {
			end = keys[1].NotAfter
		}
		if end.Sub(start) > MaxKeyOverlap {
			return nil, fail("trust_overlap")
		}
	}
	return store, nil
}
func (s *TrustStore) key(id string, createdAt, now time.Time) (ed25519.PublicKey, error) {
	if s == nil {
		return nil, fail("signing_key")
	}
	k, ok := s.keys[id]
	if !ok || s.retired[id] || createdAt.Before(k.NotBefore) || !createdAt.Before(k.NotAfter) || now.Before(k.NotBefore) || !now.Before(k.NotAfter) || (!k.RetiredAt.IsZero() && !now.Before(k.RetiredAt)) || (!s.expiresAt.IsZero() && !now.Before(s.expiresAt)) {
		return nil, fail("signing_key")
	}
	return k.PublicKey, nil
}
func (s *TrustStore) CheckKey(id string, createdAt, now time.Time) error {
	_, err := s.key(id, createdAt, now)
	return err
}

type TrustBundle struct {
	Context     string       `json:"context"`
	Environment string       `json:"environment"`
	Version     uint64       `json:"version"`
	IssuedAt    time.Time    `json:"issued_at"`
	ExpiresAt   time.Time    `json:"expires_at"`
	Keys        []TrustedKey `json:"keys"`
	Signature   string       `json:"signature"`
}

func trustBytes(bundle TrustBundle) ([]byte, error) {
	raw, err := json.Marshal(bundle)
	if err != nil {
		return nil, fail("trust_bundle")
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil {
		return nil, fail("trust_bundle")
	}
	delete(fields, "signature")
	body, err := canonical(fields)
	if err != nil {
		return nil, err
	}
	return append([]byte(TrustContext+"\x00"), body...), nil
}

// SignTrustBundle is suitable for an offline pinned-root secret-service adapter.
func SignTrustBundle(ctx context.Context, bundle TrustBundle, root Signer) ([]byte, error) {
	if root == nil {
		return nil, fail("trust_root")
	}
	bundle.Context = TrustContext
	message, err := trustBytes(bundle)
	if err != nil {
		return nil, err
	}
	sig, err := root.Sign(ctx, message)
	if err != nil {
		return nil, err
	}
	if len(sig) != ed25519.SignatureSize {
		return nil, fail("trust_signature")
	}
	bundle.Signature = base64.StdEncoding.EncodeToString(sig)
	raw, err := canonical(bundle)
	if len(raw) > MaxTrustBytes {
		return nil, fail("trust_bounds")
	}
	return raw, err
}

// Bootstrap verifies a root-signed environment-specific bundle. root must be
// pinned by authenticated installation, never learned from this bundle or NATS.
func Bootstrap(root ed25519.PublicKey, environment string, raw []byte, now time.Time) (*TrustStore, error) {
	if len(root) != ed25519.PublicKeySize || !identifier(environment) {
		return nil, fail("trust_root")
	}
	return (&TrustStore{root: bytes.Clone(root), environment: environment, retired: map[string]bool{}}).WithBundle(raw, now)
}

// WithBundle validates monotonic root-authorized rotation, bounded overlap,
// explicit retirement and omission. A previously retired key cannot reappear.
func (s *TrustStore) WithBundle(raw []byte, now time.Time) (*TrustStore, error) {
	if s == nil || len(s.root) != ed25519.PublicKeySize {
		return nil, fail("trust_root")
	}
	if len(raw) == 0 || len(raw) > MaxTrustBytes {
		return nil, fail("trust_bounds")
	}
	canon, err := canonicalRaw(raw)
	if err != nil {
		return nil, err
	}
	var bundle TrustBundle
	if err = strictDecode(canon, &bundle); err != nil {
		return nil, err
	}
	roundtrip, err := canonical(bundle)
	if err != nil || !bytes.Equal(roundtrip, canon) {
		return nil, fail("trust_bundle")
	}
	if bundle.Context != TrustContext || bundle.Environment != s.environment || bundle.Version <= s.version || bundle.Version > MaxGeneration {
		return nil, fail("trust_version")
	}
	if bundle.IssuedAt.IsZero() || now.Before(bundle.IssuedAt) || !now.Before(bundle.ExpiresAt) || bundle.ExpiresAt.Sub(bundle.IssuedAt) > MaxValidity {
		return nil, fail("trust_time")
	}
	sig, err := base64.StdEncoding.Strict().DecodeString(bundle.Signature)
	if err != nil || len(sig) != ed25519.SignatureSize {
		return nil, fail("trust_signature")
	}
	message, err := trustBytes(bundle)
	if err != nil {
		return nil, err
	}
	if !ed25519.Verify(s.root, message, sig) {
		return nil, fail("trust_signature")
	}
	next, err := NewTrustStore(bundle.Keys)
	if err != nil {
		return nil, err
	}
	next.root = bytes.Clone(s.root)
	next.environment = s.environment
	next.version = bundle.Version
	next.expiresAt = bundle.ExpiresAt
	for id := range s.retired {
		next.retired[id] = true
	}
	for id, k := range s.keys {
		if _, ok := next.keys[id]; !ok || !k.RetiredAt.IsZero() && !now.Before(k.RetiredAt) {
			next.retired[id] = true
		}
	}
	for id, k := range next.keys {
		if next.retired[id] && (k.RetiredAt.IsZero() || now.Before(k.RetiredAt)) {
			return nil, fail("trust_retired")
		}
		if old, ok := s.keys[id]; ok && (!bytes.Equal(old.PublicKey, k.PublicKey) || !old.NotBefore.Equal(k.NotBefore) || !old.NotAfter.Equal(k.NotAfter) || !old.RetiredAt.IsZero() && (k.RetiredAt.IsZero() || k.RetiredAt.After(old.RetiredAt))) {
			return nil, fail("trust_key_reuse")
		}
	}
	return next, nil
}
