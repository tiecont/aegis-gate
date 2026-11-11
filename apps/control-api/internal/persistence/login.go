package persistence

import (
	"context"
	"crypto/subtle"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
)

type LoginAttempt struct{ State, Browser, Verifier, Nonce string }

func (s *Store) BeginLogin(ctx context.Context) (LoginAttempt, error) {
	var attempt LoginAttempt
	for _, field := range []*string{&attempt.State, &attempt.Browser, &attempt.Verifier, &attempt.Nonce} {
		value, err := randomToken()
		if err != nil {
			return LoginAttempt{}, err
		}
		*field = value
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return LoginAttempt{}, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(4122026004)"); err != nil {
		return LoginAttempt{}, opaque(err)
	}
	if _, err = tx.Exec(ctx, "DELETE FROM login_attempts WHERE expires_at<=now()"); err != nil {
		return LoginAttempt{}, opaque(err)
	}
	var count int
	if err = tx.QueryRow(ctx, "SELECT count(*) FROM login_attempts").Scan(&count); err != nil {
		return LoginAttempt{}, opaque(err)
	}
	if count >= 1024 {
		return LoginAttempt{}, domain.ErrConflict
	}
	if _, err = tx.Exec(ctx, `INSERT INTO login_attempts(state_hash,browser_hash,pkce_verifier,nonce,expires_at)
		VALUES($1,$2,$3,$4,now()+interval '5 minutes')`, TokenHash(attempt.State), TokenHash(attempt.Browser), attempt.Verifier, attempt.Nonce); err != nil {
		return LoginAttempt{}, opaque(err)
	}
	return attempt, opaque(tx.Commit(ctx))
}

func (s *Store) ConsumeLogin(ctx context.Context, state, browser string) (LoginAttempt, error) {
	var attempt LoginAttempt
	if len(state) != 43 || len(browser) != 43 {
		return attempt, domain.ErrDenied
	}
	err := s.pool.QueryRow(ctx, `DELETE FROM login_attempts WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now()
		RETURNING pkce_verifier,nonce`, TokenHash(state), TokenHash(browser)).Scan(&attempt.Verifier, &attempt.Nonce)
	if err != nil {
		return LoginAttempt{}, domain.ErrDenied
	}
	return attempt, nil
}

func (s *Store) CreateWebSession(ctx context.Context, p Principal, expiry time.Time) (string, string, error) {
	if !p.valid() || !expiry.After(time.Now()) || expiry.After(time.Now().Add(15*time.Minute)) {
		return "", "", domain.ErrInvalid
	}
	token, err := randomToken()
	if err != nil {
		return "", "", err
	}
	csrf, err := randomToken()
	if err != nil {
		return "", "", err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO admin_sessions(token_hash,csrf_hash,issuer,subject,expires_at)VALUES($1,$2,$3,$4,$5)`, TokenHash(token), TokenHash(csrf), p.Issuer, p.Subject, expiry)
	if err != nil {
		return "", "", opaque(err)
	}
	return token, csrf, nil
}

func (s *Store) CheckCSRF(ctx context.Context, session, csrf string) error {
	if len(session) != 43 || len(csrf) != 43 {
		return domain.ErrDenied
	}
	var hash []byte
	err := s.pool.QueryRow(ctx, `SELECT csrf_hash FROM admin_sessions WHERE token_hash=$1 AND expires_at>now() AND revoked_at IS NULL`, TokenHash(session)).Scan(&hash)
	if err != nil || len(hash) != 32 || subtle.ConstantTimeCompare(hash, TokenHash(csrf)) != 1 {
		return domain.ErrDenied
	}
	return nil
}
