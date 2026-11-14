# Sprint 05-B Execution Contract

Status: in progress. Module 01 remains NO-GO.

Root integration worktree: `/home/tiecont/Projects/aegis-gate`, branch
`sprint/05b-integration`. Component worktrees A-F are `/tmp/aegisgate-05b-{a,b,c,d,e,f}`;
their branches are respectively `feat/sprint05b-llhttp-admission`,
`fix/sprint05b-h2-origin-lifecycle`, `fix/sprint05b-h2-rejection`,
`test/sprint05b-streaming-safety`, `test/sprint05b-regressions`,
and `review/sprint05b-security`. A/B/C start concurrently. Root covers D and
E until a worker slot is available; F must independently review the implementation.
No worker may edit shared status/risk/completion files. Only root integrates.

## Baseline

- Main and `origin/main`: `8758b1c84b4186449cd79fabae461ca53ee05100`.
- Sprint 05-A Envoy candidate: 73/75 original cases and 19/23 supplemental probes.
- Retained original failures: obsolete folded HTTP/1 header and H2 authority/Host/SNI zero-byte case.
- Retained supplemental failures: two userinfo/authority deadline cases, raw H2 HEADERS on stream zero, and raw H2 zero WINDOW_UPDATE.

The original 75-case and 23-probe manifests, inputs, expected results, evaluators, and observation windows are immutable. New work is additive and test-only unless separately reviewed as a supported feasibility candidate.

## Ownership and checkpoints

| Workstream | Scope                                                     | Evidence                                         | Gate                                                           |
| ---------- | --------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| A          | In-process incremental llhttp 9.4.4 admission feasibility | `docs/reports/sprint05b-a-ingress.md`            | No subprocess, bounded state, late-trailer and streaming proof |
| B          | Supported Envoy H2 lifecycle hypotheses                   | `docs/reports/sprint05b-b-h2-lifecycle.md`       | Original nine-byte interval remains unchanged and is measured  |
| C          | Four supplemental protocol failures                       | `docs/reports/sprint05b-c-protocol.md`           | Original 23 assertions unchanged                               |
| D          | Strict trailers, streaming and resource contract          | `docs/reports/sprint05b-d-streaming-contract.md` | Independent bounded counterexamples or proof                   |
| E          | Module 00/02/03 and 05-A regressions                      | `docs/reports/sprint05b-e-regressions.md`        | Accepted behavior preserved                                    |
| F          | Independent security review                               | `docs/reports/sprint05b-f-security-review.md`    | Clean-source reproduction and per-failure verdicts             |

All fixture lifecycles must hold `/tmp/aegisgate-sprint02-fixtures.lock` from setup through evidence hashing and cleanup. All runtime listeners remain loopback-only. No upstream publication, production deployment, parser fork, corpus edit, TLS weakening, or fabricated architecture approval is permitted.

## Acceptance contract

Module 01 can leave NO-GO only with all 75 original cases, all mandatory supplemental controls, full H1/H2/TLS/identity/streaming/resource proof, independent review, hosted/local gates, and recorded human architecture/security approval. A narrow parser or lifecycle improvement is reported as partial progress.

## Initial technical hypotheses

1. llhttp's released C API may establish strict pre-normalization folding and trailer rejection, but admission before late trailers can conflict with streaming and bounded-memory requirements.
2. Envoy H2 lifecycle controls may classify the nine-byte SETTINGS ACK but cannot satisfy the unchanged aggregate zero-byte contract if reused-connection control traffic remains in the interval.
3. The four supplemental failures may be codec lifecycle behavior rather than configuration errors; unchanged assertions will decide whether a supported setting is a repair.

## Integration Checkpoint

A `37f5439`, B `f7ce126`, C `0170010`, D `d85d04b` and E `7755f7a`
are integrated after F's scoped clean-source verdicts. Root owns D/E implementation;
F's separate reproduction supplies independent review. F accepts the finite H1
parser capability and streaming/ACK counterexamples, and rejects complete runtime
eligibility. Final integrated original matrix at `ff3f3fe` remains 73/75 and 19/23;
all 17 additive diagnostic observations complete, without granting security PASS.

First full gates at `4127839` yield check exit 2, security-scan exit 0,
cleanup/volume removal exit 0. OIDC integration hits unchanged PostgreSQL
statement/lock and callback deadlines. This is unresolved, not an accepted
regression PASS. A failed callback log exposed disposable code/state; published
gate evidence is an explicitly sanitized derivative preserving original hashes.
`de6265d` removes request URLs from HTTP fixture error messages, with a sentinel
race test. No timeout or original 75/23 expectation changes. F is measuring
database-global advisory contention before any fixture isolation correction.
