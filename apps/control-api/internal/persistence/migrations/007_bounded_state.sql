CREATE FUNCTION create_organization_quota() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path FROM CURRENT AS $$
BEGIN INSERT INTO organization_quotas(organization_id) VALUES(NEW.id); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION create_organization_quota() FROM PUBLIC;
CREATE TRIGGER organization_quota AFTER INSERT ON organizations FOR EACH ROW EXECUTE FUNCTION create_organization_quota();

-- Serializes the whole quota bucket, independent of request/idempotency key.
-- Limits include inactive/history rows so disabling resources cannot grow state.
CREATE FUNCTION guard_control_quota() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE bucket text; n bigint; cap bigint; clause text; val text;
BEGIN
    cap:=1000;
    IF TG_TABLE_NAME='organizations' THEN bucket:='global'; clause:='true'; cap:=10000;
    ELSIF TG_TABLE_NAME='memberships' THEN
        bucket:=NEW.organization_id::text; val:=bucket; clause:='organization_id::text=$1';
        SELECT max_members INTO cap FROM organization_quotas WHERE organization_id=NEW.organization_id;
        IF NEW.role='owner' THEN
            PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array(NEW.issuer,NEW.subject)::text,71));
            SELECT count(*) INTO n FROM memberships WHERE issuer=NEW.issuer AND subject=NEW.subject AND role='owner';
            IF n>=10 THEN RAISE EXCEPTION 'administrative quota reached' USING ERRCODE='54000'; END IF;
        END IF;
        IF EXISTS(SELECT 1 FROM memberships WHERE organization_id=NEW.organization_id AND issuer=NEW.issuer AND subject=NEW.subject) THEN RETURN NEW; END IF;
    ELSIF TG_TABLE_NAME='projects' THEN bucket:=NEW.organization_id::text; val:=bucket; clause:='organization_id::text=$1'; SELECT max_projects INTO cap FROM organization_quotas WHERE organization_id=NEW.organization_id;
    ELSIF TG_TABLE_NAME='admin_sessions' THEN
        PERFORM pg_advisory_xact_lock(4122026007);
        SELECT count(*) INTO n FROM admin_sessions;
        IF n>=10000 THEN RAISE EXCEPTION 'global session quota reached' USING ERRCODE='54000'; END IF;
        bucket:=jsonb_build_array(NEW.issuer,NEW.subject)::text;val:=bucket;clause:='jsonb_build_array(issuer,subject)::text=$1';cap:=128;
    ELSIF TG_TABLE_NAME='audit_events' THEN bucket:=NEW.organization_id::text;val:=bucket;clause:='organization_id::text=$1';cap:=100000;
    ELSIF TG_TABLE_NAME='origin_endpoints' THEN bucket:=NEW.pool_id::text;val:=bucket;clause:='pool_id::text=$1';cap:=100;
    ELSIF TG_TABLE_NAME IN ('resource_revisions','origin_endpoint_revisions','origin_pool_revisions','route_approvals','origin_pool_approvals','route_retirements') THEN
        IF TG_TABLE_NAME='resource_revisions' THEN bucket:=NEW.resource_id::text;clause:='resource_id::text=$1';
        ELSIF TG_TABLE_NAME='origin_endpoint_revisions' THEN bucket:=NEW.endpoint_id::text;clause:='endpoint_id::text=$1';
        ELSIF TG_TABLE_NAME IN ('route_approvals','route_retirements') THEN bucket:=NEW.route_id::text;clause:='route_id::text=$1';
        ELSE bucket:=NEW.pool_id::text;clause:='pool_id::text=$1'; END IF; val:=bucket;
    ELSE
        bucket:=NEW.project_id::text;val:=bucket;clause:='project_id::text=$1';
        SELECT q.max_resources INTO cap FROM projects p JOIN organization_quotas q ON q.organization_id=p.organization_id WHERE p.id=NEW.project_id;
        IF TG_TABLE_NAME IN ('mutation_keys','origin_mutation_keys') THEN cap:=5000; END IF;
        IF TG_TABLE_NAME='domain_verification_jobs' THEN cap:=1000; END IF;
    END IF;
    IF cap IS NULL THEN RAISE EXCEPTION 'administrative quota unavailable' USING ERRCODE='54000'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME||':'||bucket,70));
    IF val IS NULL THEN EXECUTE format('SELECT count(*) FROM %I.%I WHERE %s',TG_TABLE_SCHEMA,TG_TABLE_NAME,clause) INTO n;
    ELSE EXECUTE format('SELECT count(*) FROM %I.%I WHERE %s',TG_TABLE_SCHEMA,TG_TABLE_NAME,clause) INTO n USING val; END IF;
    IF n>=cap THEN RAISE EXCEPTION 'administrative quota reached' USING ERRCODE='54000'; END IF;
    RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
    FOREACH t IN ARRAY ARRAY['organizations','memberships','projects','resources','admin_sessions','audit_events','origin_pools','origin_endpoints','resource_revisions','origin_endpoint_revisions','origin_pool_revisions','route_approvals','origin_pool_approvals','route_retirements','mutation_keys','origin_mutation_keys','domain_verification_jobs'] LOOP
        EXECUTE format('CREATE TRIGGER bounded_state BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION guard_control_quota()',t);
    END LOOP;
END $$;

CREATE FUNCTION retained_audit_change() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE owner_name text; days integer;
BEGIN
    SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid=TG_RELID;
    SELECT audit_retention_days INTO days FROM organization_quotas WHERE organization_id=OLD.organization_id;
    IF TG_OP='DELETE' AND current_user=owner_name AND OLD.at<now()-make_interval(days=>days) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'immutable audit record';
END $$;
DROP TRIGGER immutable_audit ON audit_events;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION retained_audit_change();
CREATE OR REPLACE FUNCTION cleanup_control_state() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path FROM CURRENT AS $$
BEGIN
    DELETE FROM login_attempts WHERE state_hash IN (SELECT state_hash FROM login_attempts WHERE expires_at<=now() LIMIT 1000);
    DELETE FROM admin_sessions WHERE token_hash IN (SELECT token_hash FROM admin_sessions WHERE expires_at<now()-interval '1 day' LIMIT 1000);
    DELETE FROM mutation_keys WHERE ctid IN (SELECT ctid FROM mutation_keys WHERE created_at<now()-interval '7 days' LIMIT 1000);
    DELETE FROM origin_mutation_keys WHERE ctid IN (SELECT ctid FROM origin_mutation_keys WHERE created_at<now()-interval '7 days' LIMIT 1000);
    DELETE FROM domain_verification_jobs WHERE id IN (SELECT id FROM domain_verification_jobs WHERE state IN ('failed','succeeded') AND created_at<now()-interval '7 days' LIMIT 1000);
    DELETE FROM audit_events WHERE sequence IN (SELECT a.sequence FROM audit_events a JOIN organization_quotas q ON q.organization_id=a.organization_id WHERE a.at<now()-make_interval(days=>q.audit_retention_days) ORDER BY a.sequence LIMIT 1000);
END $$;
REVOKE ALL ON FUNCTION cleanup_control_state() FROM PUBLIC;

DO $$ DECLARE trusted_schema text := current_schema(); f text; BEGIN
    FOREACH f IN ARRAY ARRAY['create_organization_quota','guard_control_quota','retained_audit_change','cleanup_control_state'] LOOP
        EXECUTE format('ALTER FUNCTION %I.%I() SET search_path TO pg_catalog,%I,pg_temp',trusted_schema,f,trusted_schema);
    END LOOP;
END $$;
