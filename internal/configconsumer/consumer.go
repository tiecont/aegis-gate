// Package configconsumer implements engine-independent configuration acceptance.
// It opens no customer listener and performs no proxying or token validation.
package configconsumer

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"aegisgate.dev/aegisgate/internal/configsnapshot"
)

type Notice struct {
	DeploymentID string `json:"deployment_id"`
	Generation   uint64 `json:"generation"`
	Digest       string `json:"digest"`
	Location     string `json:"location"`
}

type Ack struct {
	DeploymentID string `json:"deployment_id"`
	Generation   uint64 `json:"generation"`
	Digest       string `json:"digest"`
	Accepted     bool   `json:"accepted"`
	Code         string `json:"code"`
}

// Fetcher must authenticate the server and the consumer identity, pin the
// endpoint, refuse redirects, and enforce its own time and body bounds.
type Fetcher interface {
	Fetch(context.Context, string) (io.ReadCloser, error)
}

type Options struct {
	DeploymentID           string
	Trust                  *configsnapshot.TrustStore
	Persistence            Persistence
	MaxStaleness           time.Duration
	MaxReaders             int
	MaxRetainedGenerations int
	Clock                  func() time.Time
	// MinimumGeneration comes from authenticated provisioning when recovering a
	// lost disk. Apply must advance beyond this floor; restore may equal it.
	MinimumGeneration uint64
}

type view struct {
	envelope configsnapshot.Envelope
	raw      []byte
	routes   map[routeKey]CompiledRoute
}

type routeKey struct{ host, path, method string }

// CompiledRoute binds all references to the captured immutable generation.
// It is a configuration read model; an engine must still enforce its policy.
type CompiledRoute struct {
	Generation uint64
	TenantID   string
	Route      configsnapshot.Route
	Policy     configsnapshot.Policy
	Pool       configsnapshot.OriginPool
}

type Metrics struct {
	AppliedGeneration uint64
	ACKs              uint64
	NACKs             uint64
	InvalidArtifacts  uint64
	LastValidUpdate   time.Time
	Stale             bool
	Ready             bool
}

type Consumer struct {
	mu            sync.Mutex
	active        atomic.Pointer[view]
	options       Options
	readers       map[*view]int
	readerCount   int
	metrics       Metrics
	initialized   bool
	startupErr    error
	recoveryFloor uint64
	draining      bool
	drainDone     chan struct{}
	drained       atomic.Bool
}

func New(options Options) (*Consumer, error) {
	if options.DeploymentID == "" || options.Trust == nil || options.Persistence == nil || options.MinimumGeneration > configsnapshot.MaxGeneration || options.MaxStaleness <= 0 || options.MaxStaleness > 24*time.Hour || options.MaxReaders < 1 || options.MaxReaders > 4096 || options.MaxRetainedGenerations < 1 || options.MaxRetainedGenerations > 8 {
		return nil, errors.New("invalid consumer options")
	}
	if options.Clock == nil {
		options.Clock = time.Now
	}
	return &Consumer{options: options, readers: map[*view]int{}}, nil
}

func (c *Consumer) result(notice Notice, accepted bool, code string) Ack {
	if accepted {
		c.metrics.ACKs++
	} else {
		c.metrics.NACKs++
		switch code {
		case "invalid_snapshot", "stale_snapshot", "invalid_notice", "artifact_digest", "wrong_generation", "artifact_size":
			c.metrics.InvalidArtifacts++
		}
	}
	// Never reflect attacker-supplied arbitrary identifiers or signature errors.
	return Ack{DeploymentID: c.options.DeploymentID, Generation: notice.Generation, Digest: safeDigest(notice.Digest), Accepted: accepted, Code: code}
}

func safeDigest(value string) string {
	if len(value) != 64 {
		return ""
	}
	decoded, err := hex.DecodeString(value)
	if err != nil || len(decoded) != 32 {
		return ""
	}
	return hex.EncodeToString(decoded)
}

func (c *Consumer) validate(raw []byte, minimum uint64) (*view, string) {
	now := c.options.Clock().UTC()
	envelope, err := configsnapshot.Verify(raw, c.options.Trust, c.options.DeploymentID, minimum, now)
	if err != nil {
		return nil, "invalid_snapshot"
	}
	if now.Sub(envelope.CreatedAt) > c.options.MaxStaleness {
		return nil, "stale_snapshot"
	}
	// Shared validation resolves every reference and rejects unsupported policies.
	// Keep a private immutable copy; no pointer to caller-owned data is retained.
	compiled := map[routeKey]CompiledRoute{}
	for _, tenant := range envelope.Payload.Tenants {
		domains := map[string]string{}
		policies := map[string]configsnapshot.Policy{}
		pools := map[string]configsnapshot.OriginPool{}
		for _, domain := range tenant.Domains {
			domains[domain.ID] = domain.Hostname
		}
		for _, policy := range tenant.Policies {
			policies[policy.ID] = policy
		}
		for _, pool := range tenant.OriginPools {
			pools[pool.ID] = pool
		}
		for _, route := range tenant.Routes {
			for _, method := range route.Methods {
				key := routeKey{domains[route.DomainID], route.Path, method}
				if _, exists := compiled[key]; exists {
					return nil, "route_collision"
				}
				compiled[key] = CompiledRoute{envelope.Generation, tenant.ID, route, policies[route.PolicyID], pools[route.OriginPoolID]}
			}
		}
	}
	return &view{envelope: envelope, raw: append([]byte(nil), raw...), routes: compiled}, ""
}

func (c *Consumer) Apply(ctx context.Context, notice Notice, raw []byte) Ack {
	c.mu.Lock()
	defer c.mu.Unlock()
	if ctx.Err() != nil {
		return c.result(notice, false, "cancelled")
	}
	if c.draining {
		return c.result(notice, false, "cancelled")
	}
	if err := c.startupLocked(ctx); err != nil {
		return c.result(notice, false, "checkpoint_invalid")
	}
	if notice.DeploymentID != c.options.DeploymentID || notice.Generation == 0 || len(raw) == 0 || len(raw) > configsnapshot.MaxArtifactBytes {
		return c.result(notice, false, "invalid_notice")
	}
	digest := sha256.Sum256(raw)
	if notice.Digest != hex.EncodeToString(digest[:]) {
		return c.result(notice, false, "artifact_digest")
	}
	minimum := max(c.options.MinimumGeneration, c.recoveryFloor)
	if active := c.active.Load(); active != nil {
		minimum = active.envelope.Generation
	}
	candidate, code := c.validate(raw, minimum)
	if code != "" {
		return c.result(notice, false, code)
	}
	if candidate.envelope.Generation != notice.Generation {
		return c.result(notice, false, "wrong_generation")
	}
	// One new active view plus all pinned older generations must fit the bound.
	if len(c.readers)+1 > c.options.MaxRetainedGenerations {
		return c.result(notice, false, "retention_busy")
	}
	if err := c.options.Persistence.Save(ctx, candidate.raw); err != nil {
		return c.result(notice, false, "persistence_unavailable")
	}
	c.active.Store(candidate)
	c.metrics.AppliedGeneration = candidate.envelope.Generation
	c.metrics.LastValidUpdate = c.options.Clock().UTC()
	return c.result(notice, true, "applied")
}

// Restore is an explicit startup operation. Persisted data never bootstraps trust.
// The signed checkpoint itself carries the restart generation high-water mark.
func (c *Consumer) Restore(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.active.Load() != nil {
		return errors.New("already initialized")
	}
	if err := c.startupLocked(ctx); err != nil {
		return err
	}
	if c.active.Load() == nil {
		return errors.New("no valid checkpoint")
	}
	return nil
}

func (c *Consumer) startupLocked(ctx context.Context) error {
	if c.initialized {
		return c.startupErr
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	raw, err := c.options.Persistence.Load(ctx)
	if errors.Is(err, os.ErrNotExist) {
		c.initialized = true
		return nil
	}
	if err != nil {
		c.initialized = true
		c.startupErr = errors.New("invalid checkpoint")
		return c.startupErr
	}
	candidate, code := c.validate(raw, 0)
	if code != "" {
		// An authentic expired checkpoint is evidence of a generation already
		// observed, never permission to serve. Preserve only its replay floor so
		// a newer valid candidate can recover automatically after an outage.
		historical, historicalErr := configsnapshot.VerifyCheckpoint(raw, c.options.Trust, c.options.DeploymentID, c.options.Clock().UTC())
		if historicalErr == nil && historical.Generation >= c.options.MinimumGeneration {
			c.recoveryFloor = historical.Generation
			c.initialized = true
			return nil
		}
	}
	if code == "" && candidate.envelope.Generation < c.options.MinimumGeneration {
		code = "checkpoint_rollback"
	}
	c.initialized = true
	if code != "" {
		c.startupErr = errors.New(code)
		return c.startupErr
	}
	c.active.Store(candidate)
	c.metrics.AppliedGeneration = candidate.envelope.Generation
	c.metrics.LastValidUpdate = candidate.envelope.CreatedAt
	return nil
}

// UpdateTrust accepts only an already authenticated trust store. Readiness and
// captures reverify current trust, so retired keys take effect immediately.
func (c *Consumer) UpdateTrust(trust *configsnapshot.TrustStore) error {
	if trust == nil {
		return errors.New("missing trust")
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.options.Trust = trust
	return nil
}

func (c *Consumer) readyLocked() bool {
	if c.draining {
		return false
	}
	active := c.active.Load()
	if active == nil {
		return false
	}
	_, code := c.validate(active.raw, 0)
	return code == ""
}

func (c *Consumer) Metrics() Metrics {
	c.mu.Lock()
	defer c.mu.Unlock()
	metrics := c.metrics
	metrics.Ready = c.readyLocked()
	metrics.Stale = (c.active.Load() != nil || c.recoveryFloor > 0) && !metrics.Ready
	return metrics
}

// CurrentAck retransmits an ACK lost in transit without applying a replay. It
// confirms only the exact already-active artifact under current trust/readiness.
// Callers must use Apply for every candidate; this method cannot advance state.
func (c *Consumer) CurrentAck(notice Notice) (Ack, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	active := c.active.Load()
	if active == nil || !c.readyLocked() || notice.DeploymentID != c.options.DeploymentID || notice.Generation != active.envelope.Generation {
		return Ack{}, false
	}
	digest := sha256.Sum256(active.raw)
	if notice.Digest != hex.EncodeToString(digest[:]) {
		return Ack{}, false
	}
	return c.result(notice, true, "already_applied"), true
}

// Capture pins exactly one generation for the whole operation. Close must be
// called; finite reader/retention budgets reject excess work or defer updates.
func (c *Consumer) Capture() (*Captured, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.readyLocked() || c.readerCount >= c.options.MaxReaders {
		return nil, errors.New("not ready")
	}
	active := c.active.Load()
	c.readers[active]++
	c.readerCount++
	return &Captured{consumer: c, view: active}, nil
}

type Captured struct {
	mu       sync.Mutex
	consumer *Consumer
	view     *view
}

// Drain permanently stops admission and waits for captured operations to close.
// A deadline is mandatory. On expiry all remaining capture access is refused;
// the caller must separately cancel engine I/O and remove upstream traffic.
// Restart requires a new consumer and authenticated provisioning, not an undrain.
func (c *Consumer) Drain(ctx context.Context) error {
	if _, ok := ctx.Deadline(); !ok {
		return errors.New("drain deadline required")
	}
	c.mu.Lock()
	if !c.draining {
		c.draining = true
		c.drainDone = make(chan struct{})
		if c.readerCount == 0 {
			close(c.drainDone)
		}
	}
	done := c.drainDone
	c.mu.Unlock()
	select {
	case <-done:
		c.drained.Store(true)
		return nil
	case <-ctx.Done():
		c.drained.Store(true)
		return ctx.Err()
	}
}

// Resolve uses exact, case-sensitive path/method matching and canonical hostnames
// as defined by schema 1.0. Returned slices are copies, never active storage.
func (r *Captured) Resolve(host, path, method string) (CompiledRoute, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.view == nil || r.consumer.drained.Load() {
		return CompiledRoute{}, false
	}
	value, ok := r.view.routes[routeKey{host, path, method}]
	if !ok {
		return CompiledRoute{}, false
	}
	value.Route.Methods = append([]string(nil), value.Route.Methods...)
	value.Pool.Endpoints = append([]configsnapshot.Endpoint(nil), value.Pool.Endpoints...)
	return value, true
}

func (r *Captured) Snapshot() (configsnapshot.Envelope, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.view == nil || r.consumer.drained.Load() {
		return configsnapshot.Envelope{}, errors.New("capture closed")
	}
	// Return an independent copy: exported schema slices cannot mutate the active
	// object. A real engine can compile its own read-only policy view at staging.
	var envelope configsnapshot.Envelope
	normalized, err := json.Marshal(r.view.envelope)
	if err != nil {
		return envelope, err
	}
	err = json.Unmarshal(normalized, &envelope)
	return envelope, err
}

func (r *Captured) Close() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.view == nil {
		return
	}
	c := r.consumer
	c.mu.Lock()
	defer c.mu.Unlock()
	c.readers[r.view]--
	if c.readers[r.view] == 0 {
		delete(c.readers, r.view)
	}
	c.readerCount--
	if c.draining && c.readerCount == 0 {
		close(c.drainDone)
	}
	r.view = nil
}

func (c *Consumer) FetchApply(ctx context.Context, notice Notice, fetcher Fetcher) Ack {
	if fetcher == nil {
		return c.reject(notice, "fetch_unavailable")
	}
	// Size is bounded here. The adapter must honor this deadline; HTTPSFetcher
	// additionally enforces transport-level and total request timeouts.
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	body, err := fetcher.Fetch(ctx, notice.Location)
	if err != nil {
		return c.reject(notice, "fetch_unavailable")
	}
	defer body.Close()
	raw, err := io.ReadAll(io.LimitReader(body, configsnapshot.MaxArtifactBytes+1))
	if err != nil || len(raw) > configsnapshot.MaxArtifactBytes {
		return c.reject(notice, "artifact_size")
	}
	return c.Apply(ctx, notice, raw)
}

func (c *Consumer) reject(notice Notice, code string) Ack {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.result(notice, false, code)
}
