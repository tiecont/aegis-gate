# Sprint04-B Alternative Origin-Isolation Test Design

Status: proposed design for independent security review. **Not an enabled
evaluator or replacement gate.** Original75 inputs/IDs/expectations/observer
timing and raw all-byte counters remain unchanged. Historical H2 result is FAIL.
The reviewing agent must record its exact design source and verdict separately.

## Preconditions

Formal architecture/security approval of ADR012 Option2 is required before any
acceptance change. Build a separate versioned proposed-contract test suite;
continue running/reporting the original75. Pin source/tool/image hashes and
bound connections/streams/frames/bytes/memory/deadlines. Use verified loopback
TLS on both hops, exact SNI/ALPN/cert identities and the full-lifecycle fixture
lock. A diagnostic observer does not become a production HTTP parser.

## Measurements And Assertions

1. Record every bidirectional decrypted byte, totals, connection identities and
   immutable raw-frame hashes from before warmup through bounded cleanup. Keep
   the original unchanged measurement interval and result as a separate column.
   Detect truncation/dropped samples; incomplete capture is inconclusive/FAIL.
2. Correlate downstream request/stream IDs to upstream connection/stream IDs
   using test-only dispatch instrumentation and independent origin observation.
   Authenticate Host/:authority/verified-SNI before any upstream admission.
   Observe actual new dials/handshakes, not just origin handler connections.
3. Parse full frame state with maintained H2/HPACK tooling. Include fragmented
   HEADERS/CONTINUATION, padding, PRIORITY, dynamic table updates, compressed
   blocks, partial frames, RST/GOAWAY and DATA. Raw octet presence is retained
   even if frame parsing fails. Parser/transport errors are separate counters.
4. Assert no rejected request opens an upstream stream, contributes any header
   block/HPACK mutation/DATA or application handler, or triggers a new origin
   dial. No cross-tenant pool or metadata exposure. An unassigned byte/frame,
   missing stream mapping or invalid state is inconclusive/FAIL.
5. Separately inventory existing valid-connection SETTINGS/PING/WINDOW_UPDATE,
   cancellation/drain and valid-stream bytes. Permit only explicitly approved
   control-state transitions causally tied to existing valid state; never accept
   all type4/type6/etc traffic by label alone. RST_STREAM on a forbidden new
   stream and new HPACK state are not innocent connection housekeeping.
6. Report original aggregate zero-byte outcome, proposed request-isolation
   outcome, no-new-connection outcome and raw attributed/unattributed/control/
   application bytes independently. Do not compute a new "zero" by subtracting
   approved control bytes from the original counter.

## Required Scenarios

| Scenario | Required control / negative result |
| --- | --- |
| Cold deny with mismatched Host, authority, userinfo or SNI | No new origin dial/stream/bytes; deterministic bounded rejection |
| Warm valid stream then deny, immediate and with scheduled control frames | Valid response/reuse preserved; denied request has zero upstream stream/header/data; raw SETTINGS ACK remains counted |
| Concurrent long valid stream plus denied stream | Attribute valid DATA/control; deny opens no upstream stream; no header/HPACK/tenant leak |
| Same versus different tenant/trust/config-generation pool | Correct identity/partitioning; no rejected-request pool creation or old-trust reuse |
| Fragmented/compressed headers and CONTINUATION interleaving violations | Complete state accounting; malformed ingress never reaches origin; incomplete observer remains FAIL |
| Malicious frame labelled as control / new-stream RST / HPACK mutation | Observer rejects state abuse; no type-only whitelist bypass |
| Header/trailer folding, all TE cases, H1 pipelining and upgrades | Unchanged strict pre-normalization/zero-byte/4xx-close contract; valid encoded targets and order preserved |
| Client cancel, origin error, GOAWAY, TLS closure and deadline races | Bounded cleanup, precise partial bytes/lifecycle counters, no hidden pending I/O |

Validate the observer independently against deliberately leaking synthetic
fixtures: partial forbidden HEADERS with no handler, DATA on a reused stream,
new dial without application bytes, CONTINUATION/HPACK side effects, forged
identity mapping, lost/truncated capture and concurrent valid control traffic.
It must detect every deliberate violation and keep valid protocol controls.
Then independently reproduce selected candidate results on clean exact source.

## Acceptance Boundary

E review of this design is a design-review verdict only. It does not constitute
implemented observer proof, human contract approval, a passing original75,
Module01 GO or production signoff. If any scenario cannot be measured
conclusively, retain failure and document the precise missing evidence.
