package main

import (
	"bytes"
	"encoding/hex"
	"strings"
	"testing"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/hpack"
)

func fixture(t *testing.T, write func(*http2.Framer)) Capture {
	t.Helper()
	var b bytes.Buffer
	b.WriteString(http2.ClientPreface)
	write(http2.NewFramer(&b, nil))
	return Capture{ID: "synthetic-origin-1", Hex: hex.EncodeToString(b.Bytes()), Total: uint64(b.Len()), Client: true, Closed: true, DialObserved: true, IdentityComplete: true, SNI: "lab-origin.test", Tenant: "tenant-A", Generation: 1, Links: []Link{{Upstream: 1, Downstream: 3, Connection: "down-1", Tenant: "tenant-A", Generation: 1}}}
}
func headers(t *testing.T) []byte {
	t.Helper()
	var b bytes.Buffer
	e := hpack.NewEncoder(&b)
	for _, f := range []hpack.HeaderField{{Name: ":method", Value: "GET"}, {Name: ":path", Value: "/synthetic"}, {Name: "x-fixture", Value: "constant"}} {
		if err := e.WriteField(f); err != nil {
			t.Fatal(err)
		}
	}
	return b.Bytes()
}
func need(t *testing.T, c Capture, word string, violated bool) {
	t.Helper()
	r := analyze(c)
	if r.SecurityPass {
		t.Fatal("research observer cannot grant security PASS")
	}
	values := r.Incomplete
	if violated {
		values = r.Violations
	}
	if !strings.Contains(strings.Join(values, ";"), word) {
		t.Fatalf("want %q in %#v", word, r)
	}
}
func TestValidFragmentedStatefulHPACK(t *testing.T) {
	block := headers(t)
	c := fixture(t, func(f *http2.Framer) {
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: block[:2]})
		_ = f.WriteContinuation(1, true, block[2:])
		_ = f.WriteSettingsAck()
		_ = f.WritePing(false, [8]byte{})
		_ = f.WriteWindowUpdate(0, 1)
	})
	r := analyze(c)
	if !r.Complete || len(r.Violations) != 0 || len(r.Events[1].Fields) != 3 {
		t.Fatalf("%#v", r)
	}
}
func TestStatefulDynamicReference(t *testing.T) {
	var b bytes.Buffer
	e := hpack.NewEncoder(&b)
	_ = e.WriteField(hpack.HeaderField{Name: "x-dynamic", Value: "synthetic"})
	one := append([]byte{}, b.Bytes()...)
	b.Reset()
	_ = e.WriteField(hpack.HeaderField{Name: "x-dynamic", Value: "synthetic"})
	two := append([]byte{}, b.Bytes()...)
	c := fixture(t, func(f *http2.Framer) {
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: one, EndHeaders: true})
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: two, EndHeaders: true})
	})
	r := analyze(c)
	if !r.Complete || len(two) >= len(one) || r.Events[1].Fields[0].Value != "synthetic" {
		t.Fatalf("%#v", r)
	}
	// A state-only HPACK table update is still a forbidden block, even with no emitted fields.
	c = fixture(t, func(f *http2.Framer) {
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: []byte{0x20}, EndHeaders: true})
	})
	c.Links[0].Rejected = true
	need(t, c, "rejected request emitted HEADERS", true)
}
func TestDeliberateLeaks(t *testing.T) {
	for _, kind := range []string{"HEADERS", "DATA", "RST_STREAM"} {
		t.Run(kind, func(t *testing.T) {
			c := fixture(t, func(f *http2.Framer) {
				switch kind {
				case "HEADERS":
					_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: headers(t), EndHeaders: true})
				case "DATA":
					_ = f.WriteData(1, false, []byte("synthetic"))
				case "RST_STREAM":
					_ = f.WriteRSTStream(1, http2.ErrCodeCancel)
				}
			})
			c.Links[0].Rejected = true
			need(t, c, "rejected request emitted "+kind, true)
		})
	}
}
func TestPartialForbiddenHeadersFailClosed(t *testing.T) {
	c := fixture(t, func(f *http2.Framer) {
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: headers(t), EndHeaders: true})
	})
	c.Hex = c.Hex[:len(c.Hex)-4]
	c.Total -= 2
	c.Links[0].Rejected = true
	need(t, c, "frame decoding failed", false)
}
func TestIncompleteContinuation(t *testing.T) {
	c := fixture(t, func(f *http2.Framer) {
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: []byte{0x40}})
	})
	need(t, c, "unfinished HEADERS", false)
}
func TestInterleavedContinuation(t *testing.T) {
	c := fixture(t, func(f *http2.Framer) {
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: []byte{0x40}})
		_ = f.WriteSettingsAck()
	})
	need(t, c, "frame decoding failed", false)
}
func TestNewDialWithoutHandler(t *testing.T) {
	c := fixture(t, func(*http2.Framer) {})
	c.New = true
	c.RejectionDial = true
	c.Links = nil
	need(t, c, "origin dial", true)
}
func TestCaptureOmissionAndIdentityFailClosed(t *testing.T) {
	for _, kind := range []string{"drop", "truncated", "open", "identity", "registry", "unmapped", "forged", "duplicate", "transport", "parser", "new"} {
		t.Run(kind, func(t *testing.T) {
			c := fixture(t, func(f *http2.Framer) { _ = f.WriteData(1, true, nil) })
			switch kind {
			case "drop":
				c.Dropped = 1
			case "truncated":
				c.Total++
			case "open":
				c.Closed = false
			case "identity":
				c.IdentityComplete = false
			case "registry":
				c.DialObserved = false
			case "unmapped":
				c.Links = nil
			case "forged":
				c.Links[0].Tenant = "tenant-B"
			case "duplicate":
				c.Links = append(c.Links, c.Links[0])
			case "transport":
				c.TransportErrors = 1
			case "parser":
				c.ParserErrors = 1
			case "new":
				c.New = true
				c.Links = nil
			}
			r := analyze(c)
			if r.Complete && len(r.Violations) == 0 {
				t.Fatalf("omission accepted: %#v", r)
			}
			if r.SecurityPass {
				t.Fatal("security PASS forbidden")
			}
		})
	}
}
func TestDecoderBoundsAndInvalidHPACK(t *testing.T) {
	c := fixture(t, func(f *http2.Framer) {
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, EndHeaders: true, BlockFragment: []byte{0xff, 0xff, 0xff, 0xff}})
	})
	need(t, c, "HPACK", false)
	c.Hex = strings.Repeat("00", maxCapture+1)
	need(t, c, "input byte bound", false)
	c = fixture(t, func(f *http2.Framer) {
		for range maxFrames + 1 {
			_ = f.WriteSettingsAck()
		}
	})
	need(t, c, "frame event bound", false)
}

func TestDecompressionAndContinuationBounds(t *testing.T) {
	for _, kind := range []string{"string", "fields", "wrong-stream", "table-size"} {
		t.Run(kind, func(t *testing.T) {
			var b bytes.Buffer
			e := hpack.NewEncoder(&b)
			switch kind {
			case "string":
				_ = e.WriteField(hpack.HeaderField{Name: "x-synthetic", Value: strings.Repeat("a", 8193)})
			case "fields":
				for range 129 {
					_ = e.WriteField(hpack.HeaderField{Name: "x-synthetic", Value: "constant"})
				}
			case "table-size":
				e.SetMaxDynamicTableSizeLimit(8192)
				e.SetMaxDynamicTableSize(8192)
				_ = e.WriteField(hpack.HeaderField{Name: "x-synthetic", Value: "constant"})
			}
			c := fixture(t, func(f *http2.Framer) {
				if kind == "wrong-stream" {
					_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: []byte{0x40}})
					_ = f.WriteContinuation(3, true, []byte{0})
				} else {
					_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 1, BlockFragment: b.Bytes(), EndHeaders: true})
				}
			})
			r := analyze(c)
			if r.Complete {
				t.Fatalf("bound accepted: %#v", r)
			}
		})
	}
}
