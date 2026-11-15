# Sprint05D F Independent Security Review

Status: scoped A finite-stage and corrected D correlation tooling ACCEPT;
historical failures retained below. Final integration gates and B/E/C receipt
audit still pending. No runtime acceptance or GO is issued. Module01
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
