// Package publication exposes only the approved publisher queue to the separate
// config-publisher executable. Management authorization stays inside control-api.
package publication

import (
	"aegisgate.dev/aegisgate/apps/control-api/internal/persistence"
	"aegisgate.dev/aegisgate/internal/configpublish"
	"context"
)

type Runtime struct{ s *persistence.Store }

func Open(ctx context.Context, dsn string) (*Runtime, error) {
	s, err := persistence.Open(ctx, dsn)
	if err != nil {
		return nil, err
	}
	if err = s.RequireRuntimeRole(ctx); err != nil {
		s.Close()
		return nil, err
	}
	return &Runtime{s}, nil
}
func (r *Runtime) Queue() configpublish.Queue { return r.s.PublicationQueue() }
func (r *Runtime) Close()                     { r.s.Close() }
