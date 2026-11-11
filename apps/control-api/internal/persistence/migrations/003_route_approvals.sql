CREATE TABLE route_approvals (
    project_id uuid NOT NULL,
    route_id uuid NOT NULL,
    route_generation bigint NOT NULL,
    domain_id uuid NOT NULL,
    origin_id uuid NOT NULL,
    origin_generation bigint NOT NULL,
    policy_id uuid NOT NULL,
    policy_generation bigint NOT NULL,
    issuer text NOT NULL,
    subject text NOT NULL,
    approved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(project_id,route_id,route_generation,origin_generation,policy_generation),
    FOREIGN KEY(project_id,route_id,route_generation) REFERENCES resource_revisions(project_id,resource_id,generation),
    FOREIGN KEY(project_id,origin_id,origin_generation) REFERENCES resource_revisions(project_id,resource_id,generation),
    FOREIGN KEY(project_id,policy_id,policy_generation) REFERENCES resource_revisions(project_id,resource_id,generation),
    FOREIGN KEY(project_id,domain_id) REFERENCES domain_claims(project_id,resource_id)
);
CREATE TRIGGER immutable_approval BEFORE UPDATE OR DELETE ON route_approvals
    FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
