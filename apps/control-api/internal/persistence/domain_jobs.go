package persistence

import (
	"context"
	"errors"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"aegisgate.dev/aegisgate/internal/contracts"
	"github.com/jackc/pgx/v5"
)

type VerificationJob struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	DomainID  string `json:"domain_id"`
	State     string `json:"state"`
	Attempts  int    `json:"attempts"`
}

func (s *Store) QueueDomainVerification(ctx context.Context, p Principal, project, id string) (VerificationJob, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return VerificationJob{}, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, "domains")
	if err != nil {
		return VerificationJob{}, err
	}
	claim, _, err := readClaim(ctx, tx, project, id)
	if err != nil {
		return VerificationJob{}, err
	}
	if claim.State != "pending" {
		return VerificationJob{}, domain.ErrConflict
	}
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,3))", project); err != nil {
		return VerificationJob{}, opaque(err)
	}
	var count, max int
	if err = tx.QueryRow(ctx, "SELECT count(*) FROM domain_verification_jobs WHERE project_id=$1 AND state IN ('pending','running')", project).Scan(&count); err != nil {
		return VerificationJob{}, opaque(err)
	}
	if err = tx.QueryRow(ctx, "SELECT max_pending_jobs FROM organization_quotas WHERE organization_id=$1", org).Scan(&max); err != nil {
		return VerificationJob{}, domain.ErrConflict
	}
	if count >= max {
		return VerificationJob{}, domain.ErrConflict
	}
	jobID, err := contracts.RequestID()
	if err != nil {
		return VerificationJob{}, err
	}
	var job VerificationJob
	err = tx.QueryRow(ctx, `INSERT INTO domain_verification_jobs(id,project_id,resource_id,issuer,subject,challenge_generation)VALUES($1,$2,$3,$4,$5,$6)
		ON CONFLICT(project_id,resource_id) WHERE state IN ('pending','running') DO UPDATE SET project_id=EXCLUDED.project_id
		RETURNING id,project_id,resource_id,state,attempts`, jobID, project, id, p.Issuer, p.Subject, claim.Generation).Scan(&job.ID, &job.ProjectID, &job.DomainID, &job.State, &job.Attempts)
	if err != nil {
		return job, opaque(err)
	}
	if _, err = tx.Exec(ctx, `INSERT INTO audit_events(organization_id,project_id,issuer,subject,action,outcome,resource_id)
		VALUES($1,$2,$3,$4,'domain_verify_queue','allowed',$5)`, org, project, p.Issuer, p.Subject, id); err != nil {
		return job, opaque(err)
	}
	return job, opaque(tx.Commit(ctx))
}

func (s *Store) VerificationJob(ctx context.Context, p Principal, project, id string) (VerificationJob, error) {
	var job VerificationJob
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return job, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = scoped(ctx, tx, p, project, "read"); err != nil {
		return job, err
	}
	err = tx.QueryRow(ctx, "SELECT id,project_id,resource_id,state,attempts FROM domain_verification_jobs WHERE project_id=$1 AND id=$2", project, id).Scan(&job.ID, &job.ProjectID, &job.DomainID, &job.State, &job.Attempts)
	return job, opaque(err)
}

// RunDomainVerification processes at most one durable job. Failed proofs retry
// twice with backoff; the persisted principal/project is reauthorized by Verify.
func (s *Store) RunDomainVerification(ctx context.Context, resolver TXTResolver) (bool, error) {
	if resolver == nil {
		return false, domain.ErrInvalid
	}
	if err := s.ExpireDomainClaims(ctx); err != nil {
		return false, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `UPDATE domain_claims d SET state='failed' FROM domain_verification_jobs j WHERE j.project_id=d.project_id AND j.resource_id=d.resource_id AND j.challenge_generation=d.challenge_generation AND d.state='pending' AND j.state='running' AND j.attempts=3 AND j.lease_until<=now()`); err != nil {
		return false, opaque(err)
	}
	if _, err = tx.Exec(ctx, "UPDATE domain_verification_jobs SET state='failed',lease_until=NULL WHERE state='running' AND attempts=3 AND lease_until<=now()"); err != nil {
		return false, opaque(err)
	}
	var id, project, resource string
	var p Principal
	var attempt int
	var generation int64
	err = tx.QueryRow(ctx, `SELECT id,project_id,resource_id,issuer,subject,attempts,challenge_generation FROM domain_verification_jobs
		WHERE attempts<3 AND available_at<=now() AND (state='pending' OR (state='running' AND lease_until<=now()))
		ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1`).Scan(&id, &project, &resource, &p.Issuer, &p.Subject, &attempt, &generation)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, opaque(tx.Commit(ctx))
	}
	if err != nil {
		return false, opaque(err)
	}
	attempt++
	if _, err = tx.Exec(ctx, "UPDATE domain_verification_jobs SET state='running',attempts=$2,lease_until=now()+interval '15 seconds' WHERE id=$1", id, attempt); err != nil {
		return false, opaque(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return false, opaque(err)
	}
	claim, verifyErr := s.verifyDomain(ctx, p, project, resource, resolver, id, attempt, generation)
	if verifyErr != nil {
		// A process may have committed the verification then crashed before the
		// job ACK. A verified unexpired claim safely completes a leased retry.
		if existing, e := s.DomainClaim(ctx, p, project, resource); e == nil && existing.Generation == generation && (existing.State == "verified" || existing.State == "active") {
			claim = existing
			verifyErr = nil
		}
	}
	state := "succeeded"
	if verifyErr != nil || claim.State == "" {
		state = "pending"
		if attempt >= 3 || errors.Is(verifyErr, domain.ErrDenied) {
			state = "failed"
		}
	}
	tx, err = s.pool.Begin(ctx)
	if err != nil {
		return true, opaque(err)
	}
	defer tx.Rollback(ctx)
	command, err := tx.Exec(ctx, `UPDATE domain_verification_jobs SET state=$3,lease_until=NULL,available_at=now()+interval '10 seconds'
		WHERE id=$1 AND attempts=$2 AND state='running' AND lease_until>now() AND challenge_generation=$4`, id, attempt, state, generation)
	if err != nil {
		return true, opaque(err)
	}
	if state == "failed" && command.RowsAffected() == 1 {
		if _, err = tx.Exec(ctx, "UPDATE domain_claims SET state='failed' WHERE project_id=$1 AND resource_id=$2 AND challenge_generation=$3 AND state='pending'", project, resource, generation); err != nil {
			return true, opaque(err)
		}
	}
	return true, opaque(tx.Commit(ctx))
}
