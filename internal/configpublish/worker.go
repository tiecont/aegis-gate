// Package configpublish implements engine-independent, bounded snapshot delivery.
package configpublish

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"reflect"
	"time"

	"aegisgate.dev/aegisgate/internal/configsnapshot"
)

var ErrEmpty = errors.New("publication queue empty")
var ErrLease = errors.New("publication lease unavailable")
var ErrUnavailable = errors.New("publication unavailable")

// Notification is an untrusted delivery hint. Consumers independently verify the
// exact artifact and enforce their configured deployment and trust policy.
type Notification struct {
	DeploymentID string `json:"deployment_id"`
	Generation   uint64 `json:"generation"`
	Digest       string `json:"digest"`
	Location     string `json:"location"`
}

type Job struct {
	Envelope configsnapshot.Envelope
	Token    string
	Attempts int
	Artifact []byte
	Digest   string
}

type Queue interface {
	Claim(context.Context, string, time.Duration) (Job, error)
	Stage(context.Context, Job, []byte, string) error
	Finish(context.Context, Job, Notification) error
	Retry(context.Context, Job, time.Duration) error
}
type ArtifactStore interface {
	Put(context.Context, []byte) (string, error)
}
type Notifier interface {
	Publish(context.Context, Notification) error
}

type Worker struct {
	Queue    Queue
	Store    ArtifactStore
	Notifier Notifier
	Signer   configsnapshot.Signer
	Trust    *configsnapshot.TrustStore
	Identity string
	Lease    time.Duration
	Now      func() time.Time
}

// RunOnce performs a single recoverable job; no background goroutines or
// unbounded retries. Callers should schedule subsequent attempts after backoff.
func (w *Worker) RunOnce(ctx context.Context) error {
	if w.Queue == nil || w.Store == nil || w.Notifier == nil || w.Signer == nil || w.Trust == nil || len(w.Identity) < 1 || len(w.Identity) > 128 || w.Lease < 5*time.Second || w.Lease > time.Minute {
		return ErrUnavailable
	}
	job, err := w.Queue.Claim(ctx, w.Identity, w.Lease)
	if err != nil {
		return err
	}
	now := time.Now
	if w.Now != nil {
		now = w.Now
	}
	fail := func(e error) error {
		delay := time.Duration(1<<min(job.Attempts, 6)) * time.Second
		_ = w.Queue.Retry(ctx, job, delay)
		return e
	}
	raw := job.Artifact
	if len(raw) == 0 {
		raw, err = configsnapshot.Sign(ctx, job.Envelope, w.Signer)
		if err != nil {
			return fail(err)
		}
		digest := sha256.Sum256(raw)
		job.Digest = hex.EncodeToString(digest[:])
		if err = w.Queue.Stage(ctx, job, raw, job.Digest); err != nil {
			return fail(err)
		}
	}
	digest := sha256.Sum256(raw)
	if hex.EncodeToString(digest[:]) != job.Digest {
		return fail(ErrUnavailable)
	}
	verified, verifyErr := configsnapshot.Verify(raw, w.Trust, job.Envelope.DeploymentID, job.Envelope.Generation-1, now())
	if verifyErr != nil {
		return fail(verifyErr)
	}
	if verified.Generation != job.Envelope.Generation || !verified.CreatedAt.Equal(job.Envelope.CreatedAt) || !verified.ValidFrom.Equal(job.Envelope.ValidFrom) || !verified.ExpiresAt.Equal(job.Envelope.ExpiresAt) || !reflect.DeepEqual(verified.Payload, job.Envelope.Payload) {
		return fail(ErrUnavailable)
	}
	location, err := w.Store.Put(ctx, raw)
	if err != nil {
		return fail(err)
	}
	notice := Notification{job.Envelope.DeploymentID, job.Envelope.Generation, job.Digest, location}
	if err = w.Notifier.Publish(ctx, notice); err != nil {
		return fail(err)
	}
	return w.Queue.Finish(ctx, job, notice)
}
