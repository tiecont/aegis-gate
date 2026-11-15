# Sprint 05-D Execution Contract

Baseline main aa289da3f48334ec8e2156f66ebd2a8f3cfb3324, tree
8668da5dfce1825d0e8c8c311faeb284b8114f4d. Refreshed remote agrees;
exact main hosted43689624172 passes foundation-quality/supply-chain-security.
No open PR at start. Root integration branch: sprint/05d-integration.

| Owner | Branch | Worktree |
| --- | --- | --- |
| Root | sprint/05d-integration | /home/tiecont/Projects/aegis-gate |
| A | feat/sprint05d-admission-policy | /home/tiecont/.cache/aegisgate-05d/a |
| B | fix/sprint05d-h2-identity-status | /home/tiecont/.cache/aegisgate-05d/b |
| C | fix/sprint05d-h2-frame-rejection | /home/tiecont/.cache/aegisgate-05d/c |
| D root | test/sprint05d-origin-isolation | /home/tiecont/.cache/aegisgate-05d/d |
| E | test/sprint05d-runtime-regression | /home/tiecont/.cache/aegisgate-05d/e |
| F independent | review/sprint05d-security | /home/tiecont/.cache/aegisgate-05d/f |

A/B/C execute concurrently; root implements D. E/F begin as slots become free.
Only root changes shared status/risk/ADR/completion. Agents own sprint05d-letter
tooling/report/evidence. All shared fixtures/scanners hold
/tmp/aegisgate-sprint02-fixtures.lock through setup, capture, hashes and cleanup.
Disk-backed TMPDIR avoids the already near-full /tmp; historical artifacts stay.

## Falsifiable Experiments

| Track/failure | New hypothesis and API | Minimum proof / positive control | Stop |
| --- | --- | --- | --- |
| A late-invalid CL/trailers | Complete validation before admission plus finite encrypted spool and restart reclamation removes early effects; unchanged maintained llhttp callbacks | Same-prefix complete CL10 versus abc/EOF and folded suffix; valid staged encoded/pipeline/upload controls | Pre-completion progress absent on strict stage is a streaming FAIL, never solved by buffer tuning |
| B userinfo400/421 | Released public validation hook may precede irreversible codec reset | Both exact original userinfo assertions plus valid reuse/identity | No supported hook or targeted failure ends path; no Go benchmark repeat |
| C unexpected CONTINUATION | Supported error emission/flush mechanism may preserve both alternate-codec repairs | Three exact original frame negatives first, then23 only if credible; positive reuse/cancel/header controls | Missing peer frame or loss of prior PASS ends proposed mechanism |
| D incomplete mapping | Runtime TLS/handler/transport tracing plus raw maintained Framer/HPACK association can replace hardcoded stream bindings in bounded research | Real reused TLS/H2 requests and rejects, authenticated events, omission/forgery/four prior false-PASS regressions | Missing public stream/dispatch or opaque HPACK state is INCOMPLETE, not inferred PASS |

Every concrete attempt records these six fields (failure, hypothesis, mechanism,
targeted input, positive control, stop) before execution. No old pool/window/
flush tuning, parser-only proof or codec comparison without a new mechanism.
No original75/23 inputs, oracle, observer or windows change. Baseline73/75 and
19/23 are retained by reference unless a credible repair justifies a new matrix.

E preserves actual00/02/03 PostgreSQL/Redis/NATS/mTLS/tenant/signed-v1 recovery,
serialized database scheduling and strict dashboard/dependency pins. F builds
clean sources and attacks claims independently before root integration. Full
locked make check/security-scan plus cleanup and exact-head/main hosted jobs
remain mandatory. Source/tree/argv/tool binary identities/exits/raw hashes are
retained without large duplicate historical suites.

Outcome must be a non-regressing original-case repair or a scoped executable
decision boundary with actionable architecture recommendation. ADR amendment
stays PROPOSED; named human architecture/security owners and approval PENDING.
Module01 NO-GO;04-12 LOCKED;production BLOCKED. No automatic next feasibility loop.
