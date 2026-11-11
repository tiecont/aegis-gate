// Package transport exposes only local foundation health checks. Tenant API
// resources are deliberately unavailable until the tenancy/authentication gate.
package transport

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"time"

	"aegisgate.dev/aegisgate/internal/contracts"
)

func NewHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, err := contracts.RequestID()
		if err != nil {
			http.Error(w, "request unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Request-ID", id)
		if r.Method == http.MethodGet && r.URL.Path == "/healthz" {
			_ = json.NewEncoder(w).Encode(contracts.Health{Service: "control-api", Status: "alive"})
			return
		}
		code, message, status := "not_found", "Resource unavailable", http.StatusNotFound
		if r.Method == http.MethodGet && r.URL.Path == "/readyz" {
			code, message, status = "not_ready", "Control plane is not configured", http.StatusServiceUnavailable
		}
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(contracts.ErrorEnvelope{Error: contracts.ErrorDetail{Code: code, Message: message, RequestID: id}})
	})
}

// LocalAddress rejects wildcards, hostnames and non-loopback IPs before listen.
// This development foundation must not become an unauthenticated public admin API.
func LocalAddress(addr string) error {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return err
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() || port == "" {
		return errors.New("foundation listener requires a literal loopback address and port")
	}
	return nil
}

func NewServer(addr string) (*http.Server, error) {
	if err := LocalAddress(addr); err != nil {
		return nil, err
	}
	return &http.Server{Addr: addr, Handler: NewHandler(), ReadHeaderTimeout: 3 * time.Second, ReadTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second, IdleTimeout: 15 * time.Second, MaxHeaderBytes: 16 << 10}, nil
}
