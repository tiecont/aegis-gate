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
	var count int
	if err = tx.QueryRow(ctx, "SELECT count(*) FROM domain_verification_jobs WHERE project_id=$1 AND state IN ('pending','running')", project).Scan(&count); err != nil {
		return VerificationJob{}, opaque(err)
	}
	if count >= 100 {
		return VerificationJob{}, domain.ErrConflict
	}
	jobID, err := contracts.RequestID()
	if err != nil {
		return VerificationJob{}, err
	}
	var job VerificationJob
	err = tx.QueryRow(ctx, `INSERT INTO domain_verification_jobs(id,project_id,resource_id,issuer,subject)VALUES($1,$2,$3,$4,$5)
		ON CONFLICT(project_id,resource_id) WHERE state IN ('pending','running') DO UPDATE SET project_id=EXCLUDED.project_id
		RETURNING id,project_id,resource_id,state,attempts`, jobID, project, id, p.Issuer, p.Subject).Scan(&job.ID, &job.ProjectID, &job.DomainID, &job.State, &job.Attempts)
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
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "UPDATE domain_verification_jobs SET state='failed',lease_until=NULL WHERE state='running' AND attempts=3 AND lease_until<=now()"); err != nil {
		return false, opaque(err)
	}
	var id, project, resource string
	var p Principal
	var attempt int
	err = tx.QueryRow(ctx, `SELECT id,project_id,resource_id,issuer,subject,attempts FROM domain_verification_jobs
		WHERE attempts<3 AND available_at<=now() AND (state='pending' OR (state='running' AND lease_until<=now()))
		ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1`).Scan(&id, &project, &resource, &p.Issuer, &p.Subject, &attempt)
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
	claim, verifyErr := s.VerifyDomainClaim(ctx, p, project, resource, resolver)
	if verifyErr != nil {
		// A process may have committed the verification then crashed before the
		// job ACK. A verified unexpired claim safely completes a leased retry.
		if existing, e := s.DomainClaim(ctx, p, project, resource); e == nil && (existing.State == "verified" || existing.State == "active") {
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
	_, err = s.pool.Exec(ctx, `UPDATE domain_verification_jobs SET state=$3,lease_until=NULL,available_at=now()+interval '10 seconds'
		WHERE id=$1 AND attempts=$2 AND state='running'`, id, attempt, state)
	return true, opaque(err)
}
