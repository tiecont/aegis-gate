package persistence

import (
	"context"
	"errors"
	"regexp"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"aegisgate.dev/aegisgate/apps/control-api/internal/identity"
	"github.com/jackc/pgx/v5"
)

type authenticationKey struct{}

// WithVerifiedLogin is called only after the IdP token has passed signature,
// issuer/audience/nonce/time checks, or after loading its server-side session.
func WithVerifiedLogin(ctx context.Context, login identity.Login) context.Context {
	return context.WithValue(ctx, authenticationKey{}, login)
}

func recentMFA(ctx context.Context, p Principal) bool {
	l, ok := ctx.Value(authenticationKey{}).(identity.Login)
	now := time.Now()
	return ok && l.Issuer == p.Issuer && l.Subject == p.Subject && !l.MFAAt.IsZero() && !l.MFAAt.After(now.Add(30*time.Second)) && now.Sub(l.MFAAt) <= 5*time.Minute
}

func denied(ctx context.Context, tx pgx.Tx, p Principal, org, project, action string) error {
	if !p.valid() {
		return domain.ErrDenied
	}
	var err error
	if project != "" {
		_, err = tx.Exec(ctx, `INSERT INTO audit_events(organization_id,project_id,issuer,subject,action,outcome)
			SELECT organization_id,id,$2,$3,$4,'denied' FROM projects WHERE id=$1`, project, p.Issuer, p.Subject, action)
	} else {
		_, err = tx.Exec(ctx, `INSERT INTO audit_events(organization_id,issuer,subject,action,outcome)
			SELECT id,$2,$3,$4,'denied' FROM organizations WHERE id=$1`, org, p.Issuer, p.Subject, action)
	}
	if err != nil {
		return opaque(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return opaque(err)
	}
	return domain.ErrDenied
}

func sensitive(ctx context.Context, tx pgx.Tx, p Principal, org, project, action string) error {
	if !recentMFA(ctx, p) {
		return denied(ctx, tx, p, org, project, action)
	}
	return nil
}

var roleName = regexp.MustCompile(`^[a-z][a-z0-9_]{1,62}$`)

// GrantRoles runs through the migration owner connection. The operator creates
// distinct LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE roles separately.
func (s *Store) GrantRoles(ctx context.Context, runtime, maintenance string) error {
	if !roleName.MatchString(runtime) || !roleName.MatchString(maintenance) || runtime == maintenance {
		return domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return opaque(err)
	}
	defer tx.Rollback(ctx)
	var schema, owner string
	if err = tx.QueryRow(ctx, "SELECT current_schema(),current_user").Scan(&schema, &owner); err != nil {
		return opaque(err)
	}
	for _, role := range []string{runtime, maintenance} {
		var safe bool
		if err = tx.QueryRow(ctx, `SELECT NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit AND rolcanlogin AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid) FROM pg_roles WHERE rolname=$1`, role).Scan(&safe); err != nil || !safe || role == owner {
			return domain.ErrDenied
		}
	}
	qSchema := pgx.Identifier{schema}.Sanitize()
	qRun := pgx.Identifier{runtime}.Sanitize()
	qMaint := pgx.Identifier{maintenance}.Sanitize()
	if _, err = tx.Exec(ctx, "REVOKE ALL ON SCHEMA "+qSchema+" FROM PUBLIC"); err != nil {
		return opaque(err)
	}
	for _, role := range []string{qRun, qMaint} {
		if _, err = tx.Exec(ctx, "GRANT USAGE ON SCHEMA "+qSchema+" TO "+role); err != nil {
			return opaque(err)
		}
	}
	for _, table := range []string{"organizations", "memberships", "projects", "resources", "domain_claims", "route_bindings", "admin_sessions", "domain_verification_jobs", "origin_pools", "origin_endpoints", "active_route_approvals"} {
		if _, err = tx.Exec(ctx, "GRANT SELECT,INSERT,UPDATE ON "+qSchema+"."+pgx.Identifier{table}.Sanitize()+" TO "+qRun); err != nil {
			return opaque(err)
		}
	}
	for _, table := range []string{"resource_revisions", "mutation_keys", "audit_events", "route_approvals", "origin_endpoint_revisions", "origin_pool_revisions", "origin_pool_approvals", "origin_mutation_keys", "route_retirements"} {
		if _, err = tx.Exec(ctx, "GRANT SELECT,INSERT ON "+qSchema+"."+pgx.Identifier{table}.Sanitize()+" TO "+qRun); err != nil {
			return opaque(err)
		}
	}
	if _, err = tx.Exec(ctx, "GRANT SELECT ON "+qSchema+".organization_quotas TO "+qRun); err != nil {
		return opaque(err)
	}
	if _, err = tx.Exec(ctx, "GRANT SELECT,INSERT,DELETE ON "+qSchema+".login_attempts TO "+qRun); err != nil {
		return opaque(err)
	}
	if _, err = tx.Exec(ctx, "GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA "+qSchema+" TO "+qRun); err != nil {
		return opaque(err)
	}
	if _, err = tx.Exec(ctx, "GRANT EXECUTE ON FUNCTION "+qSchema+".cleanup_control_state() TO "+qMaint); err != nil {
		return opaque(err)
	}
	return opaque(tx.Commit(ctx))
}

func (s *Store) RequireRuntimeRole(ctx context.Context) error {
	var safe bool
	err := s.pool.QueryRow(ctx, `SELECT NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication AND NOT r.rolbypassrls AND NOT r.rolinherit
		AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
		AND NOT EXISTS(SELECT 1 FROM pg_class WHERE relowner=r.oid)
		AND NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=r.oid)
		AND NOT EXISTS(SELECT 1 FROM pg_proc WHERE proowner=r.oid)
		AND NOT EXISTS(SELECT 1 FROM pg_database WHERE datdba=r.oid)
		AND NOT has_schema_privilege(current_user,current_schema(),'CREATE')
		AND NOT EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname !~ '^pg_' AND has_schema_privilege(current_user,n.oid,'CREATE'))
		AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relkind IN ('r','p') AND (has_table_privilege(current_user,c.oid,'DELETE') AND c.relname<>'login_attempts' OR has_table_privilege(current_user,c.oid,'TRUNCATE,TRIGGER,REFERENCES')))
		AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relname IN ('resource_revisions','audit_events','route_approvals','origin_endpoint_revisions','origin_pool_revisions','origin_pool_approvals','route_retirements','organization_quotas','aegis_migrations') AND has_table_privilege(current_user,c.oid,'UPDATE'))
		AND NOT has_function_privilege(current_user,current_schema()||'.cleanup_control_state()','EXECUTE')
		FROM pg_roles r WHERE r.rolname=current_user`).Scan(&safe)
	if err != nil {
		return errors.New("runtime privilege verification unavailable")
	}
	if !safe {
		return errors.New("least-privilege runtime role required")
	}
	return nil
}

func (s *Store) Cleanup(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, "SELECT cleanup_control_state()")
	return opaque(err)
}
