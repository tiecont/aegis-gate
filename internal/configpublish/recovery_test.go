package configpublish

import (
	"bytes"
	"context"
	"errors"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/internal/configsnapshot"
)

type outageSigner struct {
	configsnapshot.Signer
	down  bool
	calls int
}

func (s *outageSigner) Sign(ctx context.Context, raw []byte) ([]byte, error) {
	s.calls++
	if s.down {
		return nil, errors.New("local injected signer outage")
	}
	return s.Signer.Sign(ctx, raw)
}

type recoveryQueue struct {
	queueStub
	staged []byte
}

func (q *recoveryQueue) Stage(_ context.Context, job Job, raw []byte, digest string) error {
	q.stage++
	q.staged = bytes.Clone(raw)
	q.job = job
	q.job.Artifact = bytes.Clone(raw)
	q.job.Digest = digest
	return nil
}

type outageNotifier struct{ down bool }

func (n *outageNotifier) Publish(context.Context, Notification) error {
	if n.down {
		return ErrUnavailable
	}
	return nil
}

func TestRecoverySignerOutageStagedRestartAndRetirement(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Second)
	local, err := configsnapshot.NewLocalSigner("recovery-key")
	if err != nil {
		t.Fatal(err)
	}
	key := configsnapshot.TrustedKey{ID: local.KeyID(), PublicKey: local.PublicKey(), NotBefore: now.Add(-time.Minute), NotAfter: now.Add(12 * time.Hour)}
	trust, err := configsnapshot.NewTrustStore([]configsnapshot.TrustedKey{key})
	if err != nil {
		t.Fatal(err)
	}
	q := &recoveryQueue{queueStub: queueStub{job: Job{Envelope: configsnapshot.Envelope{DeploymentID: "recovery-deployment", Generation: 1, CreatedAt: now, ValidFrom: now, ExpiresAt: now.Add(time.Hour), Payload: configsnapshot.Payload{Tenants: []configsnapshot.Tenant{}}}, Attempts: 1}}}
	signer := &outageSigner{Signer: local, down: true}
	store := &storeStub{}
	bus := &outageNotifier{}
	w := Worker{Queue: q, Store: store, Notifier: bus, Signer: signer, Trust: trust, Identity: "recovery-worker", Lease: 10 * time.Second, Now: func() time.Time { return now }}
	if w.RunOnce(ctx) == nil || q.retry != 1 || q.stage != 0 || q.finish != 0 || store.puts != 0 {
		t.Fatal("signer outage published unsigned/fallback state")
	}
	signer.down = false
	bus.down = true
	if w.RunOnce(ctx) == nil || q.stage != 1 || q.finish != 0 || len(q.staged) == 0 {
		t.Fatal("failed delivery did not retain exact signed stage")
	}
	staged := bytes.Clone(q.staged)
	signer.down = true
	bus.down = false
	// Recreate the worker while preserving the queue's already-staged bytes.
	restarted := w
	calls := signer.calls
	if err = restarted.RunOnce(ctx); err != nil || q.finish != 1 || signer.calls != calls || !bytes.Equal(staged, q.job.Artifact) {
		t.Fatal("staged retry re-signed or lost immutable artifact", err)
	}
	key.RetiredAt = now
	retired, err := configsnapshot.NewTrustStore([]configsnapshot.TrustedKey{key})
	if err != nil {
		t.Fatal(err)
	}
	restarted.Trust = retired
	puts, finished := store.puts, q.finish
	if err = restarted.RunOnce(ctx); err == nil || configsnapshot.Code(err) != "signing_key" || store.puts != puts || q.finish != finished {
		t.Fatal("retired staged artifact republished", err)
	}
}
