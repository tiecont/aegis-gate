package configpublish

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/internal/configsnapshot"
)

type queueStub struct {
	job                  Job
	retry, stage, finish int
}

func (q *queueStub) Claim(context.Context, string, time.Duration) (Job, error) { return q.job, nil }
func (q *queueStub) Stage(context.Context, Job, []byte, string) error          { q.stage++; return nil }
func (q *queueStub) Finish(context.Context, Job, Notification) error           { q.finish++; return nil }
func (q *queueStub) Retry(context.Context, Job, time.Duration) error           { q.retry++; return nil }

type storeStub struct{ puts int }

func (s *storeStub) Put(_ context.Context, raw []byte) (string, error) {
	s.puts++
	sum := sha256.Sum256(raw)
	return "https://artifacts.example.com/artifacts/" + hex.EncodeToString(sum[:]), nil
}

type notifierStub struct{ calls int }

func (n *notifierStub) Publish(context.Context, Notification) error { n.calls++; return nil }

func TestNegativeWorkerBindsPersistedArtifactToExactApproval(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Second)
	signer, err := configsnapshot.NewLocalSigner("test-key")
	if err != nil {
		t.Fatal(err)
	}
	trust, err := configsnapshot.NewTrustStore([]configsnapshot.TrustedKey{{ID: signer.KeyID(), PublicKey: signer.PublicKey(), NotBefore: now.Add(-time.Minute), NotAfter: now.Add(24 * time.Hour)}})
	if err != nil {
		t.Fatal(err)
	}
	approved := configsnapshot.Envelope{DeploymentID: "deployment-a", Generation: 1, CreatedAt: now, ValidFrom: now, ExpiresAt: now.Add(time.Hour), Payload: configsnapshot.Payload{Tenants: []configsnapshot.Tenant{}}}
	for _, tc := range []struct {
		name   string
		modify func(*configsnapshot.Envelope)
	}{
		{"higher-generation", func(e *configsnapshot.Envelope) { e.Generation = 2 }},
		{"expiry-rewrite", func(e *configsnapshot.Envelope) { e.ExpiresAt = now.Add(2 * time.Hour) }},
		{"different-approved-payload", func(e *configsnapshot.Envelope) {
			e.Payload.Tenants = []configsnapshot.Tenant{{ID: "foreign", Domains: []configsnapshot.Domain{}, OriginPools: []configsnapshot.OriginPool{}, Policies: []configsnapshot.Policy{}, Routes: []configsnapshot.Route{}}}
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			candidate := approved
			tc.modify(&candidate)
			raw, err := configsnapshot.Sign(ctx, candidate, signer)
			if err != nil {
				t.Fatal(err)
			}
			sum := sha256.Sum256(raw)
			q := &queueStub{job: Job{Envelope: approved, Artifact: raw, Digest: hex.EncodeToString(sum[:])}}
			store := &storeStub{}
			notifier := &notifierStub{}
			worker := Worker{Queue: q, Store: store, Notifier: notifier, Signer: signer, Trust: trust, Identity: "worker", Lease: 10 * time.Second}
			if err = worker.RunOnce(ctx); err == nil || store.puts != 0 || notifier.calls != 0 || q.finish != 0 || q.retry != 1 {
				t.Fatal("unapproved signed artifact published", err)
			}
		})
	}
}
