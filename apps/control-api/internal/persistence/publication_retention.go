package persistence

import (
	"context"
	"time"

	"aegisgate.dev/aegisgate/internal/configpublish"
)

// PrunePublicationArtifacts is an explicit local maintenance operation. It
// conservatively retains every durable outbox and rollout/audit reference,
// including failed publications. externalKeep must include disconnected LKG,
// captured generations and reservations not represented by these tables.
// Callers must coordinate those external references for this entire call.
// No approval, journal, or audit history is deleted or automatically archived.
func (s *Store) PrunePublicationArtifacts(ctx context.Context, objects *configpublish.LocalStore, externalKeep []string, before time.Time, batch int) (int, error) {
	if objects == nil || len(externalKeep) > 1024 {
		return 0, configpublish.ErrUnavailable
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, configpublish.ErrUnavailable
	}
	defer tx.Rollback(ctx)
	// SHARE blocks INSERT/UPDATE/DELETE, including new references, until after
	// filesystem deletion and fsync. Missing tables or privileges refuse pruning.
	if _, err = tx.Exec(ctx, `LOCK TABLE config_deployments,config_revisions,config_outbox,config_rollout_state,config_rollout_audit IN SHARE MODE NOWAIT`); err != nil {
		return 0, configpublish.ErrUnavailable
	}
	rows, err := tx.Query(ctx, `SELECT digest FROM config_outbox WHERE digest IS NOT NULL
UNION SELECT state->'notice'->>'digest' FROM config_rollout_state
UNION SELECT event->>'digest' FROM config_rollout_audit LIMIT 1025`)
	if err != nil {
		return 0, configpublish.ErrUnavailable
	}
	keep := append([]string(nil), externalKeep...)
	for rows.Next() {
		var digest string
		if rows.Scan(&digest) != nil || len(keep) >= 1024 {
			rows.Close()
			return 0, configpublish.ErrUnavailable
		}
		keep = append(keep, digest)
	}
	rows.Close()
	if rows.Err() != nil {
		return 0, configpublish.ErrUnavailable
	}
	// The transaction is read-only apart from its locks. Rollback releases them
	// only after Prune has completed; a later database failure cannot undo a
	// filesystem deletion, so protect the complete reference set beforehand.
	return objects.Prune(ctx, keep, before, batch)
}
