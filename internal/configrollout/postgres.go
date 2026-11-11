package configrollout

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgreSQLStore requires a dedicated restricted role in an isolated schema.
// Migrate is an explicit owner-only provisioning step, never a worker startup
// operation. Runtime needs SELECT/INSERT/UPDATE on state and SELECT/INSERT on
// audit, without schema CREATE or audit UPDATE/DELETE privileges.
type PostgreSQLStore struct{ pool *pgxpool.Pool }

func NewPostgreSQLStore(pool *pgxpool.Pool) (*PostgreSQLStore, error) {
	if pool == nil {
		return nil, ErrDenied
	}
	return &PostgreSQLStore{pool}, nil
}

const Migration = `
CREATE TABLE IF NOT EXISTS config_rollout_state (
 deployment_id text PRIMARY KEY CHECK(length(deployment_id) BETWEEN 1 AND 128),
 version bigint NOT NULL CHECK(version>0),
 state jsonb NOT NULL CHECK(octet_length(state::text)<=1048576)
);
CREATE TABLE IF NOT EXISTS config_rollout_audit (
 deployment_id text NOT NULL REFERENCES config_rollout_state(deployment_id),
 sequence bigint NOT NULL CHECK(sequence>0),
 generation bigint NOT NULL CHECK(generation>0),
 recorded_at timestamptz NOT NULL,
 event jsonb NOT NULL CHECK(octet_length(event::text)<=4096),
 PRIMARY KEY(deployment_id,sequence)
);
CREATE INDEX IF NOT EXISTS config_rollout_audit_retention ON config_rollout_audit(recorded_at);
`

func (s *PostgreSQLStore) Migrate(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, Migration)
	return err
}
func (s *PostgreSQLStore) Load(ctx context.Context, deployment string) (State, error) {
	var raw []byte
	var version uint64
	err := s.pool.QueryRow(ctx, "SELECT version,state FROM config_rollout_state WHERE deployment_id=$1", deployment).Scan(&version, &raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return State{}, ErrMissing
	}
	if err != nil {
		return State{}, errors.New("rollout storage unavailable")
	}
	var state State
	if len(raw) > 1<<20 || json.Unmarshal(raw, &state) != nil || state.Version != version || state.Notice.DeploymentID != deployment || len(state.Edges) > MaxEdges || state.EventCount > MaxEvents {
		return State{}, errors.New("invalid rollout checkpoint")
	}
	return state, nil
}
func (s *PostgreSQLStore) Commit(ctx context.Context, expected uint64, next State, events []Event) error {
	if next.Version != expected+1 || len(events) != 1 || events[0].Sequence != next.Sequence || events[0].Generation != next.Notice.Generation {
		return ErrDenied
	}
	raw, err := json.Marshal(next)
	if err != nil || len(raw) > 1<<20 {
		return ErrDenied
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return errors.New("rollout storage unavailable")
	}
	defer tx.Rollback(ctx)
	var affected int64
	if expected == 0 {
		tag, e := tx.Exec(ctx, "INSERT INTO config_rollout_state(deployment_id,version,state) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", next.Notice.DeploymentID, next.Version, raw)
		err = e
		affected = tag.RowsAffected()
	} else {
		tag, e := tx.Exec(ctx, "UPDATE config_rollout_state SET version=$2,state=$3 WHERE deployment_id=$1 AND version=$4", next.Notice.DeploymentID, next.Version, raw, expected)
		err = e
		affected = tag.RowsAffected()
	}
	if err != nil {
		return errors.New("rollout storage unavailable")
	}
	if affected != 1 {
		return ErrConflict
	}
	for _, event := range events {
		encoded, e := json.Marshal(event)
		if e != nil {
			return ErrDenied
		}
		if _, e = tx.Exec(ctx, "INSERT INTO config_rollout_audit(deployment_id,sequence,generation,recorded_at,event) VALUES($1,$2,$3,$4,$5)", next.Notice.DeploymentID, event.Sequence, event.Generation, event.At, encoded); e != nil {
			return errors.New("rollout audit unavailable")
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return errors.New("rollout storage unavailable")
	}
	return nil
}

// CleanupAudit is an explicit maintenance-role operation after an independently
// verified archive. It retains at least the latest generation and refuses a
// cutoff newer than30days. At most1024 rows are deleted per invocation; the
// archive digest is recorded transactionally before deletion.
func (s *PostgreSQLStore) CleanupAudit(ctx context.Context, deployment string, before time.Time, archiveDigest string, now time.Time) (int64, error) {
	if before.After(now.Add(-30*24*time.Hour)) || !validDigest(archiveDigest) {
		return 0, ErrDenied
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	var raw []byte
	var state State
	if err = tx.QueryRow(ctx, "SELECT state FROM config_rollout_state WHERE deployment_id=$1 FOR UPDATE", deployment).Scan(&raw); err != nil {
		return 0, err
	}
	if json.Unmarshal(raw, &state) != nil {
		return 0, ErrDenied
	}
	// Cleanup metadata remains in the append-only sequence, and includes only a
	// bounded archive checksum, never a location or credential.
	event := Event{Sequence: state.Sequence + 1, At: now.UTC(), Type: "audit_archive_cleanup", Code: archiveDigest, Generation: state.Notice.Generation, Digest: state.Notice.Digest}
	state.Sequence++
	state.Version++
	raw, _ = json.Marshal(state)
	encoded, _ := json.Marshal(event)
	if _, err = tx.Exec(ctx, "UPDATE config_rollout_state SET version=$2,state=$3 WHERE deployment_id=$1", deployment, state.Version, raw); err != nil {
		return 0, err
	}
	if _, err = tx.Exec(ctx, "INSERT INTO config_rollout_audit(deployment_id,sequence,generation,recorded_at,event) VALUES($1,$2,$3,$4,$5)", deployment, event.Sequence, event.Generation, event.At, encoded); err != nil {
		return 0, err
	}
	tag, err := tx.Exec(ctx, `DELETE FROM config_rollout_audit WHERE (deployment_id,sequence) IN (SELECT deployment_id,sequence FROM config_rollout_audit WHERE deployment_id=$1 AND recorded_at<$2 AND generation<$3 ORDER BY sequence LIMIT 1024)`, deployment, before, state.Notice.Generation)
	if err != nil {
		return 0, err
	}
	if err = tx.Commit(ctx); err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
