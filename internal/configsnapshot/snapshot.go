// Package configsnapshot owns the engine-independent Module03 signed wire contract.
package configsnapshot

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"time"

	jcs "github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
)

const (
	SchemaVersion    = "1.0"
	Context          = "AEGISGATE_CONFIG_V1"
	MaxArtifactBytes = 4 << 20
	MaxGeneration    = uint64(9007199254740991)
	MaxValidity      = 24 * time.Hour
)

type Envelope struct {
	SchemaVersion string    `json:"schema_version"`
	Context       string    `json:"context"`
	Generation    uint64    `json:"generation"`
	DeploymentID  string    `json:"deployment_id"`
	CreatedAt     time.Time `json:"created_at"`
	ValidFrom     time.Time `json:"valid_from"`
	ExpiresAt     time.Time `json:"expires_at"`
	ContentSHA256 string    `json:"content_sha256"`
	SigningKeyID  string    `json:"signing_key_id"`
	Payload       Payload   `json:"payload"`
	Signature     string    `json:"signature"`
}
type Payload struct {
	Tenants []Tenant `json:"tenants"`
}
type Tenant struct {
	ID          string       `json:"id"`
	Domains     []Domain     `json:"domains"`
	OriginPools []OriginPool `json:"origin_pools"`
	Policies    []Policy     `json:"policies"`
	Routes      []Route      `json:"routes"`
}
type Domain struct {
	ID            string    `json:"id"`
	TenantID      string    `json:"tenant_id"`
	Hostname      string    `json:"hostname"`
	VerifiedUntil time.Time `json:"verified_until"`
}
type OriginPool struct {
	ID         string     `json:"id"`
	TenantID   string     `json:"tenant_id"`
	Generation uint64     `json:"generation"`
	Endpoints  []Endpoint `json:"endpoints"`
}
type Endpoint struct {
	ID         string `json:"id"`
	TenantID   string `json:"tenant_id"`
	URL        string `json:"url"`
	Generation uint64 `json:"generation"`
}
type Policy struct {
	ID           string `json:"id"`
	TenantID     string `json:"tenant_id"`
	Generation   uint64 `json:"generation"`
	AuthRequired bool   `json:"auth_required"`
	JWTIssuer    string `json:"jwt_issuer"`
	JWTAudience  string `json:"jwt_audience"`
}
type Route struct {
	ID           string   `json:"id"`
	TenantID     string   `json:"tenant_id"`
	Generation   uint64   `json:"generation"`
	DomainID     string   `json:"domain_id"`
	OriginPoolID string   `json:"origin_pool_id"`
	PolicyID     string   `json:"policy_id"`
	Path         string   `json:"path"`
	Methods      []string `json:"methods"`
}

// Failure contains a stable diagnostic code, never candidate content or secrets.
type Failure struct{ Reason string }

func (e *Failure) Error() string { return e.Reason }
func fail(code string) error     { return &Failure{Reason: code} }
func Code(err error) string {
	var e *Failure
	if errors.As(err, &e) {
		return e.Reason
	}
	return "internal"
}

// Signer is implemented by a production audited secret service. It must sign
// these exact bytes with Ed25519, without prehashing or changing the context.
type Signer interface {
	KeyID() string
	Sign(context.Context, []byte) ([]byte, error)
}

// LocalSigner is disposable process-local signing material, never persisted.
type LocalSigner struct {
	id  string
	key ed25519.PrivateKey
}

func NewLocalSigner(id string) (*LocalSigner, error) {
	if !identifier(id) {
		return nil, fail("signing_key")
	}
	_, key, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	return &LocalSigner{id, key}, nil
}
func (s *LocalSigner) KeyID() string { return s.id }
func (s *LocalSigner) PublicKey() ed25519.PublicKey {
	return bytes.Clone(s.key.Public().(ed25519.PublicKey))
}
func (s *LocalSigner) Sign(ctx context.Context, message []byte) ([]byte, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return ed25519.Sign(s.key, message), nil
}

func canonical(v any) ([]byte, error) {
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, fail("malformed")
	}
	return canonicalRaw(raw)
}
func canonicalRaw(raw []byte) ([]byte, error) {
	if len(raw) == 0 || len(raw) > MaxArtifactBytes {
		return nil, fail("size")
	}
	// Bound nesting before invoking the maintained recursive canonicalizer.
	d := json.NewDecoder(bytes.NewReader(raw))
	depth := 0
	for {
		token, err := d.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fail("malformed")
		}
		if delim, ok := token.(json.Delim); ok {
			switch delim {
			case '{', '[':
				depth++
				if depth > 24 {
					return nil, fail("depth")
				}
			case '}', ']':
				depth--
			}
		}
	}
	result, err := jcs.Transform(raw)
	if err != nil {
		return nil, fail("malformed")
	}
	return result, nil
}
func strictDecode(raw []byte, v any) error {
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return fail("schema")
	}
	if d.Decode(new(any)) != io.EOF {
		return fail("malformed")
	}
	return nil
}
func signingBytes(e Envelope) ([]byte, error) {
	// Removing the signature property is part of the versioned wire contract.
	raw, err := json.Marshal(e)
	if err != nil {
		return nil, fail("malformed")
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil {
		return nil, fail("malformed")
	}
	delete(fields, "signature")
	body, err := canonical(fields)
	if err != nil {
		return nil, err
	}
	return append([]byte(Context+"\x00"), body...), nil
}
func Sign(ctx context.Context, e Envelope, s Signer) ([]byte, error) {
	if s == nil {
		return nil, fail("signing_key")
	}
	e.SchemaVersion = SchemaVersion
	e.Context = Context
	e.SigningKeyID = s.KeyID()
	e.Signature = ""
	if err := validateEnvelope(e, e.ValidFrom); err != nil {
		return nil, err
	}
	payload, err := canonical(e.Payload)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(payload)
	e.ContentSHA256 = hex.EncodeToString(sum[:])
	message, err := signingBytes(e)
	if err != nil {
		return nil, err
	}
	sig, err := s.Sign(ctx, message)
	if err != nil {
		return nil, err
	}
	if len(sig) != ed25519.SignatureSize {
		return nil, fail("signature")
	}
	e.Signature = base64.StdEncoding.EncodeToString(sig)
	return canonical(e)
}
func Verify(raw []byte, trust *TrustStore, deploymentID string, minGeneration uint64, now time.Time) (Envelope, error) {
	return verify(raw, trust, deploymentID, minGeneration, now, false)
}

// VerifyCheckpoint authenticates durable replay-floor metadata, including an
// expired artifact, against keys still trusted NOW. It never grants readiness
// or authorizes activation: callers must separately use Verify at current time.
// This prevents an expired LKG from erasing the durable generation high-water.
func VerifyCheckpoint(raw []byte, trust *TrustStore, deploymentID string, now time.Time) (Envelope, error) {
	return verify(raw, trust, deploymentID, 0, now, true)
}
func verify(raw []byte, trust *TrustStore, deploymentID string, minGeneration uint64, now time.Time, checkpoint bool) (Envelope, error) {
	var e Envelope
	canon, err := canonicalRaw(raw)
	if err != nil {
		return e, err
	}
	if err = strictDecode(canon, &e); err != nil {
		return e, err
	}
	if err = validateRequired(canon); err != nil {
		return e, err
	}
	if e.SchemaVersion != SchemaVersion || e.Context != Context {
		return e, fail("schema_context")
	}
	if e.DeploymentID != deploymentID || !identifier(deploymentID) {
		return e, fail("deployment")
	}
	if e.Generation <= minGeneration || e.Generation > MaxGeneration {
		return e, fail("generation")
	}
	semanticTime := now
	if checkpoint {
		if now.Before(e.ValidFrom) {
			return e, fail("time")
		}
		semanticTime = e.ValidFrom
	}
	if err = validateEnvelope(e, semanticTime); err != nil {
		return e, err
	}
	if trust == nil {
		return e, fail("signing_key")
	}
	key, err := trust.key(e.SigningKeyID, e.CreatedAt, now)
	if err != nil {
		return e, err
	}
	payload, err := canonical(e.Payload)
	if err != nil {
		return e, err
	}
	sum := sha256.Sum256(payload)
	if hex.EncodeToString(sum[:]) != e.ContentSHA256 {
		return e, fail("digest")
	}
	sig, err := base64.StdEncoding.Strict().DecodeString(e.Signature)
	if err != nil || len(sig) != ed25519.SignatureSize {
		return e, fail("signature")
	}
	message, err := signingBytes(e)
	if err != nil {
		return e, err
	}
	if !ed25519.Verify(key, message, sig) {
		return e, fail("signature")
	}
	return e, nil
}
func validateEnvelope(e Envelope, now time.Time) error {
	if e.SchemaVersion != SchemaVersion || e.Context != Context {
		return fail("schema_context")
	}
	if !identifier(e.DeploymentID) || !identifier(e.SigningKeyID) {
		return fail("deployment")
	}
	if e.Generation == 0 || e.Generation > MaxGeneration {
		return fail("generation")
	}
	if e.CreatedAt.IsZero() || e.ValidFrom.IsZero() || e.ExpiresAt.IsZero() || e.CreatedAt.Location() != time.UTC || e.ValidFrom.Location() != time.UTC || e.ExpiresAt.Location() != time.UTC || e.CreatedAt.Nanosecond() != 0 || e.ValidFrom.Nanosecond() != 0 || e.ExpiresAt.Nanosecond() != 0 || e.ValidFrom.Before(e.CreatedAt) || !e.ExpiresAt.After(e.ValidFrom) || e.ExpiresAt.Sub(e.CreatedAt) > MaxValidity || now.Before(e.ValidFrom) || !now.Before(e.ExpiresAt) {
		return fail("time")
	}
	return Validate(e.Payload, now)
}
