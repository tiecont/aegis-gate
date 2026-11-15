package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	"golang.org/x/net/http2"
)

type observedTLS struct {
	*tls.Conn
	add        func(Event)
	once       sync.Once
	readOnce   sync.Once
	readerDone chan struct{}
}

func (c *observedTLS) Write(b []byte) (int, error) {
	n, err := c.Conn.Write(b)
	if n > 0 {
		c.add(Event{Kind: "wire", Connection: "origin-1", Direction: "to-origin", Hex: hex.EncodeToString(b[:n])})
	}
	return n, err
}
func (c *observedTLS) Read(b []byte) (int, error) {
	n, err := c.Conn.Read(b)
	if n > 0 {
		c.add(Event{Kind: "wire", Connection: "origin-1", Direction: "from-origin", Hex: hex.EncodeToString(b[:n])})
	}
	if err != nil {
		c.readOnce.Do(func() { close(c.readerDone) })
	}
	return n, err
}
func (c *observedTLS) Close() error {
	err := c.Conn.Close()
	select {
	case <-c.readerDone:
	case <-time.After(time.Second):
		c.add(Event{Kind: "lost", Reason: "reader did not terminate before close"})
	}
	c.once.Do(func() { c.add(Event{Kind: "close", Connection: "origin-1"}) })
	return err
}

func requireFixtureLock(t *testing.T) {
	t.Helper()
	var st syscall.Stat_t
	if err := syscall.Stat("/tmp/aegisgate-sprint02-fixtures.lock", &st); err != nil {
		t.Fatal(err)
	}
	ancestors := map[int]bool{}
	for pid := os.Getppid(); pid > 1 && !ancestors[pid]; {
		ancestors[pid] = true
		data, err := os.ReadFile(fmt.Sprintf("/proc/%d/status", pid))
		if err != nil {
			t.Fatal(err)
		}
		next := 0
		for _, line := range strings.Split(string(data), "\n") {
			if strings.HasPrefix(line, "PPid:") {
				next, _ = strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(line, "PPid:")))
			}
		}
		pid = next
	}
	locks, err := os.ReadFile("/proc/locks")
	if err != nil {
		t.Fatal(err)
	}
	for _, line := range strings.Split(string(locks), "\n") {
		f := strings.Fields(line)
		if len(f) < 6 {
			continue
		}
		pid, _ := strconv.Atoi(f[4])
		if f[1] == "FLOCK" && f[3] == "WRITE" && ancestors[pid] && strings.HasSuffix(f[5], fmt.Sprintf(":%d", st.Ino)) {
			return
		}
	}
	t.Fatal("live fixture lifecycle requires ancestor shared lock")
}

func TestLiveVerifiedTLSH2Capture(t *testing.T) {
	requireFixtureLock(t)
	var mu sync.Mutex
	var events []Event
	add := func(e Event) { mu.Lock(); events = append(events, e); mu.Unlock() }
	identity := fixtureIdentity
	identity.SNI = "example.com"
	identity.OriginSNI = "example.com"
	valid := request("valid", 1, false)
	valid.Identity = identity
	add(valid)
	server := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.ProtoMajor != 2 || r.TLS == nil || r.TLS.ServerName != "example.com" {
			t.Errorf("incorrect verified protocol/identity")
		}
		add(Event{Kind: "handler", Connection: "origin-1", Request: "valid", Stream: 1})
		w.Header().Set("Trailer", "x-fixture-end")
		w.WriteHeader(200)
		_, _ = w.Write([]byte("bounded-h2-control"))
		w.Header().Set("x-fixture-end", "done")
	}))
	server.EnableHTTP2 = true
	server.StartTLS()
	defer server.Close()
	roots := x509.NewCertPool()
	roots.AddCert(server.Certificate())
	var conn *observedTLS
	transport := &http2.Transport{TLSClientConfig: &tls.Config{RootCAs: roots, ServerName: "example.com", MinVersion: tls.VersionTLS12}, DialTLSContext: func(ctx context.Context, network, addr string, cfg *tls.Config) (net.Conn, error) {
		dialer := &tls.Dialer{Config: cfg}
		raw, err := dialer.DialContext(ctx, network, addr)
		if err != nil {
			return nil, err
		}
		tlsConn := raw.(*tls.Conn)
		state := tlsConn.ConnectionState()
		if len(state.VerifiedChains) == 0 || state.NegotiatedProtocol != "h2" {
			raw.Close()
			return nil, io.ErrUnexpectedEOF
		}
		add(Event{Kind: "dial", Connection: "origin-1", Request: "valid", Identity: identity, TLSVerified: true})
		b := binding("valid", 1)
		b.Identity = identity
		add(b)
		conn = &observedTLS{Conn: tlsConn, add: add, readerDone: make(chan struct{})}
		return conn, nil
	}}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: 3 * time.Second}
	response, err := client.Get(server.URL + "/encoded%2Ftarget?x=%2520")
	if err != nil {
		t.Fatal(err)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 1024))
	response.Body.Close()
	if err != nil || string(body) != "bounded-h2-control" || response.Trailer.Get("x-fixture-end") != "done" {
		t.Fatalf("response/trailers %q %v", body, err)
	}
	denied := request("denied", 3, true)
	denied.Identity = identity
	add(denied)
	add(Event{Kind: "begin"})
	add(Event{Kind: "end"})
	transport.CloseIdleConnections()
	if conn == nil {
		t.Fatal("missing origin dial")
	}
	// Close joins the transport reader before sealing so no trailing read is lost.
	_ = conn.Close()
	mu.Lock()
	copyEvents := append([]Event{}, events...)
	mu.Unlock()
	copyEvents = append(copyEvents, Event{Kind: "seal"})
	r := inspect(t, copyEvents)
	if !r.Research.Pass || r.Handlers != 1 || r.Dials != 1 || len(r.Frames) < 4 {
		t.Fatalf("live observer: %+v", r)
	}
	record(t, r)
}
