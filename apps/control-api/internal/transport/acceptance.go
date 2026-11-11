package transport

import (
	"net/http"
	"strconv"

	"aegisgate.dev/aegisgate/apps/control-api/internal/application"
	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"aegisgate.dev/aegisgate/apps/control-api/internal/persistence"
)

func previewRange(r *http.Request) (int64, int64, error) {
	from, e1 := strconv.ParseInt(r.URL.Query().Get("from"), 10, 64)
	to, e2 := strconv.ParseInt(r.URL.Query().Get("to"), 10, 64)
	if e1 != nil || e2 != nil || from < 1 || to < from {
		return 0, 0, domain.ErrInvalid
	}
	return from, to, nil
}
func etag(w http.ResponseWriter, generation int64) {
	w.Header().Set("ETag", strconv.Quote(strconv.FormatInt(generation, 10)))
}

func (h *adminHandler) registerAcceptance() {
	h.protected("GET /v1/organizations/{org}/audit", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		after, limit, err := pagination(r)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		var seq int64
		if after != "" {
			seq, err = strconv.ParseInt(after, 10, 64)
			if err != nil {
				h.fail(w, r, domain.ErrInvalid)
				return
			}
		}
		v, err := h.config.Service.Store.OrganizationAudit(r.Context(), p, r.PathValue("org"), seq, limit)
		h.result(w, r, v, err)
	})
	h.protected("POST /v1/projects/{project}/domains/{id}/reverify", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		expected, err := revision(r)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		v, err := h.config.Service.Store.ReverifyDomain(r.Context(), p, r.PathValue("project"), r.PathValue("id"), expected)
		if err == nil {
			etag(w, v.Generation)
		}
		h.result(w, r, v, err)
	})
	h.protected("POST /v1/projects/{project}/routes/{id}/retire", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		expected, err := revision(r)
		if err == nil {
			err = h.config.Service.Store.RetireRoute(r.Context(), p, r.PathValue("project"), r.PathValue("id"), expected)
		}
		h.result(w, r, map[string]string{"status": "retired"}, err)
	})
	base := "/v1/projects/{project}/origin-pools"
	h.protected("GET "+base, func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		after, limit, err := pagination(r)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		v, err := h.config.Service.Store.ListOriginPools(r.Context(), p, r.PathValue("project"), after, limit)
		h.result(w, r, v, err)
	})
	h.protected("POST "+base, func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		var input struct {
			Name string `json:"name"`
		}
		raw, err := body(w, r)
		if err != nil || application.Decode(raw, &input) != nil {
			h.fail(w, r, domain.ErrInvalid)
			return
		}
		v, err := h.config.Service.Store.CreateOriginPool(r.Context(), p, r.PathValue("project"), input.Name, r.Header.Get("Idempotency-Key"))
		if err == nil {
			etag(w, v.Generation)
		}
		h.result(w, r, v, err)
	})
	h.protected("GET "+base+"/{pool}", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		v, err := h.config.Service.Store.OriginPool(r.Context(), p, r.PathValue("project"), r.PathValue("pool"))
		if err == nil {
			etag(w, v.Pool.Generation)
		}
		h.result(w, r, v, err)
	})
	h.protected("PUT "+base+"/{pool}", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		var input struct {
			Name  string `json:"name"`
			State string `json:"state"`
		}
		raw, err := body(w, r)
		if err != nil || application.Decode(raw, &input) != nil {
			h.fail(w, r, domain.ErrInvalid)
			return
		}
		expected, err := revision(r)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		v, err := h.config.Service.Store.ReviseOriginPool(r.Context(), p, r.PathValue("project"), r.PathValue("pool"), input.Name, input.State, expected)
		if err == nil {
			etag(w, v.Pool.Generation)
		}
		h.result(w, r, v, err)
	})
	h.protected("POST "+base+"/{pool}/approve", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		expected, err := revision(r)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		v, err := h.config.Service.Store.ApproveOriginPool(r.Context(), p, r.PathValue("project"), r.PathValue("pool"), expected)
		h.result(w, r, v, err)
	})
	h.protected("GET "+base+"/{pool}/revisions/{generation}", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		generation, err := strconv.ParseInt(r.PathValue("generation"), 10, 64)
		if err != nil || generation < 1 {
			h.fail(w, r, domain.ErrInvalid)
			return
		}
		v, err := h.config.Service.Store.OriginPoolRevision(r.Context(), p, r.PathValue("project"), r.PathValue("pool"), generation)
		h.result(w, r, v, err)
	})
	h.protected("GET "+base+"/{pool}/preview", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		from, to, err := previewRange(r)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		v, err := h.config.Service.Store.PoolPreview(r.Context(), p, r.PathValue("project"), r.PathValue("pool"), from, to)
		h.result(w, r, v, err)
	})
	h.protected("GET "+base+"/{pool}/endpoints", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		after, limit, err := pagination(r)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		v, err := h.config.Service.Store.Endpoints(r.Context(), p, r.PathValue("project"), r.PathValue("pool"), after, limit)
		h.result(w, r, v, err)
	})
	h.protected("POST "+base+"/{pool}/endpoints", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		var input struct {
			URL string `json:"url"`
		}
		raw, err := body(w, r)
		if err != nil || application.Decode(raw, &input) != nil {
			h.fail(w, r, domain.ErrInvalid)
			return
		}
		expected, err := revision(r)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		v, err := h.config.Service.Store.CreateEndpoint(r.Context(), p, r.PathValue("project"), r.PathValue("pool"), input.URL, r.Header.Get("Idempotency-Key"), expected, h.config.Service.Resolver)
		if err == nil {
			etag(w, v.Generation)
		}
		h.result(w, r, v, err)
	})
	h.protected("GET "+base+"/{pool}/endpoints/{endpoint}", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		v, err := h.config.Service.Store.Endpoint(r.Context(), p, r.PathValue("project"), r.PathValue("pool"), r.PathValue("endpoint"), 0)
		if err == nil {
			etag(w, v.Generation)
		}
		h.result(w, r, v, err)
	})
	h.protected("GET "+base+"/{pool}/endpoints/{endpoint}/revisions/{generation}", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		generation, err := strconv.ParseInt(r.PathValue("generation"), 10, 64)
		if err != nil || generation < 1 {
			h.fail(w, r, domain.ErrInvalid)
			return
		}
		v, err := h.config.Service.Store.Endpoint(r.Context(), p, r.PathValue("project"), r.PathValue("pool"), r.PathValue("endpoint"), generation)
		h.result(w, r, v, err)
	})
	h.protected("PUT "+base+"/{pool}/endpoints/{endpoint}", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		var input struct {
			URL   string `json:"url"`
			State string `json:"state"`
		}
		raw, err := body(w, r)
		if err != nil || application.Decode(raw, &input) != nil {
			h.fail(w, r, domain.ErrInvalid)
			return
		}
		expected, err := revision(r)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		v, err := h.config.Service.Store.ReviseEndpoint(r.Context(), p, r.PathValue("project"), r.PathValue("pool"), r.PathValue("endpoint"), input.URL, input.State, expected, h.config.Service.Resolver)
		if err == nil {
			etag(w, v.Generation)
		}
		h.result(w, r, v, err)
	})
}
