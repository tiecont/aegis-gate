-- C1-C3 acceptance state. This migration is additive and keeps the generic
-- origin resource for compatibility while making pools and endpoints explicit.
CREATE TABLE IF NOT EXISTS origin_pools (
    project_id uuid NOT NULL REFERENCES projects(id),
    id uuid NOT NULL,
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 128),
    state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','disabled','retired')),
    generation bigint NOT NULL DEFAULT 1 CHECK (generation BETWEEN 1 AND 9007199254740991),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id,id),
    UNIQUE (project_id,name)
);
CREATE TABLE IF NOT EXISTS origin_endpoints (
    project_id uuid NOT NULL,
    pool_id uuid NOT NULL,
    id uuid NOT NULL,
    url text NOT NULL CHECK (length(url) BETWEEN 8 AND 2048),
    hostname text NOT NULL,
    port integer NOT NULL DEFAULT 443 CHECK (port=443),
    state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','disabled','retired')),
    generation bigint NOT NULL DEFAULT 1 CHECK (generation BETWEEN 1 AND 9007199254740991),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id,id),
    UNIQUE (project_id,pool_id,url),
    FOREIGN KEY (project_id,pool_id) REFERENCES origin_pools(project_id,id)
);
CREATE INDEX IF NOT EXISTS origin_endpoints_pool ON origin_endpoints(project_id,pool_id,state,id);
CREATE TABLE IF NOT EXISTS origin_endpoint_revisions (
    project_id uuid NOT NULL,
    endpoint_id uuid NOT NULL,
    generation bigint NOT NULL CHECK (generation BETWEEN 1 AND 9007199254740991),
    url text NOT NULL,
    state text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id,endpoint_id,generation),
    FOREIGN KEY (project_id,endpoint_id) REFERENCES origin_endpoints(project_id,id)
);
CREATE TABLE IF NOT EXISTS organization_quotas (
    organization_id uuid PRIMARY KEY REFERENCES organizations(id),
    max_projects integer NOT NULL DEFAULT 50 CHECK (max_projects BETWEEN 1 AND 10000),
    max_members integer NOT NULL DEFAULT 100 CHECK (max_members BETWEEN 1 AND 10000),
    max_resources integer NOT NULL DEFAULT 1000 CHECK (max_resources BETWEEN 1 AND 100000),
    max_pending_jobs integer NOT NULL DEFAULT 100 CHECK (max_pending_jobs BETWEEN 1 AND 10000),
    audit_retention_days integer NOT NULL DEFAULT 365 CHECK (audit_retention_days BETWEEN 30 AND 3650)
);
INSERT INTO organization_quotas(organization_id) SELECT id FROM organizations;
CREATE INDEX IF NOT EXISTS audit_retention ON audit_events(organization_id,at);
CREATE TABLE origin_pool_revisions (
    project_id uuid NOT NULL,
    pool_id uuid NOT NULL,
    generation bigint NOT NULL,
    spec jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(project_id,pool_id,generation),
    FOREIGN KEY(project_id,pool_id) REFERENCES origin_pools(project_id,id)
);
CREATE TABLE origin_pool_approvals (
    project_id uuid NOT NULL,
    pool_id uuid NOT NULL,
    generation bigint NOT NULL,
    issuer text NOT NULL,
    subject text NOT NULL,
    approved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(project_id,pool_id,generation),
    FOREIGN KEY(project_id,pool_id,generation) REFERENCES origin_pool_revisions(project_id,pool_id,generation)
);
CREATE TABLE origin_mutation_keys (
    project_id uuid NOT NULL REFERENCES projects(id),
    issuer text NOT NULL,
    subject text NOT NULL,
    key text NOT NULL CHECK(length(key) BETWEEN 8 AND 128),
    request_hash bytea NOT NULL,
    response jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(project_id,issuer,subject,key)
);
CREATE TRIGGER immutable_endpoint_revision BEFORE UPDATE OR DELETE ON origin_endpoint_revisions FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER immutable_pool_revision BEFORE UPDATE OR DELETE ON origin_pool_revisions FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER immutable_pool_approval BEFORE UPDATE OR DELETE ON origin_pool_approvals FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();

ALTER TABLE route_bindings ALTER COLUMN origin_id DROP NOT NULL;
ALTER TABLE route_bindings ADD COLUMN origin_pool_id uuid;
ALTER TABLE route_bindings ADD FOREIGN KEY(project_id,origin_pool_id) REFERENCES origin_pools(project_id,id);
ALTER TABLE route_bindings ADD CHECK ((origin_id IS NULL) <> (origin_pool_id IS NULL));
ALTER TABLE route_approvals DROP CONSTRAINT route_approvals_pkey;
ALTER TABLE route_approvals ALTER COLUMN origin_id DROP NOT NULL;
ALTER TABLE route_approvals ALTER COLUMN origin_generation DROP NOT NULL;
ALTER TABLE route_approvals ADD COLUMN origin_pool_id uuid;
ALTER TABLE route_approvals ADD COLUMN origin_pool_generation bigint;
ALTER TABLE route_approvals ADD FOREIGN KEY(project_id,origin_pool_id,origin_pool_generation) REFERENCES origin_pool_approvals(project_id,pool_id,generation);
ALTER TABLE route_approvals ADD COLUMN decision_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY;
ALTER TABLE route_approvals ADD UNIQUE(project_id,route_id,decision_id);
CREATE TABLE active_route_approvals (
    project_id uuid NOT NULL,
    route_id uuid NOT NULL,
    decision_id bigint NOT NULL,
    retired boolean NOT NULL DEFAULT false,
    PRIMARY KEY(project_id,route_id),
    FOREIGN KEY(project_id,route_id) REFERENCES resources(project_id,id),
    FOREIGN KEY(project_id,route_id,decision_id) REFERENCES route_approvals(project_id,route_id,decision_id)
);
-- Existing approvals stay historical and require a fresh explicit approval.
CREATE TABLE route_retirements (
    project_id uuid NOT NULL,
    route_id uuid NOT NULL,
    decision_id bigint NOT NULL,
    issuer text NOT NULL,
    subject text NOT NULL,
    retired_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(project_id,route_id,decision_id),
    FOREIGN KEY(project_id,route_id,decision_id) REFERENCES route_approvals(project_id,route_id,decision_id)
);
CREATE TRIGGER immutable_retirement BEFORE UPDATE OR DELETE ON route_retirements FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
ALTER TABLE admin_sessions ADD COLUMN mfa_at timestamptz;
ALTER TABLE mutation_keys ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE domain_claims ADD COLUMN challenge_generation bigint NOT NULL DEFAULT 1;
ALTER TABLE domain_verification_jobs ADD COLUMN challenge_generation bigint NOT NULL DEFAULT 1;
ALTER TABLE domain_verification_jobs ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

-- Cleanup has a fixed retention floor and bounded batches. Runtime cannot invoke
-- it or DELETE audit/history rows. The migration owner grants a maintenance role.
CREATE FUNCTION cleanup_control_state() RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path FROM CURRENT AS $$
BEGIN
    DELETE FROM login_attempts WHERE state_hash IN (SELECT state_hash FROM login_attempts WHERE expires_at<=now() LIMIT 1000);
    DELETE FROM admin_sessions WHERE token_hash IN (SELECT token_hash FROM admin_sessions WHERE expires_at<now()-interval '1 day' LIMIT 1000);
    DELETE FROM mutation_keys WHERE ctid IN (SELECT ctid FROM mutation_keys WHERE created_at<now()-interval '7 days' LIMIT 1000);
    DELETE FROM origin_mutation_keys WHERE ctid IN (SELECT ctid FROM origin_mutation_keys WHERE created_at<now()-interval '7 days' LIMIT 1000);
    DELETE FROM domain_verification_jobs WHERE id IN (SELECT id FROM domain_verification_jobs WHERE state IN ('failed','succeeded') AND created_at<now()-interval '7 days' LIMIT 1000);
END $$;
REVOKE ALL ON FUNCTION cleanup_control_state() FROM PUBLIC;
