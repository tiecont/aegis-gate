# Sprint05D F Independent Security Review

Status: scoped A finite-stage and corrected D correlation tooling ACCEPT;
historical failures retained below. Final integration gates and B/E/C receipt
audit status are detailed below. No runtime acceptance or GO is issued. Module01
remains NO-GO, Modules04-12 LOCKED, production BLOCKED. This report will record
only executed results with exact source/evidence identities.

## Execution Plan

F owns only `scripts/sprint05d-f-*`, this report and `evidence/sprint05d-f/`.
Clean shared clones reproduce A `c289b26` and D `96a1015` before independent
adversarial cases. Setup, tool identity capture, execution, preservation, source
hashes and cleanup remain under `/tmp/aegisgate-sprint02-fixtures.lock`.
TMPDIR and HOME are disk-backed under `/home/tiecont/.cache/`. Each capture
records commit/tree/argv/tool SHA256/exits/raw output and all tracked source
hashes, with all11 protected oracle files checked before and after. Code is
committed before evidence; new MJS uses the root-pinned Prettier.

| Failure | Hypothesis | Mechanism | Target | Positive | Stop |
| --- | --- | --- | --- | --- | --- |
| Late-invalid admission | Complete validation withholds rejected request effects within finite bounds | Released llhttp and A encrypted stage | EOF/fold/quota/cancel/SIGKILL plus independent limits/orphans | A29 exact wire controls and valid TLS request | Early-streaming absence remains FAIL |
| TLS downgrade/identity | Invalid origin certificate or mismatched ingress identity cannot deliver request bytes | Maintained verified TLS and A runtime | Wrong/expired/untrusted origin, unknown SNI, Host mismatch | Trusted origin/edge | Any TLS bypass is a finding, never weakened |
| Forged or omitted attribution | Missing/forged coverage cannot establish complete-runtime PASS | D evaluator plus F-only Go overlay | Swapped/duplicate nonces, omitted/malformed responses, event/loss/MAC mutations | Full D race suite and honest bounded fixture | Correlation consistency alone is insufficient |

Original75/23 inputs, oracle, observation windows and raw bytes remain unchanged.
No repeated codec/window/pool tuning, push, merge or shared documentation edits.
The proposed ADR at `30c9019` remains PROPOSED and owner approval PENDING.

## Findings In Progress

1. D `aa72f2a` exact full proof exits0. F overlay at `b2a8d0f` exits1:
   swapped accepted nonces and duplicate nonce with an orphan upstream stream
   both produce `CorrelationConsistent:true`. `RuntimeComplete`, `RuntimePass`
   and `Module01Pass` remain false. Evidence `d-independent-01` is committed
   at `5c6d21a`; all11 protected files and all tracked source bytes match after
   execution, private clone removed. Duplicate nonce is an objectively broken
   bijection. Swaps cannot be distinguished from this summary alone: raw
   upstream carries only nonce, downstream only probe, so an independent
   trusted probe-to-nonce binding is absent. Public fixture headers could carry
   both values for a bounded raw cross-check; this still cannot establish
   authoritative pre-wire dispatch, signed generation or malicious trusted
   signer coverage. HMAC authenticates supplied bytes, not their completeness.
2. A `c289b26` first clean reproduction exits1 after22 probes, at aggregate
   ciphertext quota `send()` receiving `socket closed`. Last completed control
   is aggregate file quota. Likely test-driver rejection/write race; root/A are
   investigating. Evidence `a-independent-01` committed `6f1f9b0` preserves
   failure and cleanup zeros (sockets/children/parsers/files/bytes/contexts/
   origin slots/waiters/listeners). F source inventory is retained; because
   the collector stopped before postchecks this failed capture is not a
   complete independent acceptance. No invalid request origin effect was
   observed in those22 completed probes. Independent extra tests continue.

D repair at `a532ea2` aligns with F's finding: emit the front-generated probe
and nonce together, decode both from the same raw upstream HEADERS, require
same stream, unique nonce and exact probe coverage. F's honest synthetic
positive now carries that truthful raw binding; swap/duplicate mutations stay.
This validates bounded fixture consistency only, not a malicious trusted
signer, authoritative dispatcher, HPACK mutation or signed snapshot proof.
F also tests whether syntactically valid control-only reverse capture or a raw
200 paired with an asserted421 can pass the narrower consistency check.

F `d-independent-02` at `57f2f8f` reproduces corrected D `c367fb7`:
exact full proof0; swap/duplicate/omitted-upstream-probe negatives now PASS
(rejected as inconsistent) with the truthful positive PASS. Two new negatives
FAIL: control-only reverse capture and downstream raw200 for the asserted421
remain `CorrelationConsistent:true`. Syntactic reverse frame parsing does not
bind captured `:status`/response streams to decisions. RuntimePass stays false.
Root should validate final response headers/status against raw downstream
stream IDs and accepted upstream stream IDs; a SETTINGS-only capture must not
stand in for responses. Evidence is complete with11 protected files and all
tracked bytes unchanged, private stage absent. These are bounded research
consistency findings, not an active runtime bypass or a contract waiver.

Second A reproduction preserves the same22-probe driver failure. Initial F
extra controls pass exact1.5MiB request/2MiB aggregate/three-file boundaries,
truncated GCM and injected ENOSPC release, then hit an F negative setup error:
`umask077` masked requested0755 into0700, so expecting permission rejection
was invalid. The corrected fixture explicitly chmods unsafe test objects.
This is a retained F harness failure, not an A security finding.

Root's requested final integration full locked check/security-scan review is
accepted as F's next phase after component verdicts; exact clean integration
source and command are pending. No redundant third E collector is planned.

## Reproduced Component Verdicts

| Exact source | F capture | Actual outcome |
| --- | --- | --- |
| A `c289b26` | `a-independent-04`, commit `8bb5cd6` | A29 PASS; F23 PASS; streaming FAIL |
| D `6bc71e8` | `d-independent-03`, commit `3763052` | Full original observer race suite plus five05C F overlays PASS; honest control and13 F adversarial mutations PASS |
| A corrected `c13c7b1` (code `2d50c65`) | `a-independent-05` | A29 PASS; F23 PASS; streaming FAIL; peer-close driver repair independently reproduced |

Both successful captures run clean source clones and verify all11 protected
files plus every tracked source byte after execution; private stage removed.
The D overlay has14 cases total (one honest positive and13 mutations), distinct
from D's14 live mutations. All four F false-consistency findings now reject:
swapped nonce, duplicated nonce/orphan stream, control-only reverse capture,
and raw200 versus asserted421. RuntimeComplete/RuntimePass/Module01Pass remain
false throughout. ACCEPT covers the corrected bounded consistency check only.

A extra controls measure exact1572864-byte stage,2097152-byte aggregate and
three-file limits; truncation authentication failure; injected ENOSPC release;
12 orphan startup failures (unsafe permissions, symlinks/hardlink, unknown
names, oversize/enumeration); validated12345-byte orphan reclamation; trusted
TLS positive before/after wrong-host/expired/untrusted origin negatives;
Host/SNI421 and unknown-SNI handshake refusal. Invalid origin TLS returns502
with zero decrypted origin request bytes, though one necessary attempted TLS
dial is counted. Invalid ingress identity produces zero origin dials/bytes.
All extra probes clean private fixtures and sockets. Actual SIGKILL recovery,
cancel, tamper, deadlines and shared-prefix late-invalidity remain independently
reproduced in A29. No hard RSS, same-UID attacker or production custody claim.

A first two failures retain the quota driver write/503-close race; a third run
completed all29 but F invoked the writer verifier before committing generated
evidence, which its clean-tree prerequisite correctly rejects. F now directly
validates source/receipt/raw hashes/cleanup without changing the clone HEAD.
This context error is not a writer-verifier bypass. A owner is repairing the
intermittent quota driver separately; no failed run is relabeled PASS.

C source/report `5bc9489` is a reasonable scoped API stop: pinned static
dispatch/adapter/public-interface anchors support that the examined public
config does not supply the proposed repair. It does not prove exact historical
internal causality or universal impossibility. No fresh3/23/75 result exists;
historical alternate20/23 remains rejected. B's selection hook preserves probe
bodies/assertions/deadlines but selects five probes and adds a verified TLS
relay, so those diagnostics cannot replace unchanged aggregate23 timing proof.
Both userinfo assertions remain FAIL; final B source/receipt review follows.

The root completion draft `39cffa1` and proposed ADR retain NO-GO and identify
pending delivery fields honestly. The proposed finite-versus-streaming profiles
remain inactive; no human owner or approval is inferred from successful tooling.

## C/E Retained-Evidence Review

F `audit-01` at `fa10fed` exits0. C `5bc9489` manifest27 artifacts and
historical three-frame reference match; all eight bounded static checks pass,
with fresh protocol execution false. E `f155927` manifest57 artifacts match,
all56 raw child streams match receipt hashes/lengths,28 exits0, raw Go counts
independently recompute11 packages/89 top-level/151 subtests/zero skips. E's
collector matches accepted05C exactly after namespace normalization; fixture
helper only permits05D namespace. No dependency manifest changes exist in C/E.
Current Docker checks including stopped containers find none for E's exact
project; network/volume absent; private fixture paths absent. Pinned offline
gitleaks returns empty findings for F artifacts and reviewed C/E source.

E's receipt hashes Node and raw streams and records other binary versions;
per-child binary SHA256 and TMPDIR are not embedded there. This is a provenance
limit, not invented evidence. F's final exact integration gate phase will retain
binary identities and reproduce real management fixtures. E acceptance here is
retained-source/receipt integrity and scoped regression evidence, not a fresh
F replay of the real integration yet.

B `a09565d` manifests (including failed optional404 fetch) audit independently
at `audit-02`; writer offline verifier and final report review follow. Probe
selection insertion is bounded and raw RST1 is diagnostic evidence, never a
passed HTTP400/421 assertion or original23 rerun. Security/runtime flags stay
false. No unchanged full75/23 is repeated absent a credible repair.

Explicit component acceptance for root integration: C `5bc9489` ACCEPT scoped
API-stop tooling/report/evidence; E `f155927` ACCEPT accepted-module regression
collector/report/evidence with no dependency weakening. These are complete
component reviews and may be integrated before the final full gate run.
D `6bc71e8` ACCEPT corrected bounded runtime-correlation diagnostics, and A
`2d50c65`/`c13c7b1` ACCEPT finite staging and repaired proof driver. Later A/D
report/evidence-only commits still require byte binding in final integration.

F `b-independent-01` at `ca27107` independently executes the clean B offline
verifier on `a09565d`: exit0,40 artifact hashes/302 source bindings and1867 raw
peer bytes decode correctly. Two exact RST1 frames on connections4/7 have hex
`00000403000000000100000001`, with no preceding client RST and no response
HEADERS for those streams; individual rejected request has zero origin effects.
Three selected positive controls pass. Both required HTTP400/421 cases still
FAIL. ACCEPT this diagnostic evidence and supported-API stop, subject to final
B report staying inside those claims. This is an offline replay of captured
raw evidence, not fresh F Envoy traffic or complete23 execution.

Corrected A clean replay `a-independent-05` passes A29 plus all23 F controls.
The driver now catches only documented peer-close write errors during the
expected quota rejection, then still asserts actual503, zero origin effects,
and released resources. It records attempted bytes without claiming delivery.
No runtime/parser/security threshold changes; streaming remains FAIL. F did
not invoke writer verifier in this successful fresh untracked evidence context.

## Per-Failure Verdict

| Mandatory original failure | Independent disposition |
| --- | --- |
| Original75 obsolete folded header | Isolated finite H1 stage rejects; maintained complete runtime remains FAIL/ineligible |
| Original75 H2 authority/Host/SNI interval | Historical nine-byte SETTINGS ACK retained in original interval; FAIL unchanged |
| Original23 compound settled authority negatives | B raw RST1 is not required HTTP400/421; FAIL |
| Original23 individual userinfo denial | B raw RST1 with zero origin effects still fails required HTTP status; FAIL |
| Original23 HEADERS stream zero | Accepted baseline FAIL; historical alternate PASS does not survive CONTINUATION tradeoff |
| Original23 zero WINDOW_UPDATE | Same non-regressing supported repair absent; FAIL on accepted baseline |
| Alternate unexpected CONTINUATION | No supported post-error emission API found; alternate stays rejected, baseline PASS retained |
| Late-invalid CL/trailers | Strict finite staging closes tested prefix paths, but mandatory precompletion streaming FAIL |
| Complete runtime/causal observer | INCOMPLETE: no authoritative pre-wire mapping, signed runtime generation or exact HPACK mutation authority; RuntimePass false |

Final component-delta review: A `a005a23` adds only truthful driver-repair
documentation and committed verifier03 evidence after reproduced `c13c7b1`;
ACCEPT those report/evidence additions. D `661f0d5` records corrected response
coverage and its full-proof receipt after independently reproduced `6bc71e8`;
ACCEPT that scoped report/evidence. B `044afc6` changes only the existing offline
verifier (pinned Prettier/Gitleaks/tool identity additions) and a142-line report
after independently verified `a09565d`; its report explicitly keeps both
userinfo failures and relay timing limitations. ACCEPT final B source/report
for integration. Later evidence-only receipts must remain source/hash bound.

F component report/source are committed clean. Root-pinned Prettier3.9.10
checks all three F MJS files; pinned Go1.27.4 gofmt lists no changes; scoped
`git diff --check aa289da` exits0. F's component-source ownership has no merge
conflict with A/B/C/D/E: only `scripts/sprint05d-f-*`, this report and F evidence.
Ready for final exact integration check/security-scan phase. This readiness
does not mark those gates executed or change any Module01/production decision.

## Agent Completion Report

- Module: Sprint05D F independent Module01 security research review.
- Status: in progress.
- Commits/files: F-owned collector, adversarial overlays, report and evidence.
- Architecture/ADR decisions: none.
- Contracts changed: none.
- Positive/security tests: pending execution; no capability claim yet.
- Performance: no benchmark or capacity claim.
- Known blockers: mandatory streaming and full runtime coverage.
- Human review needed: named architecture/security decision owners remain PENDING.
- Next unblocked work: exact-source review and root integration gates.
