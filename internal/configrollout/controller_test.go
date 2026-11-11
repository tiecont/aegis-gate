package configrollout

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/internal/configconsumer"
)

type testAdmission struct{}

func (testAdmission) Verify(context.Context, configconsumer.Notice, uint64) error { return nil }

type memoryStore struct {
	mu     sync.Mutex
	state  State
	events []Event
	fail   bool
}

func (s *memoryStore) Load(context.Context, string) (State, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.fail {
		return State{}, errors.New("database outage")
	}
	if s.state.Version == 0 {
		return State{}, ErrMissing
	}
	return cloneState(s.state), nil
}
func (s *memoryStore) Commit(_ context.Context, expected uint64, next State, events []Event) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.fail {
		return errors.New("database outage")
	}
	if s.state.Version != expected {
		return ErrConflict
	}
	s.state = cloneState(next)
	s.events = append(s.events, events...)
	return nil
}

type delivery struct {
	mu   sync.Mutex
	sent []string
	fail bool
}

func (d *delivery) Send(_ context.Context, edge Edge, _ configconsumer.Notice) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.sent = append(d.sent, edge.ID)
	if d.fail {
		return errors.New("network outage")
	}
	return nil
}
func notice(gen uint64) configconsumer.Notice {
	return configconsumer.Notice{DeploymentID: "project-a", Generation: gen, Digest: strings.Repeat("a", 64), Location: "https://artifact.example/artifacts/" + strings.Repeat("a", 64)}
}
func edges() []Edge {
	return []Edge{{"canary-a", "canary"}, {"canary-b", "canary"}, {"regular-a", "general"}, {"regular-b", "general"}}
}
func policy() Policy {
	return Policy{CanaryGroup: "canary", Quorum: 3, ACKTimeout: time.Second, RetryBackoff: time.Second, MaxAttempts: 2}
}
func testController(t *testing.T) (*Controller, *memoryStore, *delivery, *time.Time) {
	t.Helper()
	now := time.Date(2026, 11, 11, 11, 0, 0, 0, time.UTC)
	store := &memoryStore{}
	deliver := &delivery{}
	c, err := New(store, deliver, testAdmission{}, func() time.Time { return now })
	if err != nil {
		t.Fatal(err)
	}
	return c, store, deliver, &now
}
func report(n configconsumer.Notice, accept bool, code string) configconsumer.Ack {
	return configconsumer.Ack{DeploymentID: n.DeploymentID, Generation: n.Generation, Digest: n.Digest, Accepted: accept, Code: code}
}

func TestCanaryQuorumExpansionAndStickyRejection(t *testing.T) {
	c, store, deliver, _ := testController(t)
	ctx := context.Background()
	n := notice(1)
	if err := c.Begin(ctx, n, edges(), policy(), 0); err != nil {
		t.Fatal(err)
	}
	if err := c.Tick(ctx, n.DeploymentID); err != nil {
		t.Fatal(err)
	}
	if len(deliver.sent) != 2 {
		t.Fatalf("noncanary dispatched early: %v", deliver.sent)
	}
	if err := c.Record(ctx, "regular-a", report(n, true, "applied"), true); !errors.Is(err, ErrDenied) {
		t.Fatal("unsolicited ACK accepted", err)
	}
	if err := c.Record(ctx, "canary-a", report(n, true, "applied"), true); err != nil {
		t.Fatal(err)
	}
	if err := c.Tick(ctx, n.DeploymentID); err != nil {
		t.Fatal(err)
	}
	if len(deliver.sent) != 2 {
		t.Fatal("one canary was treated as all healthy")
	}
	if err := c.Record(ctx, "canary-b", report(n, false, "invalid_snapshot"), false); err != nil {
		t.Fatal(err)
	}
	if err := c.Tick(ctx, n.DeploymentID); err != nil {
		t.Fatal(err)
	}
	state, _ := c.State(ctx, n.DeploymentID)
	if state.Phase != "paused" || len(deliver.sent) != 2 {
		t.Fatal("rejecting canary expanded rollout")
	}
	if err := c.Retry(ctx, n.DeploymentID); !errors.Is(err, ErrDenied) {
		t.Fatal("security rejection retried without new generation")
	}
	if err := c.Record(ctx, "canary-b", report(n, true, "applied"), true); err != nil {
		t.Fatal(err)
	}
	state, _ = c.State(ctx, n.DeploymentID)
	if state.Phase != "paused" {
		t.Fatal("late ACK cleared sticky pause")
	}
	if c.Retry(ctx, n.DeploymentID) == nil {
		t.Fatal("late ACK cleared sticky security rejection")
	}
	metrics, err := c.Telemetry(ctx, n.DeploymentID)
	if err != nil || metrics.Phase != "paused" {
		t.Fatal("pause telemetry absent")
	}
	if len(store.events) < 5 {
		t.Fatal("outcomes not audited")
	}
}

func TestHealthyCanariesThenAllEdgesAdmittedBeforeQuorum(t *testing.T) {
	c, _, deliver, now := testController(t)
	ctx := context.Background()
	n := notice(1)
	if err := c.Begin(ctx, n, edges(), policy(), 0); err != nil {
		t.Fatal(err)
	}
	c.Tick(ctx, n.DeploymentID)
	for _, edge := range []string{"canary-a", "canary-b"} {
		if err := c.Record(ctx, edge, report(n, true, "applied"), true); err != nil {
			t.Fatal(err)
		}
	}
	state, _ := c.State(ctx, n.DeploymentID)
	if state.Phase != "expanding" {
		t.Fatal(state.Phase)
	}
	if err := c.Tick(ctx, n.DeploymentID); err != nil {
		t.Fatal(err)
	}
	if len(deliver.sent) != 4 {
		t.Fatal("expansion did not admit all edges")
	}
	*now = now.Add(2 * time.Second)
	if err := c.Record(ctx, "regular-a", report(n, true, "applied"), true); err != nil {
		t.Fatal(err)
	}
	state, _ = c.State(ctx, n.DeploymentID)
	if state.Phase != "complete" {
		t.Fatal("healthy quorum not complete", state.Phase)
	}
	metrics, _ := c.Telemetry(ctx, n.DeploymentID)
	if metrics.ACKs != 3 || metrics.Pending != 1 || metrics.MaxPropagationLag != 2*time.Second {
		t.Fatalf("bad telemetry %+v", metrics)
	}
	// A late rejection remains actionable even after quorum was met.
	if err := c.Record(ctx, "regular-b", report(n, false, "artifact_digest"), false); err != nil {
		t.Fatal(err)
	}
	metrics, _ = c.Telemetry(ctx, n.DeploymentID)
	if metrics.Phase != "paused" || !metrics.InvalidArtifactAlert {
		t.Fatal("late security rejection ignored")
	}
}

func TestOutageRetryControllerRestartAndBoundedAttempts(t *testing.T) {
	c, store, deliver, now := testController(t)
	ctx := context.Background()
	n := notice(1)
	c.Begin(ctx, n, edges(), policy(), 0)
	deliver.fail = true
	if err := c.Tick(ctx, n.DeploymentID); err != nil {
		t.Fatal(err)
	}
	if len(deliver.sent) != 2 {
		t.Fatal("initial attempts absent")
	}
	if err := c.Tick(ctx, n.DeploymentID); err != nil {
		t.Fatal(err)
	}
	if len(deliver.sent) != 2 {
		t.Fatal("backoff absent")
	}
	*now = now.Add(2 * time.Second)
	c.Tick(ctx, n.DeploymentID)
	*now = now.Add(2 * time.Second)
	c.Tick(ctx, n.DeploymentID)
	state, _ := c.State(ctx, n.DeploymentID)
	if state.Phase != "paused" || len(deliver.sent) != 4 {
		t.Fatal("attempt bounds not enforced")
	}
	// Recreate controller: durable dispatch/pause state is authoritative.
	restarted, _ := New(store, deliver, testAdmission{}, c.clock)
	if err := restarted.Retry(ctx, n.DeploymentID); err != nil {
		t.Fatal(err)
	}
	deliver.fail = false
	if err := restarted.Tick(ctx, n.DeploymentID); err != nil {
		t.Fatal(err)
	}
	for _, edge := range []string{"canary-a", "canary-b"} {
		if err := restarted.Record(ctx, edge, report(n, true, "already_applied"), true); err != nil {
			t.Fatal(err)
		}
	}
	restarted.Tick(ctx, n.DeploymentID)
	if len(deliver.sent) != 8 {
		t.Fatalf("recovery failed %v", deliver.sent)
	}
	store.fail = true
	if err := restarted.Tick(ctx, n.DeploymentID); err == nil {
		t.Fatal("database outage ignored")
	}
	store.fail = false
	state, _ = restarted.State(ctx, n.DeploymentID)
	if state.Notice != n {
		t.Fatal("outage changed signed generation")
	}
}

func TestNegativeForgedACKRollbackAndIdempotency(t *testing.T) {
	c, store, _, _ := testController(t)
	ctx := context.Background()
	n := notice(5)
	c.Begin(ctx, n, edges(), policy(), 0)
	c.Tick(ctx, n.DeploymentID)
	for _, kind := range []string{"identity", "generation", "digest", "deployment", "code"} {
		t.Run(kind, func(t *testing.T) {
			a := report(n, true, "applied")
			id := "canary-a"
			switch kind {
			case "identity":
				id = "attacker"
			case "generation":
				a.Generation = 4
			case "digest":
				a.Digest = strings.Repeat("b", 64)
			case "deployment":
				a.DeploymentID = "other-project"
			case "code":
				a.Code = "secret=value"
			}
			if err := c.Record(ctx, id, a, true); err == nil {
				t.Fatal("forged report accepted")
			}
		})
	}
	if err := c.Record(ctx, "canary-a", report(n, true, "applied"), true); err != nil {
		t.Fatal(err)
	}
	sequence := store.state.Sequence
	if err := c.Record(ctx, "canary-a", report(n, true, "applied"), true); err != nil || store.state.Sequence != sequence {
		t.Fatal("duplicate ACK not idempotent")
	}
	if err := c.Begin(ctx, notice(4), edges(), policy(), 0); !errors.Is(err, ErrConflict) {
		t.Fatal("generation rollback admitted")
	}
	if err := c.Begin(ctx, notice(6), edges(), policy(), 5); err != nil {
		t.Fatal(err)
	}
	state, _ := c.State(ctx, n.DeploymentID)
	if state.Notice.Generation != 6 || state.RollbackFrom != 5 || store.events[len(store.events)-1].Code != "signed_rollback" {
		t.Fatal("new-generation rollback not audited")
	}
	if err := c.Record(ctx, "canary-b", report(n, true, "applied"), true); !errors.Is(err, ErrConflict) {
		t.Fatal("old generation ACK accepted")
	}
	encoded, _ := json.Marshal(store.events)
	if strings.Contains(string(encoded), "secret=value") {
		t.Fatal("unsafe diagnostics leaked")
	}
}

func TestNegativeHealthAndResourceBounds(t *testing.T) {
	c, store, _, _ := testController(t)
	ctx := context.Background()
	n := notice(1)
	c.Begin(ctx, n, edges(), policy(), 0)
	c.Tick(ctx, n.DeploymentID)
	if err := c.Record(ctx, "canary-a", report(n, true, "health_failed"), false); err != nil {
		t.Fatal(err)
	}
	state, _ := c.State(ctx, n.DeploymentID)
	if state.Phase != "paused" {
		t.Fatal("unhealthy canary expanded")
	}
	tooMany := make([]Edge, MaxEdges+1)
	if c.Begin(ctx, notice(2), tooMany, policy(), 0) == nil {
		t.Fatal("edge bounds absent")
	}
	store.state.EventCount = MaxEvents
	if c.Record(ctx, "canary-b", report(n, true, "applied"), true) == nil {
		t.Fatal("unbounded audit growth")
	}
	if err := c.Begin(ctx, notice(2), edges(), policy(), 0); err != nil {
		t.Fatal("new generation failed to reset event budget", err)
	}
}
