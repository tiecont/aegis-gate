package transport

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"aegisgate.dev/aegisgate/apps/control-api/internal/application"
	"aegisgate.dev/aegisgate/apps/control-api/internal/domain"
	"aegisgate.dev/aegisgate/apps/control-api/internal/identity"
	"aegisgate.dev/aegisgate/apps/control-api/internal/persistence"
	"aegisgate.dev/aegisgate/internal/contracts"
)

const sessionCookie = "__Host-aegis-session"
const csrfCookie = "__Host-aegis-csrf"
const loginCookie = "__Host-aegis-login"

type AdminConfig struct {
	Service  *application.Service
	Identity *identity.Verifier
	Origin   string
	DNS      persistence.TXTResolver
}

type window struct {
	start time.Time
	count int
}
type adminHandler struct {
	config    AdminConfig
	mux       *http.ServeMux
	authority string
	mu        sync.Mutex
	limits    map[string]window
}

func NewAdminHandler(config AdminConfig) (http.Handler, error) {
	u, err := url.Parse(config.Origin)
	if err != nil || u.Scheme != "https" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "" || u.Opaque != "" || net.ParseIP(u.Hostname()) == nil || !net.ParseIP(u.Hostname()).IsLoopback() || config.Service == nil || config.Service.Store == nil || config.Identity == nil {
		return nil, errors.New("local management requires explicit HTTPS loopback origin, persistence and OIDC")
	}
	h := &adminHandler{config: config, mux: http.NewServeMux(), authority: u.Host, limits: make(map[string]window)}
	h.mux.HandleFunc("GET /v1/login", h.login)
	h.mux.HandleFunc("GET /v1/callback", h.callback)
	h.protected("GET /v1/session", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) { h.write(w, 200, p) })
	h.protected("POST /v1/logout", h.logout)
	h.protected("GET /v1/organizations", h.organizations)
	h.protected("POST /v1/organizations", h.organizations)
	h.protected("GET /v1/organizations/{org}/projects", h.projects)
	h.protected("POST /v1/organizations/{org}/projects", h.projects)
	h.protected("POST /v1/organizations/{org}/members", h.members)
	h.protected("POST /v1/organizations/{org}/members/revoke", h.members)
	h.protected("GET /v1/projects/{project}/audit", h.audit)
	h.registerAcceptance()
	h.registerPublication()
	h.protected("POST /v1/projects/{project}/domains/{id}/verifications", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		job, err := h.config.Service.Store.QueueDomainVerification(r.Context(), p, r.PathValue("project"), r.PathValue("id"))
		h.result(w, r, job, err)
	})
	h.protected("GET /v1/projects/{project}/domain-verifications/{id}", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		job, err := h.config.Service.Store.VerificationJob(r.Context(), p, r.PathValue("project"), r.PathValue("id"))
		h.result(w, r, job, err)
	})
	for plural, kind := range map[string]string{"domains": "domain", "origins": "origin", "policies": "policy", "routes": "route"} {
		base := "/v1/projects/{project}/" + plural
		h.protected("GET "+base, func(w http.ResponseWriter, r *http.Request, p persistence.Principal) { h.resources(w, r, p, kind) })
		h.protected("POST "+base, func(w http.ResponseWriter, r *http.Request, p persistence.Principal) { h.resources(w, r, p, kind) })
		h.protected("GET "+base+"/{id}", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) { h.resource(w, r, p, kind) })
		if kind != "domain" {
			h.protected("PUT "+base+"/{id}", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) { h.resource(w, r, p, kind) })
			h.protected("GET "+base+"/{id}/preview", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
				from, to, err := previewRange(r)
				if err != nil {
					h.fail(w, r, err)
					return
				}
				v, err := h.config.Service.Store.Preview(r.Context(), p, r.PathValue("project"), kind, r.PathValue("id"), from, to)
				h.result(w, r, v, err)
			})
		}
		h.protected("GET "+base+"/{id}/revisions/{generation}", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
			generation, err := strconv.ParseInt(r.PathValue("generation"), 10, 64)
			if err != nil {
				h.fail(w, r, domain.ErrInvalid)
				return
			}
			item, err := h.config.Service.Store.Revision(r.Context(), p, r.PathValue("project"), kind, r.PathValue("id"), generation)
			h.result(w, r, item, err)
		})
	}
	h.protected("POST /v1/projects/{project}/routes/{id}/approve", func(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
		expected, err := revision(r)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		item, err := h.config.Service.Store.ApproveRoute(r.Context(), p, r.PathValue("project"), r.PathValue("id"), expected)
		h.result(w, r, item, err)
	})
	return h, nil
}

func (h *adminHandler) allow(key string, max int) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := time.Now()
	for id, value := range h.limits {
		if now.Sub(value.start) >= time.Minute {
			delete(h.limits, id)
		}
	}
	value, exists := h.limits[key]
	if !exists {
		if len(h.limits) >= 4096 {
			return false
		}
		value.start = now
	}
	if value.count >= max {
		return false
	}
	value.count++
	h.limits[key] = value
	return true
}

func (h *adminHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	id, err := contracts.RequestID()
	if err != nil {
		http.Error(w, "unavailable", 503)
		return
	}
	w.Header().Set("X-Request-ID", id)
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
	w.Header().Set("Referrer-Policy", "no-referrer")
	if r.TLS == nil || r.Host != h.authority {
		h.fail(w, r, domain.ErrDenied)
		return
	}
	if r.Method == http.MethodOptions {
		h.fail(w, r, domain.ErrDenied)
		return
	}
	h.mux.ServeHTTP(w, r)
}

func (h *adminHandler) protected(pattern string, next func(http.ResponseWriter, *http.Request, persistence.Principal)) {
	h.mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
		token := uniqueCookie(r, sessionCookie)
		ctx, p, err := h.config.Service.Store.SessionContext(r.Context(), token)
		if err != nil {
			h.error(w, "authentication_required", 401)
			return
		}
		r = r.WithContext(ctx)
		if !h.allow(p.Issuer+"\x00"+p.Subject, 120) {
			w.Header().Set("Retry-After", "60")
			h.error(w, "rate_limited", 429)
			return
		}
		if r.Method != "GET" && r.Method != "HEAD" {
			if len(r.Header.Values("Origin")) != 1 || r.Header.Get("Origin") != h.config.Origin || len(r.Header.Values("X-CSRF-Token")) != 1 || h.config.Service.Store.CheckCSRF(r.Context(), token, r.Header.Get("X-CSRF-Token")) != nil {
				_ = h.config.Service.Store.AuditRequestDenied(r.Context(), p, r.PathValue("org"), r.PathValue("project"))
				h.fail(w, r, domain.ErrDenied)
				return
			}
		}
		next(w, r, p)
	})
}

func uniqueCookie(r *http.Request, name string) string {
	var value string
	count := 0
	for _, cookie := range r.Cookies() {
		if cookie.Name == name {
			value = cookie.Value
			count++
		}
	}
	if count != 1 {
		return ""
	}
	return value
}
func (h *adminHandler) write(w http.ResponseWriter, status int, value any) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func (h *adminHandler) error(w http.ResponseWriter, code string, status int) {
	h.write(w, status, contracts.ErrorEnvelope{Error: contracts.ErrorDetail{Code: code, Message: "Request unavailable", RequestID: w.Header().Get("X-Request-ID")}})
}
func (h *adminHandler) fail(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, domain.ErrInvalid):
		h.error(w, "invalid_resource", 400)
	case errors.Is(err, domain.ErrDenied):
		h.error(w, "not_found", 404)
	case errors.Is(err, domain.ErrConflict):
		h.error(w, "resource_conflict", 409)
	default:
		h.error(w, "unavailable", 503)
	}
}
func (h *adminHandler) result(w http.ResponseWriter, r *http.Request, value any, err error) {
	if err != nil {
		if r.PathValue("project") != "" {
			token := uniqueCookie(r, sessionCookie)
			if p, e := h.config.Service.Store.Session(r.Context(), token); e == nil {
				_ = h.config.Service.Store.AuditDenied(r.Context(), p, r.PathValue("project"))
			}
		}
		h.fail(w, r, err)
		return
	}
	h.write(w, 200, value)
}
func body(w http.ResponseWriter, r *http.Request) ([]byte, error) {
	media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || media != "application/json" {
		return nil, domain.ErrInvalid
	}
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 16384))
	if err != nil {
		return nil, domain.ErrInvalid
	}
	return raw, nil
}
func pagination(r *http.Request) (string, int, error) {
	limit := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 100 {
			return "", 0, domain.ErrInvalid
		}
		limit = value
	}
	return r.URL.Query().Get("after"), limit, nil
}
func revision(r *http.Request) (int64, error) {
	raw := r.Header.Get("If-Match")
	if len(raw) < 3 || raw[0] != '"' || raw[len(raw)-1] != '"' {
		return 0, domain.ErrInvalid
	}
	value, err := strconv.ParseInt(raw[1:len(raw)-1], 10, 64)
	if err != nil || value < 1 {
		return 0, domain.ErrInvalid
	}
	return value, nil
}
func setCookie(w http.ResponseWriter, name, value string, httpOnly bool, expiry time.Time) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: value, Path: "/", Secure: true, HttpOnly: httpOnly, SameSite: http.SameSiteLaxMode, Expires: expiry, MaxAge: int(time.Until(expiry).Seconds())})
}
func clearCookie(w http.ResponseWriter, name string) {
	http.SetCookie(w, &http.Cookie{Name: name, Path: "/", Secure: true, HttpOnly: name != csrfCookie, SameSite: http.SameSiteLaxMode, MaxAge: -1})
}

func (h *adminHandler) login(w http.ResponseWriter, r *http.Request) {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil || !h.allow("login:"+ip, 10) {
		h.error(w, "rate_limited", 429)
		return
	}
	attempt, err := h.config.Service.Store.BeginLogin(r.Context())
	if err != nil {
		h.fail(w, r, err)
		return
	}
	location, err := h.config.Identity.AuthorizationURL(h.config.Origin+"/v1/callback", attempt.State, attempt.Nonce, attempt.Verifier)
	if err != nil {
		h.error(w, "login_unavailable", 503)
		return
	}
	setCookie(w, loginCookie, attempt.Browser, true, time.Now().Add(5*time.Minute))
	http.Redirect(w, r, location, 302)
}
func (h *adminHandler) callback(w http.ResponseWriter, r *http.Request) {
	query, parseErr := url.ParseQuery(r.URL.RawQuery)
	if parseErr != nil || len(r.URL.RawQuery) > 8192 || len(query["state"]) != 1 || len(query["code"]) != 1 || len(query["error"]) != 0 {
		h.error(w, "login_unavailable", 401)
		return
	}
	attempt, err := h.config.Service.Store.ConsumeLogin(r.Context(), query.Get("state"), uniqueCookie(r, loginCookie))
	clearCookie(w, loginCookie)
	if err != nil {
		h.error(w, "login_unavailable", 401)
		return
	}
	login, err := h.config.Identity.Exchange(r.Context(), h.config.Origin+"/v1/callback", query.Get("code"), attempt.Verifier, attempt.Nonce)
	if err != nil {
		h.error(w, "login_unavailable", 401)
		return
	}
	token, csrf, err := h.config.Service.Store.CreateWebSession(persistence.WithVerifiedLogin(r.Context(), login), persistence.Principal{Issuer: login.Issuer, Subject: login.Subject}, login.ExpiresAt)
	if err != nil {
		h.error(w, "login_unavailable", 503)
		return
	}
	setCookie(w, sessionCookie, token, true, login.ExpiresAt)
	setCookie(w, csrfCookie, csrf, false, login.ExpiresAt)
	h.write(w, 200, map[string]string{"status": "authenticated"})
}
func (h *adminHandler) logout(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
	if err := h.config.Service.Store.RevokeSession(r.Context(), p, uniqueCookie(r, sessionCookie)); err != nil {
		h.fail(w, r, err)
		return
	}
	clearCookie(w, sessionCookie)
	clearCookie(w, csrfCookie)
	h.write(w, 200, map[string]string{"status": "revoked"})
}

func (h *adminHandler) organizations(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
	if r.Method == "GET" {
		after, limit, err := pagination(r)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		items, err := h.config.Service.Store.Organizations(r.Context(), p, after, limit)
		h.result(w, r, items, err)
		return
	}
	raw, err := body(w, r)
	var input struct {
		Name string `json:"name"`
	}
	if err != nil || application.Decode(raw, &input) != nil {
		h.fail(w, r, domain.ErrInvalid)
		return
	}
	id, err := h.config.Service.Store.CreateOrganization(r.Context(), p, input.Name)
	h.result(w, r, map[string]string{"id": id}, err)
}
func (h *adminHandler) projects(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
	if r.Method == "GET" {
		after, limit, err := pagination(r)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		items, err := h.config.Service.Store.Projects(r.Context(), p, r.PathValue("org"), after, limit)
		h.result(w, r, items, err)
		return
	}
	raw, err := body(w, r)
	var input struct {
		Name string `json:"name"`
	}
	if err != nil || application.Decode(raw, &input) != nil {
		h.fail(w, r, domain.ErrInvalid)
		return
	}
	id, err := h.config.Service.Store.CreateProject(r.Context(), p, r.PathValue("org"), input.Name)
	h.result(w, r, map[string]string{"id": id}, err)
}
func (h *adminHandler) members(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
	raw, err := body(w, r)
	var input struct {
		Issuer  string      `json:"issuer"`
		Subject string      `json:"subject"`
		Role    domain.Role `json:"role,omitempty"`
	}
	if err != nil || application.Decode(raw, &input) != nil {
		h.fail(w, r, domain.ErrInvalid)
		return
	}
	member := persistence.Principal{Issuer: input.Issuer, Subject: input.Subject}
	if strings.HasSuffix(r.URL.Path, "/revoke") {
		err = h.config.Service.Store.RevokeMember(r.Context(), p, r.PathValue("org"), member)
	} else {
		err = h.config.Service.Store.AddMember(r.Context(), p, r.PathValue("org"), member, input.Role)
	}
	h.result(w, r, map[string]string{"status": "updated"}, err)
}
func (h *adminHandler) audit(w http.ResponseWriter, r *http.Request, p persistence.Principal) {
	after, limit, err := pagination(r)
	var sequence int64
	if after != "" {
		sequence, err = strconv.ParseInt(after, 10, 64)
	}
	if err != nil {
		h.fail(w, r, domain.ErrInvalid)
		return
	}
	items, err := h.config.Service.Store.Audit(r.Context(), p, r.PathValue("project"), sequence, limit)
	h.result(w, r, items, err)
}

func (h *adminHandler) resources(w http.ResponseWriter, r *http.Request, p persistence.Principal, kind string) {
	project := r.PathValue("project")
	if r.Method == "GET" {
		after, limit, err := pagination(r)
		if err != nil {
			h.fail(w, r, err)
			return
		}
		items, err := h.config.Service.Store.List(r.Context(), p, project, kind, after, limit)
		h.result(w, r, items, err)
		return
	}
	raw, err := body(w, r)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	key := r.Header.Get("Idempotency-Key")
	if kind == "domain" {
		var input struct {
			Hostname string `json:"hostname"`
		}
		if application.Decode(raw, &input) != nil {
			h.fail(w, r, domain.ErrInvalid)
			return
		}
		claim, err := h.config.Service.Store.CreateDomainClaim(r.Context(), p, project, input.Hostname, key)
		h.result(w, r, claim, err)
		return
	}
	resource, err := h.config.Service.Create(r.Context(), p, project, kind, key, raw)
	if err == nil {
		w.Header().Set("ETag", strconv.Quote(strconv.FormatInt(resource.Generation, 10)))
	}
	h.result(w, r, resource, err)
}
func (h *adminHandler) resource(w http.ResponseWriter, r *http.Request, p persistence.Principal, kind string) {
	project, id := r.PathValue("project"), r.PathValue("id")
	if kind == "domain" {
		claim, err := h.config.Service.Store.DomainClaim(r.Context(), p, project, id)
		h.result(w, r, claim, err)
		return
	}
	var resource persistence.Resource
	var err error
	if r.Method == "GET" {
		resource, err = h.config.Service.Store.Get(r.Context(), p, project, kind, id)
	} else {
		expected, e := revision(r)
		if e != nil {
			h.fail(w, r, e)
			return
		}
		raw, e := body(w, r)
		if e != nil {
			h.fail(w, r, e)
			return
		}
		resource, err = h.config.Service.Revise(r.Context(), p, project, kind, id, expected, raw)
	}
	if err == nil {
		w.Header().Set("ETag", strconv.Quote(strconv.FormatInt(resource.Generation, 10)))
	}
	h.result(w, r, resource, err)
}
