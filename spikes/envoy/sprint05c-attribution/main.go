// Test-only authenticated fixture ledger. Not a proxy or acceptance replacement.
package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/hpack"
)

const maxBytes = 256 << 10
const maxEvents = 2048

type Identity struct {
	Tenant     string `json:"tenant"`
	Generation uint64 `json:"generation"`
	SNI        string `json:"verified_downstream_sni"`
	OriginSNI  string `json:"verified_origin_sni"`
}
type Event struct {
	Sequence    int      `json:"sequence"`
	Kind        string   `json:"kind"`
	Connection  string   `json:"origin_connection"`
	Direction   string   `json:"direction,omitempty"`
	Request     string   `json:"request,omitempty"`
	Downstream  string   `json:"downstream_connection,omitempty"`
	DownStream  uint32   `json:"downstream_stream,omitempty"`
	Stream      uint32   `json:"upstream_stream,omitempty"`
	Identity    Identity `json:"identity"`
	Rejected    bool     `json:"rejected,omitempty"`
	TLSVerified bool     `json:"tls_verified,omitempty"`
	Hex         string   `json:"raw_hex,omitempty"`
	Reason      string   `json:"reason,omitempty"`
	MAC         string   `json:"mac"`
}
type Ledger struct {
	Events []Event `json:"events"`
}
type Frame struct {
	Connection    string              `json:"connection"`
	Direction     string              `json:"direction"`
	FirstSequence int                 `json:"first_sequence"`
	LastSequence  int                 `json:"last_sequence"`
	Type          string              `json:"type"`
	Stream        uint32              `json:"stream"`
	Raw           string              `json:"raw_hex"`
	SHA256        string              `json:"raw_sha256"`
	Fields        []hpack.HeaderField `json:"fields,omitempty"`
	HPACKBefore   string              `json:"hpack_history_before,omitempty"`
	HPACKAfter    string              `json:"hpack_history_after,omitempty"`
	Identity      Identity            `json:"verified_fixture_identity"`
	Request       string              `json:"request,omitempty"`
	Downstream    string              `json:"downstream_connection,omitempty"`
	DownStream    uint32              `json:"downstream_stream,omitempty"`
	StreamState   string              `json:"stream_state,omitempty"`
}
type Result struct {
	Current struct {
		Bytes    int  `json:"origin_bytes_in_original_interval"`
		Zero     bool `json:"zero_origin_bytes"`
		Complete bool `json:"complete"`
		Pass     bool `json:"pass"`
	} `json:"current_all_byte_contract"`
	Research struct {
		Complete   bool     `json:"bounded_fixture_complete"`
		Pass       bool     `json:"bounded_request_isolation_pass"`
		Violations []string `json:"violations"`
		Incomplete []string `json:"incomplete"`
	} `json:"research_contract_only"`
	Frames           []Frame      `json:"frames"`
	Captures         []RawCapture `json:"raw_captures"`
	Dials            int          `json:"dials"`
	Handlers         int          `json:"handlers"`
	SecurityGatePass bool         `json:"module01_security_gate_pass"`
	Limitations      []string     `json:"limitations"`
}

type RawCapture struct {
	Connection string `json:"connection"`
	Direction  string `json:"direction"`
	Hex        string `json:"hex"`
	SHA256     string `json:"sha256"`
	Bytes      int    `json:"bytes"`
	Closed     bool   `json:"closed"`
}

func digest(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }
func eventMAC(key []byte, previous string, e Event) string {
	e.MAC = ""
	b, _ := json.Marshal(e)
	h := hmac.New(sha256.New, key)
	h.Write([]byte("AEGISGATE_SYNTHETIC_LEDGER_V1\x00"))
	h.Write([]byte(previous))
	h.Write([]byte{0})
	h.Write(b)
	return hex.EncodeToString(h.Sum(nil))
}

type fragment struct{ start, end, sequence int }
type wireCapture struct {
	raw       []byte
	fragments []fragment
	closed    bool
}
type connection struct {
	request       string
	identity      Identity
	captures      map[string]*wireCapture
	bindings      map[uint32]Event
	boundAt       map[uint32]int
	streams       map[uint32]bool
	closedStreams map[uint32]bool
}

func analyze(l Ledger, key []byte) Result {
	r := Result{Frames: []Frame{}, Captures: []RawCapture{}, Limitations: []string{
		"Only a bounded synthetic fixture with a separately trusted signing key is authenticated; no production proxy dispatch binding is implemented.",
		"HPACK history hashes identify decoder transitions, not an exact public dynamic-table mutation trace. Maintained decoder state is opaque.",
		"Late malformed streaming prefixes can already have origin effects. Observation does not supply pre-origin admission.",
		"No security contract revision, complete runtime or Module01 GO is granted.",
	}}
	r.Research.Violations = []string{}
	r.Research.Incomplete = []string{}
	fail := func(s string) { r.Research.Incomplete = append(r.Research.Incomplete, s) }
	violate := func(s string) { r.Research.Violations = append(r.Research.Violations, s) }
	if len(key) < 32 || len(l.Events) > maxEvents {
		fail("key/event bound")
		return r
	}
	connections := map[string]*connection{}
	requests := map[string]Event{}
	downBindings := map[string]string{}
	var handlerRequests []string
	previous := ""
	inInterval, began, ended, sealed := false, false, false, false
	total := 0
	for i, e := range l.Events {
		if e.Sequence != i+1 || !hmac.Equal([]byte(eventMAC(key, previous, e)), []byte(e.MAC)) {
			fail("ledger authentication/sequence failure")
			break
		}
		previous = e.MAC
		if sealed {
			fail("event after seal")
			break
		}
		c := connections[e.Connection]
		switch e.Kind {
		case "request":
			if e.Request == "" || e.Downstream == "" || e.DownStream == 0 || e.Identity.Tenant == "" || e.Identity.Generation == 0 || e.Identity.SNI == "" || e.Identity.OriginSNI == "" || !e.TLSVerified {
				fail("missing verified request identity")
			}
			if _, ok := requests[e.Request]; ok {
				fail("duplicate request identity")
			}
			requests[e.Request] = e
		case "decision":
			request, ok := requests[e.Request]
			if !ok {
				fail("decision for unknown request")
				continue
			}
			request.Rejected = e.Rejected
			requests[e.Request] = request
			for _, conn := range connections {
				for stream, bound := range conn.bindings {
					if bound.Request == e.Request {
						conn.bindings[stream] = request
					}
				}
			}
		case "dial":
			r.Dials++
			if c != nil || e.Connection == "" {
				fail("duplicate/missing origin connection")
			}
			request, ok := requests[e.Request]
			if !ok || !e.TLSVerified || request.Identity != e.Identity {
				fail("unattributed/unverified origin dial")
			}
			if request.Rejected {
				violate("rejected request caused origin dial")
			}
			connections[e.Connection] = &connection{request: e.Request, identity: e.Identity, captures: map[string]*wireCapture{"to-origin": {}, "from-origin": {}}, bindings: map[uint32]Event{}, boundAt: map[uint32]int{}, streams: map[uint32]bool{}, closedStreams: map[uint32]bool{}}
		case "bind":
			request, ok := requests[e.Request]
			if c == nil || !ok || e.Stream == 0 || e.Stream%2 == 0 {
				fail("missing connection/request stream binding")
				continue
			}
			if request.Identity != c.identity || request.Identity != e.Identity {
				violate("cross-tenant/trust-generation/SNI binding")
			}
			if e.Downstream != request.Downstream || e.DownStream != request.DownStream {
				fail("downstream stream mapping mismatch")
			}
			if _, ok := c.bindings[e.Stream]; ok {
				fail("duplicate upstream binding")
			}
			dkey := fmt.Sprintf("%s/%d", e.Downstream, e.DownStream)
			if _, ok := downBindings[dkey]; ok {
				fail("duplicate downstream binding")
			}
			downBindings[dkey] = e.Connection
			c.bindings[e.Stream] = request
			c.boundAt[e.Stream] = e.Sequence
		case "begin":
			if began || ended {
				fail("duplicate interval begin")
			}
			began = true
			inInterval = true
		case "end":
			if !inInterval {
				fail("interval end without begin")
			}
			inInterval = false
			ended = true
		case "wire":
			if c == nil || (e.Direction != "to-origin" && e.Direction != "from-origin") {
				fail("unknown wire connection/direction")
				continue
			}
			if len(e.Hex) > maxBytes*2 {
				fail("wire capture bound")
				continue
			}
			b, err := hex.DecodeString(e.Hex)
			if err != nil {
				fail("invalid hex capture")
				continue
			}
			total += len(b)
			if total > maxBytes {
				fail("aggregate wire bound")
				continue
			}
			if inInterval && e.Direction == "to-origin" {
				r.Current.Bytes += len(b)
			}
			cap := c.captures[e.Direction]
			if cap.closed {
				fail("wire after capture close")
			}
			cap.fragments = append(cap.fragments, fragment{len(cap.raw), len(cap.raw) + len(b), e.Sequence})
			cap.raw = append(cap.raw, b...)
		case "handler":
			r.Handlers++
			handlerRequests = append(handlerRequests, e.Request)
			if c == nil {
				fail("unmapped handler connection")
				continue
			}
			request, ok := c.bindings[e.Stream]
			if !ok || request.Request != e.Request {
				fail("unmapped handler request")
			}
			if request.Rejected {
				violate("rejected request dispatched to handler")
			}
		case "parser-error":
			violate("origin parser error: " + e.Reason)
		case "transport-error", "lost":
			fail("incomplete capture: " + e.Kind)
		case "close":
			if c == nil {
				fail("unknown connection close")
				continue
			}
			for _, cap := range c.captures {
				if cap.closed {
					fail("duplicate close")
				}
				cap.closed = true
			}
		case "seal":
			sealed = true
		default:
			fail("unknown event kind")
		}
	}
	if !began || !ended || inInterval || !sealed {
		fail("unsealed/incomplete interval")
	}
	for id, c := range connections {
		if requests[c.request].Rejected {
			violate("origin dial belongs to finally rejected request")
		}
		for _, direction := range []string{"to-origin", "from-origin"} {
			cap := c.captures[direction]
			r.Captures = append(r.Captures, RawCapture{Connection: id, Direction: direction, Hex: hex.EncodeToString(cap.raw), SHA256: digest(cap.raw), Bytes: len(cap.raw), Closed: cap.closed})
			if !cap.closed {
				fail("unclosed capture")
			}
			r.decode(id, direction, cap, c, fail, violate)
		}
	}
	for _, request := range handlerRequests {
		if requests[request].Rejected {
			violate("handler belongs to finally rejected request")
		}
	}
	r.Current.Zero = r.Current.Bytes == 0
	r.Research.Complete = len(r.Research.Incomplete) == 0
	r.Research.Pass = r.Research.Complete && len(r.Research.Violations) == 0
	r.Current.Complete = r.Research.Complete
	r.Current.Pass = r.Current.Zero && r.Current.Complete
	return r
}

func (r *Result) decode(id, direction string, cap *wireCapture, c *connection, fail, violate func(string)) {
	raw := cap.raw
	offset := 0
	if direction == "to-origin" {
		if len(raw) < len(http2.ClientPreface) || string(raw[:len(http2.ClientPreface)]) != http2.ClientPreface {
			fail("missing complete connection history/preface")
			return
		}
		offset = len(http2.ClientPreface)
	}
	reader := bytes.NewReader(raw[offset:])
	fr := http2.NewFramer(io.Discard, reader)
	fr.SetMaxReadFrameSize(65536)
	fields := []hpack.HeaderField{}
	fieldBytes := 0
	dec := hpack.NewDecoder(4096, func(f hpack.HeaderField) {
		fieldBytes += len(f.Name) + len(f.Value)
		if len(fields) >= 128 || fieldBytes > 16384 {
			fail("decompressed header bound")
			return
		}
		fields = append(fields, f)
	})
	dec.SetMaxStringLength(8192)
	var pending uint32
	var compressed int
	history := ""
	frames := 0
	for reader.Len() > 0 {
		frames++
		if frames > maxEvents {
			fail("frame bound")
			break
		}
		before := reader.Len()
		start := len(raw) - before
		f, err := fr.ReadFrame()
		end := len(raw) - reader.Len()
		if err != nil {
			fail("frame parser error/truncated capture: " + err.Error())
			break
		}
		h := f.Header()
		ev := Frame{Connection: id, Direction: direction, Type: h.Type.String(), Stream: h.StreamID, Raw: hex.EncodeToString(raw[start:end]), SHA256: digest(raw[start:end])}
		for _, piece := range cap.fragments {
			if piece.end > start && piece.start < end {
				if ev.FirstSequence == 0 {
					ev.FirstSequence = piece.sequence
				}
				ev.LastSequence = piece.sequence
			}
		}
		if h.StreamID != 0 {
			request, ok := c.bindings[h.StreamID]
			ev.Identity = c.identity
			ev.Request = request.Request
			ev.Downstream = request.Downstream
			ev.DownStream = request.DownStream
			if c.boundAt[h.StreamID] > ev.FirstSequence {
				fail("stream binding supplied after origin effect")
			}
			if !ok {
				fail(fmt.Sprintf("unattributed stream %s/%d", id, h.StreamID))
			} else if request.Rejected {
				violate(fmt.Sprintf("rejected request effect %s/%s/%d", direction, h.Type, h.StreamID))
			}
		}
		var fragment []byte
		ended := false
		switch v := f.(type) {
		case *http2.HeadersFrame:
			pending = h.StreamID
			fields = nil
			fieldBytes = 0
			compressed = 0
			fragment = v.HeaderBlockFragment()
			ended = v.HeadersEnded()
			if direction == "to-origin" {
				if c.closedStreams[h.StreamID] {
					fail("HEADERS on closed request stream")
				}
				c.streams[h.StreamID] = true
				if v.StreamEnded() {
					c.closedStreams[h.StreamID] = true
				}
			}
		case *http2.ContinuationFrame:
			if pending != h.StreamID {
				fail("unmatched continuation")
			}
			fragment = v.HeaderBlockFragment()
			ended = v.HeadersEnded()
		case *http2.DataFrame:
			if direction == "to-origin" && !c.streams[h.StreamID] {
				fail("DATA without observed stream creation")
			}
			if direction == "to-origin" {
				if c.closedStreams[h.StreamID] {
					fail("DATA on closed request stream")
				}
				if v.StreamEnded() {
					c.closedStreams[h.StreamID] = true
				}
			}
		case *http2.RSTStreamFrame:
			delete(c.streams, h.StreamID)
			c.closedStreams[h.StreamID] = true
		case *http2.PushPromiseFrame, *http2.UnknownFrame:
			fail("unsupported frame semantics")
		}
		if h.StreamID != 0 {
			ev.StreamState = "open"
			if c.closedStreams[h.StreamID] {
				ev.StreamState = "request-ended-or-reset"
			}
		}
		if fragment != nil {
			compressed += len(fragment)
			if compressed > 65536 {
				fail("compressed header bound")
				break
			}
			ev.HPACKBefore = history
			if _, err = dec.Write(fragment); err != nil {
				fail("HPACK decode error: " + err.Error())
				break
			}
			history = digest(append([]byte(history), fragment...))
			ev.HPACKAfter = history
			if ended {
				if err = dec.Close(); err != nil {
					fail("HPACK incomplete block")
				}
				ev.Fields = append([]hpack.HeaderField{}, fields...)
				pending = 0
			}
		}
		r.Frames = append(r.Frames, ev)
	}
	if pending != 0 {
		fail("unfinished HEADERS/CONTINUATION")
	}
}

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: observer private-fixture-key-file")
		os.Exit(2)
	}
	info, err := os.Stat(os.Args[1])
	if err != nil || info.Mode().Perm() != 0600 {
		fmt.Fprintln(os.Stderr, "fixture key must have mode0600")
		os.Exit(2)
	}
	key, err := os.ReadFile(os.Args[1])
	if err != nil || len(key) != 32 {
		fmt.Fprintln(os.Stderr, "invalid fixture key")
		os.Exit(2)
	}
	b, err := io.ReadAll(io.LimitReader(os.Stdin, 2*maxBytes+(1<<18)))
	if err != nil || len(b) > 2*maxBytes+(1<<17) {
		fmt.Fprintln(os.Stderr, "input bound")
		os.Exit(2)
	}
	var l Ledger
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	if err = dec.Decode(&l); err != nil {
		fmt.Fprintln(os.Stderr, "invalid ledger")
		os.Exit(2)
	}
	if err = dec.Decode(&struct{}{}); err != io.EOF {
		fmt.Fprintln(os.Stderr, "trailing input")
		os.Exit(2)
	}
	if err = json.NewEncoder(os.Stdout).Encode(analyze(l, key)); err != nil {
		os.Exit(2)
	}
}
