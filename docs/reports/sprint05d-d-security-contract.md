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

Independent F at aa72f2a subsequently rejects two more narrow-correlation
claims: swapped admitted-request nonces and a duplicate nonce with an orphan
upstream stream were accepted as consistent. Full runtime PASS stayed false,
but that does not excuse the diagnostic false consistency. Source a532ea2
requires unique nonces and both captured probe and nonce on the same upstream
HEADERS stream, with exact coverage counts. The actual front fixture emits the
probe alongside its generated nonce. Both attacks are now live-fixture
regressions. This checks observed correlation only; a trusted signer that
rewrites or omits underlying coverage still defeats causality certification.

Runtime-five at a532ea2 exits0 on the full race proof and14 live mutations.
Receipt SHA256:
`14bdc9b79397dadd15333e3daf86cc9e87a174d2d0a271affa5131266bdd34d5`.
Use the runtime-four command below with output runtime-five for reproduction.
Independent F reproduction of this correction remains required.

F's next overlay confirms the nonce repair and detects two response-coverage
gaps: valid control-only reverse bytes, or captured200 for asserted421, still
looked consistent. Source6bc71e8 decodes final response status per stream,
requires response completion via DATA/trailers END_STREAM and exact response
coverage, and compares raw downstream/upstream statuses against each request's
observed stream binding. A reset cannot stand in for a completed response.
This is a bounded fixture consistency rule, not a new HTTP parser or general
protocol-state certification. Runtime-six full race proof exits0. Receipt:
`5d37cf729ee4e28e1e1db04d1df3ee7848b768c83c958072dda9c0e95afc7473`.
Independent F attacks remain authoritative for scoped acceptance. Earlier
incorrect narrow-correlation claims are superseded only by tested corrections;
the failed evidence and full runtime INCOMPLETE status remain visible.

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

## Executed Receipts

Source `36abf92`, `evidence/sprint05d-d/runtime-four`, exits0 under the shared
fixture lock. Full race execution includes the original observer tests, the
five independently authored05C F finding overlays and the live runtime with12
malicious mutations. Receipt SHA256:
`90b368ac879fa7421ab4b9e1ab33a9e082a3c0ef55b065fe1b69981c0d57781d`.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
 env GOAMD64=v1 GOTOOLCHAIN=local \
 TMPDIR=/home/tiecont/.cache/aegisgate-05d/d/.local/tmp \
 /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
 scripts/sprint05a-receipt.mjs evidence/sprint05d-d/runtime-four \
 /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
 spikes/envoy/sprint05d-d-proof.mjs
```

Runtime-three is retained FAIL1: the maintained Framer can return io.EOF for a
fully read frame header whose declared payload is entirely missing. The first
reverse-capture implementation treated that as clean stream completion. The
fix tests remaining raw bytes before each frame and treats every subsequent
read error as incomplete. The exact truncated-reverse control now rejects.
This diagnostic correction does not create full security attribution or repair
an original75/23 failure. Private overlay staging is removed in the collector's
finally path; evidence/source hashes and tool versions are retained by receipt.
