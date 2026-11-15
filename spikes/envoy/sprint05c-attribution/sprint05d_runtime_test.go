package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/http/httptrace"
	"strconv"
	"sync"
	"testing"
	"time"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/hpack"
)

// Runtime-derived evidence remains distinct from the synthetic ledger and gate.
type runtimeRequest struct {
	Probe, Nonce, SNI, Tenant string
	Generation                uint64
	Status, OriginHandlers    int
	GotConnection, Wrote      bool
}
type runtimeWire struct {
	ID, SNI, To, From string
	Verified, Closed  bool
	Lost              bool
}
type runtimeEvidence struct {
	Requests []runtimeRequest
	Wires    []runtimeWire
	MAC      string
}
type runtimeAssessment struct {
	CorrelationConsistent bool
	RuntimeComplete       bool
	RuntimePass           bool
	Module01Pass          bool
	UpstreamStreams       map[string]uint32
	DownstreamStreams     map[string]uint32
	Incomplete            []string
	Raw                   runtimeEvidence
}

func runtimeMAC(e runtimeEvidence, key []byte) string {
	e.MAC = ""
	b, _ := json.Marshal(e)
	h := hmac.New(sha256.New, key)
	h.Write([]byte("AEGISGATE_RUNTIME_OBSERVATION_RESEARCH_V1\x00"))
	h.Write(b)
	return hex.EncodeToString(h.Sum(nil))
}

func runtimeFrames(rawHex string, client bool, visit func(http2.Frame) error) error {
	raw, err := hex.DecodeString(rawHex)
	if err != nil || len(raw) > maxBytes {
		return fmt.Errorf("invalid or oversized raw H2 capture")
	}
	if client {
		if len(raw) < len(http2.ClientPreface) || !bytes.Equal(raw[:len(http2.ClientPreface)], []byte(http2.ClientPreface)) {
			return fmt.Errorf("missing captured H2 preface")
		}
		raw = raw[len(http2.ClientPreface):]
	}
	reader := bytes.NewReader(raw)
	fr := http2.NewFramer(io.Discard, reader)
	fr.SetMaxReadFrameSize(65536)
	fr.ReadMetaHeaders = hpack.NewDecoder(4096, nil)
	fr.MaxHeaderListSize = 16384
	for reader.Len() > 0 {
		frame, err := fr.ReadFrame()
		if err != nil {
			return fmt.Errorf("incomplete frame/header capture: %w", err)
		}
		if h, ok := frame.(*http2.MetaHeadersFrame); ok {
			if h.Truncated {
				return fmt.Errorf("truncated HPACK fields")
			}
		}
		if err := visit(frame); err != nil {
			return err
		}
	}
	return nil
}

func runtimeHeaders(rawHex string, field string, client bool) (map[string]uint32, error) {
	m := map[string]uint32{}
	err := runtimeFrames(rawHex, client, func(frame http2.Frame) error {
		if h, ok := frame.(*http2.MetaHeadersFrame); ok {
			for _, f := range h.Fields {
				if f.Name == field {
					if f.Value == "" || m[f.Value] != 0 {
						return fmt.Errorf("missing/duplicate correlation")
					}
					m[f.Value] = h.StreamID
				}
			}
		}
		return nil
	})
	return m, err
}

// This bounded fixture expects one final response followed by complete DATA or
// trailers per stream. It does not certify general runtime protocol semantics.
func runtimeStatuses(rawHex string) (map[uint32]int, error) {
	statuses, ended := map[uint32]int{}, map[uint32]bool{}
	err := runtimeFrames(rawHex, false, func(frame http2.Frame) error {
		switch f := frame.(type) {
		case *http2.MetaHeadersFrame:
			if ended[f.StreamID] {
				return fmt.Errorf("headers after completed response")
			}
			for _, h := range f.Fields {
				if h.Name == ":status" {
					status, err := strconv.Atoi(h.Value)
					if err != nil || len(h.Value) != 3 || status < 200 || status > 599 || statuses[f.StreamID] != 0 {
						return fmt.Errorf("invalid/duplicate final response status")
					}
					statuses[f.StreamID] = status
				}
			}
			if statuses[f.StreamID] == 0 {
				return fmt.Errorf("response headers without final status")
			}
			ended[f.StreamID] = f.StreamEnded()
		case *http2.DataFrame:
			if statuses[f.StreamID] == 0 || ended[f.StreamID] {
				return fmt.Errorf("unbound response DATA")
			}
			ended[f.StreamID] = f.StreamEnded()
		case *http2.RSTStreamFrame:
			return fmt.Errorf("reset is not a completed fixture response")
		}
		return nil
	})
	for id := range statuses {
		if !ended[id] {
			return nil, fmt.Errorf("response end missing from capture")
		}
	}
	return statuses, err
}

func assessRuntime(e runtimeEvidence, key []byte) runtimeAssessment {
	r := runtimeAssessment{Raw: e, UpstreamStreams: map[string]uint32{}, DownstreamStreams: map[string]uint32{}}
	upstreamProbes := map[string]uint32{}
	downstreamStatuses, upstreamStatuses := map[uint32]int{}, map[uint32]int{}
	fail := func(s string) { r.Incomplete = append(r.Incomplete, s) }
	if len(key) != 32 || !hmac.Equal([]byte(e.MAC), []byte(runtimeMAC(e, key))) {
		fail("runtime observation authentication")
		return r
	}
	if len(e.Wires) != 2 || len(e.Requests) != 3 {
		fail("bounded fixture event coverage")
	}
	for _, w := range e.Wires {
		if !w.Verified || !w.Closed || w.Lost || w.SNI != "example.com" {
			fail("TLS/capture lifecycle incomplete")
		}
		field := "x-aegis-fixture-id"
		if w.ID == "downstream" {
			field = "x-aegis-probe-id"
		} else if w.ID != "upstream" {
			fail("unattributed dial")
		}
		m, err := runtimeHeaders(w.To, field, true)
		if err != nil {
			fail(err.Error())
			continue
		}
		statuses, err := runtimeStatuses(w.From)
		if err != nil || len(statuses) == 0 {
			fail("missing/truncated reverse capture")
		}
		if w.ID == "downstream" {
			r.DownstreamStreams = m
			downstreamStatuses = statuses
		} else {
			r.UpstreamStreams = m
			upstreamStatuses = statuses
			upstreamProbes, err = runtimeHeaders(w.To, "x-aegis-probe-id", true)
			if err != nil {
				fail("invalid upstream probe correlation")
			}
		}
	}
	seen := map[string]bool{}
	nonces := map[string]bool{}
	accepted := 0
	for _, q := range e.Requests {
		if seen[q.Probe] || q.Probe == "" || q.SNI != "example.com" || q.Tenant != "fixture-A" || q.Generation != 7 || r.DownstreamStreams[q.Probe] == 0 {
			fail("missing/duplicate identity or downstream binding")
		}
		seen[q.Probe] = true
		if downstreamStatuses[r.DownstreamStreams[q.Probe]] != q.Status {
			fail("downstream response status/stream binding")
		}
		if q.Status == 200 {
			accepted++
			if q.Nonce == "" || nonces[q.Nonce] || !q.GotConnection || !q.Wrote || q.OriginHandlers != 1 || r.UpstreamStreams[q.Nonce] == 0 || upstreamProbes[q.Probe] != r.UpstreamStreams[q.Nonce] {
				fail("missing runtime transport/handler binding")
			}
			nonces[q.Nonce] = true
			if upstreamStatuses[r.UpstreamStreams[q.Nonce]] != q.Status {
				fail("upstream response status/stream binding")
			}
		} else if q.Status != 421 || q.OriginHandlers != 0 || q.GotConnection || q.Wrote || q.Nonce != "" {
			fail("denied request caused origin effect or forged decision")
		}
	}
	if len(r.UpstreamStreams) != accepted || len(upstreamProbes) != accepted || len(r.DownstreamStreams) != len(e.Requests) {
		fail("unattributed stream or omitted request")
	}
	if len(downstreamStatuses) != len(e.Requests) || len(upstreamStatuses) != accepted {
		fail("response stream coverage")
	}
	r.CorrelationConsistent = len(r.Incomplete) == 0
	// Supported callbacks do not expose authoritative origin handler stream IDs,
	// pre-wire stream admission, exact HPACK table mutations or signed generation.
	r.Incomplete = append(r.Incomplete, "post-capture correlation is not an authenticated pre-wire dispatch hook", "static generation fixture is not signed snapshot runtime coverage", "exact HPACK internal table mutations unavailable through public decoder API")
	return r
}

type runtimeRecorder struct {
	mu       sync.Mutex
	wires    map[string]*runtimeWire
	requests map[string]*runtimeRequest
	order    []string
}
type runtimeConn struct {
	*tls.Conn
	r          *runtimeRecorder
	id         string
	readerDone chan struct{}
	once       sync.Once
}

func (c *runtimeConn) Write(b []byte) (int, error) {
	n, err := c.Conn.Write(b)
	c.record(true, b[:n], err)
	return n, err
}
func (c *runtimeConn) Read(b []byte) (int, error) {
	n, err := c.Conn.Read(b)
	c.record(false, b[:n], err)
	if err != nil {
		c.once.Do(func() { close(c.readerDone) })
	}
	return n, err
}
func (c *runtimeConn) record(to bool, b []byte, err error) {
	c.r.mu.Lock()
	defer c.r.mu.Unlock()
	w := c.r.wires[c.id]
	if len(b) > 0 {
		if len(w.To)+len(w.From)+len(b)*2 > 2*maxBytes {
			w.Lost = true
			return
		}
		if to {
			w.To += hex.EncodeToString(b)
		} else {
			w.From += hex.EncodeToString(b)
		}
	}
	if err != nil && err != io.EOF {
		if ne, ok := err.(net.Error); ok && ne.Timeout() {
			w.Lost = true
		}
	}
}
func (c *runtimeConn) Close() error { return c.Conn.Close() }

func TestSprint05DRuntimeDerivedMappings(t *testing.T) {
	requireFixtureLock(t)
	r := &runtimeRecorder{wires: map[string]*runtimeWire{}, requests: map[string]*runtimeRequest{}}
	var all []*runtimeConn
	transport := func(id string, server *httptest.Server) *http2.Transport {
		roots := x509.NewCertPool()
		roots.AddCert(server.Certificate())
		tr := &http2.Transport{TLSClientConfig: &tls.Config{RootCAs: roots, ServerName: "example.com", MinVersion: tls.VersionTLS12}}
		tr.DialTLSContext = func(ctx context.Context, network, addr string, cfg *tls.Config) (net.Conn, error) {
			conn, err := (&tls.Dialer{Config: cfg}).DialContext(ctx, network, addr)
			if err != nil {
				return nil, err
			}
			tc := conn.(*tls.Conn)
			state := tc.ConnectionState()
			r.mu.Lock()
			defer r.mu.Unlock()
			if r.wires[id] != nil {
				tc.Close()
				return nil, fmt.Errorf("unexpected second dial")
			}
			r.wires[id] = &runtimeWire{ID: id, SNI: state.ServerName, Verified: len(state.VerifiedChains) > 0 && state.NegotiatedProtocol == "h2"}
			wrapped := &runtimeConn{Conn: tc, r: r, id: id, readerDone: make(chan struct{})}
			all = append(all, wrapped)
			return wrapped, nil
		}
		return tr
	}
	origin := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, q *http.Request) {
		r.mu.Lock()
		found := false
		for _, rec := range r.requests {
			if rec.Nonce != "" && q.Header.Get("X-Aegis-Fixture-Id") == rec.Nonce {
				rec.OriginHandlers++
				found = true
			}
		}
		r.mu.Unlock()
		if !found || q.TLS == nil || q.TLS.ServerName != "example.com" || q.ProtoMajor != 2 {
			t.Error("unmapped origin handler")
		}
		w.Header().Set("Trailer", "x-fixture-end")
		w.WriteHeader(200)
		_, _ = w.Write([]byte("bounded-runtime-control"))
		w.Header().Set("x-fixture-end", "done")
	}))
	origin.EnableHTTP2 = true
	origin.StartTLS()
	defer origin.Close()
	up := transport("upstream", origin)
	defer up.CloseIdleConnections()
	front := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, q *http.Request) {
		probe := q.Header.Get("X-Aegis-Probe-Id")
		rec := &runtimeRequest{Probe: probe, SNI: q.TLS.ServerName, Tenant: "fixture-A", Generation: 7}
		r.mu.Lock()
		r.requests[probe] = rec
		r.order = append(r.order, probe)
		r.mu.Unlock()
		if q.TLS.ServerName != "example.com" || q.Host != "example.com" {
			r.mu.Lock()
			rec.Status = 421
			r.mu.Unlock()
			w.WriteHeader(421)
			return
		}
		nonce := make([]byte, 16)
		if _, err := rand.Read(nonce); err != nil {
			t.Error(err)
			w.WriteHeader(503)
			return
		}
		r.mu.Lock()
		rec.Nonce = hex.EncodeToString(nonce)
		r.mu.Unlock()
		trace := &httptrace.ClientTrace{GotConn: func(httptrace.GotConnInfo) { r.mu.Lock(); rec.GotConnection = true; r.mu.Unlock() }, WroteHeaders: func() { r.mu.Lock(); rec.Wrote = true; r.mu.Unlock() }}
		out, err := http.NewRequestWithContext(httptrace.WithClientTrace(q.Context(), trace), "GET", origin.URL+q.URL.RequestURI(), nil)
		if err != nil {
			t.Error(err)
			return
		}
		// Caller-provided correlation is replaced by a fixture-generated identity.
		out.Header.Set("X-Aegis-Fixture-Id", rec.Nonce)
		out.Header.Set("X-Aegis-Probe-Id", probe)
		resp, err := up.RoundTrip(out)
		if err != nil {
			t.Error(err)
			w.WriteHeader(502)
			return
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(io.LimitReader(resp.Body, 1024))
		if err != nil {
			t.Error(err)
		}
		r.mu.Lock()
		rec.Status = resp.StatusCode
		r.mu.Unlock()
		w.WriteHeader(resp.StatusCode)
		_, _ = w.Write(body)
	}))
	front.EnableHTTP2 = true
	front.StartTLS()
	defer front.Close()
	down := transport("downstream", front)
	defer down.CloseIdleConnections()
	client := &http.Client{Transport: down, Timeout: 3 * time.Second}
	for i, host := range []string{"example.com", "other.example.com", "example.com"} {
		q, _ := http.NewRequest("GET", front.URL+"/encoded%2Ftarget?x=%2520", nil)
		q.Host = host
		q.Header.Set("X-Aegis-Probe-Id", fmt.Sprintf("probe-%d", i))
		q.Header.Set("X-Aegis-Fixture-Id", "untrusted-spoof")
		resp, err := client.Do(q)
		if err != nil {
			t.Fatal(err)
		}
		_, err = io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
		if err != nil {
			t.Fatal(err)
		}
		want := 200
		if i == 1 {
			want = 421
		}
		if resp.StatusCode != want {
			t.Fatalf("status %d want%d", resp.StatusCode, want)
		}
	}
	down.CloseIdleConnections()
	up.CloseIdleConnections()
	for _, c := range all {
		_ = c.Close()
		select {
		case <-c.readerDone:
		case <-time.After(time.Second):
			t.Fatal("capture reader not joined")
		}
		r.mu.Lock()
		r.wires[c.id].Closed = true
		r.mu.Unlock()
	}
	r.mu.Lock()
	e := runtimeEvidence{}
	for _, id := range []string{"downstream", "upstream"} {
		e.Wires = append(e.Wires, *r.wires[id])
	}
	for _, id := range r.order {
		e.Requests = append(e.Requests, *r.requests[id])
	}
	r.mu.Unlock()
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	e.MAC = runtimeMAC(e, key)
	assessment := assessRuntime(e, key)
	if !assessment.CorrelationConsistent || assessment.RuntimeComplete || assessment.RuntimePass || assessment.Module01Pass {
		t.Fatalf("incorrect bounded/full-runtime conclusion: %+v", assessment)
	}
	b, _ := json.Marshal(assessment)
	t.Log(string(b))
	for _, kind := range []string{"missing-handler", "missing-trace", "duplicate-probe", "swapped-nonces", "duplicate-nonce", "forged-decision", "late-rejection", "missing-identity", "lost-capture", "truncated-capture", "truncated-reverse", "omitted-dial", "tampered-MAC", "missing-header-block"} {
		t.Run(kind, func(t *testing.T) {
			copyBytes, _ := json.Marshal(e)
			var bad runtimeEvidence
			_ = json.Unmarshal(copyBytes, &bad)
			switch kind {
			case "missing-handler":
				bad.Requests[0].OriginHandlers = 0
			case "missing-trace":
				bad.Requests[0].GotConnection = false
			case "duplicate-probe":
				bad.Requests[1].Probe = bad.Requests[0].Probe
			case "swapped-nonces":
				bad.Requests[0].Nonce, bad.Requests[2].Nonce = bad.Requests[2].Nonce, bad.Requests[0].Nonce
			case "duplicate-nonce":
				bad.Requests[2].Nonce = bad.Requests[0].Nonce
			case "forged-decision":
				bad.Requests[1].Status = 200
			case "late-rejection":
				bad.Requests[0].Status = 421
			case "missing-identity":
				bad.Requests[0].Tenant = ""
			case "lost-capture":
				bad.Wires[0].Lost = true
			case "truncated-capture":
				bad.Wires[1].To = bad.Wires[1].To[:len(bad.Wires[1].To)-2]
			case "truncated-reverse":
				bad.Wires[1].From = bad.Wires[1].From[:len(bad.Wires[1].From)-2]
			case "omitted-dial":
				bad.Wires = bad.Wires[:1]
			case "missing-header-block":
				bad.Wires[1].To = hex.EncodeToString([]byte(http2.ClientPreface))
			}
			bad.MAC = runtimeMAC(bad, key)
			if kind == "tampered-MAC" {
				bad.Requests[0].Status = 421
			}
			got := assessRuntime(bad, key)
			if got.CorrelationConsistent || got.RuntimePass || got.Module01Pass {
				t.Fatalf("incomplete/forged runtime accepted: %+v", got)
			}
		})
	}
}
