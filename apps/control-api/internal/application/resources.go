package application

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"aegisgate.dev/aegisgate/apps/control-api/internal/persistence"
)

type Service struct {
	Store    *persistence.Store
	Resolver domain.Resolver
}

func Decode(raw []byte, target any) error {
	if len(raw) == 0 || len(raw) > 16384 {
		return domain.ErrInvalid
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return domain.ErrInvalid
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return domain.ErrInvalid
	}
	return nil
}

func (s *Service) validated(ctx context.Context, kind string, raw []byte) (json.RawMessage, error) {
	switch kind {
	case "origin":
		var spec struct {
			URL string `json:"url"`
		}
		if Decode(raw, &spec) != nil {
			return nil, domain.ErrInvalid
		}
		ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
		defer cancel()
		canonical, err := domain.Origin(ctx, spec.URL, s.Resolver)
		if err != nil {
			return nil, err
		}
		spec.URL = canonical
		return json.Marshal(spec)
	case "policy":
		var spec domain.Policy
		if Decode(raw, &spec) != nil || spec.Validate() != nil {
			return nil, domain.ErrInvalid
		}
		return json.Marshal(spec)
	default:
		return nil, domain.ErrInvalid
	}
}

func (s *Service) Create(ctx context.Context, p persistence.Principal, project, kind, key string, raw []byte) (persistence.Resource, error) {
	if kind == "route" {
		var spec persistence.RouteSpec
		if Decode(raw, &spec) != nil {
			return persistence.Resource{}, domain.ErrInvalid
		}
		return s.Store.CreateRouteDraft(ctx, p, project, key, spec)
	}
	// Authorize before DNS work; an unauthorized caller cannot use origin
	// validation as a DNS side channel for another tenant's project.
	if err := s.Store.Authorize(ctx, p, project, kind); err != nil {
		return persistence.Resource{}, err
	}
	spec, err := s.validated(ctx, kind, raw)
	if err != nil {
		return persistence.Resource{}, err
	}
	return s.Store.CreateDraft(ctx, p, project, kind, key, spec)
}

func (s *Service) Revise(ctx context.Context, p persistence.Principal, project, kind, id string, expected int64, raw []byte) (persistence.Resource, error) {
	if kind == "route" {
		var spec persistence.RouteSpec
		if Decode(raw, &spec) != nil {
			return persistence.Resource{}, domain.ErrInvalid
		}
		return s.Store.ReviseRouteDraft(ctx, p, project, id, expected, spec)
	}
	if err := s.Store.Authorize(ctx, p, project, kind); err != nil {
		return persistence.Resource{}, err
	}
	spec, err := s.validated(ctx, kind, raw)
	if err != nil {
		return persistence.Resource{}, err
	}
	return s.Store.Revise(ctx, p, project, kind, id, expected, spec)
}
