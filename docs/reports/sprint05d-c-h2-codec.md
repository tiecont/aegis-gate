# Sprint05D C: H2 Error Emission API Stop

Status: **bounded research complete; runtime repair blocked**. No supported
configurable mechanism was identified that repairs oghttp2's unexpected
CONTINUATION regression while preserving the two earlier frame repairs.
No new three-case fixture or original23 execution was justified or performed.
Module01 remains NO-GO, Modules04-12 LOCKED, production BLOCKED.

## Hypothesis Declared Before Execution

Committed `spikes/envoy/sprint05d-c-hypothesis.json` declares all six fields:

| Field            | Executable decision                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Failure          | Unexpected CONTINUATION lacks the required peer PROTOCOL_ERROR; preserve HEADERS stream zero and zero WINDOW_UPDATE.                                                     |
| Hypothesis       | A released supported API might emit and flush a protocol error after adapter processing fails and before HCM closes.                                                     |
| Mechanism        | Inspect pinned codec dispatch, adapter-send boundary, public HTTP/network interfaces and protocol configuration; implement only a supported hook connecting those paths. |
| Targeted input   | Exact original `raw-H2-HEADERS-stream-zero`, `raw-H2-unexpected-CONTINUATION`, `raw-H2-zero-WINDOW_UPDATE`.                                                              |
| Positive control | After a credible implementation passes those three, unchanged original23 provides reuse, identity, cancellation and header controls.                                     |
| Stop             | Missing supported hook, missing required peer error, or loss of either prior PASS ends the attempt; no repeated codec comparison.                                        |

The missing-hook condition was met during source inspection. These checks are
source/integrity observations, not executed protocol acceptance assertions.

## Exact Release And Public Boundary

The pinned release is Envoy1.40.2, source
`b2d89e0ae53916f28770771fbdd49c5c99c5c5a2`, image
`envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`.
Actual root `.local/sprint05b-native/envoy` SHA256 is
`1d64506e25c1844f146162ddb2ece7010fa4e784faddb40a079021491f1f03cc`.
The audit verifies the committed extraction receipt and actual binary before
running only `--version`. Fresh pinned-source downloads reproduce the existing
codec implementation, HCM implementation and HCM proto hashes exactly.
Seven downloaded files and their exact URLs/hashes are retained in
`evidence/sprint05d-c/audit-01/receipt.json` under `upstream`.

| Released source path / lines                                 | Boundary found                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `source/common/http/http2/codec_impl.cc:1092-1136`           | `ProcessBytes()` can return through callback status or short/error processing before `sendPendingFrames()`.                                                                                                                    |
| Same file:1175-1198                                          | Ordinary `goAway()` submits NO_ERROR. `protocolErrorForTest()` submits PROTOCOL_ERROR and sends, but is a concrete test helper.                                                                                                |
| `source/common/http/http2/codec_impl.h:168`                  | The helper is explicitly documented as "Used in tests to simulate errors."                                                                                                                                                     |
| Same header:199,683-701,750                                  | Adapter storage and `sendPendingFrames()` belong to the protected implementation surface, not the public generic codec API.                                                                                                    |
| `envoy/http/codec.h:633-666`                                 | Public connection methods expose dispatch, ordinary goAway, shutdownNotice and wantsToWrite; no configurable post-error PROTOCOL_ERROR emission/adapter-send callback is supplied here.                                        |
| `source/common/http/http2/codec_impl.cc:1432-1475,2162-2165` | Fatal invalid-frame categories return callback failure; the visitor forwards to this implementation.                                                                                                                           |
| Same file:1763-1771                                          | `sendPendingFrames()` returns during dispatch/closed state; otherwise it calls adapter `Send()`.                                                                                                                               |
| `source/common/http/conn_manager_impl.cc:562-569`            | HCM explicitly assumes the H2 codec already sent GOAWAY, then closes with `FlushWriteAndDelay`.                                                                                                                                |
| `envoy/network/connection.h:85-90,204-211`                   | Close modes flush pending network write data. They do not expose adapter error-frame submission or serialization.                                                                                                              |
| HCM proto:625-641,680-715                                    | `stream_flush_timeout` concerns buffered end-of-stream data awaiting flow-control credit; `delayed_close_timeout` concerns socket close/write-buffer grace. Neither bridges the codec error return to adapter submission/send. |
| `api/envoy/config/core/v3/protocol.proto:754-758`            | Explicit `use_oghttp2_codec` remains hidden/work-in-progress. No such field is configured or accepted by this audit.                                                                                                           |

The retained source artifacts are `upstream-0.stdout` through
`upstream-6.stdout` in the order recorded by the receipt. Eight bounded textual
checks verify these source anchors. Inspection of these interfaces did not find
a supported configurable hook for the proposed repair. This is not a universal
impossibility claim or proof about every Envoy extension.

There is no captured internal adapter trace establishing which particular
callback/return ran, whether GOAWAY was queued, or exact QUICHE internal state
for the historical CONTINUATION failure. The report makes none of those claims.
Calling a test helper, patching the codec, or emitting replacement framing in
a custom production parser would not supply the required supported mechanism.
Ordinary NO_ERROR GOAWAY would not satisfy the original expected error code1.

## Executed Evidence

Clean tested source `3474579f9a35de62f1eb338012a185f7ad5499c1`, tree
`f672951afe4efdc85c09c4ef497ed71db7664ad3`, contains the audit collector and
six-field declaration before execution. The complete source SHA is recorded
in the receipt; later changes add only this report and evidence.

```sh
env TMPDIR=/home/tiecont/.cache flock --verbose -w 60 \
  /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint05d-c-audit.mjs evidence/sprint05d-c/audit-01
sha256sum -c evidence/sprint05d-c/audit-01/SHA256SUMS
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  --check spikes/envoy/sprint05d-c-audit.mjs
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  /home/tiecont/Projects/aegis-gate/apps/dashboard/node_modules/prettier/bin/prettier.cjs \
  --check spikes/envoy/sprint05d-c-audit.mjs spikes/envoy/sprint05d-c-hypothesis.json
git diff --cached --check -- spikes/envoy/sprint05d-c-* docs/reports/sprint05d-c-h2-codec.md
```

All commands exit0. The collector records13 child commands, raw stdout/stderr,
exits, actual tool versions, Node binary identity, source/tree and artifact
hashes. Both protected-file checks verify all11 immutable original input,
oracle and observer files against8758b1c. Eight static source checks pass.
All27 manifest artifacts verify. Audit receipt SHA256:
`be4b56ae946f8c5c5cfc2f92e1c3c5e46f6d9da6fcca15eb82ad4fa94cd90497`.

The unfiltered staged whitespace check exits2 because the actual Envoy version
stdout ends with an extra blank line. Its raw bytes and hash remain intact;
the scoped source/report whitespace command above exits0.

The shared flock was acquired immediately and held continuously through source
capture, final receipt and hashing. Disk-backed TMPDIR is under `/home`.
No fixtures, listeners, private material, containers or native proxy runtime
were created. Consequently no fresh verified-TLS loopback protocol execution,
new three-case result, full23, original75 or resource-eligibility claim exists.
Only ordinary authenticated HTTPS source downloads and local binary version
queries were performed. Root/B/A fixture coordination was notified of the
source-only stop; the lock is released and no fixture remains owned by C.

Historical `evidence/sprint05c-c/attempt-04/original23.json` is bound by hash and
its three original frame observations retained in the audit receipt, explicitly
marked `fresh_execution:false`: HEADERS stream zero and zero WINDOW_UPDATE
PASS with peer GOAWAY1, unexpected CONTINUATION FAIL with no received frame.
Historical19/23 baseline and20/23 alternate-codec totals remain historical.
No payload, oracle, timeout or observation interval changed.

## Resume Boundary

One alternative is a released maintained repair or supported hook that submits
the required error and drains adapter output before closing on parser failure.
Resume only with its exact source/API pin and the three unchanged frame cases;
then require full unchanged23, prior positive controls and independent review.
A second alternative is a separately reviewed maintained runtime/ingress
architecture with its own complete protocol/TLS/identity/resource proof and
explicit architecture authorization. Neither alternative is implemented here.
No public maintainer message, private fork or further codec comparison is queued.

## Agent Completion Report

- Module/status:01/C, bounded research complete; supported runtime repair blocked.
- Commits/files:3474579 audit collector and hypothesis; separate report/evidence commit follows. Only C-owned sprint05d files change.
- Architecture/ADR decisions: none; ADR012 remains proposed with approval pending.
- Contracts changed: none; all11 protected sources remain unchanged.
- Positive checks: pinned source/binary identity, eight static anchors,27 artifact hashes, syntax, pinned Prettier and whitespace pass.
- Security negatives: no new runtime execution; three exact historical observations retained by hash only.
- Performance/resource data: none; resource_eligible and semantic_security_pass are false.
- Risks/release blockers: CONTINUATION regression and both historical userinfo failures remain; no eligible replacement runtime.
- Human review: F may independently review source evidence and this bounded stop; no gate opening requested.
- Next unblocked work: root/F can review this exact source and retained evidence; runtime modules remain locked. No push or merge performed.
