// Test-only decoder for bounded, synthetic decrypted H2 captures.
// It is not a proxy, a production parser, or an approved acceptance evaluator.
package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/hpack"
)

const maxCapture = 128 << 10
const maxFrames = 2048

type Link struct {
	Upstream   uint32 `json:"upstream_stream"`
	Downstream uint32 `json:"downstream_stream"`
	Connection string `json:"downstream_connection"`
	Rejected   bool   `json:"rejected"`
	Tenant     string `json:"tenant"`
	Generation uint64 `json:"generation"`
}
type Capture struct {
	ID               string `json:"connection"`
	Hex              string `json:"hex"`
	Total            uint64 `json:"total_bytes"`
	Dropped          uint64 `json:"dropped_bytes"`
	Client           bool   `json:"client_preface"`
	Closed           bool   `json:"capture_closed"`
	New              bool   `json:"new_connection"`
	RejectionDial    bool   `json:"rejection_caused_dial"`
	DialObserved     bool   `json:"dial_observed"`
	IdentityComplete bool   `json:"identity_complete"`
	SNI              string `json:"verified_sni"`
	Tenant           string `json:"tenant"`
	Generation       uint64 `json:"generation"`
	Links            []Link `json:"links"`
	ParserErrors     uint64 `json:"parser_errors"`
	TransportErrors  uint64 `json:"transport_errors"`
}
type Event struct {
	Offset      int                 `json:"offset"`
	Type        string              `json:"type"`
	Stream      uint32              `json:"stream"`
	Length      uint32              `json:"payload_bytes"`
	SHA         string              `json:"raw_sha256"`
	Raw         string              `json:"raw_hex"`
	Fields      []hpack.HeaderField `json:"decoded_fields,omitempty"`
	HeaderBlock string              `json:"hpack_block_hex,omitempty"`
	Error       string              `json:"error,omitempty"`
}
type Result struct {
	Connection              string   `json:"connection"`
	Bytes                   int      `json:"captured_bytes"`
	SHA                     string   `json:"captured_sha256"`
	Events                  []Event  `json:"events"`
	Violations              []string `json:"violations"`
	Incomplete              []string `json:"incomplete"`
	Complete                bool     `json:"capture_complete"`
	SecurityPass            bool     `json:"semantic_security_pass"`
	HPACKMutationVisibility string   `json:"hpack_mutation_visibility"`
}

func digest(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }
func analyze(c Capture) Result {
	r := Result{Connection: c.ID, Events: []Event{}, Violations: []string{}, Incomplete: []string{}, HPACKMutationVisibility: "stateful maintained decoder; exact dynamic-table mutations unavailable through public API"}
	fail := func(s string) { r.Incomplete = append(r.Incomplete, s) }
	violate := func(s string) { r.Violations = append(r.Violations, s) }
	if len(c.Hex) > maxCapture*2 {
		fail("capture exceeds input byte bound")
		return r
	}
	raw, err := hex.DecodeString(c.Hex)
	if err != nil {
		fail("invalid hex capture")
		return r
	}
	r.Bytes = len(raw)
	r.SHA = digest(raw)
	if c.Total != uint64(len(raw)) || c.Dropped != 0 {
		fail("lost/truncated bytes or inconsistent total")
	}
	if !c.Closed {
		fail("capture lifecycle not closed")
	}
	if !c.DialObserved {
		fail("dial registry unavailable")
	}
	if !c.IdentityComplete || c.SNI == "" || c.Tenant == "" || c.Generation == 0 {
		fail("authenticated identity/generation association unavailable")
	}
	if c.RejectionDial {
		violate("rejected request caused an origin dial")
	}
	if c.New && len(c.Links) == 0 && !c.RejectionDial {
		fail("new origin dial has no valid-request attribution")
	}
	if c.ParserErrors > 0 {
		violate("origin parser error observed")
	}
	if c.TransportErrors > 0 {
		fail("origin transport error observed")
	}
	links := map[uint32]Link{}
	down := map[string]bool{}
	for _, l := range c.Links {
		key := fmt.Sprintf("%s/%d", l.Connection, l.Downstream)
		if l.Upstream == 0 || l.Downstream == 0 || l.Connection == "" || links[l.Upstream].Upstream != 0 || down[key] {
			fail("invalid/duplicate stream mapping")
		}
		if l.Tenant != c.Tenant || l.Generation != c.Generation {
			violate("tenant/generation mapping mismatch")
		}
		links[l.Upstream] = l
		down[key] = true
	}
	offset := 0
	if c.Client {
		preface := []byte(http2.ClientPreface)
		if len(raw) < len(preface) || !bytes.Equal(raw[:len(preface)], preface) {
			fail("missing/partial client preface")
			return r
		}
		offset = len(preface)
	}
	reader := bytes.NewReader(raw[offset:])
	fr := http2.NewFramer(io.Discard, reader)
	fr.SetMaxReadFrameSize(65536)
	fields := []hpack.HeaderField{}
	fieldBytes := 0
	fieldOverflow := false
	dec := hpack.NewDecoder(4096, func(f hpack.HeaderField) {
		fieldBytes += len(f.Name) + len(f.Value)
		if len(fields) >= 128 || fieldBytes > 16384 {
			fieldOverflow = true
			return
		}
		fields = append(fields, f)
	})
	dec.SetMaxStringLength(8192)
	var pending uint32
	var block []byte
	for reader.Len() > 0 {
		if len(r.Events) >= maxFrames {
			fail("frame event bound exceeded")
			break
		}
		before := reader.Len()
		start := len(raw) - before
		f, e := fr.ReadFrame()
		consumed := before - reader.Len()
		if e != nil {
			r.Events = append(r.Events, Event{Offset: start, Type: "unparsed", Length: uint32(consumed), SHA: digest(raw[start : start+consumed]), Raw: hex.EncodeToString(raw[start : start+consumed]), Error: e.Error()})
			fail("frame decoding failed: " + e.Error())
			break
		}
		h := f.Header()
		ev := Event{Offset: start, Type: h.Type.String(), Stream: h.StreamID, Length: h.Length, SHA: digest(raw[start : start+consumed]), Raw: hex.EncodeToString(raw[start : start+consumed])}
		if h.StreamID != 0 {
			l, ok := links[h.StreamID]
			if !ok {
				fail(fmt.Sprintf("unattributed upstream stream %d", h.StreamID))
			} else if l.Rejected {
				violate(fmt.Sprintf("rejected request emitted %s on stream %d", h.Type, h.StreamID))
			}
		}
		var fragment []byte
		ended := false
		switch v := f.(type) {
		case *http2.HeadersFrame:
			pending = h.StreamID
			block = nil
			fields = nil
			fieldBytes = 0
			fieldOverflow = false
			fragment = v.HeaderBlockFragment()
			ended = v.HeadersEnded()
		case *http2.ContinuationFrame:
			if pending != h.StreamID {
				fail("CONTINUATION without matching HEADERS")
			}
			fragment = v.HeaderBlockFragment()
			ended = v.HeadersEnded()
		case *http2.PushPromiseFrame:
			fail("PUSH_PROMISE attribution unsupported")
		case *http2.UnknownFrame:
			fail("unknown extension frame attribution unsupported")
		}
		if fragment != nil {
			if len(block)+len(fragment) > 65536 {
				fail("HPACK compressed block bound exceeded")
				r.Events = append(r.Events, ev)
				break
			}
			block = append(block, fragment...)
			if _, e = dec.Write(fragment); e != nil {
				fail("HPACK decoding failed: " + e.Error())
				ev.Error = e.Error()
				r.Events = append(r.Events, ev)
				break
			}
			if ended {
				if e = dec.Close(); e != nil {
					fail("incomplete HPACK block: " + e.Error())
					ev.Error = e.Error()
				}
				if fieldOverflow {
					fail("decoded header bound exceeded")
				}
				ev.Fields = append([]hpack.HeaderField{}, fields...)
				ev.HeaderBlock = hex.EncodeToString(block)
				pending = 0
			}
		}
		r.Events = append(r.Events, ev)
	}
	if pending != 0 {
		fail("unfinished HEADERS/CONTINUATION block")
	}
	// Decoder completeness is deliberately distinct from Option2 eligibility.
	// No complete dynamic-table mutation trace or authenticated proxy dispatch map exists here.
	r.Complete = len(r.Incomplete) == 0
	return r
}
func main() {
	data, err := io.ReadAll(io.LimitReader(os.Stdin, 2*maxCapture+16385))
	if err != nil {
		panic(err)
	}
	if len(data) > 2*maxCapture+16384 {
		fmt.Fprintln(os.Stderr, "input bound exceeded")
		os.Exit(2)
	}
	var c Capture
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	if err = d.Decode(&c); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	if err = d.Decode(&struct{}{}); err != io.EOF {
		fmt.Fprintln(os.Stderr, "trailing input")
		os.Exit(2)
	}
	out := analyze(c)
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err = enc.Encode(out); err != nil {
		panic(err)
	}
}
