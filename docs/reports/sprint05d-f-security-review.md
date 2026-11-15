# Sprint05D F Independent Security Review

Status: execution in progress. No runtime acceptance or GO is issued. Module01
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
