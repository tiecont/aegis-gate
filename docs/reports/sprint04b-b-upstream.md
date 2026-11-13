# Sprint04-B B: Maintained Strict-Ingress Research

Decision: **upstream NO-GO; no new complete candidate**. Latest released Envoy,
Pingora and Hyper still lack the demonstrated complete strict-ingress path.
Source research is separate from the standalone H1 execution described below.
Module01 remains NO-GO; Modules04-12 remain LOCKED; production BLOCKED.

## Ownership And Provenance

Agent B owns only this report, `evidence/sprint04b-b/`, and additive
`spikes/envoy/sprint04b-*`. Branch `research/sprint04b-maintained-ingress`, worktree
`/home/tiecont/Projects/aegis-gate-04b-b`, base/main
`cbb5f71db84b9489bf4a6260696bbba29ab4a561` (PR12 merge). The assignment reports
main CI43466312855 with both jobs PASS; B did not independently rerun those
hosted jobs. `git fetch origin main` confirmed the base before B source commits.
No PR, upstream publication, production change or shared status/ADR edit by B.

Source precedes proof: `007fc31` adds plan/collector; `35c7db0` retains the failed
anonymous API attempt and adds authenticated refresh/reproducer; `644a844`
retains successful release receipts and isolates hostile-request counters;
`4deca66` adds unpublished requests. Exact subsequent source/tree/argv/cwd,
tool versions, UTC times, raw logs, exits, input hashes and cleanup are bound in
each `commands.json` and directory `SHA256SUMS`. The final owned manifest binds
this report, sources, drafts and all retained evidence without self-reference.
No historical evidence was rewritten. No subagents.

## Released Sources

Successful fresh collection: `upstream-02`, 2026-11-13T17:00:31.078Z through
17:00:48.180Z, at source `35c7db0`. All nested commands exit0. Official metadata
uses the configured authenticated `gh api`; raw source uses verified HTTPS curl
at immutable revisions. No credentials are printed. `upstream-01` remains an
exit1 failed attempt: anonymous GitHub API rate limit at Envoy default-head
lookup after successful released-source retrieval. No runtime was involved.

| Project | Latest Stable / Published UTC | Immutable Released Revision |
| --- | --- | --- |
| Envoy | v1.40.2 / 2026-10-27T01:51:56Z | `b2d89e0ae53916f28770771fbdd49c5c99c5c5a2` |
| Pingora | 0.9.1 / 2026-11-03T01:07:23Z | `f86ffda5d3ae5c3baf5125682138b33b26c01b08` |
| Hyper | v1.12.0 / 2026-10-06T15:58:27Z | `7f67699ce32d717081deb7018b4da7d679277ac0` |

All three release revisions equal Sprint04-A. All16 overlapping inspected
released files are byte-identical to its retained sources; three additional
Envoy files (accesslog API, local reply implementation and Balsa tests) are
freshly retained. A new release number alone would not trigger a build.
Envoy's fetched `RELEASES.md` describes a12-month stable window; it is not a
support service commitment from AegisGate. No equivalent LTS/SLA was established
for Pingora/Hyper in this scope.

Default-branch snapshots are **unreleased source research**, not executed fixes:
Envoy main `2f475e9681d2d0e236e0ffe3ffd232872d2e414a`, Pingora main
`3f87e92c982ee27c714506e16ae362776faea4aa`, Hyper master
`378f8479b8b703d098b46de1cec9ea648f12ea69`. The inspected Envoy main still has
continuation acceptance and private no-op raw callbacks; the inspected Pingora
and Hyper main/master still contain target retry and CL/TE normalization paths,
respectively. No experimental patch is represented as released or tested.

## Exact Capability Boundary

Paths below resolve under `upstream-02/<project>/released/<path>.stdout`.
Line numbers refer to the unmodified upstream file, not generated summaries.

| Requirement | Released API / Source Finding | Classification |
| --- | --- | --- |
| Reject folded headers/trailers before normalization | Envoy `balsa_parser.cc:181` sets `disallow_header_continuation_lines=false`; `:304-305` raw callbacks are no-ops; `:428-464` shares header/trailer processing and removes CR/LF. `balsa_parser.h:39-45` makes callbacks private; `HeaderValidator:54,69,96,104` takes parsed maps. | Missing public strict-fold/provenance API in inspected release. Parsed-map filtering cannot reconstruct removed CR/LF. |
| Preserve Host/:authority/verified SNI | H2 `codec_impl.cc:2188` permits differing Host/authority; `:2523-2524,2585-2607` controls Host discard via `http2_discard_host_header`. | Released partial information-retention hook. It does not prove an identity check before all upstream effects. No new H2 runtime proof by B. |
| Unsupported TE gives4xx and actual close | H1 `codec_impl.cc:917-925` selects501; `:1376-1396` creates a logical stream if absent and calls decoder `sendLocalReply`. HCM proto `:1004,1160-1221`, accesslog proto `:56,80,227-260` and `local_reply.cc:109-126` expose status/flag matching and status mapping. | Released partial hook, tested in the standalone experiment. Do not claim no supported status mapper exists. No blanket proof for every error path. |
| Preserve valid encoded targets and ordered pipeline | HCM `normalize_path=false`, `merge_slashes=false`, `KEEP_UNCHANGED`; normal H1 keepalive remains enabled. | Released controls, tested locally below. No whole-engine acceptance follows. |
| Pingora strict targets/framing | `v1/server.rs:400-432,437-455` removes CL with TE and retries illegal target parsing via `escape_illegal_request_line`; `apps/mod.rs:64-96` lacks a no-retry strict option. | Missing inspected released no-normalization policy. Existing raw/session hooks do not by themselves repair target provenance. Source-only this sprint. |
| Pingora ordered pipeline | `set_pipelining_enabled:1014`, `set_pipelined_prefix:1024`, `reuse`, persistent session options in `apps/mod.rs`. | Released low-level partial APIs; ordered ProxyHttp integration still needs execution after strict prerequisites. No new Pingora run. |
| Hyper incoming CL+TE/raw target | `role.rs:225-230,275-300` constructs Uri and removes/skips CL with TE; `:359-361` disables keepalive on coexistence. Complete inspected server Builder exposes bounds, keepalive and pipeline controls, no reject-both/raw-target callback. | Missing strict incoming policy before normalization. Source-only this sprint; closing keepalive does not establish no service dispatch. |

No exhaustive search of every supported older branch, third-party extension,
or future API is claimed. No parser fork or custom production framing scanner
was created. Proposed upstream options in `upstream-requests.md` are unpublished
requests, not available APIs.

## Standalone Execution

The short parser reproduction uses the existing pinned Envoy1.40.2 image, no
image/candidate rebuild. Both listeners and the HTTPS origin bind127.0.0.1;
there is no Compose fixture or network discovery requirement. Full setup, PKI,
image/version check, execution, stop, container-absence check and key-directory
removal hold `/tmp/aegisgate-sprint02-fixtures.lock`. A first `flock -w45` attempt
timed out before launching source or creating fixtures/evidence; the longer
wait respects D's existing fixture ownership without interruption.

Command (fresh destination required):

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint04b-repro.mjs evidence/sprint04b-b/repro-01
```

Runtime receipt and outcome are pending fixture-lock acquisition at this source
checkpoint. This sentence will be replaced with actual results before handoff.
No new passing runtime claim is made by the source checkpoint.

The two intended listeners differ only by a released local reply mapper:
`status_code=501 AND response_flag=DPE -> status_code400`. It is deliberately
narrower than remapping all501 responses. The probe sends no client FIN for
keepalive negatives, records peer `end` separately from a close header and
deadline, and splits prior valid warmup observations from the hostile request.
It captures raw request/response hex, verified downstream SNI/certificate/ALPN,
origin decrypted bytes, handlers, connections, parser/TLS errors and cleanup.
Origin certificate verification is configured with CA and exact DNS SAN/SNI.
No TLS verification is disabled. Keys are disposable and excluded from evidence.

The repro is bounded to40 requests,90s wall time,2.5s per observation,32KiB
response capture,256MiB/one CPU/64 container PIDs. It does not exercise H2,
dynamic certificates/config, resource soak, gRPC/WS or cancellation. In
particular it does not establish the current H2 zero-origin-byte contract.
Those controls and C's seven supplemental dispositions remain other owners'
work. A trailer parser policy also cannot retroactively undo previously
streamed upstream bytes; any altered trailer/streaming contract needs separate
architecture/security approval. B does not change the contract.

## Historical Contract And Resume

Historical immutable75 counts remain Pingora63/75, Envoy69/75, Hyper70/75.
Envoy failure IDs remain `malformed-HTTP-invalid-transfer-encoding`,
`malformed-HTTP-obsolete-folded-header`, `strict-ingress-TE-repeated-chunked`,
`strict-ingress-TE-not-final-chunked`,
`supplemental-repeated-transfer-encoding-fields`, and
`HTTP2-authority-Host-and-SNI-confusion-rejected`. The historical folded header
forwarded263 bytes/one handler; the H2 case emitted9 bytes/zero handlers:
`000000040100000000`, a SETTINGS ACK on an existing valid connection. It still
FAILS the zero-byte assertion. These are inherited results, not B's new counts.
No byte subtraction, delay, control-frame exception or expectation edit occurs.
The standalone experiment cannot replace these failures with a higher score.

Technical resume requires a demonstrated relevant **released maintained**
pre-normalization strict-fold/target/framing policy, preserved original identity
through verified SNI checks before forbidden upstream work, TE4xx/actual close,
and valid encoded/pipeline preservation. Only then run historical failures,
unchanged75 and mandatory full TLS/identity/protocol/streaming/cancellation/
pooling/config/resource controls. Require maintenance/dependency review,
independent exact-commit security review and affirmative recorded human
architecture approval.75/75 alone is insufficient. Named owner/formal
architecture/security decision remain PENDING with root and the human.

## Agent Completion Report

- Module: Sprint04-B B, maintained strict-ingress research for Module01.
- Status: source research complete; runtime/verification checkpoint pending.
- Commits/files changed: B-owned plan, four additive scripts, receipts,
  unpublished upstream requests and this report; exact source objects in receipts.
- Architecture/ADR decisions: upstream NO-GO retained; no substitution/approval.
- Contracts changed: none; original75 and zero-byte assertion remain mandatory.
- Positive tests executed: release/API refresh exit0; runtime results pending.
- Security negative tests executed: no new full-candidate execution; standalone
  results pending; historical failures above retained.
- Performance data: no benchmark/capacity claim; bounded correctness experiment.
- Known risks/release blockers: strict-fold/provenance and H2 all-byte boundary;
  original6 Envoy failures,7 supplemental failures and full engine gate persist.
- Human review needed: root/E exact-head review and architecture/security owner.
- Next unblocked work: upstream maintained API contribution/release planning;
  root owns integration, hosted gates and shared documentation. Modules00/02/03
  are not changed; B does not claim their regression gates were rerun.
