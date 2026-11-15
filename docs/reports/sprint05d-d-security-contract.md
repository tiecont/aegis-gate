# Sprint 05-D Runtime Attribution And Contract Boundary

Status: bounded runtime correlation implemented; full attribution INCOMPLETE.
Original all-byte contract remains authoritative. No runtime/Module01 GO.

## Experiment Contract

1. Failure:05C hardcoded stream binding and synthetic signer cannot establish
   complete downstream-to-origin runtime causality.
2. Hypothesis: maintained TLS connection wrappers, server TLS state,
   httptrace.GotConn/WroteHeaders and public Framer/HPACK MetaHeaders can derive
   real request/stream/dial/handler correlation across a reused pool.
3. Mechanism: standard verified TLS, public x/net/http2 Transport and Framer,
   per-admitted-request random nonce replacing caller spoofed correlation,
   signed whole-capture HMAC with separately held ephemeral key.
4. Minimum: two valid TLS/H2 requests around a421 identity denial, same origin
   connection, downstream and upstream stream numbers decoded from real bytes.
5. Positive: verified SNI/CA, encoded target, persistent reuse, body/trailer
   completion and denied-request no-dispatch; retain all four05C false-PASS
   regressions through the exact independent overlay and old suite.
6. Stop: public callbacks do not supply authenticated pre-wire stream admission
   or exact dynamic-table changes; never promote post-capture correlation or a
   fixture generation to complete runtime security proof.

## New Runtime Measurement

`spikes/envoy/sprint05c-attribution/sprint05d_runtime_test.go` adds real front
and origin verified TLS/H2 servers and maintained transport, with one captured
connection on each hop. It does not rebuild the05C Go benchmark or claim to
replace Envoy. No private codec/parser, production filter or dependency changes.
The downstream raw HPACK probe identifies the incoming stream; the front end
replaces any caller nonce before upstream admission. Raw upstream HPACK plus
public GotConn/WroteHeaders and the origin handler associate the admitted
request. A reused upstream connection serves the two valid requests around a
421 rejection. Every decrypted byte in both directions is retained as hex
within a256KiB bound, authenticated, reader-joined before closed capture.

The first run at3036dfa passes targeted race execution and11 malicious
mutations. A subsequent naming correction calls this only
`CorrelationConsistent`; RuntimeComplete/RuntimePass/Module01Pass always remain
false. This is a narrower correlation check, not a security PASS.
Mutations omit handler/trace/identity/dial/HEADERS, duplicate probe identity,
forge/late-change final status, truncate/lose capture or invalidate its MAC.
Reverse traffic also undergoes bounded maintained frame/HPACK parsing, adding
a12th deliberately truncated reverse-capture mutation. The original observer suite retains incomplete/forbidden request effects,
HPACK stateful/dynamic references, missing and reordered events and prior four
false-PASS regressions. Fresh source/receipt results follow actual execution.

## Completeness Boundary

Both streams are discovered only after real captured HEADERS. A trusted signer
can still omit an effect it never records. The maintained handler API exposes
no upstream H2 stream ID; correlation uses a fixture nonce, not a signed config
generation or a production proxy's authoritative dispatcher. Generation7 and
tenant fixture-A are static test routes, explicitly not signed-snapshot proof.
HPACK decoder dynamic state is maintained internally; its exact mutation trace
is not available through the public API. No Envoy instrumentation or system
capture-loss authority is established. Malicious trusted-signer forgery is not
prevented by HMAC. Incomplete coverage therefore cannot produce runtime PASS.

## Contract Comparison

| Property | Current aggregate zero-byte | Proposed request-isolation v2 research |
| --- | --- | --- |
| Independent SETTINGS ACK | Any byte in interval FAIL, including exact000000040100000000 | Could be permitted only with full unrelated-control attribution; no active exception |
| Forbidden request HEADERS/DATA/HPACK | Byte presence catches effects in measured interval, without causal mapping | Must detect complete/partial block, DATA and HPACK state effects across reused connections |
| New dial without request bytes | Separate dial controls required | Explicitly forbidden when caused by rejected request |
| Late-invalid/truncated upload | Strict zero forwarding requires complete validation first | Earlier request effects remain forbidden; H2 control exception does not help H1 |
| Lost capture/missing dispatch map | No valid zero-byte proof | INCOMPLETE, never PASS |
| Operational cost | Simple interval byte oracle; unrelated concurrent traffic can fail | Authoritative per-request state, authenticated mapping, full decoder/transport capture and audit burden |

The preserved dual-contract test counts all nine ACK bytes and current PASS is
false, while bounded research can distinguish control traffic. It never changes
the original75 evaluator or its interval. These contracts are not universally
equivalent: v2 permits a class of bytes v1 forbids and adds a causal proof burden
that current public instrumentation cannot satisfy. Handler/status-only evidence
is insufficient. See the separately PROPOSED05D ADR amendment for human decisions.
