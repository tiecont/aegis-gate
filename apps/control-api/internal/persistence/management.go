package persistence

import (
	"context"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
)

func (s *Store) Authorize(ctx context.Context, p Principal, project, kind string) error {
	if action(kind) == "invalid" {
		return domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return opaque(err)
	}
	defer tx.Rollback(ctx)
	_, err = scoped(ctx, tx, p, project, action(kind))
	return err
}

type Organization struct {
	ID   string      `json:"id"`
	Name string      `json:"name"`
	Role domain.Role `json:"role"`
}
type Project struct {
	ID             string `json:"id"`
	OrganizationID string `json:"organization_id"`
	Name           string `json:"name"`
}

func (s *Store) Organizations(ctx context.Context, p Principal, after string, limit int) ([]Organization, error) {
	if !p.valid() || limit < 1 || limit > 100 {
		return nil, domain.ErrInvalid
	}
	if after == "" {
		after = "00000000-0000-0000-0000-000000000000"
	}
	rows, err := s.pool.Query(ctx, `SELECT o.id,o.name,m.role FROM organizations o JOIN memberships m ON m.organization_id=o.id
		WHERE m.issuer=$1 AND m.subject=$2 AND m.active AND o.status='active' AND o.id>$3 ORDER BY o.id LIMIT $4`, p.Issuer, p.Subject, after, limit)
	if err != nil {
		return nil, opaque(err)
	}
	defer rows.Close()
	items := []Organization{}
	for rows.Next() {
		var item Organization
		if err = rows.Scan(&item.ID, &item.Name, &item.Role); err != nil {
			return nil, opaque(err)
		}
		items = append(items, item)
	}
	return items, opaque(rows.Err())
}

func (s *Store) Projects(ctx context.Context, p Principal, org, after string, limit int) ([]Project, error) {
	if limit < 1 || limit > 100 {
		return nil, domain.ErrInvalid
	}
	if after == "" {
		after = "00000000-0000-0000-0000-000000000000"
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = orgRole(ctx, tx, p, org); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, "SELECT id,organization_id,name FROM projects WHERE organization_id=$1 AND status='active' AND id>$2 ORDER BY id LIMIT $3", org, after, limit)
	if err != nil {
		return nil, opaque(err)
	}
	defer rows.Close()
	items := []Project{}
	for rows.Next() {
		var item Project
		if err = rows.Scan(&item.ID, &item.OrganizationID, &item.Name); err != nil {
			return nil, opaque(err)
		}
		items = append(items, item)
	}
	return items, opaque(rows.Err())
}

func (s *Store) RevokeMember(ctx context.Context, p Principal, org string, member Principal) error {
	if !member.valid() || p == member {
		return domain.ErrDenied
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return opaque(err)
	}
	defer tx.Rollback(ctx)
	role, err := orgRole(ctx, tx, p, org)
	if err != nil || !role.Allows("members") {
		return domain.ErrDenied
	}
	command, err := tx.Exec(ctx, "UPDATE memberships SET active=false WHERE organization_id=$1 AND issuer=$2 AND subject=$3 AND role<>'owner'", org, member.Issuer, member.Subject)
	if err != nil {
		return opaque(err)
	}
	if command.RowsAffected() != 1 {
		return domain.ErrDenied
	}
	if _, err = tx.Exec(ctx, `INSERT INTO audit_events(organization_id,issuer,subject,action,outcome)VALUES($1,$2,$3,'membership_revoke','allowed')`, org, p.Issuer, p.Subject); err != nil {
		return opaque(err)
	}
	return opaque(tx.Commit(ctx))
}

type AuditEvent struct {
	Sequence int64     `json:"sequence"`
	Action   string    `json:"action"`
	Outcome  string    `json:"outcome"`
	At       time.Time `json:"at"`
}

func (s *Store) Audit(ctx context.Context, p Principal, project string, after int64, limit int) ([]AuditEvent, error) {
	if after < 0 || limit < 1 || limit > 100 {
		return nil, domain.ErrInvalid
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, opaque(err)
	}
	defer tx.Rollback(ctx)
	if _, err = scoped(ctx, tx, p, project, "read"); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, "SELECT sequence,action,outcome,at FROM audit_events WHERE project_id=$1 AND sequence>$2 ORDER BY sequence LIMIT $3", project, after, limit)
	if err != nil {
		return nil, opaque(err)
	}
	defer rows.Close()
	items := []AuditEvent{}
	for rows.Next() {
		var item AuditEvent
		if err = rows.Scan(&item.Sequence, &item.Action, &item.Outcome, &item.At); err != nil {
			return nil, opaque(err)
		}
		items = append(items, item)
	}
	return items, opaque(rows.Err())
}

// AuditDenied records only server-defined action names and authenticated actor
// identity. Neither request bodies nor attacker-supplied descriptions are stored.
func (s *Store) AuditDenied(ctx context.Context, p Principal, project string) error {
	if !p.valid() {
		return domain.ErrDenied
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO audit_events(organization_id,project_id,issuer,subject,action,outcome)
		SELECT organization_id,id,$2,$3,'management_denied','denied' FROM projects WHERE id=$1`, project, p.Issuer, p.Subject)
	return opaque(err)
}
