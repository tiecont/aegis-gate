// Go overlay tests for the independent review; no D source file is modified.
package main

import (
	"testing"

	"golang.org/x/net/http2"
)

func TestSprint05CFFinalDecisionCannotBeRewritten(t *testing.T) {
	e := capture(t)
	e[0].FinalDecision = false
	middle := []Event{
		{Kind: "decision", Request: "valid", Rejected: true, FinalDecision: true},
		{Kind: "decision", Request: "valid", Rejected: false, FinalDecision: true},
	}
	e = append(e[:len(e)-3], append(middle, e[len(e)-3:]...)...)
	r := inspect(t, e)
	record(t, r)
	if r.Research.Pass {
		t.Fatal("final rejection overwritten: earlier origin dial and HEADERS were accepted")
	}
}

func TestSprint05CFMultipleRequestsCannotAliasDownstreamStream(t *testing.T) {
	// An allowed request and rejected request claim the same downstream identity.
	allowed := request("alias", 3, false)
	e := capture(t, allowed, binding("alias", 3), origin(t, func(f *http2.Framer) {
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 3, BlockFragment: block(t), EndHeaders: true})
	}), Event{Kind: "handler", Connection: "origin-1", Request: "alias", Stream: 3})
	r := inspect(t, e)
	record(t, r)
	if r.Research.Pass {
		t.Fatal("allowed alias hid effects on rejected request's downstream connection/stream")
	}
}

func TestSprint05CFHandlerRequiresObservedHEADERS(t *testing.T) {
	allowed := request("no-headers", 5, false)
	e := capture(t, allowed, binding("no-headers", 5), Event{Kind: "handler", Connection: "origin-1", Request: "no-headers", Stream: 5})
	r := inspect(t, e)
	record(t, r)
	if r.Research.Pass {
		t.Fatal("capture reported complete despite handler dispatch with no observed upstream HEADERS")
	}
}

func TestSprint05CFRejectedExistingStreamDATAControl(t *testing.T) {
	e := capture(t, binding("denied", 3), origin(t, func(f *http2.Framer) {
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 3, BlockFragment: block(t), EndHeaders: true})
		_ = f.WriteData(3, true, []byte("owned synthetic review body"))
	}))
	r := inspect(t, e)
	record(t, r)
	if r.Research.Pass || len(r.Research.Violations) < 2 {
		t.Fatal("forbidden DATA/HEADERS control failed to reject")
	}
}

func TestSprint05CFHandlerCannotPrecedeCompleteRequestHeaders(t *testing.T) {
	fragment := block(t)
	e := capture(t, request("incomplete-headers", 5, false), binding("incomplete-headers", 5), origin(t, func(f *http2.Framer) {
		_ = f.WriteHeaders(http2.HeadersFrameParam{StreamID: 5, BlockFragment: fragment[:1]})
	}), Event{Kind: "handler", Connection: "origin-1", Request: "incomplete-headers", Stream: 5}, origin(t, func(f *http2.Framer) {
		_ = f.WriteContinuation(5, true, fragment[1:])
	}))
	r := inspect(t, e)
	record(t, r)
	if r.Research.Pass {
		t.Fatal("handler ran before CONTINUATION completed the captured request header block")
	}
}
