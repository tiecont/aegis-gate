package configrollout

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"sync"
	"time"

	"aegisgate.dev/aegisgate/internal/configconsumer"
	"aegisgate.dev/aegisgate/internal/configsnapshot"
)

// AdmissionVerifier must verify a planner hint against authenticated immutable
// storage and durable approval before it can advance the rollout generation.
type AdmissionVerifier interface {
	Verify(context.Context, configconsumer.Notice, uint64) error
}
type ApprovalCheck func(context.Context, string, uint64, string, uint64) error

// SignedAdmission checks approval and authenticity without activating anything.
// Approved snapshots remain subject to canary admission and consumer validation.
type SignedAdmission struct {
	mu       sync.RWMutex
	fetcher  configconsumer.Fetcher
	trust    *configsnapshot.TrustStore
	allowed  map[string]bool
	approval ApprovalCheck
	clock    func() time.Time
}

func NewSignedAdmission(fetcher configconsumer.Fetcher, trust *configsnapshot.TrustStore, deployments []string, approval ApprovalCheck, clock func() time.Time) (*SignedAdmission, error) {
	if fetcher == nil || trust == nil || approval == nil || len(deployments) < 1 || len(deployments) > 128 {
		return nil, ErrDenied
	}
	if clock == nil {
		clock = time.Now
	}
	allowed := map[string]bool{}
	for _, id := range deployments {
		if !idPattern.MatchString(id) || allowed[id] {
			return nil, ErrDenied
		}
		allowed[id] = true
	}
	return &SignedAdmission{fetcher: fetcher, trust: trust, allowed: allowed, approval: approval, clock: clock}, nil
}
func (v *SignedAdmission) UpdateTrust(trust *configsnapshot.TrustStore) error {
	if trust == nil {
		return ErrDenied
	}
	v.mu.Lock()
	defer v.mu.Unlock()
	v.trust = trust
	return nil
}
func (v *SignedAdmission) Verify(ctx context.Context, n configconsumer.Notice, rollbackOf uint64) error {
	if !validNotice(n) || !v.allowed[n.DeploymentID] || rollbackOf >= n.Generation {
		return ErrDenied
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if v.approval(ctx, n.DeploymentID, n.Generation, n.Digest, rollbackOf) != nil {
		return ErrDenied
	}
	body, err := v.fetcher.Fetch(ctx, n.Location)
	if err != nil {
		return ErrDenied
	}
	defer body.Close()
	raw, err := io.ReadAll(io.LimitReader(body, configsnapshot.MaxArtifactBytes+1))
	if err != nil || len(raw) > configsnapshot.MaxArtifactBytes {
		return ErrDenied
	}
	digest := sha256.Sum256(raw)
	if hex.EncodeToString(digest[:]) != n.Digest {
		return ErrDenied
	}
	v.mu.RLock()
	trust := v.trust
	v.mu.RUnlock()
	envelope, err := configsnapshot.Verify(raw, trust, n.DeploymentID, 0, v.clock().UTC())
	if err != nil || envelope.Generation != n.Generation {
		return ErrDenied
	}
	return nil
}
