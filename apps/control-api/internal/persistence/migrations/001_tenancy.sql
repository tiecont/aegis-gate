CREATE TABLE IF NOT EXISTS organizations (
    id uuid PRIMARY KEY,
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 128),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS memberships (
    organization_id uuid NOT NULL REFERENCES organizations(id),
    issuer text NOT NULL,
    subject text NOT NULL,
    role text NOT NULL CHECK (role IN ('owner','admin','security-admin','developer','billing-admin','viewer')),
    active boolean NOT NULL DEFAULT true,
    PRIMARY KEY (organization_id, issuer, subject)
);
CREATE TABLE IF NOT EXISTS projects (
    id uuid PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id),
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 128),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
    UNIQUE (organization_id,id)
);
CREATE TABLE IF NOT EXISTS resources (
    id uuid NOT NULL,
    project_id uuid NOT NULL REFERENCES projects(id),
    kind text NOT NULL CHECK (kind IN ('domain','origin','policy','route')),
    generation bigint NOT NULL CHECK (generation BETWEEN 1 AND 9007199254740991),
    spec jsonb NOT NULL CHECK (jsonb_typeof(spec) = 'object' AND octet_length(spec::text) <= 16384),
    PRIMARY KEY (project_id,id),
    UNIQUE (project_id,id,kind)
);
CREATE INDEX IF NOT EXISTS resources_list ON resources(project_id,kind,id);
CREATE TABLE IF NOT EXISTS resource_revisions (
    project_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    generation bigint NOT NULL CHECK (generation BETWEEN 1 AND 9007199254740991),
    spec jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id,resource_id,generation),
    FOREIGN KEY (project_id,resource_id) REFERENCES resources(project_id,id)
);
CREATE TABLE IF NOT EXISTS domain_claims (
    project_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    hostname text NOT NULL UNIQUE CHECK (hostname = lower(hostname) AND length(hostname) <= 253),
    challenge_hash bytea NOT NULL CHECK (octet_length(challenge_hash)=32),
    expires_at timestamptz NOT NULL,
    state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','verified','active','failed','expired')),
    verified_at timestamptz,
    PRIMARY KEY (project_id,resource_id),
    FOREIGN KEY (project_id,resource_id) REFERENCES resources(project_id,id)
);
CREATE TABLE IF NOT EXISTS route_bindings (
    project_id uuid NOT NULL,
    route_id uuid NOT NULL,
    route_kind text NOT NULL DEFAULT 'route' CHECK (route_kind='route'),
    domain_id uuid NOT NULL,
    domain_kind text NOT NULL DEFAULT 'domain' CHECK (domain_kind='domain'),
    origin_id uuid NOT NULL,
    origin_kind text NOT NULL DEFAULT 'origin' CHECK (origin_kind='origin'),
    policy_id uuid NOT NULL,
    policy_kind text NOT NULL DEFAULT 'policy' CHECK (policy_kind='policy'),
    PRIMARY KEY (project_id,route_id),
    FOREIGN KEY(project_id,route_id,route_kind) REFERENCES resources(project_id,id,kind),
    FOREIGN KEY(project_id,domain_id,domain_kind) REFERENCES resources(project_id,id,kind),
    FOREIGN KEY(project_id,origin_id,origin_kind) REFERENCES resources(project_id,id,kind),
    FOREIGN KEY(project_id,policy_id,policy_kind) REFERENCES resources(project_id,id,kind)
);
CREATE TABLE IF NOT EXISTS mutation_keys (
    project_id uuid NOT NULL REFERENCES projects(id),
    issuer text NOT NULL,
    subject text NOT NULL,
    idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 128),
    request_hash bytea NOT NULL CHECK (octet_length(request_hash)=32),
    resource_id uuid NOT NULL,
    PRIMARY KEY(project_id,issuer,subject,idempotency_key),
    FOREIGN KEY(project_id,resource_id) REFERENCES resources(project_id,id)
);
CREATE TABLE IF NOT EXISTS audit_events (
    sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES organizations(id),
    project_id uuid REFERENCES projects(id),
    issuer text NOT NULL,
    subject text NOT NULL,
    action text NOT NULL CHECK (action ~ '^[a-z_]{1,64}$'),
    outcome text NOT NULL CHECK (outcome IN ('allowed','denied')),
    resource_id uuid,
    at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_scope ON audit_events(organization_id,sequence);
CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash bytea PRIMARY KEY CHECK (octet_length(token_hash)=32),
    issuer text NOT NULL,
    subject text NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS admin_session_expiry ON admin_sessions(expires_at);
CREATE OR REPLACE FUNCTION reject_immutable_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable record'; END;
$$;
DROP TRIGGER IF EXISTS immutable_revision ON resource_revisions;
CREATE TRIGGER immutable_revision BEFORE UPDATE OR DELETE ON resource_revisions
    FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
DROP TRIGGER IF EXISTS immutable_audit ON audit_events;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
