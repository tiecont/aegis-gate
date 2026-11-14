# Sprint05-A implementation and measured results

Status: engineering improvements measured; final integration review, full root
gates and exact-head/main hosted closeout PENDING until recorded below or in a
subsequent receipt addendum. Module01 remains **NO-GO**. No production runtime
or human architecture/security approval is implied.

## Baseline and implementation

Refreshed baseline main `541d1d915ce6a3b679dc3fed3ea0a98f908ce001`, tree
`89eff9430f2bb7044683eaf9e62e6657a7295a86`; baseline hosted receipt is
`evidence/sprint05a-root/baseline-ci/`. Original75/23 inputs, assertions,
evaluator, observation intervals and all-byte requirement remain unchanged.
Root inventory and extraction receipts precede candidate changes. Source was
committed before runtime capture. Execution ownership and acceptance contract:
`docs/sprints/05a-execution.md`.

| Owner | Branch | Exact component head / implementation |
| --- | --- | --- |
| A | `fix/sprint05a-envoy-te-rejection` | `9391ba922bc8daa2c68c86bb5e770d8685b6a4d7`; supported status-only local501=>400 mapper, candidate launcher and original-input controls |
| B | `feat/sprint05a-strict-parser` | `133d3eae70fa6dfe6b27ee0b4ca0ce08b8d44dcf`; released llhttp C API driver, bounded test-only admission adapter, Envoy/Nginx negative proofs |
| C | `fix/sprint05a-h2-identity` | `d4fc4b1460d846142c05beb854697efe89a10352`; five supported H2 policies, passive tap, untapped control and lifecycle proof; no repair found |
| D | `fix/sprint05a-protocol-limits` | `d06728676bcf63a0464a665b9447b69c423a27ef`; supported minimum upstream H2 windows and stream-level invalid-message rejection; cleanup corrected at `c698a4af61195aad5a8a80d2b8d0d090f0f1d068` |
| E | `test/sprint05a-regressions` | `a001282`; actual accepted-module integrations, strict dependency checks and independent receipt verification |
| F | `review/sprint05a-security` | `acec5e6`; independent A/D and retained B/C/combined reproductions; final integration verdict recorded separately |
| Root | `spike/sprint05a-combined` | `8d293c8ad7ab5c2deaac868462913243852adde7`, tree `03b61ba9303c4dfc7538b2b8feb8f4658d0ad53c`; compose A/D policies without changing baseline |
| Root | `sprint/05a-integration` | accepted components integrated sequentially; exact final head/PR/merge recorded at closeout |

Only additive feasibility/test/research sources, evidence and scoped status/gate
receipt helpers change. No private production framing parser/fork, architecture
substitution, Module04/10 implementation, dependency override change or upstream
publication. Local501 mapping applies to codec/local replies, not upstream501;
broader production local-status policy remains review work.

## Original75 comparison

Historical Pingora63/75 and Hyper70/75 are references, not new runtime runs.
Historical Envoy69/75 becomes **73/75** in A and the combined candidate.
Independent F reproduces73/75. The unchanged evaluator correctly exits1.

| Original failed ID | New exact disposition |
| --- | --- |
| `malformed-HTTP-invalid-transfer-encoding` | PASS400, actual peer close, zero origin effects |
| `strict-ingress-TE-repeated-chunked` | PASS400, actual peer close, zero origin effects |
| `strict-ingress-TE-not-final-chunked` | PASS400, actual peer close, zero origin effects |
| `supplemental-repeated-transfer-encoding-fields` | PASS400, actual peer close, zero origin effects |
| `malformed-HTTP-obsolete-folded-header` | FAIL;263 decrypted bytes,1 origin handler |
| `HTTP2-authority-Host-and-SNI-confusion-rejected` | FAIL;9 decrypted bytes,0 handlers,0 parser errors |

No new75 regression. A's51 focused probes include exact original vectors,
fresh/reused downstreams, actual peer end without client FIN, valid chunked
bodies/methods, genuine origin501, six encoded targets and ordered pipelining.
Both TLS hops verify CA/SAN/SNI. All negative TE intervals have zero decrypted
bytes, new origin connections, handlers, parser and transport errors.

Combined root proof: `evidence/sprint05a-root/candidate-02/commands.json`,
`original75.json`, `original23.json`, `controls.json`, `SHA256SUMS`. Its runtime
source is the exact combined source above, clean before execution. Candidate01
failed before traffic on missing installed ws dependency; its raw failure and
cleanup remain retained, not counted. Strict unchanged lock installation
precedes completed02. Original75 and23 child exits1 are retained; collector
exit0 denotes complete capture/cleanup, not security acceptance.

## Strict parser and H2 proof

Released llhttp9.4.4 official source
`816485216511b86459b2e6478190e14c38c14891` rejects SP/HTAB continuation before
normalization through its maintained strict parser API. Both exact historical
fold vectors return400 with peer closure and zero origin bytes/dials/handlers/
parser/transport errors in B's PoC.22 wire and24 direct controls include folded
trailers, fragmented input, positive headers/trailers, unchanged encoded targets
and ordered pipelines. C callbacks reject at the original continuation byte.

This is a narrow maintained parser capability, **not a complete ingress runtime**.
The adapter buffers a complete message including trailers, caps pending input
at32KiB and invokes an unmodified upstream C parser subprocess. It is test-only;
streaming, large bodies, H2, WS/gRPC, signed generations, pooling and broader
identity/resource scope remain unproved. Envoy supported settings still fold
and forward; its pinned image rejects the validator extension as unsupported.
Nginx1.30.6 rejects folded headers but accepts/discards folded trailers and
rejects a required valid encoded-NUL target. Neither is an eligible substitute.
Exact source/version/license/proof is in B's report and versioned receipts.

C tests recovery, minimum windows/HPACK0, explicit identity validation,
per-downstream pool partitioning and max32 requests per H2 connection. Each
original75 run remains69/75 with the exact9-byte failure. A no-tap run agrees.
Passive bytes are `000000040100000000`, SETTINGS ACK on the previously valid
origin connection, SHA256
`a9fd441cc14ae4b467f3ea0a0ed70de71bb5834db34815eca9cceb70017adfd6`.
All bytes remain counted. No pooling disablement, interval delay, subtraction
or handler-only acceptance is used. Cold denial/reuse/concurrency/route pools/
generation rotation/retired trust controls pass21/21 across three policies;
these diagnostic intervals do not replace the original failed interval.

## Original23 and resource observations

Historical16/23 becomes **19/23** in the selected D and combined candidate.
Independent fresh baseline is17/23 because the paused-reader timing varies;
do not claim a deterministic three-case failing-to-passing transition.

| Historical failure | Selected unchanged expectation |
| --- | --- |
| `settled-reuse-identity-and-three-authority-negatives` | FAIL; original userinfo operation deadline |
| `individual-settled-userinfo-denial` | FAIL; original operation deadline |
| `raw-H2-HEADERS-stream-zero` | FAIL; closure lacks required error-frame evidence |
| `raw-H2-zero-WINDOW_UPDATE` | FAIL; closure lacks required error-frame evidence |
| `raw-H2-uppercase-header-name` | PASS; peer RST_STREAM1 PROTOCOL_ERROR, all origin counters0 |
| `raw-H2-connection-specific-header` | PASS; same frame and zero origin effects |
| `slow-reader-backpressure-and-response-cancellation` | PASS;196608 produced bytes at200ms, cancellation reaches origin; baseline timing variable |

Actual repaired-header frame is `00000403000000000100000001`. Supported upstream
receive windows65535 cause8/32MiB paused producers to plateau at196608 bytes
at200/500ms, remain incomplete and receive actual upstream RST2 on cancellation.
17 bounded controls preserve valid H2 reuse, WS echo/close1000, bidirectional
gRPC/trailers/cancellation and partial-upload cancellation. All17 are observation
complete, not alternate security gate passes. Short RSS/window samples do not
prove sustained fairness, production memory bounds or complete attribution.
The stronger observer still reports `semantic_security_pass=false`.

## Accepted modules and dependencies

E's committed collector `e325d80f45147f3125ebb9ac9428420cdba348c1` runs64
commands with128 verified raw slices. Actual PostgreSQL/Redis/NATS JetStream/
mTLS, tenancy/RBAC/OIDC negatives, signed snapshotv1 publication/approval/
rollback/atomic consumer, encrypted LKG/floors/drain/archive/pruning pass.
Go11 packages/88 top-level/151 subtests have0 failures and0 skips; dashboard
lint/typecheck/test/build/integration pass. Isolated Compose networking, stale
volume credential behavior, image identity and cleanup pass. No product change.

Strict npm resolution supports existing TS6.0.3; released typescript-eslint8.72.2
still excludes TS7 (`>=4.8.4 <6.1.0`). Disposable TS7 resolution rejects with
ERESOLVE. Compatible pins/minimatch11.0.7 override remain. Fresh dependency
checks pass; Pingora derivative/unsafe-libyaml unmaintained warnings remain
visible. Historical image/SBOM references are not claimed as fresh scans.
Root complete scan, including fresh image/SBOM checks, is recorded separately.
External generation floor is not a production monotonic storage service.

## Review, gates and delivery

Initial F scoped ACCEPT confirms four TE repairs, two H2-header repairs and
bounded-window/cancellation observations. Overall protocol acceptance is
REJECTED. Original D cleanup collector is rejected for reuse; corrected mount-only
inspection/removal wait source above has a fresh17-control run at
`evidence/sprint05a-d/attempt-03/`. Final component/integration security review,
root local gates, exact PR-head CI, merge SHA and main CI: **PENDING**, to be
filled only from actual completed receipts. Earlier failed attempts and A's
sanitized capture correction remain disclosed; no unreviewed unsafe ancestry
is accepted. No upstream issue/PR draft was externally published.

All shared fixtures/scanners hold `/tmp/aegisgate-sprint02-fixtures.lock`
through setup, execution, evidence hashing and cleanup. Unique projects and
actual network discovery prevent shared fixture edits; only owned disposable
resources/private material are removed. Raw manifests bind exact source/tree,
tool binaries/versions, command arguments, timestamps, exit codes and SHA256.

## Gate matrix and next action

| Gate | State |
| --- | --- |
| Module00 | PASS local |
| Module01 / M0-PROXY-GO-NOGO | NO-GO |
| Module02 | PASS local |
| Module03 | PASS local |
| Modules04-12 | LOCKED |
| Production | BLOCKED |

Architecture owner, security owner, selected approved runtime/contract, approval
reference/date: **PENDING**. ADR012 remains PROPOSED; aggregate zero bytes is
binding. An isolated PoC or independent partial repair cannot supply approval.

Next justified implementation work: prove a maintained complete integration of
strict pre-normalization header/trailer rejection without whole-message streaming
regression; separately identify a supported H2 lifecycle mechanism that passes
the original zero-byte interval while preserving reuse. Envoy/Balsa lacks the
proved public rejection hook; existing pool/window policies do not fix ACK
lifecycle. Resolve both userinfo deadlines and two required connection-error
frames using exact payloads. Then unchanged75/23, full protocol/TLS/identity/
generation/resource proof, maintenance review, clean independent reproduction,
local/hosted gates and actual affirmative human approval are all required.
