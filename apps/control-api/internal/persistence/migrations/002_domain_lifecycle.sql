ALTER TABLE domain_claims DROP CONSTRAINT domain_claims_hostname_key;
CREATE UNIQUE INDEX domain_claims_reserved_hostname ON domain_claims(hostname)
    WHERE state IN ('pending','verified','active');
CREATE INDEX domain_claims_expiry ON domain_claims(expires_at)
    WHERE state IN ('pending','verified','active');
