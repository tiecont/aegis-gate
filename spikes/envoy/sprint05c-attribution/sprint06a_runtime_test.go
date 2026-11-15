package main

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/hpack"
)

// This is a bounded transcript check, never a runtime authority certificate.
func sprint06aAssess(e runtimeEvidence, key []byte) runtimeAssessment {
	r := assessRuntime(e, key)
	seenWires := map[string]bool{}
	for _, w := range e.Wires {
		if seenWires[w.ID] {
			r.CorrelationConsistent = false
			r.Incomplete = append(r.Incomplete, "duplicate capture identity")
		}
		seenWires[w.ID] = true
		streams := map[uint32]bool{}
		err := runtimeFrames(w.To, true, func(frame http2.Frame) error {
			switch f := frame.(type) {
			case *http2.MetaHeadersFrame:
				if streams[f.StreamID] || !f.StreamEnded() {
					return fmt.Errorf("aliased or incomplete bounded GET stream")
				}
				streams[f.StreamID] = true
			case *http2.DataFrame:
				return fmt.Errorf("unexpected DATA in bounded GET transcript")
			}
			return nil
		})
		if err != nil {
			r.CorrelationConsistent = false
			r.Incomplete = append(r.Incomplete, err.Error())
		}
	}
	return r
}

func sprint06aRequests(ids []uint32, probes, nonces []string) string {
	var wire, block bytes.Buffer
	wire.WriteString(http2.ClientPreface)
	fr := http2.NewFramer(&wire, nil)
	_ = fr.WriteSettings()
	enc := hpack.NewEncoder(&block)
	for i, probe := range probes {
		block.Reset()
		fields := []hpack.HeaderField{{Name: ":method", Value: "GET"}, {Name: ":scheme", Value: "https"}, {Name: ":authority", Value: "example.com"}, {Name: ":path", Value: "/06a"}, {Name: "x-aegis-probe-id", Value: probe}}
		if nonces != nil {
			fields = append(fields, hpack.HeaderField{Name: "x-aegis-fixture-id", Value: nonces[i]})
		}
		for _, f := range fields {
			_ = enc.WriteField(f)
		}
		_ = fr.WriteHeaders(http2.HeadersFrameParam{StreamID: ids[i], BlockFragment: block.Bytes(), EndHeaders: true, EndStream: true})
	}
	return hex.EncodeToString(wire.Bytes())
}

func sprint06aResponses(ids []uint32, statuses []string) string {
	var wire, block bytes.Buffer
	fr := http2.NewFramer(&wire, nil)
	_ = fr.WriteSettings()
	enc := hpack.NewEncoder(&block)
	for i, status := range statuses {
		block.Reset()
		_ = enc.WriteField(hpack.HeaderField{Name: ":status", Value: status})
		_ = fr.WriteHeaders(http2.HeadersFrameParam{StreamID: ids[i], BlockFragment: block.Bytes(), EndHeaders: true, EndStream: true})
	}
	return hex.EncodeToString(wire.Bytes())
}

func TestSprint06AIndependentChallenges(t *testing.T) {
	requireFixtureLock(t)
	key := bytes.Repeat([]byte{0x6a}, 32)
	baseline := runtimeEvidence{
		Requests: []runtimeRequest{
			{Probe: "six-a", Nonce: "nonce-a", SNI: "example.com", Tenant: "fixture-A", Generation: 7, Status: 200, OriginHandlers: 1, GotConnection: true, Wrote: true},
			{Probe: "six-denied", SNI: "example.com", Tenant: "fixture-A", Generation: 7, Status: 421},
			{Probe: "six-b", Nonce: "nonce-b", SNI: "example.com", Tenant: "fixture-A", Generation: 7, Status: 200, OriginHandlers: 1, GotConnection: true, Wrote: true},
		},
		Wires: []runtimeWire{
			{ID: "downstream", SNI: "example.com", Verified: true, Closed: true, To: sprint06aRequests([]uint32{1, 3, 5}, []string{"six-a", "six-denied", "six-b"}, nil), From: sprint06aResponses([]uint32{1, 3, 5}, []string{"200", "421", "200"})},
			{ID: "upstream", SNI: "example.com", Verified: true, Closed: true, To: sprint06aRequests([]uint32{1, 3}, []string{"six-a", "six-b"}, []string{"nonce-a", "nonce-b"}), From: sprint06aResponses([]uint32{1, 3}, []string{"200", "200"})},
		},
	}
	for _, challenge := range []string{"honest", "omitted-dispatch", "omitted-request", "stream-alias", "nonce-swap", "incomplete-HPACK", "manipulated-final-response", "capture-loss", "truncated-reverse", "duplicate-capture", "orphan-DATA", "trusted-signer-rewrite"} {
		t.Run(challenge, func(t *testing.T) {
			encoded, _ := json.Marshal(baseline)
			var e runtimeEvidence
			_ = json.Unmarshal(encoded, &e)
			switch challenge {
			case "omitted-dispatch":
				e.Requests[0].Wrote = false
			case "omitted-request":
				e.Requests = e.Requests[:2]
			case "stream-alias":
				// Old map/cardinality checks alone accept two probes on stream1
				// plus an unrelated completed response on stream3.
				e.Wires[1].To = sprint06aRequests([]uint32{1, 1}, []string{"six-a", "six-b"}, []string{"nonce-a", "nonce-b"})
			case "nonce-swap":
				e.Requests[0].Nonce, e.Requests[2].Nonce = e.Requests[2].Nonce, e.Requests[0].Nonce
			case "incomplete-HPACK":
				var wire bytes.Buffer
				wire.WriteString(http2.ClientPreface)
				fr := http2.NewFramer(&wire, nil)
				_ = fr.WriteSettings()
				_ = fr.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: []byte{0x40, 0x7f}, EndHeaders: false, EndStream: true})
				e.Wires[1].To = hex.EncodeToString(wire.Bytes())
			case "manipulated-final-response":
				e.Wires[0].From = sprint06aResponses([]uint32{1, 3, 5}, []string{"200", "200", "200"})
			case "capture-loss":
				e.Wires[1].Lost = true
			case "truncated-reverse":
				e.Wires[1].From += "000001000000000001"
			case "duplicate-capture":
				e.Wires[0].ID = "upstream"
			case "orphan-DATA":
				var wire bytes.Buffer
				fr := http2.NewFramer(&wire, nil)
				_ = fr.WriteData(99, true, []byte("synthetic-orphan"))
				e.Wires[1].To += hex.EncodeToString(wire.Bytes())
			case "trusted-signer-rewrite":
				// A signer controlling events AND bytes can rewrite a coherent
				// transcript. Its MAC cannot establish complete real-world coverage.
				e.Requests[0].Probe, e.Requests[0].Nonce = "rewritten", "rewritten-nonce"
				e.Wires[0].To = sprint06aRequests([]uint32{1, 3, 5}, []string{"rewritten", "six-denied", "six-b"}, nil)
				e.Wires[1].To = sprint06aRequests([]uint32{1, 3}, []string{"rewritten", "six-b"}, []string{"rewritten-nonce", "nonce-b"})
			}
			e.MAC = runtimeMAC(e, key)
			prior := assessRuntime(e, key)
			got := sprint06aAssess(e, key)
			wantConsistency := challenge == "honest" || challenge == "trusted-signer-rewrite"
			if got.CorrelationConsistent != wantConsistency || got.RuntimeComplete || got.RuntimePass || got.Module01Pass || len(got.Incomplete) == 0 {
				t.Fatalf("unsupported assessment: %+v", got)
			}
			log, _ := json.Marshal(map[string]any{"challenge": challenge, "priorCorrelationConsistent": prior.CorrelationConsistent, "assessment": got, "synthetic": true})
			t.Log(string(log))
		})
	}
}

type sprint06aCapture struct {
	mu       sync.Mutex
	to, from []byte
	lost     bool
}

type sprint06aPeer struct {
	*tls.Conn
	capture *sprint06aCapture
}

func (c *sprint06aPeer) record(to bool, data []byte) {
	c.capture.mu.Lock()
	defer c.capture.mu.Unlock()
	if len(c.capture.to)+len(c.capture.from)+len(data) > maxBytes {
		c.capture.lost = true
		return
	}
	if to {
		c.capture.to = append(c.capture.to, data...)
	} else {
		c.capture.from = append(c.capture.from, data...)
	}
}
func (c *sprint06aPeer) Read(b []byte) (int, error) {
	n, err := c.Conn.Read(b)
	c.record(true, b[:n])
	return n, err
}
func (c *sprint06aPeer) Write(b []byte) (int, error) {
	n, err := c.Conn.Write(b)
	c.record(false, b[:n])
	return n, err
}

func TestSprint06AActualUnrelatedSettingsACK(t *testing.T) {
	requireFixtureLock(t)
	for _, overlap := range []bool{false, true} {
		t.Run(fmt.Sprintf("identity-denial-overlap-%t", overlap), func(t *testing.T) {
			seed := httptest.NewTLSServer(http.NotFoundHandler())
			serverTLS := seed.TLS.Clone()
			roots := x509.NewCertPool()
			roots.AddCert(seed.Certificate())
			seed.Close()
			serverTLS.NextProtos = []string{"h2"}
			listener, err := tls.Listen("tcp", "127.0.0.1:0", serverTLS)
			if err != nil {
				t.Fatal(err)
			}
			defer listener.Close()
			capture := &sprint06aCapture{}
			peerReady := make(chan *sprint06aPeer, 1)
			acks := make(chan struct{}, 4)
			peerDone := make(chan error, 1)
			var originHeaders atomic.Int32
			go func() {
				conn, err := listener.Accept()
				if err != nil {
					peerDone <- err
					return
				}
				peer := &sprint06aPeer{Conn: conn.(*tls.Conn), capture: capture}
				defer peer.Close()
				preface := make([]byte, len(http2.ClientPreface))
				if _, err := io.ReadFull(peer, preface); err != nil || string(preface) != http2.ClientPreface {
					peerDone <- fmt.Errorf("client preface: %v", err)
					return
				}
				fr := http2.NewFramer(peer, peer)
				if err := fr.WriteSettings(); err != nil {
					peerDone <- err
					return
				}
				peerReady <- peer
				for {
					frame, err := fr.ReadFrame()
					if err != nil {
						peerDone <- err
						return
					}
					switch f := frame.(type) {
					case *http2.SettingsFrame:
						if f.IsAck() {
							acks <- struct{}{}
						}
					case *http2.HeadersFrame:
						originHeaders.Add(1)
					}
				}
			}()
			clientTLS := &tls.Config{RootCAs: roots, ServerName: "example.com", NextProtos: []string{"h2"}, MinVersion: tls.VersionTLS12}
			conn, err := tls.DialWithDialer(&net.Dialer{Timeout: 2 * time.Second}, "tcp", listener.Addr().String(), clientTLS)
			if err != nil {
				t.Fatal(err)
			}
			defer conn.Close()
			if len(conn.ConnectionState().VerifiedChains) == 0 || conn.ConnectionState().NegotiatedProtocol != "h2" {
				t.Fatal("unverified origin TLS/H2")
			}
			transport := &http2.Transport{}
			cc, err := transport.NewClientConn(conn)
			if err != nil {
				t.Fatal(err)
			}
			defer cc.Close()
			wait := func(ch <-chan struct{}, reason string) {
				t.Helper()
				select {
				case <-ch:
				case <-time.After(2 * time.Second):
					t.Fatal(reason)
				}
			}
			var peer *sprint06aPeer
			select {
			case peer = <-peerReady:
			case <-time.After(2 * time.Second):
				t.Fatal("origin setup deadline")
			}
			wait(acks, "initial SETTINGS ACK missing")
			pending, release, denied := make(chan struct{}), make(chan struct{}), make(chan struct{})
			var releaseOnce sync.Once
			releaseDenial := func() { releaseOnce.Do(func() { close(release) }) }
			var downstreamRequests atomic.Int32
			var down *http2.Transport
			var downstream runtimeEvidence
			if overlap {
				recorder := &runtimeRecorder{wires: map[string]*runtimeWire{"downstream": {ID: "downstream", SNI: "example.com", Verified: true}}}
				var tapped *runtimeConn
				front := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, q *http.Request) {
					downstreamRequests.Add(1)
					if q.TLS == nil || q.TLS.ServerName != "example.com" || q.Host != "other.example.com" || q.ProtoMajor != 2 {
						t.Error("identity-denial fixture mismatch")
					}
					close(pending)
					<-release
					w.WriteHeader(http.StatusMisdirectedRequest)
				}))
				front.EnableHTTP2 = true
				front.StartTLS()
				defer front.Close()
				defer releaseDenial()
				frontRoots := x509.NewCertPool()
				frontRoots.AddCert(front.Certificate())
				down = &http2.Transport{TLSClientConfig: &tls.Config{RootCAs: frontRoots, ServerName: "example.com", MinVersion: tls.VersionTLS12}}
				down.DialTLSContext = func(ctx context.Context, network, addr string, cfg *tls.Config) (net.Conn, error) {
					c, err := (&tls.Dialer{Config: cfg}).DialContext(ctx, network, addr)
					if err != nil {
						return nil, err
					}
					tapped = &runtimeConn{Conn: c.(*tls.Conn), r: recorder, id: "downstream", readerDone: make(chan struct{})}
					return tapped, nil
				}
				defer down.CloseIdleConnections()
				go func() {
					defer close(denied)
					q, _ := http.NewRequest("GET", front.URL+"/06a-denied", nil)
					q.Host = "other.example.com"
					q.Header.Set("X-Aegis-Probe-Id", "06a-overlap-denied")
					response, err := (&http.Client{Transport: down, Timeout: 3 * time.Second}).Do(q)
					if err != nil {
						t.Error(err)
						return
					}
					_, err = io.Copy(io.Discard, response.Body)
					response.Body.Close()
					if err != nil || response.StatusCode != 421 {
						t.Errorf("denial result status=%d err=%v", response.StatusCode, err)
					}
				}()
				wait(pending, "denial did not overlap")
				defer func() {
					down.CloseIdleConnections()
					_ = tapped.Close()
					wait(tapped.readerDone, "downstream reader did not join")
					recorder.mu.Lock()
					recorder.wires["downstream"].Closed = true
					downstream.Wires = append(downstream.Wires, *recorder.wires["downstream"])
					recorder.mu.Unlock()
					raw, _ := json.Marshal(map[string]any{"actualDownstreamCapture": downstream, "runtimeComplete": false, "runtimePass": false})
					t.Log(string(raw))
				}()
			}
			capture.mu.Lock()
			start := len(capture.to)
			capture.mu.Unlock()
			// The public maintained ClientConn read loop sends the ACK. This
			// fixture submits only server SETTINGS, never client ACK bytes.
			if err := http2.NewFramer(peer, nil).WriteSettings(http2.Setting{ID: http2.SettingMaxConcurrentStreams, Val: 13}); err != nil {
				t.Fatal(err)
			}
			wait(acks, "independent SETTINGS ACK missing")
			capture.mu.Lock()
			interval := append([]byte(nil), capture.to[start:]...)
			capture.mu.Unlock()
			if hex.EncodeToString(interval) != "000000040100000000" || originHeaders.Load() != 0 {
				t.Fatalf("unexpected interval=%x originHeaders=%d", interval, originHeaders.Load())
			}
			if overlap {
				select {
				case <-denied:
					t.Fatal("denial finished before unrelated ACK")
				default:
				}
				releaseDenial()
				wait(denied, "denial response deadline")
			}
			_ = cc.Close()
			_ = peer.Close()
			select {
			case err := <-peerDone:
				if err == nil {
					t.Fatal("reader join had no termination")
				}
			case <-time.After(2 * time.Second):
				t.Fatal("origin capture reader did not join")
			}
			capture.mu.Lock()
			defer capture.mu.Unlock()
			if capture.lost || downstreamRequests.Load() != int32(map[bool]int{false: 0, true: 1}[overlap]) {
				t.Fatal("incomplete capture or downstream request count")
			}
			log, _ := json.Marshal(map[string]any{"actual": true, "overlap": overlap, "toOriginHex": hex.EncodeToString(capture.to), "fromOriginHex": hex.EncodeToString(capture.from), "intervalStart": start, "intervalHex": hex.EncodeToString(interval), "intervalBytes": len(interval), "downstreamRequests": downstreamRequests.Load(), "originRequestHeaders": originHeaders.Load(), "captureLost": capture.lost, "readerJoined": true, "aggregateVerdict": "FAIL", "researchConsistency": "observed-control-only", "runtimeComplete": false, "runtimePass": false, "module01Pass": false})
			t.Log(string(log))
		})
	}
}
