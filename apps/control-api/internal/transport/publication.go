package transport

import (
	"net/http"
	"regexp"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/application"
	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"aegisgate.dev/aegisgate/apps/control-api/internal/persistence"
)

var publicationDigest = regexp.MustCompile(`^[0-9a-f]{64}$`)

func (h *adminHandler) registerPublication() {
	base := "/v1/projects/{project}/publications"
	h.protected("GET "+base+"/preview", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		v, err := h.config.Service.Store.PreviewPublication(r.Context(), p, r.PathValue("project"))
		h.result(w, r, v, err)
	})
	h.protected("POST "+base, func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		var input struct {
			Digest     string `json:"digest"`
			TTLSeconds int64  `json:"ttl_seconds"`
		}
		raw, err := body(w, r)
		if err != nil || application.Decode(raw, &input) != nil || !publicationDigest.MatchString(input.Digest) || input.TTLSeconds < 60 || input.TTLSeconds > 86400 || len(r.Header.Values("Idempotency-Key")) != 1 {
			h.fail(w, r, domain.ErrInvalid)
			return
		}
		v, err := h.config.Service.Store.ApprovePublication(r.Context(), p, r.PathValue("project"), r.Header.Get("Idempotency-Key"), input.Digest, time.Duration(input.TTLSeconds)*time.Second)
		h.result(w, r, v, err)
	})
	h.protected("POST "+base+"/rollback", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		var input struct {
			Generation uint64 `json:"generation"`
			TTLSeconds int64  `json:"ttl_seconds"`
		}
		raw, err := body(w, r)
		if err != nil || application.Decode(raw, &input) != nil || input.Generation == 0 || input.Generation > 9007199254740991 || input.TTLSeconds < 60 || input.TTLSeconds > 86400 || len(r.Header.Values("Idempotency-Key")) != 1 {
			h.fail(w, r, domain.ErrInvalid)
			return
		}
		v, err := h.config.Service.Store.RollbackPublication(r.Context(), p, r.PathValue("project"), r.Header.Get("Idempotency-Key"), input.Generation, time.Duration(input.TTLSeconds)*time.Second)
		h.result(w, r, v, err)
	})
}
