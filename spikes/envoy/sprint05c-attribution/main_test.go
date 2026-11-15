package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"strings"
	"testing"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/hpack"
)

var fixtureIdentity = Identity{Tenant: "tenant-A", Generation: 7, SNI: "a.lab.test", OriginSNI: "origin.lab.test"}

func wire(t *testing.T, write func(*http2.Framer)) string {
	t.Helper()
	var b bytes.Buffer
	write(http2.NewFramer(&b, nil))
	return hex.EncodeToString(b.Bytes())
}
func block(t *testing.T) []byte {
	t.Helper()
	var b bytes.Buffer
	e := hpack.NewEncoder(&b)
	for _, field := range []hpack.HeaderField{{Name: ":method", Value: "POST"}, {Name: ":scheme", Value: "https"}, {Name: ":authority", Value: "origin.lab.test"}, {Name: ":path", Value: "/encoded%2Ftarget?x=%2520"}, {Name: "x-fixture", Value: "synthetic"}} {
		if err := e.WriteField(field); err != nil {
			t.Fatal(err)
		}
	}
	return b.Bytes()
}
func request(id string, stream uint32, rejected bool) Event {
	return Event{Kind: "request", Request: id, Downstream: "downstream-1", DownStream: stream, Identity: fixtureIdentity, TLSVerified: true, Rejected: rejected, FinalDecision: true}
}
func binding(id string, stream uint32) Event {
	return Event{Kind: "bind", Connection: "origin-1", Request: id, Downstream: "downstream-1", DownStream: stream, Stream: stream, Identity: fixtureIdentity}
}
func capture(t *testing.T, middle ...Event) []Event {
	t.Helper()
	head := wire(t, func(f *http2.Framer) {
		_ = f.WriteSettings()
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: block(t), EndHeaders: true})
	})
	e := []Event{request("valid", 1, false), {Kind: "dial", Connection: "origin-1", Request: "valid", Identity: fixtureIdentity, TLSVerified: true}, binding("valid", 1), {Kind: "wire", Connection: "origin-1", Direction: "to-origin", Hex: hex.EncodeToString([]byte(http2.ClientPreface)) + head}, {Kind: "wire", Connection: "origin-1", Direction: "from-origin", Hex: wire(t, func(f *http2.Framer) { _ = f.WriteSettings() })}, {Kind: "begin"}, request("denied", 3, true)}
	e = append(e, middle...)
	return append(e, Event{Kind: "end"}, Event{Kind: "close", Connection: "origin-1"}, Event{Kind: "seal"})
}
func sign(t *testing.T, events []Event) (Ledger, []byte) {
	t.Helper()
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatal(err)
	}
	previous := ""
	for i := range events {
		events[i].Sequence = i + 1
		events[i].MAC = eventMAC(key, previous, events[i])
		previous = events[i].MAC
	}
	return Ledger{Events: events}, key
}
func inspect(t *testing.T, events []Event) Result {
	t.Helper()
	l, k := sign(t, events)
	return analyze(l, k)
}
func origin(t *testing.T, fn func(*http2.Framer)) Event {
	return Event{Kind: "wire", Connection: "origin-1", Direction: "to-origin", Hex: wire(t, fn)}
}
func record(t *testing.T, r Result) {
	t.Helper()
	b, err := json.Marshal(r)
	if err != nil {
		t.Fatal(err)
	}
	t.Log(string(b))
	if r.SecurityGatePass {
		t.Fatal("research cannot grant Module01 PASS")
	}
}

func TestDualContractsControlOnly(t *testing.T) {
	r := inspect(t, capture(t, origin(t, func(f *http2.Framer) { _ = f.WriteSettingsAck() })))
	if r.Current.Bytes != 9 || r.Current.Pass || !r.Research.Pass {
		t.Fatalf("wrong dual conclusions: %+v", r)
	}
	if r.Frames[len(r.Frames)-2].Raw != "000000040100000000" {
		t.Fatal("ACK raw accounting lost")
	}
	record(t, r)
}
func TestNoEffects(t *testing.T) {
	r := inspect(t, capture(t))
	if !r.Current.Pass || !r.Research.Pass {
		t.Fatalf("%+v", r)
	}
	record(t, r)
}

func TestLateRejectionRetainsEarlierOriginEffects(t *testing.T) {
	e := capture(t, Event{Kind: "handler", Connection: "origin-1", Stream: 1, Request: "valid"}, Event{Kind: "decision", Request: "valid", Rejected: true, FinalDecision: true})
	r := inspect(t, e)
	if r.Research.Pass || len(r.Research.Violations) < 3 {
		t.Fatalf("late invalidation hidden: %+v", r)
	}
	record(t, r)
}
func TestDeliberateForbiddenEffects(t *testing.T) {
	for _, kind := range []string{"HEADERS-no-handler", "DATA-existing-stream", "dial-no-request", "partial-HEADERS", "missing-CONTINUATION", "HPACK-only", "cross-tenant", "missing-binding", "handler", "parser-error", "transport-error", "missing-identity"} {
		t.Run(kind, func(t *testing.T) {
			middle := []Event{binding("denied", 3)}
			switch kind {
			case "HEADERS-no-handler":
				middle = append(middle, origin(t, func(f *http2.Framer) {
					_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 3, BlockFragment: block(t), EndHeaders: true})
				}))
			case "DATA-existing-stream":
				middle = append(middle, origin(t, func(f *http2.Framer) {
					_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 3, BlockFragment: block(t), EndHeaders: true})
					_ = f.WriteData(3, false, []byte("deliberate-leak"))
				}))
			case "dial-no-request":
				middle = []Event{{Kind: "dial", Connection: "origin-2", Request: "denied", Identity: fixtureIdentity, TLSVerified: true}, {Kind: "close", Connection: "origin-2"}}
			case "partial-HEADERS":
				e := origin(t, func(f *http2.Framer) {
					_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 3, BlockFragment: block(t), EndHeaders: true})
				})
				e.Hex = e.Hex[:len(e.Hex)-2]
				middle = append(middle, e)
			case "missing-CONTINUATION":
				middle = append(middle, origin(t, func(f *http2.Framer) {
					_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 3, BlockFragment: block(t)[:1]})
				}))
			case "HPACK-only":
				middle = append(middle, origin(t, func(f *http2.Framer) {
					_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 3, BlockFragment: []byte{0x20}, EndHeaders: true})
				}))
			case "cross-tenant":
				middle[0].Identity.Tenant = "tenant-B"
			case "missing-binding":
				middle = []Event{origin(t, func(f *http2.Framer) {
					_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 3, BlockFragment: block(t), EndHeaders: true})
				})}
			case "handler":
				middle = append(middle, Event{Kind: "handler", Connection: "origin-1", Request: "denied", Stream: 3})
			case "parser-error":
				middle = append(middle, Event{Kind: "parser-error", Reason: "synthetic"})
			case "transport-error":
				middle = append(middle, Event{Kind: "transport-error"})
			case "missing-identity":
				middle = []Event{request("missing", 5, true)}
				middle[0].Identity.SNI = ""
			}
			r := inspect(t, capture(t, middle...))
			if r.Research.Pass {
				t.Fatalf("leak accepted: %+v", r)
			}
			record(t, r)
		})
	}
}
func TestLedgerAuthenticityAndCompleteness(t *testing.T) {
	for _, kind := range []string{"tamper", "drop", "reorder", "truncated-seal", "unclosed", "lost", "wrong-key", "late-binding", "wire-after-close", "duplicate-mapping", "trust-epoch"} {
		t.Run(kind, func(t *testing.T) {
			e := capture(t, origin(t, func(f *http2.Framer) { _ = f.WriteSettingsAck() }))
			if kind == "lost" {
				e = capture(t, Event{Kind: "lost"})
			}
			if kind == "late-binding" {
				e = capture(t, origin(t, func(f *http2.Framer) { _ = f.WriteData(3, false, nil) }), binding("denied", 3))
			}
			if kind == "wire-after-close" {
				e = capture(t, Event{Kind: "close", Connection: "origin-1"}, origin(t, func(f *http2.Framer) { _ = f.WriteSettingsAck() }))
			}
			if kind == "duplicate-mapping" {
				e = capture(t, binding("denied", 3), binding("denied", 3))
			}
			if kind == "trust-epoch" {
				b := binding("denied", 3)
				b.Identity.Generation++
				e = capture(t, b)
			}
			if kind == "unclosed" {
				e = append(e[:len(e)-2], e[len(e)-1])
			}
			l, k := sign(t, e)
			switch kind {
			case "tamper":
				l.Events[0].Identity.Tenant = "tenant-B"
			case "drop":
				l.Events = append(l.Events[:1], l.Events[2:]...)
			case "reorder":
				l.Events[0], l.Events[1] = l.Events[1], l.Events[0]
			case "truncated-seal":
				l.Events = l.Events[:len(l.Events)-1]
			case "wrong-key":
				k = bytes.Repeat([]byte{1}, 32)
			}
			r := analyze(l, k)
			if r.Research.Pass {
				t.Fatalf("accepted %s", kind)
			}
			record(t, r)
		})
	}
}
func TestFragmentedHPACKAndBounds(t *testing.T) {
	fragment := block(t)
	r := inspect(t, capture(t, binding("denied", 3), origin(t, func(f *http2.Framer) {
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 3, BlockFragment: fragment[:1]})
		_ = f.WriteContinuation(3, true, fragment[1:])
	})))
	if r.Research.Pass || len(r.Research.Violations) != 2 {
		t.Fatalf("%+v", r)
	}
	record(t, r)
	l, k := sign(t, capture(t, Event{Kind: "wire", Connection: "origin-1", Direction: "to-origin", Hex: strings.Repeat("00", maxBytes+1)}))
	r = analyze(l, k)
	if r.Research.Pass {
		t.Fatal("byte limit accepted")
	}
}

func TestMissingFinalDecisionCannotPass(t *testing.T) {
	e := capture(t)
	e[0].FinalDecision = false
	r := inspect(t, e)
	if r.Research.Pass || r.Current.Pass {
		t.Fatal("missing decision accepted")
	}
	record(t, r)
}

func TestStatefulDynamicTableReferences(t *testing.T) {
	var b bytes.Buffer
	enc := hpack.NewEncoder(&b)
	field := hpack.HeaderField{Name: "x-stateful", Value: "unchanged"}
	_ = enc.WriteField(field)
	one := bytes.Clone(b.Bytes())
	b.Reset()
	_ = enc.WriteField(field)
	two := bytes.Clone(b.Bytes())
	mid := origin(t, func(f *http2.Framer) {
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: one, EndHeaders: true})
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: two, EndHeaders: true})
	})
	r := inspect(t, capture(t, mid))
	if !r.Research.Pass || len(two) >= len(one) {
		t.Fatalf("%+v", r)
	}
	last := ""
	count := 0
	for _, f := range r.Frames {
		if f.HPACKAfter != "" {
			count++
			if last != "" && f.HPACKBefore != last {
				t.Fatal("opaque decoder history discontinuity")
			}
			last = f.HPACKAfter
		}
	}
	if count != 3 {
		t.Fatal(count)
	}
	record(t, r)
}
