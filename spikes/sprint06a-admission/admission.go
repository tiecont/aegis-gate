//go:build aegisgate_sprint06a_feasibility

// Package admission is a build-tagged local feasibility experiment only.
package admission

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"sync"
	"time"

	"aegisgate.dev/aegisgate/internal/configconsumer"
	"aegisgate.dev/aegisgate/internal/configsnapshot"
	jcs "github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
	"github.com/golang-jwt/jwt/v5"
)

const MaxWireBytes = 1536 * 1024
const RequestMillis = 2500

var ErrDenied = errors.New("experimental_admission_denied")

type Binding struct {
	Tenant             string `json:"tenant"`
	Route              string `json:"route"`
	RouteGeneration    uint64 `json:"route_generation"`
	PolicyGeneration   uint64 `json:"policy_generation"`
	PoolGeneration     uint64 `json:"pool_generation"`
	EndpointGeneration uint64 `json:"endpoint_generation"`
	Profile            string `json:"profile"`
	MaxWireBytes       int    `json:"max_wire_bytes"`
	RequestMillis      int    `json:"request_millis"`
}
type Sidecar struct {
	Context        string    `json:"context"`
	Version        string    `json:"version"`
	Deployment     string    `json:"deployment"`
	SnapshotDigest string    `json:"snapshot_sha256"`
	Generation     uint64    `json:"generation"`
	CreatedAt      time.Time `json:"created_at"`
	ExpiresAt      time.Time `json:"expires_at"`
	KeyID          string    `json:"key_id"`
	Bindings       []Binding `json:"bindings"`
	Signature      string    `json:"signature"`
}

func digest(raw []byte) string { sum := sha256.Sum256(raw); return hex.EncodeToString(sum[:]) }
func canonical(v any) ([]byte, error) {
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return jcs.Transform(raw)
}
func unsigned(s Sidecar) ([]byte, error) {
	raw, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil {
		return nil, ErrDenied
	}
	delete(fields, "signature")
	return canonical(fields)
}

// SignSidecar signs domain-separated JCS using the existing Signer interface.
// Signatures and their verification use the existing Module03 trust lifecycle.
func SignSidecar(ctx context.Context, s Sidecar, signer configsnapshot.Signer) ([]byte, error) {
	if signer == nil {
		return nil, ErrDenied
	}
	s.Context = configsnapshot.Sprint06AAdmissionContext
	s.Version = "1-experimental"
	s.KeyID = signer.KeyID()
	s.Signature = ""
	raw, err := unsigned(s)
	if err != nil {
		return nil, err
	}
	message, err := configsnapshot.Sprint06AAdmissionSigningBytes(raw)
	if err != nil {
		return nil, err
	}
	sig, err := signer.Sign(ctx, message)
	if err != nil {
		return nil, err
	}
	if len(sig) != 64 {
		return nil, ErrDenied
	}
	s.Signature = base64.StdEncoding.EncodeToString(sig)
	return canonical(s)
}

func verifySidecar(raw, snapshot []byte, trust *configsnapshot.TrustStore, deployment string, now time.Time) (Sidecar, error) {
	var s Sidecar
	if len(raw) == 0 || len(raw) > configsnapshot.Sprint06AMaxAdmissionBytes {
		return s, ErrDenied
	}
	// The shared bounded canonicalizer checks depth and duplicates before decoding.
	if _, err := configsnapshot.Sprint06AAdmissionSigningBytes(raw); err != nil {
		return s, ErrDenied
	}
	canon, err := jcs.Transform(raw)
	if err != nil {
		return s, ErrDenied
	}
	dec := json.NewDecoder(bytes.NewReader(canon))
	dec.DisallowUnknownFields()
	if dec.Decode(&s) != nil || dec.Decode(new(any)) != io.EOF {
		return s, ErrDenied
	}
	round, err := canonical(s)
	if err != nil || !bytes.Equal(round, canon) {
		return s, ErrDenied
	}
	e, err := configsnapshot.Verify(snapshot, trust, deployment, 0, now)
	if err != nil {
		return s, ErrDenied
	}
	if s.Context != configsnapshot.Sprint06AAdmissionContext || s.Version != "1-experimental" || s.Deployment != deployment || s.SnapshotDigest != digest(snapshot) || s.Generation != e.Generation || s.KeyID != e.SigningKeyID || !s.CreatedAt.Equal(e.CreatedAt) || !s.ExpiresAt.Equal(e.ExpiresAt) || len(s.Bindings) == 0 || len(s.Bindings) > 128 {
		return s, ErrDenied
	}
	seen := map[string]bool{}
	for _, b := range s.Bindings {
		key := b.Tenant + "\x00" + b.Route
		if seen[key] || b.Profile != "strict_finite" || b.MaxWireBytes != MaxWireBytes || b.RequestMillis != RequestMillis {
			return s, ErrDenied
		}
		seen[key] = true
		found := false
		for _, tenant := range e.Payload.Tenants {
			if tenant.ID != b.Tenant {
				continue
			}
			for _, r := range tenant.Routes {
				if r.ID != b.Route {
					continue
				}
				var p configsnapshot.Policy
				var pool configsnapshot.OriginPool
				for _, v := range tenant.Policies {
					if v.ID == r.PolicyID {
						p = v
					}
				}
				for _, v := range tenant.OriginPools {
					if v.ID == r.OriginPoolID {
						pool = v
					}
				}
				found = r.Generation == b.RouteGeneration && p.Generation == b.PolicyGeneration && pool.Generation == b.PoolGeneration && len(pool.Endpoints) == 1 && pool.Endpoints[0].Generation == b.EndpointGeneration && p.AuthRequired
			}
		}
		if !found {
			return s, ErrDenied
		}
	}
	sig, err := base64.StdEncoding.Strict().DecodeString(s.Signature)
	if err != nil || len(sig) != 64 {
		return s, ErrDenied
	}
	message, err := unsigned(s)
	if err != nil {
		return s, ErrDenied
	}
	if trust.VerifySprint06AAdmission(message, sig, s.KeyID, s.CreatedAt, now) != nil {
		return s, ErrDenied
	}
	return s, nil
}

type Lease struct {
	Capture *configconsumer.Captured
	Route   configconsumer.CompiledRoute
	Binding Binding
	Expires time.Time
}

func (l *Lease) Close() { l.Capture.Close() }

// Adapter serializes candidate staging and capture, so a request can never pair
// a sidecar with a different snapshot. Consumer owns compilation/persistence.
type Adapter struct {
	mu         sync.Mutex
	consumer   *configconsumer.Consumer
	trust      *configsnapshot.TrustStore
	deployment string
	clock      func() time.Time
	profile    Sidecar
	activeRaw  []byte
}

func New(c *configconsumer.Consumer, trust *configsnapshot.TrustStore, deployment string, clock func() time.Time) *Adapter {
	return &Adapter{consumer: c, trust: trust, deployment: deployment, clock: clock}
}
func (a *Adapter) Apply(ctx context.Context, n configconsumer.Notice, raw, sidecar []byte) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	s, err := verifySidecar(sidecar, raw, a.trust, a.deployment, a.clock())
	if err != nil {
		return err
	}
	ack := a.consumer.Apply(ctx, n, raw)
	if !ack.Accepted {
		return ErrDenied
	}
	a.profile = s
	a.activeRaw = bytes.Clone(raw)
	return nil
}

// Restore authenticates the sidecar separately; absence never grants admission.
// A crash between durable snapshot save and sidecar availability fails closed.
func (a *Adapter) Restore(ctx context.Context, raw, sidecar []byte) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	s, err := verifySidecar(sidecar, raw, a.trust, a.deployment, a.clock())
	if err != nil {
		return err
	}
	if err = a.consumer.Restore(ctx); err != nil {
		return err
	}
	n := configconsumer.Notice{DeploymentID: a.deployment, Generation: s.Generation, Digest: digest(raw)}
	if _, ok := a.consumer.CurrentAck(n); !ok {
		return ErrDenied
	}
	a.profile = s
	a.activeRaw = bytes.Clone(raw)
	return nil
}
func (a *Adapter) UpdateTrust(trust *configsnapshot.TrustStore) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if trust == nil {
		return ErrDenied
	}
	if err := a.consumer.UpdateTrust(trust); err != nil {
		return err
	}
	a.trust = trust
	return nil
}
func (a *Adapter) Capture(sni, host, path, method string) (*Lease, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if sni != host || strings.ContainsAny(host, ":/@\\") {
		return nil, ErrDenied
	}
	if _, err := verifySidecarMust(a); err != nil {
		return nil, err
	}
	c, err := a.consumer.Capture()
	if err != nil {
		return nil, ErrDenied
	}
	e, err := c.Snapshot()
	if err != nil || e.Generation != a.profile.Generation || e.Signature == "" {
		c.Close()
		return nil, ErrDenied
	}
	var active configsnapshot.Envelope
	if json.Unmarshal(a.activeRaw, &active) != nil || e.Signature != active.Signature {
		c.Close()
		return nil, ErrDenied
	}
	r, ok := c.Resolve(host, path, method)
	if !ok {
		c.Close()
		return nil, ErrDenied
	}
	for _, b := range a.profile.Bindings {
		if b.Tenant == r.TenantID && b.Route == r.Route.ID && b.RouteGeneration == r.Route.Generation {
			return &Lease{c, r, b, a.profile.ExpiresAt}, nil
		}
	}
	c.Close()
	return nil, ErrDenied
}
func verifySidecarMust(a *Adapter) (Sidecar, error) {
	raw, err := canonical(a.profile)
	if err != nil {
		return Sidecar{}, ErrDenied
	}
	return verifySidecar(raw, a.activeRaw, a.trust, a.deployment, a.clock())
}

// Authenticate is a bounded fixture verifier using the maintained JWT library.
// Its key is pinned per issuer by the test fixture, never learned from a token.
func Authenticate(l *Lease, authorization string, key any, now time.Time) error {
	if !l.Route.Policy.AuthRequired || len(authorization) > 4096 || !strings.HasPrefix(authorization, "Bearer ") {
		return ErrDenied
	}
	claims := new(jwt.RegisteredClaims)
	t, err := jwt.ParseWithClaims(strings.TrimPrefix(authorization, "Bearer "), claims, func(token *jwt.Token) (any, error) {
		if token.Header["kid"] != "fixture-jwt" {
			return nil, ErrDenied
		}
		return key, nil
	}, jwt.WithValidMethods([]string{"ES256"}), jwt.WithIssuer(l.Route.Policy.JWTIssuer), jwt.WithAudience(l.Route.Policy.JWTAudience), jwt.WithExpirationRequired(), jwt.WithIssuedAt(), jwt.WithTimeFunc(func() time.Time { return now }))
	if err != nil || !t.Valid || claims.Subject == "" {
		return ErrDenied
	}
	return nil
}
