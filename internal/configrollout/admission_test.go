package configrollout

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"strings"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/internal/configconsumer"
	"aegisgate.dev/aegisgate/internal/configsnapshot"
)

type byteFetcher struct {
	raw   []byte
	calls int
}

func (f *byteFetcher) Fetch(context.Context, string) (io.ReadCloser, error) {
	f.calls++
	return io.NopCloser(bytes.NewReader(f.raw)), nil
}
func admissionFixture(t *testing.T) (*SignedAdmission, *byteFetcher, configconsumer.Notice, *time.Time) {
	t.Helper()
	now := time.Date(2026, 11, 11, 12, 0, 0, 0, time.UTC)
	signer, err := configsnapshot.NewLocalSigner("rollout-signing")
	if err != nil {
		t.Fatal(err)
	}
	trust, err := configsnapshot.NewTrustStore([]configsnapshot.TrustedKey{{ID: signer.KeyID(), PublicKey: signer.PublicKey(), NotBefore: now.Add(-time.Hour), NotAfter: now.Add(24 * time.Hour)}})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := configsnapshot.Sign(context.Background(), configsnapshot.Envelope{DeploymentID: "project-a", Generation: 1, CreatedAt: now, ValidFrom: now, ExpiresAt: now.Add(time.Hour), Payload: configsnapshot.Payload{Tenants: []configsnapshot.Tenant{}}}, signer)
	if err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(raw)
	n := configconsumer.Notice{DeploymentID: "project-a", Generation: 1, Digest: hex.EncodeToString(digest[:]), Location: "https://artifact.example/artifacts/" + hex.EncodeToString(digest[:])}
	fetcher := &byteFetcher{raw: raw}
	check := func(_ context.Context, id string, generation uint64, digest string, rollback uint64) error {
		if id != n.DeploymentID || generation != n.Generation || digest != n.Digest || rollback != 0 {
			return ErrDenied
		}
		return nil
	}
	verifier, err := NewSignedAdmission(fetcher, trust, []string{"project-a"}, check, func() time.Time { return now })
	if err != nil {
		t.Fatal(err)
	}
	return verifier, fetcher, n, &now
}
func TestAuthenticatedAdmissionBeforeGenerationAdvance(t *testing.T) {
	v, fetcher, n, now := admissionFixture(t)
	store := &memoryStore{}
	deliver := &delivery{}
	c, err := New(store, deliver, v, func() time.Time { return *now })
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	for _, kind := range []string{"unapproved_generation", "wrong_digest", "wrong_deployment", "wrong_rollback", "oversized_location"} {
		t.Run(kind, func(t *testing.T) {
			forged := n
			rollback := uint64(0)
			switch kind {
			case "unapproved_generation":
				forged.Generation = 9007199254740991
			case "wrong_digest":
				forged.Digest = strings.Repeat("0", 64)
			case "wrong_deployment":
				forged.DeploymentID = "project-b"
			case "wrong_rollback":
				rollback = 1
			case "oversized_location":
				forged.Location = strings.Repeat("a", 4096)
			}
			if c.Begin(ctx, forged, edges(), policy(), rollback) == nil {
				t.Fatal("forged planner notice admitted")
			}
			if store.state.Version != 0 {
				t.Fatal("forged notice poisoned durable floor")
			}
		})
	}
	if fetcher.calls != 0 {
		t.Fatal("unapproved notice reached artifact fetch")
	}
	if err = c.Begin(ctx, n, edges(), policy(), 0); err != nil {
		t.Fatal("approved signed notice rejected", err)
	}
	if store.state.Notice.Generation != 1 || fetcher.calls != 1 {
		t.Fatal("valid generation not admitted")
	}
	// Compromised notification and blob channels do not bypass signature checks,
	// even if a test approval source is made permissive.
	v.approval = func(context.Context, string, uint64, string, uint64) error { return nil }
	changed := bytes.Clone(fetcher.raw)
	changed = bytes.Replace(changed, []byte(`"signature":"`), []byte(`"signature":"A`), 1)
	fetcher.raw = changed
	sum := sha256.Sum256(changed)
	forged := n
	forged.Generation = 2
	forged.Digest = hex.EncodeToString(sum[:])
	if c.Begin(ctx, forged, edges(), policy(), 0) == nil || store.state.Notice.Generation != 1 {
		t.Fatal("tampered artifact advanced floor")
	}
	fetcher.raw = bytes.Replace(changed, []byte(`"signature":"A`), []byte(`"signature":"`), 1)
	forged = n
	forged.Generation = 2
	if c.Begin(ctx, forged, edges(), policy(), 0) == nil {
		t.Fatal("notice generation substituted signed generation")
	}
	*now = now.Add(2 * time.Hour)
	if v.Verify(ctx, n, 0) == nil {
		t.Fatal("expired signed notice admitted")
	}
}

func TestNegativeCorruptRolloutCheckpointFailsClosed(t *testing.T) {
	c, store, deliver, _ := testController(t)
	ctx := context.Background()
	n := notice(1)
	c.Begin(ctx, n, edges(), policy(), 0)
	for _, kind := range []string{"phase", "policy", "canary_bypass", "duplicate_identity", "fake_complete"} {
		t.Run(kind, func(t *testing.T) {
			original := cloneState(store.state)
			switch kind {
			case "phase":
				store.state.Phase = "anything"
			case "policy":
				store.state.Policy.MaxAttempts = 100000
			case "canary_bypass":
				store.state.Phase = "expanding"
			case "duplicate_identity":
				store.state.Edges[1].Edge.ID = store.state.Edges[0].Edge.ID
			case "fake_complete":
				store.state.Phase = "complete"
			}
			if c.Tick(ctx, n.DeploymentID) == nil {
				t.Fatal("corrupt checkpoint allowed dispatch")
			}
			if len(deliver.sent) != 0 {
				t.Fatal("corrupt state sent notice")
			}
			store.state = original
		})
	}
}
