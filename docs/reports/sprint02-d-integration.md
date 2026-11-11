# Sprint 02 independent integration review

Status: A/B/C and dependency candidates independently reviewed and merged;
final integrated check/scan PASS. Module02 accepted for local scope only;
Module01 remains NO-GO. Historical findings below are preserved.
Baseline: `9e734e31bf1544bd1158a5bf8d29047c2adb72f8`.
Integration branch: `sprint/02-integration`.

## Verified starting evidence

- Fetched `origin/main` equals the supplied baseline; no upstream delta.
- Actions run [42957348129](https://github.com/tiecont/aegis-gate/actions/runs/42957348129)
  has a successful `foundation-quality` job and failed `supply-chain-security`
  job. Downloaded hosted artifacts reproduce the identical `KeyError: 'digest'`
  at `document['config']['digest']` for image 1 and image 3. Logs are retained
  under ignored `.local/evidence/ci-42957348129/`.
- The root integration worktree is clean after Agent A restored two files
  accidentally targeted through the inherited working directory. Root
  independently confirmed `git status --short --branch` and scoped diffs.
  Subsequent edits must use absolute paths or an explicit worktree for
  `apply_patch`; implementation trees remain separate.
- Historical local checks are baseline evidence only. They cannot accept the
  fix commit, the expanded feasibility corpus, or module 02 completion.

## Independent review requirements

| Surface | Evidence required before acceptance |
| --- | --- |
| A: image identity | Real Docker classic and OCI exports; distinguish config/index/manifest/descriptor types; SHA-256 and descriptor sizes; platform and scan binding; substituted/malformed content rejected; full local checks/scans; both hosted jobs PASS on the exact fix head. |
| B: ingress | Fresh raw-wire reproduction and origin dispatch counters; valid encoded targets preserved; Host/authority/smuggling vectors; maintained upstream API/source evidence; both dependency warning dispositions; explicit GO candidate or NO-GO with alternatives. |
| C1: persistence | Explicit OriginPool/Endpoint lifecycle and tenant references; immutable revisions/ETags; public-origin registration checks; additive migrations; actual runtime-role HTTP/DB integration and denied DDL/ownership privileges. |
| C2: identity | Real HTTPS IdP rotation/refresh/backoff/outage/callback negatives; verified MFA claims and freshness for privileged actions; use-case and HTTP denial audit; quotas and cleanup/retention evidence. |
| C3: lifecycle | Owned DNS transport; expiry/failure/reverification and stale proof protection; worker crash/concurrency; explicit revision diff; conflicting approvals and retirement. |
| Isolation/contracts | Two tenants/three mixed-role users; list/item/mutation/job isolation; session/CSRF/revocation; tenant-scoped audit; source OpenAPI and generated bindings synchronized. |
| Integrated checks | Exact reviewed commits; formatting/lint/race/unit/integration/security-negative/build/supply-chain evidence; no skipped mandatory integration; no architecture substitution or bypass. |

Implementation agents do not accept their own gates. Review findings and
retests will be recorded here after the relevant branches are ready. Approved
branches will be integrated sequentially, followed by checks on the combined
tree and final status/risk updates.

## Active findings and probes

- A-history-scan: root inspected Agent A's completed scan artifact and found
  `fatal: not a git repository` and `0 commits scanned` in
  `.local/evidence/security/history-secrets.log`, although the wrapper printed
  PASS. The worktree `.git` file points outside the container mount and
  gitleaks exits zero despite that failure. That history result cannot satisfy
  the secret-scan requirement. Agent A must preserve this evidence, support
  actual worktree Git metadata with read-only mounts, add a fail-closed
  history preflight and demonstrate nonempty history scanning before acceptance.
- A-layer-binding: review identified a config-only binding gap. The agent added
  layer verification before the independent probe executed, so the probe is not
  a reproduced pre-fix failure. On live validator SHA-256
  `1212a938803cb8f33aa9aa41622ded3c2b039e4eddc64bed125d506c5e922df8`,
  root's conventional classic/OCI positive archives pass and substituted layer
  bytes fail. Evidence: `evidence/sprint02/a-layer-substitution-live-review.log`.
  The initial probe rejected its legitimate OCI control with omitted optional
  index media type; retained in `a-layer-substitution-before.log` and referred
  to Agent A. Repeat on an immutable reviewed commit is still required.
- C-public-origin: root's actual negative test fails for `fec0::1`, `3fff::1`,
  `5f00::1`, `100:0:0:1::1` and `192.88.99.1`. These non-public/special-purpose
  destinations pass baseline `PublicAddress`. No destination was contacted.
  Command: `GOTOOLCHAIN=go1.27.4 go test ./apps/control-api/internal/domain
  -run TestNegativeSprint02RootNonPublicOriginPrefixes -count=1 -v` (exit 1).
  Evidence: `evidence/sprint02/c-nonpublic-prefix-before.log`. Agent C must
  assess the address registry/RFC policy, fix registration validation and retain
  positive public-address controls. Future edge dial-time checks remain gated.
  Root tested C's live `validation.go` SHA-256
  `81dde112d1d1318a5cc937e70eed791559fc85d2559ca0cac27499300a151243`
  through a Go source overlay: `GOTOOLCHAIN=go1.27.4 go test -race
  -overlay .local/evidence/sprint02-c-origin-overlay.json
  ./apps/control-api/internal/domain -count=1 -v` (exit 0).
  Mixed public/non-public resolver responses and public IPv4/IPv6 controls
  also pass. Evidence: `c-nonpublic-prefix-live-review.log`. Repeat on the
  accepted immutable integration commit is still required.
- Repository release control: `gh api
  repos/tiecont/aegis-gate/branches/main/protection` returns HTTP 404,
  `Branch not protected`. Required branch protection/reviewer approval from
  `QUALITY_GATES.md` is not proven. No repository setting was changed.

## Initial gate disposition (historical)

- Module 00: historical local PASS; hosted supply-chain recovery pending.
- Module 01: NO-GO, closed pending fresh evidence and architecture review.
- Module 02: partial, closed pending C1-C3 implementation and independent review.
- Modules 03-12: locked under their existing task prerequisites.
- Production release: blocked. No deployment, live DNS, billing or public
  security/load operation is part of this sprint.

## Sprint02 Reviewed Integration

PR6 merged as45ae1c6 after exact-head run42964002493 passed both hosted jobs.
Full A scripts, history regression target and C implementation were integrated
with B evidence; PR5 and PR7 were then rebased onto the recovered CI base and
passed both jobs in runs42969922803 and42969925238. Their reviewed heads are
da919d7 and727f5b1. PRs1-4 were reviewed in separate E worktrees, rebased,
tested and merged individually; details are in `sprint02-e-dependencies.md`.
Actual PR merge commits/timestamps are in `evidence/sprint02-d/pull-requests.json`.

Independent security report: `sprint02-d-security-review.md`. Root repeated
classic/OCI layer substitution, all public-origin regressions and real scans;
the corrected history wrapper inspected18 commits rather than accepting the
old zero-commit scan. Final history count is recorded in the final scan log.
No scanner suppression or TLS/auth relaxation was introduced.

Root rebuilt Pingora release and repeated57/65, eight failures, exit1. The
relative target again sent192 decrypted bytes and caused two origin parser
errors. The six valid percent-encoded controls pass unchanged. Exact raw results
are `evidence/sprint02-d/pingora-results.json`; unit/build/lab logs are adjacent.
The evidence-only merge does not approve any architecture or change NO-GO.

One repeated `make check` was interrupted during PostgreSQL integration while
the task resumed; its log is retained as `make-check-interrupted.log` and is not
accepted as a passing run. Earlier complete root evidence is preserved as
`make-check-before-history-target.log`. Final `make-check.log` must contain
`RESULT_EXIT=0`; it now does. The final scan also returns0. An interrupted
command, implementation or hosted candidate alone was not accepted.

## Final Commands And Evidence

All commands executed from the root integration worktree on2026-11-11. All
Compose/database/full-check/scan/lab work held the shared fixture lock.
Application/workflow source is6999d53, including all merged PRs1-7;75e4969 adds
review docs only. No runtime code was changed after the final check.

| Exact command (output piped to the indicated evidence log with pipefail) | Result | Evidence |
| --- | --- | --- |
| Locked `make check` (complete invocation below) | PASS, exit0 | `evidence/sprint02-d/make-check.log` |
| Locked `make security-scan` (complete invocation below) | PASS, exit0;20 history commits | `evidence/sprint02-d/security-scan-final.log` |
| `python3 evidence/sprint02/image-layer-binding-repro.py scripts/image_identity.py` | PASS, positive controls and substituted layers | `evidence/sprint02-d/image-layer-binding.log` |
| `GOTOOLCHAIN=go1.27.4 go test -race ./apps/control-api/internal/domain -count=1 -v` | PASS, public/non-public/mixed DNS cases | `evidence/sprint02-d/origin-negative.log` |
| `cargo +1.99.1 test --locked --manifest-path spikes/pingora/Cargo.toml` | PASS,5 tests | `evidence/sprint02-d/pingora-tests.log` |
| `cargo +1.99.1 build --release --locked --manifest-path spikes/pingora/Cargo.toml` | PASS | `evidence/sprint02-d/pingora-build.log` |
| `flock /tmp/aegisgate-sprint02-fixtures.lock env PINGORA_SPIKE_PROFILE=release .local/toolchains/node/bin/node spikes/pingora/lab.mjs` | FAIL, exit1;57/65, eight failures retained | `evidence/sprint02-d/pingora-lab.log`, `pingora-results.json` |
| `git diff --check` | PASS | Executed before final commits |

Full check and scan invocations:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock bash -o pipefail -c 'make check 2>&1 | tee evidence/sprint02-d/make-check.log; result=$?; printf "RESULT_EXIT=%s\n" "$result" | tee -a evidence/sprint02-d/make-check.log; exit "$result"'
flock /tmp/aegisgate-sprint02-fixtures.lock bash -o pipefail -c 'make security-scan 2>&1 | tee evidence/sprint02-d/security-scan-final.log; result=$?; printf "RESULT_EXIT=%s\n" "$result" | tee -a evidence/sprint02-d/security-scan-final.log; exit "$result"'
```

The full check runs formatting, vet/clippy/eslint/types, schema compatibility,
unit/race tests, builds, actual PostgreSQL/HTTPS OIDC/owned UDP DNS and fixture
integration, security negatives and gate self-tests. The only database skip
guards require `AEGIS_TENANCY_INTEGRATION=1`; the integration target sets it
explicitly and both actual persistence/transport suites execute. No mandatory
acceptance skip is used. The final scan includes fail-closed history preflight,
nonempty history verification,31 image regressions, all SCA/secret/SBOM/image
steps; original zero-commit evidence remains rejected and preserved.

Hosted A/B/C and dependency outcomes are stored as `ci-<run>.json` in the same
evidence directory. Each contains the exact reviewed head and both successful
job URLs. Hash manifest: `evidence/sprint02-d/SHA256SUMS`.

## Final Gate Matrix And Next Wave

| Module | Disposition |
| --- | --- |
| 00 | Historical local PASS preserved; Sprint02 hosted supply-chain recovery PASS |
| 01 | NO-GO/CLOSED; eight mandatory strict-ingress failures; human architecture decision pending |
| 02 | M1-ADMIN-TENANCY PASS for local scope after full acceptance, independent review and final integrated checks |
| 03 | Eligible for next wave per task03:00/02 and01 findings; NOT STARTED, gate CLOSED |
| 04 | LOCKED; affirmative01 GO and03 PASS required |
| 05-12 | LOCKED by their documented dependencies/release gates |

Remaining blockers: strict-ingress behavior (P0 feasibility blocker), two Rust
maintenance warnings (unaccepted), and all later production/security/operational
release obligations. ADR011 offers upstream strict mode, reviewed maintained
ingress, Envoy and Hyper/Tokio cost/proof comparisons. A human must decide any
architecture replacement; no option has been silently selected. Next wave can
prepare/execute module03's scoped distribution safety work and separately pursue
the human architecture review. It cannot activate production edge or deploy.
