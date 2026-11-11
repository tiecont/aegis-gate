package persistence

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"aegisgate.dev/aegisgate/internal/configpublish"
	"aegisgate.dev/aegisgate/internal/configsnapshot"
	"aegisgate.dev/aegisgate/internal/contracts"
	"github.com/jackc/pgx/v5"
)

// PublicationQueue gives an already-authenticated least-privilege worker access
// to approved jobs. There is no API accepting a caller-provided payload.
func (s *Store) PublicationQueue() configpublish.Queue { return &publicationQueue{s} }

type publicationQueue struct{ s *Store }

func (q *publicationQueue) Claim(ctx context.Context, owner string, lease time.Duration) (configpublish.Job, error) {
	var job configpublish.Job
	if owner == "" || len(owner) > 128 || lease < 5*time.Second || lease > time.Minute {
		return job, configpublish.ErrLease
	}
	token, err := contracts.RequestID()
	if err != nil {
		return job, err
	}
	tx, err := q.s.pool.Begin(ctx)
	if err != nil {
		return job, configpublish.ErrUnavailable
	}
	defer tx.Rollback(ctx)
	// Exhausted workers that crashed on their final lease become terminal;
	// later independently approved generations must not wait forever.
	if _, err = tx.Exec(ctx, `WITH exhausted AS (SELECT project_id,generation FROM config_outbox WHERE state='leased' AND attempts>=32 AND lease_until<=now() ORDER BY project_id,generation FOR UPDATE SKIP LOCKED LIMIT 64) UPDATE config_outbox o SET state='failed',lease_until=NULL,lease_owner=NULL,lease_token=NULL FROM exhausted e WHERE o.project_id=e.project_id AND o.generation=e.generation`); err != nil {
		return job, configpublish.ErrUnavailable
	}
	var payload []byte
	err = tx.QueryRow(ctx, `WITH picked AS (
  SELECT o.project_id,o.generation FROM config_outbox o
  WHERE o.state IN ('pending','leased') AND o.available_at<=now() AND (o.lease_until IS NULL OR o.lease_until<=now()) AND o.attempts<32
  AND NOT EXISTS(SELECT 1 FROM config_outbox older WHERE older.project_id=o.project_id AND older.generation<o.generation AND older.state NOT IN ('published','failed'))
  ORDER BY o.available_at,o.project_id,o.generation FOR UPDATE OF o SKIP LOCKED LIMIT 1
 ) UPDATE config_outbox o SET state='leased',lease_owner=$1,lease_token=$2,lease_until=now()+make_interval(secs=>$3),attempts=attempts+1 FROM picked p,config_revisions r
 WHERE o.project_id=p.project_id AND o.generation=p.generation AND r.project_id=p.project_id AND r.generation=p.generation
 RETURNING o.project_id,o.generation,r.payload,r.created_at,r.expires_at,o.artifact,COALESCE(o.digest,''),o.attempts`, owner, token, int(lease.Seconds())).Scan(&job.Envelope.DeploymentID, &job.Envelope.Generation, &payload, &job.Envelope.CreatedAt, &job.Envelope.ExpiresAt, &job.Artifact, &job.Digest, &job.Attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return job, configpublish.ErrEmpty
	}
	if err != nil {
		return job, configpublish.ErrUnavailable
	}
	if json.Unmarshal(payload, &job.Envelope.Payload) != nil {
		return job, configpublish.ErrUnavailable
	}
	job.Envelope.CreatedAt = job.Envelope.CreatedAt.UTC()
	job.Envelope.ValidFrom = job.Envelope.CreatedAt
	job.Envelope.ExpiresAt = job.Envelope.ExpiresAt.UTC()
	job.Token = token
	if err = tx.Commit(ctx); err != nil {
		return configpublish.Job{}, configpublish.ErrUnavailable
	}
	return job, nil
}
func (q *publicationQueue) Stage(ctx context.Context, j configpublish.Job, raw []byte, digest string) error {
	if len(raw) == 0 || len(raw) > configsnapshot.MaxArtifactBytes {
		return configpublish.ErrUnavailable
	}
	sum := sha256.Sum256(raw)
	if hex.EncodeToString(sum[:]) != digest {
		return configpublish.ErrUnavailable
	}
	tag, err := q.s.pool.Exec(ctx, `UPDATE config_outbox SET artifact=$4,digest=$5 WHERE project_id=$1 AND generation=$2 AND lease_token=$3 AND state='leased' AND lease_until>now() AND artifact IS NULL`, j.Envelope.DeploymentID, j.Envelope.Generation, j.Token, raw, digest)
	if err != nil || tag.RowsAffected() != 1 {
		return configpublish.ErrLease
	}
	return nil
}
func (q *publicationQueue) Finish(ctx context.Context, j configpublish.Job, n configpublish.Notification) error {
	if n.DeploymentID != j.Envelope.DeploymentID || n.Generation != j.Envelope.Generation || n.Digest != j.Digest || len(n.Location) < 1 || len(n.Location) > 2048 {
		return configpublish.ErrUnavailable
	}
	tag, err := q.s.pool.Exec(ctx, `UPDATE config_outbox SET state='published',location=$4,published_at=now(),lease_until=NULL,lease_owner=NULL,lease_token=NULL WHERE project_id=$1 AND generation=$2 AND lease_token=$3 AND state='leased' AND lease_until>now() AND digest=$5`, n.DeploymentID, n.Generation, j.Token, n.Location, n.Digest)
	if err != nil || tag.RowsAffected() != 1 {
		return configpublish.ErrLease
	}
	return nil
}
func (q *publicationQueue) Retry(ctx context.Context, j configpublish.Job, delay time.Duration) error {
	if delay < time.Second || delay > time.Minute+4*time.Second {
		return configpublish.ErrUnavailable
	}
	tag, err := q.s.pool.Exec(ctx, `UPDATE config_outbox SET state=CASE WHEN attempts>=32 THEN 'failed' ELSE 'pending' END,available_at=now()+make_interval(secs=>$4),lease_until=NULL,lease_owner=NULL,lease_token=NULL WHERE project_id=$1 AND generation=$2 AND lease_token=$3 AND state='leased' AND lease_until>now()`, j.Envelope.DeploymentID, j.Envelope.Generation, j.Token, int(delay.Seconds()))
	if err != nil || tag.RowsAffected() != 1 {
		return configpublish.ErrLease
	}
	return nil
}

// VerifyPublication binds a rollout admission to a durable approval and the
// exact immutable artifact staged by the publisher. A pubsub hint alone cannot
// create or advance a rollout. A staged job may still be awaiting its bus ACK.
func (s *Store) VerifyPublication(ctx context.Context, deploymentID string, generation uint64, artifactDigest string, rollbackOf uint64) error {
	if generation == 0 || generation > configsnapshot.MaxGeneration || len(artifactDigest) != 64 {
		return configpublish.ErrUnavailable
	}
	var approved bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM config_revisions r JOIN config_outbox o ON o.project_id=r.project_id AND o.generation=r.generation WHERE r.project_id=$1 AND r.generation=$2 AND o.digest=$3 AND o.artifact IS NOT NULL AND COALESCE(r.rollback_of,0)=$4 AND o.state IN ('leased','pending','published'))`, deploymentID, generation, artifactDigest, rollbackOf).Scan(&approved)
	if err != nil || !approved {
		return configpublish.ErrUnavailable
	}
	return nil
}
