package persistence

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"aegisgate.dev/aegisgate/internal/contracts"
	"github.com/jackc/pgx/v5"
)

type DomainClaim struct {
	ResourceID string    `json:"id"`
	ProjectID  string    `json:"project_id"`
	Hostname   string    `json:"hostname"`
	State      string    `json:"state"`
	ExpiresAt  time.Time `json:"expires_at"`
	TXTName    string    `json:"txt_name"`
	// Proof is returned once on creation. It is never stored in resource JSON.
	Proof string `json:"proof,omitempty"`
}

func randomToken() (string, error) {
	var entropy [32]byte
	if _, err := rand.Read(entropy[:]); err != nil {
		return "", errors.New("randomness unavailable")
	}
	return base64.RawURLEncoding.EncodeToString(entropy[:]), nil
}

func readClaim(ctx context.Context, tx pgx.Tx, project, id string) (DomainClaim, []byte, error) {
	var claim DomainClaim
	var hash []byte
	err := tx.QueryRow(ctx, `SELECT resource_id,project_id,hostname,state,expires_at,challenge_hash
		FROM domain_claims WHERE project_id=$1 AND resource_id=$2`, project, id).
		Scan(&claim.ResourceID, &claim.ProjectID, &claim.Hostname, &claim.State, &claim.ExpiresAt, &hash)
	claim.TXTName = "_aegisgate-challenge." + claim.Hostname
	if err == nil && !claim.ExpiresAt.After(time.Now()) {
		claim.State = "expired"
	}
	return claim, hash, opaque(err)
}

func (s *Store) DomainClaim(ctx context.Context, p Principal, project, id string) (DomainClaim, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return DomainClaim{}, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = scoped(ctx, tx, p, project, "read"); err != nil {
		return DomainClaim{}, err
	}
	claim, _, err := readClaim(ctx, tx, project, id)
	return claim, err
}

func (s *Store) CreateDomainClaim(ctx context.Context, p Principal, project, host, key string) (DomainClaim, error) {
	host, err := domain.Hostname(host)
	if err != nil || len(key) < 8 || len(key) > 128 {
		return DomainClaim{}, domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return DomainClaim{}, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, "domains")
	if err != nil {
		return DomainClaim{}, err
	}
	lockKey, _ := json.Marshal([]string{project, p.Issuer, p.Subject, key})
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,0))", string(lockKey)); err != nil {
		return DomainClaim{}, opaque(err)
	}
	spec, _ := json.Marshal(map[string]string{"hostname": host})
	digest := sha256.Sum256(append([]byte("domain\x00"), spec...))
	var oldID string
	var oldHash []byte
	err = tx.QueryRow(ctx, `SELECT resource_id,request_hash FROM mutation_keys
		WHERE project_id=$1 AND issuer=$2 AND subject=$3 AND idempotency_key=$4`, project, p.Issuer, p.Subject, key).Scan(&oldID, &oldHash)
	if err == nil {
		if subtle.ConstantTimeCompare(oldHash, digest[:]) != 1 {
			return DomainClaim{}, domain.ErrConflict
		}
		claim, _, err := readClaim(ctx, tx, project, oldID)
		return claim, err
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return DomainClaim{}, opaque(err)
	}
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1,1))", host); err != nil {
		return DomainClaim{}, opaque(err)
	}
	// Expired reservations may be reclaimed, but their immutable resource and
	// audit history remain bound to the original tenant.
	if _, err = tx.Exec(ctx, `UPDATE domain_claims SET state='expired'
		WHERE hostname=$1 AND expires_at<=now() AND state IN ('pending','verified','active')`, host); err != nil {
		return DomainClaim{}, opaque(err)
	}
	id, err := contracts.RequestID()
	if err != nil {
		return DomainClaim{}, err
	}
	secret, err := randomToken()
	if err != nil {
		return DomainClaim{}, err
	}
	proof := "aegisgate-verification=" + secret
	hash := sha256.Sum256([]byte(proof))
	expires := time.Now().UTC().Add(15 * time.Minute)
	for _, query := range []string{
		"INSERT INTO resources(project_id,id,kind,generation,spec)VALUES($1,$2,'domain',1,$3)",
		"INSERT INTO resource_revisions(project_id,resource_id,generation,spec)VALUES($1,$2,1,$3)",
	} {
		if _, err = tx.Exec(ctx, query, project, id, spec); err != nil {
			return DomainClaim{}, opaque(err)
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO domain_claims(project_id,resource_id,hostname,challenge_hash,expires_at)
		VALUES($1,$2,$3,$4,$5)`, project, id, host, hash[:], expires); err != nil {
		return DomainClaim{}, opaque(err)
	}
	if _, err = tx.Exec(ctx, `INSERT INTO mutation_keys(project_id,issuer,subject,idempotency_key,request_hash,resource_id)
		VALUES($1,$2,$3,$4,$5,$6)`, project, p.Issuer, p.Subject, key, digest[:], id); err != nil {
		return DomainClaim{}, opaque(err)
	}
	if _, err = tx.Exec(ctx, `INSERT INTO audit_events(organization_id,project_id,issuer,subject,action,outcome,resource_id)
		VALUES($1,$2,$3,$4,'domain_claim','allowed',$5)`, org, project, p.Issuer, p.Subject, id); err != nil {
		return DomainClaim{}, opaque(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return DomainClaim{}, opaque(err)
	}
	return DomainClaim{ResourceID: id, ProjectID: project, Hostname: host, State: "pending", ExpiresAt: expires, TXTName: "_aegisgate-challenge." + host, Proof: proof}, nil
}

// TXTResolver is injected by the operator-owned DNS worker, never by a tenant.
type TXTResolver interface {
	LookupTXT(context.Context, string) ([]string, error)
}

func (s *Store) VerifyDomainClaim(ctx context.Context, p Principal, project, id string, resolver TXTResolver) (DomainClaim, error) {
	if resolver == nil {
		return DomainClaim{}, domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return DomainClaim{}, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = scoped(ctx, tx, p, project, "domains"); err != nil {
		return DomainClaim{}, err
	}
	claim, hash, err := readClaim(ctx, tx, project, id)
	if err != nil {
		return DomainClaim{}, err
	}
	if claim.State != "pending" {
		return DomainClaim{}, domain.ErrConflict
	}
	// Release all database locks before consulting DNS, then recheck membership,
	// expiry and the exact challenge under a fresh transaction before committing.
	if err = tx.Rollback(ctx); err != nil {
		return DomainClaim{}, opaque(err)
	}
	lookupCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	records, lookupErr := resolver.LookupTXT(lookupCtx, claim.TXTName)
	matched := false
	if lookupErr == nil && len(records) <= 32 {
		for _, record := range records {
			if len(record) > 512 {
				continue
			}
			digest := sha256.Sum256([]byte(record))
			matched = subtle.ConstantTimeCompare(hash, digest[:]) == 1 || matched
		}
	}
	tx, err = s.pool.Begin(ctx)
	if err != nil {
		return DomainClaim{}, opaque(err)
	}
	defer tx.Rollback(ctx)
	org, err := scoped(ctx, tx, p, project, "domains")
	if err != nil {
		return DomainClaim{}, err
	}
	outcome := "denied"
	if matched {
		outcome = "allowed"
		row := tx.QueryRow(ctx, `UPDATE domain_claims SET state='verified',verified_at=now(),expires_at=now()+interval '24 hours'
			WHERE project_id=$1 AND resource_id=$2 AND state='pending' AND expires_at>now() AND challenge_hash=$3
			RETURNING expires_at`, project, id, hash)
		if err = row.Scan(&claim.ExpiresAt); err != nil {
			return DomainClaim{}, domain.ErrConflict
		}
		claim.State = "verified"
	}
	if _, err = tx.Exec(ctx, `INSERT INTO audit_events(organization_id,project_id,issuer,subject,action,outcome,resource_id)
		VALUES($1,$2,$3,$4,'domain_verify',$5,$6)`, org, project, p.Issuer, p.Subject, outcome, id); err != nil {
		return DomainClaim{}, opaque(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return DomainClaim{}, opaque(err)
	}
	if !matched {
		return DomainClaim{}, domain.ErrConflict
	}
	return claim, nil
}
