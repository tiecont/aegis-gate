# Sprint03-A Root Integration

Status: combined local quality/scan PASS; final review/hosted acceptance pending.
Baseline main: `668b8d998d8a39f3a554a9e42ad6a1a270049d27`.
Integration branch: `test/edge-architecture-comparison`, draft PR9.

## Integrated Work

| Role | Immutable input | Scope |
| --- | --- | --- |
| A | `ca573d2` | Pingora published-source/parser/API research, unchanged retained binary, exact-lock audit and preserved NO-GO proof |
| B | `f7660dd` | Isolated pinned Envoy loopback PoC, file-based CDS/RDS/SDS, regression tests, identity/scan/SBOM, actual process benchmark and migration report |
| C | `c17e0bf`, follow-up `f8ce234` | Isolated Hyper/Tokio/rustls proxy, source/lock integrity, protocol proof, six extra bounded-resource probes and observed H2 follow-up |
| D/root | `4179b42`, `bd96d00`, `2e97ce3`, `2cc5ad7` | Immutable corpus/evaluator, negative regressions, corrected TLS/H2 observation, candidate check/scan coverage and root reruns |
| E | Pending review commit | Separate clean worktree; independent reproduction, source/dependency/image review and instrumentation calibration |

Safe PoCs/evidence are staged on an integration branch pending final review
and repository gates. No `apps/`, `internal/`, API/schema, production runtime,
TLS-verification setting or deployment configuration is changed by this sprint.
Original tests, failed evidence and historical architecture decisions remain.

## Actual Candidate Commands

All commands below use the repository Node26.13.0 executable. They ran under
the fixture lock for their complete lifetime. Candidate proofs intentionally
exit1 for mandatory failures; no failed status is converted into gate PASS.

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock env PINGORA_SPIKE_PROFILE=release AEGIS_CANDIDATE_NAME=pingora-h2-observed .local/toolchains/node/bin/node spikes/edge-comparison/run.mjs
flock /tmp/aegisgate-sprint02-fixtures.lock env PINGORA_SPIKE_PROFILE=release AEGIS_CANDIDATE_NAME=envoy-h2-observed AEGIS_CANDIDATE_COMMAND=/home/tiecont/Projects/aegis-gate/spikes/envoy/launch AEGIS_CANDIDATE_ARTIFACTS='["/home/tiecont/Projects/aegis-gate/spikes/envoy/config.mjs","/home/tiecont/Projects/aegis-gate/spikes/envoy/launcher.mjs","/home/tiecont/Projects/aegis-gate/spikes/envoy/image.lock.json"]' .local/toolchains/node/bin/node spikes/edge-comparison/run.mjs
flock /tmp/aegisgate-sprint02-fixtures.lock .local/toolchains/node/bin/node --test spikes/edge-comparison/contract.test.mjs spikes/edge-comparison/evaluate.test.mjs spikes/edge-comparison/tls-observer.test.mjs
.local/toolchains/node/bin/node spikes/edge-comparison/evaluate.mjs evidence/sprint03a-d/envoy-h2-observed.json
```

Root Pingora:63/75, same twelve failures. Root Envoy:69/75, same six failures.
Seven harness/observer unit tests pass, zero skips. Raw logs/results are
`evidence/sprint03a-d/{pingora,envoy}-h2-observed.{log,json}` and
`harness-final-unit.log`. Hyper's observer-enabled70/75 follow-up is
`evidence/sprint03a-c/shared-run-03.json`; E owns independent rebuild/rerun.

## Instrumentation Review

The root reproduced original57/65 before supplemental additions. TLS alerts
were initially misclassified as HTTP parser errors; the polluted run is
preserved as `pingora-instrumentation-failure.json`, never final proof.
HTTP parser errors require `HPE_*`/decrypted `rawPacket`; other TLS failures
are transport errors. Zero handlers and decrypted bytes remain mandatory.

E calibrated native H2 and found TLSSocket data events can miss frames.
`bd96d00` adds a bounded verified TLS relay before native H2/gRPC consumption,
with no HTTP parser or byte transformation. The unit sends a24-byte preface
and proves observation despite zero handler dispatch, then preserves a valid
encoded-target request. Final positive controls record H2/gRPC decrypted bytes.
Envoy's failed H2 authority case records56 bytes and one handler. Historical
H2 zero counts alone are incomplete evidence, retained without rewriting.

Envoy launcher-only CPU/RSS in the shared lab is not actual proxy resource
evidence. B's separate benchmark samples actual container PIDs; raw samples,
failed attempt and limitations are retained. No performance ranking or SLO
claim is used to waive a security failure.

## Repository Gates

Started on the combined source under the same fixture lock:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock make check
flock /tmp/aegisgate-sprint02-fixtures.lock make security-scan
```

Final logs: `evidence/sprint03a-d/make-check-final.log` and
`security-scan-final.log`, both **RESULT_EXIT=0**. Check includes real
PostgreSQL/HTTPS OIDC/UDP DNS, race, tenancy/permission/security negatives,
contracts, build and deliberate-defect gates. Scan includes42 actual commits,
zero known Rust vulnerability findings, two unresolved Pingora maintenance
warnings, clean lab Node audit and zero HIGH/CRITICAL pinned Envoy findings.
Selected raw outputs are copied beside the logs; complete scanner reports are
retained in `.local/evidence/security` and hosted artifact output. Exact-head
hosted acceptance and E's final observed-harness review remain pending.
CI now includes Hyper fmt/clippy/test/locked build, Envoy adapter unit tests,
shared evaluator/observer regressions and manifest integrity. Common scans
include both isolated Rust locks, lab Node dependencies and pinned Envoy image
plus existing application/dependency/history/filesystem/fixture-image gates.
No scanner ignore or accepted maintenance exception is introduced.

Source/docs whitespace diagnostics exclude raw logs deliberately: retained
HTTP CRLF/ANSI scanner output and trailing tool newlines are original evidence,
not source formatting changes. This is not a security-test or scan exclusion.

## Disposition

Every candidate remains NO-GO. The proposed architecture package is
`sprint03a-architecture-decision.md`; no replacement is accepted by this PR.
Module00/02 retain scoped local PASS; Module03 is eligible but unimplemented,
gate closed. Module04 requires affirmative feasibility and Module03 PASS.
Modules05-12 and production release remain locked/closed. No public listener,
third-party security/load test, live DNS/payment or deployment was performed.
