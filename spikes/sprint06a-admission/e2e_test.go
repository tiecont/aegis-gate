//go:build aegisgate_sprint06a_feasibility

package admission

import (
	"bufio"
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type blockOrigin struct {
	entered   chan struct{}
	release   chan struct{}
	cancelled chan struct{}
}
type networkFixture struct {
	f                         *state
	pki                       *pki
	port                      int
	handlers, dials, captures atomic.Int64
	wrongTLS                  atomic.Bool
	block                     atomic.Pointer[blockOrigin]
	metrics                   string
}

func network(t *testing.T) *networkFixture {
	t.Helper()
	if os.Getenv("AEGIS_SPRINT06A_NODE") == "" || os.Getenv("AEGIS_SPRINT06A_ADDON") == "" {
		t.Fatal("run through locked sprint06a-b collector; no skipped e2e")
	}
	n := &networkFixture{f: setup(t), pki: certificates(t)}
	originHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n.handlers.Add(1)
		if r.Header.Get("Authorization") != "" {
			t.Error("bearer forwarded to origin")
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, MaxWireBytes+1))
		if err != nil {
			return
		}
		if gate := n.block.Load(); gate != nil {
			close(gate.entered)
			select {
			case <-gate.release:
			case <-r.Context().Done():
				close(gate.cancelled)
				return
			}
		}
		w.Header().Set("Content-Length", "2")
		w.WriteHeader(200)
		_, _ = w.Write([]byte("OK"))
		_ = digest(body)
	})
	originA, _ := tlsServer(t, n.pki, "origin-a.example.com", originHandler)
	originB, _ := tlsServer(t, n.pki, "origin-b.example.com", originHandler)
	wrong, _ := tlsServer(t, n.pki, "wrong.example.com", originHandler)
	addresses := map[string]string{"https://origin-a.example.com": originA, "https://origin-b.example.com": originB}
	admissionHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Outer llhttp/TLS fixture already checked original Host/SNI. This hop
		// independently verifies its own admission TLS name; no SNI header is trusted.
		if r.TLS == nil || r.TLS.ServerName != "admission.example.com" || r.RequestURI != "/v1" {
			w.WriteHeader(421)
			return
		}
		l, err := n.f.a.Capture(r.Host, r.Host, r.URL.Path, r.Method)
		if err != nil {
			w.WriteHeader(503)
			return
		}
		n.captures.Add(1)
		defer func() { l.Close(); n.captures.Add(-1) }()
		if Authenticate(l, r.Header.Get("Authorization"), &n.f.jwtKey.PublicKey, n.f.clock()) != nil {
			w.WriteHeader(401)
			return
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, MaxWireBytes+1))
		if err != nil || len(body) > MaxWireBytes {
			w.WriteHeader(400)
			return
		}
		endpoint := l.Route.Pool.Endpoints[0]
		address, allowed := addresses[endpoint.URL]
		if !allowed {
			w.WriteHeader(502)
			return
		}
		// This is an explicit fixture allowlist, not production SSRF validation.
		originName := strings.TrimPrefix(endpoint.URL, "https://")
		transport := &http.Transport{DisableKeepAlives: true, DialTLSContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			n.dials.Add(1)
			if n.wrongTLS.Load() {
				address = wrong
			}
			return (&tls.Dialer{NetDialer: &net.Dialer{Timeout: time.Second}, Config: &tls.Config{RootCAs: n.pki.pool, ServerName: originName, MinVersion: tls.VersionTLS12, NextProtos: []string{"http/1.1"}}}).DialContext(ctx, "tcp4", address)
		}}
		defer transport.CloseIdleConnections()
		ctx, cancel := context.WithTimeout(r.Context(), time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, r.Method, endpoint.URL+"/v1", bytes.NewReader(body))
		if err != nil {
			w.WriteHeader(502)
			return
		}
		resp, err := transport.RoundTrip(req)
		if err != nil {
			w.WriteHeader(502)
			return
		}
		defer resp.Body.Close()
		_, err = io.Copy(io.Discard, io.LimitReader(resp.Body, 1024))
		if err != nil {
			w.WriteHeader(502)
			return
		}
		result, _ := json.Marshal(map[string]any{"generation": l.Route.Generation, "resource_generation": l.Route.Route.Generation, "tenant": l.Route.TenantID, "body_sha256": digest(body)})
		w.Header().Set("Content-Length", strconv.Itoa(len(result)))
		w.WriteHeader(resp.StatusCode)
		_, _ = w.Write(result)
	})
	address, _ := tlsServer(t, n.pki, "admission.example.com", admissionHandler)
	_, port, err := net.SplitHostPort(address)
	must(t, err)
	p, err := strconv.Atoi(port)
	must(t, err)
	for _, id := range []string{"a", "b"} {
		n.pki.issue(t, "api-"+id+".example.com")
	}
	dir := t.TempDir()
	input := filepath.Join(dir, "input.json")
	ready := filepath.Join(dir, "ready.json")
	n.metrics = filepath.Join(dir, "metrics.json")
	safeJSON(t, input, map[string]any{"port": p, "pki": n.pki.dir, "directory": filepath.Join(dir, "spool")})
	cmd := exec.Command(os.Getenv("AEGIS_SPRINT06A_NODE"), filepath.Join(os.Getenv("AEGIS_SPRINT06A_ROOT"), "spikes/sprint06a-admission/sprint06a-b-finite.mjs"), input, ready, n.metrics)
	cmd.Dir = os.Getenv("AEGIS_SPRINT06A_ROOT")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	stdin, err := cmd.StdinPipe()
	must(t, err)
	must(t, cmd.Start())
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	t.Cleanup(func() {
		_, _ = stdin.Write([]byte("stop\n"))
		_ = stdin.Close()
		select {
		case err := <-done:
			if err != nil {
				t.Errorf("finite child failed: %v; %s", err, stderr.String())
			}
		case <-time.After(8 * time.Second):
			_ = cmd.Process.Kill()
			<-done
			t.Error("finite child teardown timeout")
		}
		if raw, err := os.ReadFile(n.metrics); err == nil {
			t.Logf("finite_metrics=%s", raw)
		} else {
			t.Errorf("missing cleanup metrics: %v; %s", err, stderr.String())
		}
	})
	until(t, func() bool { _, err := os.Stat(ready); return err == nil })
	var info struct {
		Port int `json:"port"`
	}
	raw, err := os.ReadFile(ready)
	must(t, err)
	must(t, json.Unmarshal(raw, &info))
	n.port = info.Port
	return n
}
func until(t *testing.T, predicate func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !predicate() {
		if time.Now().After(deadline) {
			t.Fatal("bounded fixture observation deadline")
		}
		time.Sleep(10 * time.Millisecond)
	}
}
func (n *networkFixture) connect(t *testing.T, sni string) *tls.Conn {
	t.Helper()
	conn, err := tls.DialWithDialer(&net.Dialer{Timeout: time.Second}, "tcp4", net.JoinHostPort("127.0.0.1", strconv.Itoa(n.port)), &tls.Config{RootCAs: n.pki.pool, ServerName: sni, MinVersion: tls.VersionTLS12, NextProtos: []string{"http/1.1"}})
	must(t, err)
	must(t, conn.SetDeadline(time.Now().Add(5*time.Second)))
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}
func wire(host, authorization, body string) string {
	auth := ""
	if authorization != "" {
		auth = "Authorization: " + authorization + "\r\n"
	}
	return fmt.Sprintf("POST /v1 HTTP/1.1\r\nHost: %s\r\n%sContent-Length: %d\r\nConnection: close\r\n\r\n%s", host, auth, len(body), body)
}
func response(t *testing.T, conn *tls.Conn) (int, map[string]any) {
	t.Helper()
	resp, err := http.ReadResponse(bufio.NewReader(conn), nil)
	must(t, err)
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4096))
	must(t, err)
	var result map[string]any
	if len(raw) > 0 {
		must(t, json.Unmarshal(raw, &result))
	}
	return resp.StatusCode, result
}
func (n *networkFixture) request(t *testing.T, host, authorization, body string) (int, map[string]any) {
	t.Helper()
	conn := n.connect(t, host)
	defer conn.Close()
	_, err := io.WriteString(conn, wire(host, authorization, body))
	must(t, err)
	return response(t, conn)
}

func TestSignedFiniteTLSAndJWTEndToEnd(t *testing.T) {
	n := network(t)
	status, _ := n.request(t, "api-a.example.com", n.f.token(t, "a", "valid"), "complete")
	if status != 503 || n.handlers.Load() != 0 {
		t.Fatal("boot without authenticated profile admitted")
	}
	n.f.apply(t, 7, 7, n.f.signer)
	for _, kind := range []string{"missing", "expired", "audience", "issuer", "future", "kid", "tampered", "cross_tenant"} {
		t.Run("JWT_"+kind, func(t *testing.T) {
			authorization := n.f.token(t, "a", kind)
			if kind == "missing" {
				authorization = ""
			}
			if kind == "cross_tenant" {
				authorization = n.f.token(t, "b", "valid")
			}
			before := n.handlers.Load()
			status, _ := n.request(t, "api-a.example.com", authorization, "complete")
			if status != 401 || n.handlers.Load() != before {
				t.Fatal("JWT denial reached origin")
			}
		})
	}
	for _, id := range []string{"a", "b"} {
		status, result := n.request(t, "api-"+id+".example.com", n.f.token(t, id, "valid"), "complete")
		if status != 200 || result["tenant"] != "tenant-"+id || result["generation"] != float64(7) || result["body_sha256"] != digest([]byte("complete")) {
			t.Fatal("signed finite TLS positive mismatch")
		}
		t.Logf("signed_finite_positive tenant=%s generation=7 status=200 body_sha256=%s", id, result["body_sha256"])
	}
	t.Run("Host_SNI_mismatch", func(t *testing.T) {
		before := n.dials.Load()
		conn := n.connect(t, "api-a.example.com")
		_, err := io.WriteString(conn, wire("api-b.example.com", n.f.token(t, "b", "valid"), "complete"))
		must(t, err)
		status, _ := response(t, conn)
		if status != 421 || n.dials.Load() != before {
			t.Fatal("identity mismatch reached customer origin")
		}
	})
	t.Run("unknown_SNI", func(t *testing.T) {
		before := n.dials.Load()
		conn, err := tls.DialWithDialer(&net.Dialer{Timeout: time.Second}, "tcp4", net.JoinHostPort("127.0.0.1", strconv.Itoa(n.port)), &tls.Config{RootCAs: n.pki.pool, ServerName: "unknown.example.com", MinVersion: tls.VersionTLS12})
		if conn != nil {
			conn.Close()
		}
		if err == nil || n.dials.Load() != before {
			t.Fatal("unknown SNI accepted")
		}
	})
	t.Run("origin_TLS_mismatch", func(t *testing.T) {
		before := n.handlers.Load()
		n.wrongTLS.Store(true)
		defer n.wrongTLS.Store(false)
		status, _ := n.request(t, "api-a.example.com", n.f.token(t, "a", "valid"), "complete")
		if status != 502 || n.handlers.Load() != before {
			t.Fatal("invalid upstream TLS reached handler")
		}
	})
	until(t, func() bool { return n.captures.Load() == 0 })
}

func TestFiniteLateInvalidityAndPinnedRollbackEndToEnd(t *testing.T) {
	n := network(t)
	n.f.apply(t, 7, 7, n.f.signer)
	t.Run("CL10_prefix_valid_completion", func(t *testing.T) {
		before := n.handlers.Load()
		conn := n.connect(t, "api-a.example.com")
		prefix := wire("api-a.example.com", n.f.token(t, "a", "valid"), "abcdefghij")
		_, err := io.WriteString(conn, prefix[:len(prefix)-7])
		must(t, err)
		time.Sleep(150 * time.Millisecond)
		if n.handlers.Load() != before || n.captures.Load() != 0 {
			t.Fatal("incomplete finite prefix admitted")
		}
		_, err = io.WriteString(conn, "defghij")
		must(t, err)
		status, result := response(t, conn)
		if status != 200 || n.handlers.Load() != before+1 || result["body_sha256"] != digest([]byte("abcdefghij")) {
			t.Fatal("complete finite not exactly once")
		}
	})
	for _, kind := range []string{"CL10_EOF", "folded_header", "late_folded_trailer"} {
		t.Run(kind, func(t *testing.T) {
			before := n.handlers.Load()
			conn := n.connect(t, "api-a.example.com")
			request := wire("api-a.example.com", n.f.token(t, "a", "valid"), "abcdefghij")
			if kind == "CL10_EOF" {
				request = request[:len(request)-7]
			} else if kind == "folded_header" {
				request = strings.Replace(request, "Content-Length:", "X-Fold: one\r\n two\r\nContent-Length:", 1)
			} else {
				request = "POST /v1 HTTP/1.1\r\nHost: api-a.example.com\r\nAuthorization: " + n.f.token(t, "a", "valid") + "\r\nTransfer-Encoding: chunked\r\nTrailer: X-Fold\r\nConnection: close\r\n\r\n3\r\nabc\r\n0\r\nX-Fold: one\r\n two\r\n\r\n"
			}
			_, err := io.WriteString(conn, request)
			must(t, err)
			if kind == "CL10_EOF" {
				must(t, conn.CloseWrite())
			}
			status, _ := response(t, conn)
			if status != 400 || n.handlers.Load() != before {
				t.Fatal("late-invalid finite request reached origin")
			}
		})
	}
	gate := &blockOrigin{make(chan struct{}), make(chan struct{}), make(chan struct{})}
	n.block.Store(gate)
	conn := n.connect(t, "api-a.example.com")
	_, err := io.WriteString(conn, wire("api-a.example.com", n.f.token(t, "a", "valid"), "captured"))
	must(t, err)
	select {
	case <-gate.entered:
	case <-time.After(2 * time.Second):
		t.Fatal("captured origin not entered")
	}
	n.f.apply(t, 8, 8, n.f.signer)
	n.f.apply(t, 9, 7, n.f.signer)
	close(gate.release)
	status, result := response(t, conn)
	if status != 200 || result["generation"] != float64(7) || result["resource_generation"] != float64(7) {
		t.Fatal("inflight request changed generation during rollback")
	}
	n.block.Store(nil)
	status, result = n.request(t, "api-a.example.com", n.f.token(t, "a", "valid"), "new request")
	if status != 200 || result["generation"] != float64(9) || result["resource_generation"] != float64(7) {
		t.Fatal("new request did not capture newer rollback generation")
	}
	t.Log("rollback_capture old_deployment=7 new_deployment=9 rollback_resource=7 status=200")
	gate = &blockOrigin{make(chan struct{}), make(chan struct{}), make(chan struct{})}
	n.block.Store(gate)
	conn = n.connect(t, "api-a.example.com")
	_, err = io.WriteString(conn, wire("api-a.example.com", n.f.token(t, "a", "valid"), "cancelled"))
	must(t, err)
	select {
	case <-gate.entered:
	case <-time.After(2 * time.Second):
		t.Fatal("cancel origin not entered")
	}
	_ = conn.Close()
	n.f.apply(t, 10, 10, n.f.signer)
	select {
	case <-gate.cancelled:
	case <-time.After(2 * time.Second):
		t.Fatal("client cancellation not propagated")
	}
	n.block.Store(nil)
	until(t, func() bool { return n.captures.Load() == 0 })
	status, result = n.request(t, "api-a.example.com", n.f.token(t, "a", "valid"), "after cancel")
	if status != 200 || result["generation"] != float64(10) {
		t.Fatal("post-cancel generation recovery")
	}
}
