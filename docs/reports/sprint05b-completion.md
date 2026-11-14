# Sprint 05-B Completion Evidence

Status: engineering measurements recorded; independent final review,
integration gates, hosted CI and merge closeout pending at this checkpoint.
This report does not grant Module 01 GO. Subsequent closeout receipts must name
the actual reviewed source, PR head, merge SHA and hosted run; no commit can
contain its own final commit hash.

## Baseline And Source Ownership

Starting main `8758b1c84b4186449cd79fabae461ca53ee05100`, tree
`2c6b1d5ff56f9e60a7bf77b478e291f3f5bc420d`. PRs 17/18 merged before this sprint.
Baseline hosted run `43620722442` passes foundation-quality and
supply-chain-security. Root branch `sprint/05b-integration`. Full source/tree,
argv, tool versions, exits and output SHA256 are in the referenced receipts.

| Owner | Branch | Executable source / report evidence |
| --- | --- | --- |
| A | `feat/sprint05b-llhttp-admission` | code `95ded76`, final `37f5439`; root-executed `sprint05b-a/run-06` |
| B | `fix/sprint05b-h2-origin-lifecycle` | final `f7ce126`; ACK causal/original-case traces |
| C | `fix/sprint05b-h2-rejection` | final `0170010`; native original23 and peer-frame relay |
| D (root) | `test/sprint05b-streaming-safety` | source `eba8445`, report/evidence `d85d04b` |
| E (root) | `test/sprint05b-regressions` | source `a59e9f9`, final `7755f7a` |
| F (independent) | `review/sprint05b-security` | clean-source reproduction/review in progress |
| Root | `sprint/05b-integration` | source `34cf5b0`, matrix evidence `fb4cc6a` |

All isolated worktrees and ownership are recorded in `docs/sprints/05b-execution.md`.
An initial duplicate-agent orchestration error was stopped before acceptance;
sole writers and clean committed sources supersede drafts. Component reports
retain collision/stop provenance. No draft or uncommitted source is accepted as
clean proof. No upstream content was published and no production change made.

## Implemented Work

A adds a persistent in-process Node N-API binding to unchanged released llhttp
9.4.4, digest-pinned at source `816485216511b86459b2e6478190e14c38c14891`.
It feeds fragments incrementally, retains bounded parser state and error
offsets, pauses at complete messages, handles pipelined suffixes and frees
state explicitly. No subprocess parses HTTP. Finite admission/staging experiments
exercise verified TLS, strict trailers, size/deadline/queue limits, cancellation
and byte-exact forwarding. They are isolated H1 feasibility tools, not accepted
production ingress or complete H2/tenant/config integration.

B adds bounded passive traces and an executable causal H2 SETTINGS control.
C adds supported-setting experiments and a verified TLS relay distinguishing
peer-sent RST_STREAM from client-generated cancellation. D independently
builds the maintained parser and measures late-trailer admission versus streaming.
E adds fresh real dependency/config/tenant regressions. Root adds exact-image
binary extraction, a loopback native diagnostic launcher, corrected owned-fixture
cleanup and native RSS sampling. Original 75/23 sources remain immutable.

## Original Results And Failure Disposition

The combined Envoy 1.40.2 configuration is unchanged. Fresh root
`evidence/sprint05b-root/candidate-04/` at `34cf5b0` records:

| Mandatory suite | Previous | Current | New repaired assertions |
| --- | ---: | ---: | ---: |
| Original 75 | 73/75 | 73/75 | 0 |
| Original supplemental 23 | 19/23 | 19/23 | 0 |

The exact binary is extracted from
`envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`.
Native execution preserves the config and original observation windows, but
lacks Docker memory/PID cgroups/read-only-rootfs isolation. Thus these are
protocol diagnostics, not new complete resource/runtime eligibility evidence.
All 17 additive controls finish observation in candidate04; observation completion
does not assert a security PASS for their retained historical failures.

| Failure ID | Current measured disposition |
| --- | --- |
| `malformed-HTTP-obsolete-folded-header` | Envoy FAIL: 263 decrypted origin bytes, one handler. Exact historical bytes reject with HTTP 400, zero origin effects in the separate finite llhttp H1 fixture; original full-runtime assertion not repaired. |
| `HTTP2-authority-Host-and-SNI-confusion-rejected` | FAIL: nine bytes `000000040100000000`, zero handlers; ACK retained in full counter. |
| `settled-reuse-identity-and-three-authority-negatives` | FAIL: userinfo rejection lacks required response/end behavior; peer RST_STREAM PROTOCOL_ERROR observed separately. |
| `individual-settled-userinfo-denial` | FAIL: same response/deadline contract remains unmet. |
| `raw-H2-HEADERS-stream-zero` | FAIL: close without required observable peer error frame. |
| `raw-H2-zero-WINDOW_UPDATE` | FAIL: close without required observable peer error frame. |

C's native baseline, flush-zero, flush-one-second and 500 ms header-timeout
variants all measure 19/23, preserving the repaired 19. None is proposed as a
repair. The separate TLS relay captures Envoy-to-client RST_STREAM error 1
(`00000403000000000100000001`) for userinfo, and independently distinguishes
client CANCEL error 8. The two raw malformed frame cases still have no peer
error frame. Internal queued-GOAWAY/adapter branch details remain unproven;
the source-causal stop is bounded to inspected released behavior.

## Parser, Trailers And Resource Proof

A run06 at `95ded76` exits 0: 714 split boundaries plus one-byte/native limits,
34 wire probes, exact historical folded header/TE bytes, SP/HTAB folded trailers,
fresh/reused connections, valid encoded targets and ordered pipelines. Rejected
folded inputs have zero origin connections/bytes/handlers/parser/transport errors.
Finite staging supports cancellation, 413/408 and queue rejection, but waits
through complete trailers. This is narrower than the original full ingress gate.

D attempt04 at `eba8445` independently executes six verified-TLS scenarios:
stream/stage each with valid 1 MiB body, late folded trailer and cancellation.
Streaming a valid prefix produces 1,049,201 origin bytes and one handler before
llhttp rejects the late trailer. Stage mode observes zero origin effects for
that negative, but no body progress before complete validation. The 2 MiB stage
cap, 16 KiB chunks, 30-second experiment watchdog, sampled process RSS peak
72,564,736 bytes and complete transport/parser cleanup are recorded. This is a
specific executable design conflict, not a universal H2/HTTP impossibility proof.

The counterexample does not waive the zero-byte contract. Disk staging moves
the storage cost and imposes finite size/deadline limits; it does not supply
indefinite end-to-end upload streaming. No custom production framing scanner,
patched llhttp, hidden H2 bypass or complete runtime replacement is introduced.

## H2 Origin Lifecycle Proof

B's original-case tap and untapped controls both reproduce 73/75 and 19/23.
The trace orders valid H2 warmup, origin SETTINGS/response, original observation
boundary, Envoy SETTINGS ACK and failed identity case. No HEADERS/DATA or new
origin connection accompanies the nine bytes in that interval. A separate
hardened-container causal test sends origin SETTINGS while no downstream request
exists; the same nine-byte ACK arrives, and the existing pool remains reusable.
Cold denial and sequential/concurrent valid reuse controls pass in that diagnostic.
No aggregate counter/window changes or ACK subtraction occur. No tested supported
arrangement proves zero bytes while preserving the full required H2 behavior.

## Accepted Module Regressions And Dependencies

E attempt02/source `a59e9f9` exits 0 across actual PostgreSQL, Redis, NATS/JetStream,
mTLS, tenant/RBAC/OIDC negatives, snapshot v1 signing/publication/approval,
trust rotation, encrypted LKG, floors, rollback/canary, atomic apply, drain,
archive/prune and recovery. Go race/integration: 11 packages, 88 top-level tests,
151 subtests, zero failures/skips. Fixture credential/TLS/image identity/restart/
stale-volume tests and isolated discovered-network cleanup pass. No Module 10
service is implemented; external generation floor remains a provisioned interface.

Strict npm root/dashboard/spike resolution and dashboard checks pass. Registry
metadata keeps typescript-eslint 8.72.2 at TypeScript `>=4.8.4 <6.1.0`; compatible
TypeScript 6.0.3/minimatch pins remain. No forced upgrade or scanner suppression.
Fresh full scanner and hosted results are separate final integration obligations.

## Review, Gates And Preserved Failures

F independent exact-source reproduction and per-failure verdicts are pending.
Full local `make check`, `make security-scan`, cleanup and exact-head/merge hosted
jobs are pending. A subsequent additive closeout must record actual source,
PR/run links and merge SHA without rewriting historical runtime receipts.

Preserved failed attempts include Docker startup failures (zero cases), the
llhttp wrapper's nonexistent version macro/completion-EOF fix, managed-session
socket EPERM, run05's additive cancellation assertion bug, D's mutable TLS buffer
and inter-scenario attribution defects, and native Docker-only resource sampling.
Corrections use fresh suffixes; no failed receipt is relabeled PASS. Root's
candidate01 cleanup flag was incorrect for a never-started Created container;
`cleanup-candidate-one` explicitly supersedes it. C uses separate prefix inventories
instead of assuming combined Docker name filters form a union.

## Gate Matrix And Next Action

| Gate | State |
| --- | --- |
| Module 00 | PASS local, final integration regression pending |
| Module 01 | NO-GO |
| Module 02 | PASS local, final integration regression pending |
| Module 03 | PASS local, final integration regression pending |
| Modules 04-12 | LOCKED |
| Production | BLOCKED |
| ADR-012 / named architecture and security owners / approval | PROPOSED / PENDING / PENDING |

The next executable implementation must demonstrate a maintained complete ingress
admission boundary that rejects pre-normalization folded syntax, specifies late
trailer admission and preserves mandatory streaming/identity/H2 behavior. The
current finite llhttp H1 stage is not that boundary. For Envoy H2, require a new
supported lifecycle capability with a causal mechanism that eliminates the exact
nine-byte interval without changing measurement or valid reuse controls. Do not
repeat the disproven flush/pool configurations. Formal owner decisions remain
necessary before any architecture/contract change; all present acceptance and
downstream locks remain binding.
