CREATE TABLE domain_verification_jobs (
    id uuid PRIMARY KEY,
    project_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    issuer text NOT NULL,
    subject text NOT NULL,
    state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','succeeded','failed')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
    available_at timestamptz NOT NULL DEFAULT now(),
    lease_until timestamptz,
    FOREIGN KEY(project_id,resource_id) REFERENCES domain_claims(project_id,resource_id)
);
CREATE UNIQUE INDEX domain_verification_active ON domain_verification_jobs(project_id,resource_id)
    WHERE state IN ('pending','running');
CREATE INDEX domain_verification_ready ON domain_verification_jobs(available_at)
    WHERE state IN ('pending','running');
