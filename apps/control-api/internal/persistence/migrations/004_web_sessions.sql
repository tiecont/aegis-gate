ALTER TABLE admin_sessions ADD COLUMN csrf_hash bytea
    CHECK (csrf_hash IS NULL OR octet_length(csrf_hash)=32);
CREATE TABLE login_attempts (
    state_hash bytea PRIMARY KEY CHECK (octet_length(state_hash)=32),
    browser_hash bytea NOT NULL CHECK (octet_length(browser_hash)=32),
    pkce_verifier text NOT NULL CHECK (length(pkce_verifier)=43),
    nonce text NOT NULL CHECK (length(nonce)=43),
    expires_at timestamptz NOT NULL
);
CREATE INDEX login_attempts_expiry ON login_attempts(expires_at);
