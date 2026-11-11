-- Module03 uses one stable deployment UUID per project. Revisions are immutable
-- approved whole read-models; only queue lease/status and deployment head mutate.
CREATE TABLE config_deployments (
 project_id uuid PRIMARY KEY REFERENCES projects(id),
 generation bigint NOT NULL DEFAULT 0 CHECK(generation BETWEEN 0 AND 9007199254740991)
);
CREATE TABLE config_revisions (
 project_id uuid NOT NULL REFERENCES config_deployments(project_id),
 generation bigint NOT NULL CHECK(generation BETWEEN 1 AND 9007199254740991),
 issuer text NOT NULL, subject text NOT NULL,
 request_key text NOT NULL CHECK(length(request_key) BETWEEN 8 AND 128),
 payload jsonb NOT NULL CHECK(octet_length(payload::text)<=4194304),
 payload_digest text NOT NULL CHECK(payload_digest ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL CHECK(expires_at>created_at AND expires_at<=created_at+interval '24 hours'),
 rollback_of bigint,
 PRIMARY KEY(project_id,generation),
 UNIQUE(project_id,issuer,subject,request_key),
 FOREIGN KEY(project_id,rollback_of) REFERENCES config_revisions(project_id,generation)
);
CREATE TRIGGER immutable_config_revision BEFORE UPDATE OR DELETE ON config_revisions FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TABLE config_outbox (
 project_id uuid NOT NULL,
 generation bigint NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','leased','published','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 32),
 available_at timestamptz NOT NULL DEFAULT now(),
 lease_owner text, lease_token uuid, lease_until timestamptz,
 artifact bytea CHECK(octet_length(artifact)<=4194304),
 digest text CHECK(digest ~ '^[0-9a-f]{64}$'),
 location text CHECK(length(location)<=2048),
 published_at timestamptz,
 PRIMARY KEY(project_id,generation),
 FOREIGN KEY(project_id,generation) REFERENCES config_revisions(project_id,generation),
 CHECK((artifact IS NULL)=(digest IS NULL))
);
CREATE INDEX config_outbox_pending ON config_outbox(available_at,project_id,generation) WHERE state IN ('pending','leased');
-- A bounded historical journal deliberately refuses more than1000 revisions per
-- deployment. Archive/export and a reviewed migration are required to raise it.
CREATE FUNCTION guard_config_publication() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.project_id::text,83));
 IF (SELECT count(*) FROM config_revisions WHERE project_id=NEW.project_id)>=1000 THEN
  RAISE EXCEPTION 'publication quota reached' USING ERRCODE='54000';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bounded_config_revision BEFORE INSERT ON config_revisions FOR EACH ROW EXECUTE FUNCTION guard_config_publication();
CREATE FUNCTION guard_config_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.project_id<>OLD.project_id OR NEW.generation<>OLD.generation OR
    OLD.state='published' OR (OLD.artifact IS NOT NULL AND (NEW.artifact IS DISTINCT FROM OLD.artifact OR NEW.digest IS DISTINCT FROM OLD.digest)) THEN
  RAISE EXCEPTION 'immutable publication artifact';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guarded_config_outbox BEFORE UPDATE ON config_outbox FOR EACH ROW EXECUTE FUNCTION guard_config_outbox();
DO $$ DECLARE trusted_schema text:=current_schema(); BEGIN
 EXECUTE format('ALTER FUNCTION %I.guard_config_publication() SET search_path TO pg_catalog,%I,pg_temp',trusted_schema,trusted_schema);
END $$;
