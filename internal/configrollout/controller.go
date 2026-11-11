// Package configrollout controls delivery of signed configurations without
// participating in customer request handling or trusting notification contents.
package configrollout

import (
	"context"
	"encoding/hex"
	"errors"
	"regexp"
	"sort"
	"time"

	"aegisgate.dev/aegisgate/internal/configconsumer"
)

var (
	ErrConflict = errors.New("rollout state conflict")
	ErrMissing  = errors.New("rollout not found")
	ErrDenied   = errors.New("rollout operation denied")
	idPattern   = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$`)
)

const MaxEdges = 128
const MaxEvents = 2048

type Edge struct {
	ID    string `json:"id"`
	Group string `json:"group"`
}
type Policy struct {
	CanaryGroup  string        `json:"canary_group"`
	Quorum       int           `json:"quorum"`
	ACKTimeout   time.Duration `json:"ack_timeout"`
	RetryBackoff time.Duration `json:"retry_backoff"`
	MaxAttempts  int           `json:"max_attempts"`
}
type EdgeState struct {
	Edge              Edge      `json:"edge"`
	Attempts          int       `json:"attempts"`
	LastAttempt       time.Time `json:"last_attempt"`
	Accepted          bool      `json:"accepted"`
	Healthy           bool      `json:"healthy"`
	Rejected          bool      `json:"rejected"`
	Code              string    `json:"code"`
	AppliedAt         time.Time `json:"applied_at"`
	AppliedGeneration uint64    `json:"applied_generation"`
}
type State struct {
	Version          uint64                `json:"version"`
	Notice           configconsumer.Notice `json:"notice"`
	Policy           Policy                `json:"policy"`
	Phase            string                `json:"phase"`
	StartedAt        time.Time             `json:"started_at"`
	UpdatedAt        time.Time             `json:"updated_at"`
	Edges            []EdgeState           `json:"edges"`
	Sequence         uint64                `json:"sequence"`
	RollbackFrom     uint64                `json:"rollback_from"`
	EventCount       int                   `json:"event_count"`
	SecurityRejected bool                  `json:"security_rejected"`
}
type Event struct {
	Sequence   uint64    `json:"sequence"`
	At         time.Time `json:"at"`
	Type       string    `json:"type"`
	EdgeID     string    `json:"edge_id"`
	Code       string    `json:"code"`
	Generation uint64    `json:"generation"`
	Digest     string    `json:"digest"`
}

// Store must atomically compare Version, persist next and append every event.
// Commit receives expected=0 only for the first rollout for a deployment.
type Store interface {
	Load(context.Context, string) (State, error)
	Commit(context.Context, uint64, State, []Event) error
}

// Deliverer routes notices to one registered authenticated edge, never a global
// subject. The receiver still fetches and verifies the complete signed artifact.
type Deliverer interface {
	Send(context.Context, Edge, configconsumer.Notice) error
}
type Controller struct {
	store    Store
	deliver  Deliverer
	verifier AdmissionVerifier
	clock    func() time.Time
}

func New(store Store, deliver Deliverer, verifier AdmissionVerifier, clock func() time.Time) (*Controller, error) {
	if store == nil || deliver == nil || verifier == nil {
		return nil, ErrDenied
	}
	if clock == nil {
		clock = time.Now
	}
	return &Controller{store, deliver, verifier, clock}, nil
}
func validNotice(n configconsumer.Notice) bool {
	return idPattern.MatchString(n.DeploymentID) && n.Generation > 0 && n.Generation <= 9007199254740991 && validDigest(n.Digest) && len(n.Location) > 0 && len(n.Location) <= 2048
}
func validDigest(value string) bool {
	if len(value) != 64 {
		return false
	}
	d, err := hex.DecodeString(value)
	return err == nil && len(d) == 32 && hex.EncodeToString(d) == value
}
func (c *Controller) commit(ctx context.Context, old State, next State, typ, edge, code string) error {
	if old.Notice.Generation == next.Notice.Generation {
		next.EventCount = old.EventCount + 1
	} else {
		next.EventCount = 1
	}
	if next.EventCount > MaxEvents {
		return ErrDenied
	}
	now := c.clock().UTC()
	next.Version = old.Version + 1
	next.Sequence = old.Sequence + 1
	next.UpdatedAt = now
	event := Event{next.Sequence, now, typ, edge, code, next.Notice.Generation, next.Notice.Digest}
	return c.store.Commit(ctx, old.Version, next, []Event{event})
}
func (c *Controller) Begin(ctx context.Context, n configconsumer.Notice, edges []Edge, p Policy, rollbackFrom uint64) error {
	if !validNotice(n) || len(edges) < 1 || len(edges) > MaxEdges || !idPattern.MatchString(p.CanaryGroup) || p.Quorum < 1 || p.Quorum > len(edges) || p.ACKTimeout < time.Second || p.ACKTimeout > 10*time.Minute || p.RetryBackoff < time.Second || p.RetryBackoff > time.Minute || p.MaxAttempts < 1 || p.MaxAttempts > 5 || rollbackFrom >= n.Generation {
		return ErrDenied
	}
	seen := map[string]bool{}
	canaries := 0
	states := make([]EdgeState, 0, len(edges))
	for _, edge := range edges {
		if !idPattern.MatchString(edge.ID) || !idPattern.MatchString(edge.Group) || seen[edge.ID] {
			return ErrDenied
		}
		seen[edge.ID] = true
		if edge.Group == p.CanaryGroup {
			canaries++
		}
		states = append(states, EdgeState{Edge: edge})
	}
	if canaries == 0 {
		return ErrDenied
	}
	sort.Slice(states, func(i, j int) bool { return states[i].Edge.ID < states[j].Edge.ID })
	if c.verifier.Verify(ctx, n, rollbackFrom) != nil {
		return ErrDenied
	}
	old, err := c.load(ctx, n.DeploymentID)
	if err != nil && !errors.Is(err, ErrMissing) {
		return err
	}
	if err == nil {
		if old.Notice == n {
			return nil
		}
		if n.Generation <= old.Notice.Generation {
			return ErrConflict
		}
		for i := range states {
			for _, prior := range old.Edges {
				if states[i].Edge.ID == prior.Edge.ID {
					states[i].AppliedGeneration = prior.AppliedGeneration
				}
			}
		}
	}
	next := State{Notice: n, Policy: p, Phase: "canary", StartedAt: c.clock().UTC(), Edges: states, RollbackFrom: rollbackFrom}
	// A new generation has a fresh bounded event budget; sequence remains durable
	// and monotonic in the store while audit history is retained separately.
	next.Sequence = old.Sequence
	return c.commit(ctx, old, next, "begin", "", func() string {
		if rollbackFrom > 0 {
			return "signed_rollback"
		}
		return "approved"
	}())
}

func (c *Controller) State(ctx context.Context, deployment string) (State, error) {
	return c.load(ctx, deployment)
}

// Tick makes at most128 bounded sends. It records dispatch before network IO;
// a crash can repeat a notice, never skip its durable admission decision.
func (c *Controller) Tick(ctx context.Context, deployment string) error {
	for count := 0; count < MaxEdges; count++ {
		state, err := c.load(ctx, deployment)
		if err != nil {
			return err
		}
		if state.Phase == "paused" || state.Phase == "complete" {
			return nil
		}
		index := -1
		now := c.clock().UTC()
		for i, e := range state.Edges {
			if state.Phase == "canary" && e.Edge.Group != state.Policy.CanaryGroup || e.Accepted || e.Rejected {
				continue
			}
			if e.Attempts > 0 && now.Before(e.LastAttempt.Add(state.Policy.ACKTimeout+state.Policy.RetryBackoff)) {
				continue
			}
			if e.Attempts >= state.Policy.MaxAttempts {
				next := cloneState(state)
				next.Phase = "paused"
				return c.commit(ctx, state, next, "pause", e.Edge.ID, "ack_timeout")
			}
			index = i
			break
		}
		if index < 0 {
			if state.Phase == "expanding" && quorumComplete(state) {
				next := cloneState(state)
				next.Phase = "complete"
				return c.commit(ctx, state, next, "complete", "", "quorum_healthy")
			}
			return nil
		}
		next := cloneState(state)
		next.Edges[index].Attempts++
		next.Edges[index].LastAttempt = now
		if err = c.commit(ctx, state, next, "dispatch", next.Edges[index].Edge.ID, "attempt"); err != nil {
			return err
		}
		sendCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err = c.deliver.Send(sendCtx, next.Edges[index].Edge, next.Notice)
		cancel()
		if err != nil {
			// Persist a safe failure without leaking endpoint/server diagnostics.
			latest, loadErr := c.load(ctx, deployment)
			if loadErr != nil {
				return loadErr
			}
			if latest.Notice != next.Notice {
				return ErrConflict
			}
			if err = c.commit(ctx, latest, cloneState(latest), "delivery_error", next.Edges[index].Edge.ID, "network_unavailable"); err != nil {
				return err
			}
		}
	}
	return nil
}

func cloneState(s State) State { s.Edges = append([]EdgeState(nil), s.Edges...); return s }

func (c *Controller) load(ctx context.Context, deployment string) (State, error) {
	state, err := c.store.Load(ctx, deployment)
	if err != nil {
		return State{}, err
	}
	if !validState(state) || state.Notice.DeploymentID != deployment {
		return State{}, ErrDenied
	}
	return state, nil
}
func validState(state State) bool {
	if state.Version == 0 || state.Sequence == 0 || state.EventCount < 1 || state.EventCount > MaxEvents || !validNotice(state.Notice) || len(state.Edges) < 1 || len(state.Edges) > MaxEdges {
		return false
	}
	p := state.Policy
	if !idPattern.MatchString(p.CanaryGroup) || p.Quorum < 1 || p.Quorum > len(state.Edges) || p.MaxAttempts < 1 || p.MaxAttempts > 5 || p.ACKTimeout < time.Second || p.ACKTimeout > 10*time.Minute || p.RetryBackoff < time.Second || p.RetryBackoff > time.Minute || state.StartedAt.IsZero() || state.UpdatedAt.Before(state.StartedAt) {
		return false
	}
	switch state.Phase {
	case "canary", "expanding", "paused", "complete":
	default:
		return false
	}
	seen := map[string]bool{}
	canaries := 0
	for _, e := range state.Edges {
		if !idPattern.MatchString(e.Edge.ID) || !idPattern.MatchString(e.Edge.Group) || seen[e.Edge.ID] || e.Attempts < 0 || e.Attempts > p.MaxAttempts || e.AppliedGeneration > state.Notice.Generation || e.Code != "" && !safeCode(e.Code) {
			return false
		}
		seen[e.Edge.ID] = true
		if e.Edge.Group == p.CanaryGroup {
			canaries++
		} else if state.Phase == "canary" && e.Attempts > 0 {
			return false
		}
		if (state.Phase == "expanding" || state.Phase == "complete") && e.Edge.Group == p.CanaryGroup && (!e.Accepted || !e.Healthy || e.Rejected) {
			return false
		}
	}
	if canaries == 0 || state.SecurityRejected && state.Phase != "paused" || state.Phase == "complete" && !quorumComplete(state) {
		return false
	}
	return true
}

// Record is for an authenticated transport adapter. identity is derived from a
// verified certificate, never an edge identifier in a message or request header.
func (c *Controller) Record(ctx context.Context, identity string, ack configconsumer.Ack, healthy bool) error {
	state, err := c.load(ctx, ack.DeploymentID)
	if err != nil {
		return err
	}
	if ack.DeploymentID != state.Notice.DeploymentID || ack.Generation != state.Notice.Generation || ack.Digest != state.Notice.Digest {
		return ErrConflict
	}
	index := -1
	for i, e := range state.Edges {
		if e.Edge.ID == identity {
			index = i
			break
		}
	}
	if index < 0 {
		return ErrDenied
	}
	edge := state.Edges[index]
	if edge.Attempts == 0 || state.Phase == "canary" && edge.Edge.Group != state.Policy.CanaryGroup {
		return ErrDenied
	}
	if !safeCode(ack.Code) {
		return ErrDenied
	}
	if edge.Accepted && ack.Accepted && edge.Healthy == healthy && edge.Code == ack.Code {
		return nil
	}
	if edge.Rejected && !ack.Accepted && edge.Code == ack.Code {
		return nil
	}
	next := cloneState(state)
	next.Edges[index].Accepted = ack.Accepted
	next.Edges[index].Healthy = healthy && ack.Accepted
	next.Edges[index].Rejected = !ack.Accepted || !healthy
	next.Edges[index].Code = ack.Code
	next.Edges[index].AppliedAt = c.clock().UTC()
	if ack.Accepted {
		next.Edges[index].AppliedGeneration = ack.Generation
	}
	typ := "ack"
	if !ack.Accepted || !healthy {
		next.Phase = "paused"
		next.SecurityRejected = true
		typ = "nack"
	} else if state.Phase != "paused" {
		allCanary := true
		accepted := 0
		for _, e := range next.Edges {
			if e.Accepted && e.Healthy {
				accepted++
			}
			if e.Edge.Group == state.Policy.CanaryGroup && (!e.Accepted || !e.Healthy || e.Rejected) {
				allCanary = false
			}
		}
		if allCanary {
			next.Phase = "expanding"
			if accepted >= state.Policy.Quorum && quorumComplete(next) {
				next.Phase = "complete"
			}
		}
	}
	return c.commit(ctx, state, next, typ, identity, ack.Code)
}
func quorumComplete(state State) bool {
	accepted := 0
	for _, edge := range state.Edges {
		if edge.Attempts == 0 {
			return false
		}
		if edge.Edge.Group == state.Policy.CanaryGroup && (!edge.Accepted || !edge.Healthy || edge.Rejected) {
			return false
		}
		if edge.Accepted && edge.Healthy {
			accepted++
		}
	}
	return accepted >= state.Policy.Quorum
}
func safeCode(code string) bool {
	switch code {
	case "applied", "already_applied", "invalid_snapshot", "stale_snapshot", "invalid_notice", "artifact_digest", "wrong_generation", "retention_busy", "persistence_unavailable", "cancelled", "fetch_unavailable", "artifact_size", "checkpoint_invalid", "health_failed":
		return true
	}
	return false
}

// Retry resumes only a timeout/network pause. A signature/policy/health rejection
// is sticky and requires a new approved signed generation, including rollback.
func (c *Controller) Retry(ctx context.Context, deployment string) error {
	state, err := c.load(ctx, deployment)
	if err != nil {
		return err
	}
	if state.Phase != "paused" {
		return ErrDenied
	}
	if state.SecurityRejected {
		return ErrDenied
	}
	next := cloneState(state)
	canaryComplete := true
	for i, e := range next.Edges {
		if e.Rejected {
			return ErrDenied
		}
		if !e.Accepted {
			next.Edges[i].Attempts = 0
			next.Edges[i].LastAttempt = time.Time{}
		}
		if e.Edge.Group == state.Policy.CanaryGroup && !e.Accepted {
			canaryComplete = false
		}
	}
	next.Phase = "canary"
	if canaryComplete {
		next.Phase = "expanding"
	}
	return c.commit(ctx, state, next, "resume", "", "operator_retry")
}

type Telemetry struct {
	Generation                               uint64
	Phase                                    string
	ACKs, NACKs, Pending                     int
	MaxVersionSkew                           uint64
	MaxPropagationLag                        time.Duration
	StaleArtifactAlert, InvalidArtifactAlert bool
}

func (c *Controller) Telemetry(ctx context.Context, deployment string) (Telemetry, error) {
	state, err := c.load(ctx, deployment)
	if err != nil {
		return Telemetry{}, err
	}
	m := Telemetry{Generation: state.Notice.Generation, Phase: state.Phase}
	for _, e := range state.Edges {
		if e.Accepted && e.Healthy {
			m.ACKs++
			lag := e.AppliedAt.Sub(state.StartedAt)
			if lag > m.MaxPropagationLag {
				m.MaxPropagationLag = lag
			}
		} else if e.Rejected {
			m.NACKs++
			m.InvalidArtifactAlert = m.InvalidArtifactAlert || e.Code == "invalid_snapshot" || e.Code == "artifact_digest"
			m.StaleArtifactAlert = m.StaleArtifactAlert || e.Code == "stale_snapshot"
		} else {
			m.Pending++
			m.StaleArtifactAlert = m.StaleArtifactAlert || c.clock().Sub(state.StartedAt) > state.Policy.ACKTimeout
		}
		if e.AppliedGeneration <= state.Notice.Generation {
			skew := state.Notice.Generation - e.AppliedGeneration
			if skew > m.MaxVersionSkew {
				m.MaxVersionSkew = skew
			}
		}
	}
	return m, nil
}
