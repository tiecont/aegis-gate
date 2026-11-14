# Sprint05-A implementation and measured results

Final integration closeout: PR17 merged at
`581a609df8c3c3a0ce62d75f4f58fa6db8f76816`; exact final-head43617194188 and
merge43618663914 both PASS the two hosted jobs. The
[closeout addendum](sprint05a-closeout-addendum.md) supersedes checkpoint pending
delivery fields below while retaining all mandatory failures and gate locks.

Status: engineering improvements independently accepted in their scoped research
and test boundaries; full root gates PASS. Exact-head/main hosted closeout
PENDING until recorded below or in a subsequent receipt addendum. Module01
remains **NO-GO**. No production runtime
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
`evidence/sprint05a-d/attempt-03/`. Final independent review at `862f1ad`
ACCEPTs exact B/C/E research/regressions, corrected D collector and preservation
of the combined partial repairs; complete runtime eligibility is REJECTED.
See `sprint05a-f-integration-review.md` and the final handoff at `c5cd051`.
Root full local gates now PASS as recorded below; exact PR-head CI, merge SHA
and main CI remain **PENDING**,
to be filled only from actual completed receipts. Earlier failed attempts and A's
sanitized capture correction remain disclosed; no unreviewed unsafe ancestry
is accepted. No upstream issue/PR draft was externally published.

All shared fixtures/scanners hold `/tmp/aegisgate-sprint02-fixtures.lock`
through setup, execution, evidence hashing and cleanup. Unique projects and
actual network discovery prevent shared fixture edits; only owned disposable
resources/private material are removed. Raw manifests bind exact source/tree,
tool binaries/versions, command arguments, timestamps, exit codes and SHA256.

Root gates01 at `4c47218` fails: three helper scripts need Prettier formatting;
no Compose fixture is created, so image/cleanup prerequisites also fail. The
history scan correctly reports two previously rejected Sprint04-C commits:
`551591395880ce87863b4e861c05d266c719b91f` (fixture JWT in rejected E output)
and `cd8f4a760239086616809db8b55a651d3cc28d8e` (synthetic private-key marker
in rejected audit source). Both are reachable only through retained old local
branches, never through the Sprint05-A publishable ancestry or a remote ref.
They are not new candidate leaks or accepted exceptions. Findings, failed exits
and raw redacted outputs remain in `evidence/sprint05a-root/gates-01/`.

Formatting-only repair `2993cc0` is applied. The final full gate rerun uses an
independent `git clone --no-hardlinks --single-branch --branch
sprint/05a-integration` checkout at the exact root source. Its unchanged scanner
still scans every available ref and fails on findings; the clone has only the
complete publishable source history, without unrelated rejected local branches.
This does not delete or suppress the earlier findings. Source/tree equality and
non-ancestry of both rejected commits must be independently reviewed before
merge; the final actual gate result is recorded separately.

Full gates02 PASS at exact source `c117d96a0216de301c2a8033e79edee21a936f4a`,
tree `e47d07a6fcdd88c4d827e725bcd8abd263f648d9`, UTC2026-11-14
16:20:08.406 through16:25:49.006. A single outer flock covers both required
make commands and cleanup. Actual `make check`, `make security-scan`,
`make dev-down` and Compose `down --volumes --remove-orphans` each exit0.
All project container/network/volume inventories are empty; private fixture
paths are absent and56 retained files have zero generated-private-value matches.
Fresh Go/Rust/npm, worktree/history, filesystem, candidate/fixture-image scans
and SBOM generation pass. History actually scans336 commits/58.76MB with0 leaks;
Pingora's two unmaintained warnings remain visible, not ignored.

| Final local artifact | SHA256 |
| --- | --- |
| `gates-02/commands.json` | `c84a12d94da71fa895da03c9df8df535c3798fee4946a09bb12313dd0b52e7b9` |
| `gates-02/SHA256SUMS` | `b5bfab7f59bf39c5eab6fda6c73be545f2efa9d0d6968aab586e36f45faa9eec` |
| `candidate-02/commands.json` | `572ad993fe7f38b58c62c0b66de81a333006b3c6ed5a332478e38f60838d273a` |
| `candidate-02/original75.json` | `13a04311fa39f0e7c7d94c85051d6d375e9a281cf6a4aa0f4aafa8dbe337556a` |
| `candidate-02/original23.json` | `62fa6ba4082b20185d4958bbd034bbddef40dc7b46e2a89291fda507d3c99cee` |

Paths in this table are under `evidence/sprint05a-root/`. Final PR-head hosted
jobs, merge SHA and main jobs must still be recorded from actual GitHub state;
local gates alone do not grant merge or runtime acceptance.

Final gate/source independent ACCEPT is `8ce5aef`, report
`sprint05a-f-gate-review.md`. Its audit03 verifies67 manifests/1675 entries,
1278 source hashes/1104 stream hashes, exact gates02, six empty inventories,
formatting AST equality, absence of new binaries/private fixture material and
an offline pinned secret scan. Four declared A withheld streams remain absent
and ineligible. Both rejected04C commits are non-ancestors of the publishable
source and all52 live advertised remote refs. All402 publishable ancestors are
present in the independent clone; no shallow/alternate/hardlink boundary hides
published history. This review accepts local gates and research scope only.

Integration PR: https://github.com/tiecont/aegis-gate/pull/17. Its exact final
head and resulting merge/main hosted results are recorded in the closeout
addendum after execution; no self-referential commit hash is fabricated here.

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
