package configconsumer

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"aegisgate.dev/aegisgate/internal/configsnapshot"
)

type recoveryKeys struct {
	key  keySource
	down bool
}

func (k *recoveryKeys) CacheKey(context.Context) ([]byte, error) {
	if k.down {
		return nil, errors.New("local injected key outage")
	}
	return k.key, nil
}

func recoveryNotice(raw []byte, notice Notice) Notice {
	sum := sha256.Sum256(raw)
	notice.Digest = hex.EncodeToString(sum[:])
	return notice
}

func TestRecoveryExternalProvisioningRejectsEncryptedFullStateRollback(t *testing.T) {
	f := setup(t)
	dir := t.TempDir()
	if err := os.Chmod(dir, 0700); err != nil {
		t.Fatal(err)
	}
	keys := &recoveryKeys{key: make(keySource, 32)}
	if _, err := rand.Read(keys.key); err != nil {
		t.Fatal(err)
	}
	disk, err := NewDiskLKG(dir, "edge-a/deployment-test", keys, configsnapshot.MaxArtifactBytes)
	if err != nil {
		t.Fatal(err)
	}
	f.c.options.Persistence = disk
	apply(t, f, 7)
	path := filepath.Join(dir, "checkpoint.aead")
	older, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	apply(t, f, 9)
	newer, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	// This floor represents independently authenticated provisioning. It is not
	// learned from a notice, the rolled-back disk, or a claimed hardware counter.
	provisioned := f.c.options
	provisioned.MinimumGeneration = 9
	restart := func(options Options) *Consumer {
		t.Helper()
		c, err := New(options)
		if err != nil {
			t.Fatal(err)
		}
		return c
	}
	equal := restart(provisioned)
	if err = equal.Restore(context.Background()); err != nil || equal.Metrics().AppliedGeneration != 9 {
		t.Fatal("equal-floor restore must work", err)
	}
	if err = os.WriteFile(path, older, 0600); err != nil {
		t.Fatal(err)
	}
	// Positive control documents the threat boundary: valid AEAD/signatures alone
	// cannot detect rollback of the entire local checkpoint while still current.
	withoutAnchor := restart(f.c.options)
	if err = withoutAnchor.Restore(context.Background()); err != nil || withoutAnchor.Metrics().AppliedGeneration != 7 {
		t.Fatal("full-local-state rollback control changed", err)
	}
	anchored := restart(provisioned)
	if anchored.Restore(context.Background()) == nil || anchored.Metrics().Ready {
		t.Fatal("external floor did not reject old encrypted checkpoint")
	}
	raw, notice := f.artifact(t, 10)
	if ack := anchored.Apply(context.Background(), notice, raw); ack.Accepted || ack.Code != "checkpoint_invalid" {
		t.Fatal("rollback diagnosis bypassed without operator recovery", ack)
	}
	if err = os.Remove(path); err != nil {
		t.Fatal(err)
	}
	lostDisk := restart(provisioned)
	for _, gen := range []uint64{7, 9} {
		candidate, n := f.artifact(t, gen)
		if lostDisk.Apply(context.Background(), n, candidate).Accepted {
			t.Fatal("lost disk lowered external floor", gen)
		}
	}
	if !lostDisk.Apply(context.Background(), notice, raw).Accepted {
		t.Fatal("newer authenticated recovery refused")
	}
	keys.down = true
	keyOutage := restart(provisioned)
	if keyOutage.Restore(context.Background()) == nil || keyOutage.Metrics().Ready {
		t.Fatal("cache key outage bypassed")
	}
	keys.down = false
	if keyOutage.Restore(context.Background()) == nil {
		t.Fatal("failed bootstrap was silently retried")
	}
	recovered := restart(provisioned)
	if err = recovered.Restore(context.Background()); err != nil || recovered.Metrics().AppliedGeneration != 10 {
		t.Fatal("cache key recovery lost durable state", err)
	}
	if recovered.Apply(context.Background(), notice, raw).Accepted {
		t.Fatal("restart accepted replay")
	}
	current, err := os.ReadFile(path)
	if err != nil || bytes.Equal(current, newer) {
		t.Fatal("recovery failed to replace old durable checkpoint", err)
	}
	provisioned.MinimumGeneration = configsnapshot.MaxGeneration + 1
	if _, err = New(provisioned); err == nil {
		t.Fatal("impossible provisioning floor accepted")
	}
}

func TestRecoveryCapturedGenerationDrain(t *testing.T) {
	for _, deadline := range []bool{false, true} {
		t.Run(map[bool]string{false: "graceful", true: "deadline"}[deadline], func(t *testing.T) {
			f := setup(t)
			apply(t, f, 1)
			old, err := f.c.Capture()
			if err != nil {
				t.Fatal(err)
			}
			defer old.Close()
			apply(t, f, 2)
			if err = f.c.Drain(context.Background()); err == nil || !f.c.Metrics().Ready {
				t.Fatal("unbounded drain accepted or changed readiness")
			}
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			done := make(chan error, 1)
			go func() { done <- f.c.Drain(ctx) }()
			// Synchronize on the admission flag, not an assumed scheduling delay.
			for f.c.Metrics().Ready {
				select {
				case <-ctx.Done():
					t.Fatal("drain did not stop admission")
				default:
					time.Sleep(time.Millisecond)
				}
			}
			if _, err = f.c.Capture(); err == nil {
				t.Fatal("drain admitted a new operation")
			}
			route, ok := old.Resolve("api.example.com", "/v1", "GET")
			if !ok || route.Generation != 1 || route.Policy.Generation != 1 || route.Pool.Generation != 1 {
				t.Fatal("captured generation mixed during grace")
			}
			raw, n := f.artifact(t, 3)
			if ack := f.c.Apply(context.Background(), n, raw); ack.Accepted || ack.Code != "cancelled" {
				t.Fatal("drain allowed activation", ack)
			}
			if deadline {
				if err = <-done; !errors.Is(err, context.DeadlineExceeded) {
					t.Fatal("drain ignored deadline", err)
				}
			} else {
				old.Close()
				if err = <-done; err != nil {
					t.Fatal("graceful close failed", err)
				}
			}
			if _, ok = old.Resolve("api.example.com", "/v1", "GET"); ok {
				t.Fatal("drained capture still resolves")
			}
			if _, err = old.Snapshot(); err == nil {
				t.Fatal("drained capture exports a snapshot")
			}
			old.Close()
			old.Close()
			if f.c.readerCount != 0 || len(f.c.readers) != 0 {
				t.Fatal("drain leaked reader retention")
			}
			restart, err := New(f.c.options)
			if err != nil || restart.Restore(context.Background()) != nil || restart.Metrics().AppliedGeneration != 2 {
				t.Fatal("drain damaged durable checkpoint", err)
			}
		})
	}
}

func TestRecoveryDisconnectedEmergencyFailClosed(t *testing.T) {
	for _, boundary := range []string{"staleness", "snapshot", "ownership", "trust", "retirement"} {
		t.Run(boundary, func(t *testing.T) {
			f := setup(t)
			f.c.options.MaxStaleness = 24 * time.Hour
			if boundary == "staleness" {
				f.c.options.MaxStaleness = time.Minute
			}
			if boundary == "trust" || boundary == "retirement" {
				root, err := configsnapshot.NewLocalSigner("recovery-root")
				if err != nil {
					t.Fatal(err)
				}
				key := configsnapshot.TrustedKey{ID: f.signer.KeyID(), PublicKey: f.signer.PublicKey(), NotBefore: f.now.Add(-time.Hour), NotAfter: f.now.Add(24 * time.Hour)}
				if boundary == "retirement" {
					key.RetiredAt = f.now.Add(time.Minute)
				}
				bundle, err := configsnapshot.SignTrustBundle(context.Background(), configsnapshot.TrustBundle{Environment: "local", Version: 1, IssuedAt: f.now, ExpiresAt: f.now.Add(time.Minute), Keys: []configsnapshot.TrustedKey{key}}, root)
				if err != nil {
					t.Fatal(err)
				}
				if boundary == "retirement" {
					bundle, err = configsnapshot.SignTrustBundle(context.Background(), configsnapshot.TrustBundle{Environment: "local", Version: 1, IssuedAt: f.now, ExpiresAt: f.now.Add(time.Hour), Keys: []configsnapshot.TrustedKey{key}}, root)
					if err != nil {
						t.Fatal(err)
					}
				}
				trust, err := configsnapshot.Bootstrap(root.PublicKey(), "local", bundle, f.now)
				if err != nil || f.c.UpdateTrust(trust) != nil {
					t.Fatal("authenticated bootstrap failed", err)
				}
			}
			raw, n := f.artifact(t, 1)
			if boundary == "ownership" {
				e, err := configsnapshot.Verify(raw, f.trust, n.DeploymentID, 0, f.now)
				if err != nil {
					t.Fatal(err)
				}
				e.Payload.Tenants[0].Domains[0].VerifiedUntil = f.now.Add(time.Minute)
				raw, err = configsnapshot.Sign(context.Background(), e, f.signer)
				if err != nil {
					t.Fatal(err)
				}
				n = recoveryNotice(raw, n)
			}
			if !f.c.Apply(context.Background(), n, raw).Accepted {
				t.Fatal("healthy control refused")
			}
			if ack := f.c.FetchApply(context.Background(), n, brokenFetcher{}); ack.Accepted || !f.c.Metrics().Ready {
				t.Fatal("disconnected control failed", ack)
			}
			advance := time.Minute
			if boundary == "staleness" {
				advance += time.Second
			}
			if boundary == "snapshot" {
				advance = 2 * time.Hour
			}
			f.now = f.now.Add(advance)
			if f.c.Metrics().Ready {
				t.Fatal("disconnection extended a security deadline")
			}
			if _, err := f.c.Capture(); err == nil {
				t.Fatal("disconnected expired state admitted work")
			}
			if _, ok := f.c.CurrentAck(n); ok {
				t.Fatal("expired state confirmed healthy")
			}
		})
	}
}
