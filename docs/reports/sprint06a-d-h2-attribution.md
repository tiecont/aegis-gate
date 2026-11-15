# Sprint06A D: Attribution Challenges And Public API Stop

Status: bounded research complete; authoritative runtime coverage **INCOMPLETE**.
The test run exits0, but both fresh ACK observations retain aggregate **FAIL**.
RuntimeComplete, RuntimePass and Module01Pass remain false throughout. No new
acceptance, production runtime, signed-generation claim or contract activation.

Independent F rejected the initial bounded-consistency source406d560 and report
ba54e45 for four additional false positives. Correction69a3be8 passes the exact
unchanged F overlay locally; independent F re-review remains required. The
initial attempt01 and F failed receipts are preserved. The correction and its
attempt02 evidence are detailed below; initial passing test counts do not imply
the rejected source was accepted.

## Declared Experiment

| Field      | Implementation and acceptance boundary                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Failure    | Observer-supplied dispatch/nonce events and post-wire mappings cannot prove complete runtime causality; unrelated control bytes still fail the effective contract.                                    |
| Hypothesis | Independent adversarial transcripts expose diagnostic false consistency; real maintained client control processing can produce an ACK without a downstream request and during a real identity denial. |
| Mechanism  | Unchanged Go1.27.4, x/net v0.62.0 Transport/ClientConn, verified TLS, public Framer/HPACK; new bounded transcript checks only.                                                                        |
| Minimum    | Omitted dispatch/request, aliased stream, swapped nonce, unfinished HPACK, manipulated final response and lost capture; actual no-request and denial-overlap ACK captures.                            |
| Positive   | Unchanged05C/05D and F regressions, honest bounded transcript, real verified TLS/H2 denial421; all raw origin and downstream bytes retained.                                                          |
| Stop       | Public callbacks do not expose combined authenticated pre-wire dispatch/stream/HPACK/signed-generation authority. No complete runtime PASS; no new runtime comparison or rebuild.                     |

## Source And Execution

Worktree `/home/tiecont/.cache/aegisgate-06a/d`, existing branch
`test/sprint06a-h2-attribution`, baseline
`8929adfd10f245ec0dac70b5304f1a2b445e7357`.
Source committed before testing:
`406d560f23bb9cc39c7b6f4a8e5eeaf1ea148a7d`, tree
`c6affd863db975e17a05c793b9e0fb77317f26e1`.
Only new06a-named test, runner, capability specification, evidence and this report
are owned. Historical05C/05D sources, dependencies and production files stay
byte-identical.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
 /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
 scripts/sprint06a-d-proof.mjs evidence/sprint06a-d/attempt-01
```

Executed 2026-11-15T11:02:38.142Z through11:02:43.149Z. Collector0; all nine
recorded commands0. The runner compiles a race-enabled test binary using Go's
overlay API to include both unchanged independent F overlays:
`scripts/sprint05c-f-observer_test.go.txt` and
`scripts/sprint05d-f-runtime_test.go.txt`. The original package tests and05D
runtime fixture execute unchanged alongside the new06A tests. Actual binary
SHA256 `e7aa8a343a907f5e8694f89dbc4ed6db50b2a1db76c5cec5503c3c812f6cebbf`.
The exact compile/test argv, source/tree, nine source hashes, four public API
source hashes, executable hashes, versions and raw stdout/stderr are in receipt.

Result:19 top-level tests and65 subtests PASS; zero skips/failing tests/race
diagnostics. This is test correctness, not a passing ingress security gate.
Four public `go doc` captures retain the inspected trace, Transport, ClientConn
and HPACK Decoder interfaces. Before/after protected checks verify all11
original pins against8758b1c and unchanged inventory SHA256
`85de42e7d2ac54b0f199bcced46760bec41b7687dd7c7016dd580ea4a300c1fa`.
Original75=73/75 and original23=19/23 remain historical authoritative results;
neither full comparison is rerun or relabeled.

Receipt `evidence/sprint06a-d/attempt-01/receipt.json` SHA256:
`cd53a31e4421712f092c7d4545462696d55f7d637dcbfed5416412407818a332`.
All19 manifest artifacts verify. Manifest SHA256:
`a8a793bb8bc251ab0fa77a72295fc1b7cc37184c33d87f87c35f60917de007a4`.
No failed test attempt occurred; earlier historical failed evidence is untouched.

## Independent Adversarial Results

The new tests construct their own public Framer/HPACK transcripts rather than
reusing the F builders. Synthetic fixtures are explicitly marked as such; their
fixed generation7 and fixture tenant are not signed Module03 runtime evidence.

| Challenge                                                                      | 05D narrow consistency | 06A bounded consistency | Complete runtime |
| ------------------------------------------------------------------------------ | ---------------------- | ----------------------- | ---------------- |
| Honest transcript                                                              | true                   | true                    | INCOMPLETE       |
| Omitted dispatch marker or omitted request                                     | false                  | false                   | INCOMPLETE       |
| Two admitted request blocks aliased onto stream1, unrelated response3 retained | true                   | false                   | INCOMPLETE       |
| Swapped nonces                                                                 | false                  | false                   | INCOMPLETE       |
| Incomplete HEADERS/HPACK without CONTINUATION                                  | false                  | false                   | INCOMPLETE       |
| Raw200 substituted for the asserted421                                         | false                  | false                   | INCOMPLETE       |
| Capture loss, truncated reverse payload or duplicate capture identity          | false                  | false                   | INCOMPLETE       |
| Orphan DATA on unobserved stream99                                             | true                   | false                   | INCOMPLETE       |
| Trusted signer rewrites events and captured probe/nonce bytes consistently     | true                   | true                    | INCOMPLETE       |

The12 new transcript cases include ten rejected mutations plus honest and
trusted-signer-rewrite controls.06A's wrapper additionally rejects repeated
initial HEADERS, incomplete bounded GET streams, duplicate capture identities
and any request DATA in this deliberately narrow GET fixture. It does not add a
general HTTP/2 protocol-state validator.05D is preserved unchanged, including
raw results demonstrating its stream-alias and orphan-DATA diagnostic gaps.
The coherent trusted-signer rewrite intentionally remains transcript-consistent:
authenticating observer-selected bytes cannot prove that the observer recorded
every real dispatch or effect. RuntimePass stays false even in that control.

## Independent F Rejection And Correction

F source `7694b614fae56b34d96e4c4495301595cb19e676`, evidence/report commit
`f6b1413c424d9e56d2e40bc937b397ae6cf7ee05`, rejects the initial wrapper:
untagged complete HEADERS stream99 passes on either hop, and two request
identities in one complete block pass on either hop while unrelated completed
responses satisfy the old map cardinalities. The original D run's19/65 success
did not cover these defects. RuntimeComplete/RuntimePass remained false, but
that does not excuse diagnostic false consistency.

Correction source `69a3be8d1e339bf3699b721ff8af78042c20f9fe`, tree
`cf2dfe73a0d131faff43751b92fca066002015ec`, changes only the06A wrapper and
runner. Every downstream bounded GET block must contain exactly one nonempty
unique probe and no fixture nonce. Every upstream block must contain exactly
one nonempty unique probe and nonce, bound to the same admitted request event.
Each decoded block must have an event; every relevant event must have a block;
each stream must be unique. Completed response stream IDs and statuses must
match the exact block/event stream set, including an explicit rejection for
responses without a corresponding block. This remains a bounded fixture rule,
not an authoritative runtime coverage or general protocol validator claim.

The runner first executes the original D suite and both historical F overlays,
then extracts F's exact independent source by immutable `git show`, adds it as
one more Go overlay and recompiles/runs the full race suite. F's source SHA256
`224469de9d5355ad5ecd01ed768bd50cd4998938558dcd2401004531b3f3cd89`
is retained in `f-overlay.stdout` and receipt metadata. The original failed F
full-proof stdout/stderr, receipt and SHA256 manifest are copied byte-for-byte
with their original immutable commit references into attempt02. Historical
attempt01, F evidence and all05C/05D sources stay untouched.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
 /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
 scripts/sprint06a-d-proof.mjs evidence/sprint06a-d/attempt-02
```

Actual locked execution 2026-11-15T11:27:07.042Z through11:27:13.497Z:
all16 child commands exit0, collector0. The first run passes19 top-level tests
and65 subtests. The full run with exact independent F source passes20 top-level
tests and81 subtests, zero failing tests/skips/race diagnostics. All four new F
counterexamples now return CorrelationConsistent=false. All14 F negative cases
reject; honest and coherent trusted-signer rewrite return true for transcript
consistency only. Every F case retains false RuntimeComplete/RuntimePass/
Module01Pass. Old05D still reproduces its earlier alias/orphan-DATA diagnostic
gaps unchanged. Both full runs freshly execute the zero-downstream-request and
real-denial-overlap ACK captures: each retains9 bytes and aggregate FAIL,
with all raw origin/downstream bytes and completed421 preserved.

Receipt `evidence/sprint06a-d/attempt-02/receipt.json` SHA256
`e7c8240fe8e680bfde61b756432122a55dfdf19543fc347d0d931ec3a01ee0fb`.
All33 artifact hashes verify; manifest SHA256
`e7de97c35468eb662f14e45d5dea35e65aad662f289154033ef73ab3f7e9d88e`.
Original D binary SHA256
`7b0b27a3f4c8111349f9e415b2c174a5142df30d3d77e805aa233c0ede5f4fe8`;
binary including F SHA256
`90423864777e5f8de02270ae36f74aace9e110fb6690732a7401a5c4bb1bbeff`.
Before/after11-pin checks match, the private stage is removed and TMPDIR is
empty. Source-only syntax/formatting checks also pass. Independent F acceptance
of the corrected exact source has not yet been supplied; no acceptance is
inferred from this author replay.

## Actual ACK Captures

Each case uses a dedicated loopback verified TLS/H2 connection, created through
public `http2.Transport.NewClientConn`. A controlled peer submits server SETTINGS;
the maintained client read loop generates the ACK. No test submits client ACK
bytes. Initial handshake/control traffic stays in the full bidirectional capture.
The synchronized experimental interval begins before the second server SETTINGS
and ends only after its actual ACK is read; this does not alter any original
acceptance interval, input, evaluator or timing requirement.

| Fresh observation                                           | Downstream requests | Origin request HEADERS | Measured origin bytes   | Effective aggregate |
| ----------------------------------------------------------- | ------------------- | ---------------------- | ----------------------- | ------------------- |
| Independent control, no downstream request                  | 0                   | 0                      | 9: `000000040100000000` | FAIL                |
| Independent control while mismatched Host denial is pending | 1                   | 0                      | 9: `000000040100000000` | FAIL                |

The second case sends a real verified TLS/H2 request with SNI example.com and
Host other.example.com. Its actual handler reaches the mismatch branch and waits
on a synchronization channel. The unrelated origin ACK is captured before the
handler may send its421; the actual peer then receives completed421. Raw front
request/response bytes are logged separately as `actualDownstreamCapture`.
This is an isolated identity-check fixture, not a JWT/authz or signed-admission
implementation and not an Envoy rerun.

Both origin captures retain88 bytes toward origin and24 reverse bytes, including
preface, initial SETTINGS/WINDOW_UPDATE/ACK and the measured second ACK. The
interval starts at byte79. Every byte is retained as hex; no control byte is
subtracted. Capture loss is false and readers join before final origin capture.
These observations support the narrow control-only classification while leaving
both effective aggregate verdicts FAIL and full runtime coverage INCOMPLETE.
One independent connection is deliberately pre-established per case; no claim
of rejected-request zero dials, general pool isolation or concurrent traffic
attribution follows.

## Exact Supported API Stop

`docs/reports/sprint06a-d-capability-v1.json` specifies version
`AEGISGATE_H2_ATTRIBUTION_CAPABILITY_V1` and a proposed, inactive hook contract.
The raw public API documentation and hashed installed maintained sources show:

- `httptrace.GotConn` observes acquired connections. `WroteHeaders` has no stream
  argument and runs after header serialization (`transport.go:1280-1282`).
- Public Framer/MetaHeaders derives stream IDs and fields from already captured
  bytes. It cannot establish an omitted runtime dispatch or a pre-wire decision.
- HPACK Decoder's public field-emission callback does not expose exact table
  insertions/evictions or encoder mutations; its dynamic table remains private.
- These APIs do not bind the complete verified snapshot deployment/digest,
  tenant/route/resource generation, TLS identity and attempted origin effects at
  one authoritative admission boundary.

The proposed hook requires runtime epoch, monotonic event sequence, exact
request/downstream/origin stream identity, verified snapshot and TLS binding,
every attempted dial/HPACK/header/DATA effect, control pairing, byte spans,
cancellation and independent capture reconciliation/loss. Missing or mismatched
coverage must remain INCOMPLETE. No such runtime hook is implemented or claimed.
The stop is bounded to the inspected Go1.27.4/x/net v0.62.0 APIs, not a universal
impossibility claim. Root's official release audit owns broader upstream claims.

## Isolation And Limits

The shared flock covers setup, overlay staging, compilation, TLS fixtures,
capture, raw streams, hashing and complete private-stage cleanup. TMPDIR is
disk-backed worktree `.local/tmp`; the stage is removed and TMPDIR is empty.
Listeners bind127.0.0.1, no containers/public endpoints or external traffic are
used. TLS verification stays enabled. Fixture certificates/keys stay in process
memory; no keys, credentials or tokens are retained. Captured request bodies and
IDs are synthetic, not customer material. No private parser, TLS/crypto fork,
production code, accepted snapshot wire or dependency/scanner policy change.
No throughput/cgroup/capacity or full make check/security-scan claim; F/root own
independent clean-source review and final integration gates.

## Agent Completion Report

- Module:01 research, Sprint06A D.
- Status:complete bounded challenges/captures/API specification; authoritative
  runtime coverage remains INCOMPLETE and Module01 NO-GO.
- Commits/files:406d560 initial source, ba54e45 initial report/evidence;
  69a3be8 correction source; separate correction report/evidence delivery.
- Architecture/ADR decisions:none; proposed hook is inactive; ADR012/v2 pending.
- Contracts changed:none; original75/23 and protected files unchanged.
- Positive tests executed:exact locked command above exits0; unchanged runtime,
  old false-PASS regressions, honest transcript, actual TLS/H2 completed421 and
  both maintained-client ACK observations; full raw streams retained.
- Security negative tests executed:ten new transcript mutations reject bounded
  consistency; trusted rewrite remains consistent but cannot produce runtime
  completeness/PASS; initial wrapper rejected by F's four additional findings;
  corrected source passes unchanged F overlay with all14 negatives rejecting.
  Both9-byte effective aggregate cases remain FAIL.
- Performance data:none; only bounded local correctness observations.
- Known risks/release blockers:no authoritative public pre-wire mapping or exact
  HPACK mutation/signed-generation/coverage authority; unrelated control still
  violates the unchanged all-byte contract. Modules04-12 LOCKED, production BLOCKED.
- Human review needed:F/root independent exact-source review; no architecture
  activation or release signoff requested or implied.
- Next unblocked work:F can replay this source; root may consume exact API stop
  and observed limits in its proposed decision. No push/merge performed.
