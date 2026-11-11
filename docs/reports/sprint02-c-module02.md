# Sprint02 Agent C: Module02 Acceptance Candidate

Root acceptance update,2026-11-11: PR7 rebased without application changes to
727f5b17dd38bca2f44b94634c53afa1e8504524; both hosted jobs passed in42969925238
and the PR was merged. Independent root review and integrated check/scan pass.
M1-ADMIN-TENANCY is accepted for local scope; sprint02-d-integration.md records
commands/evidence and release limits. The original candidate report and failed
history-scan evidence below remain historical; the final wrapper verifies20
real commits.

## Agent Completion Report

- Module: 02, Agent C C1-C3, candidate for `M1-ADMIN-TENANCY` review.
- Status: complete for the assigned C1-C3 implementation scope. Root must
  independently review the candidate and dispose the gate. This report does not
  claim M1 PASS or production readiness; dependent modules remain gated.
- Commits / files changed: branch `feat/module02-acceptance`; control-api
  domain/identity/persistence/transport and command, migrations006-007,
  OpenAPI/generated Go/TypeScript/JSON Schema, Go dependency locks,
  `docs/MANAGEMENT_ACCEPTANCE.md`, `docs/DEVELOPMENT.md`, this report and
  `evidence/sprint02-c/`. The delivery commit is identified by the draft PR.
- Architecture/ADR decisions: preserve the existing single-origin API; add
  explicit pools/endpoints with immutable snapshots and separate active route
  pointers. Offline migration owner, checked runtime login and maintenance
  login are separate. Use maintained OIDC/oauth2, PostgreSQL transactions and
  Go DNS parsing. No accepted ADR is reversed.
- Contracts changed: additive pool/endpoint/revision/preview/approval/retirement,
  domain reverification and organization audit operations. Generated bindings
  and schema pass the existing compatibility baseline and drift checks.
- Positive tests executed (exact commands + outcome): commands below, all final
  checks passed. Database suites actually used the non-owner runtime role.
- Security negative tests executed (exact commands + outcome): commands below;
  tenant/role/MFA/lease/SSRF/immutable-history/cleanup negatives passed.
- Performance data: no benchmark, capacity or production SLO claim. Quotas are
  administrative bounds, exercised locally for concurrency and fail-closed state.
- Known risks and release blockers: root's independent acceptance is pending;
  the inherited security wrapper's worktree history-scan gap is described below.
  Dial-time SSRF/TLS/rebinding, signed publication and edge activation belong to
  later gated modules. DNS resolver trust is operator-owned; no DNSSEC or
  compromised-resolver protection is claimed. MFA requires signed `amr=mfa` and
  recent `auth_time`; other IdP conventions need a reviewed mapping.
- Human review needed: root reviews C1-C3 code, SQL privileges/retention,
  contracts and this evidence. No production, public-listener or live-DNS
  authorization is implied.
- Next unblocked module(s): root acceptance/review only. This branch does not
  independently unlock module03 or change `IMPLEMENTATION_STATUS.md`.

## Delivered Behavior

C1 adds project-scoped pools and endpoints, canonical HTTPS/public-address
registration, conditional generations, immutable endpoint/pool revisions and
approved snapshots. Existing routes retain their approved dependency versions.
Pool/endpoint retirement is final, including endpoint changes under a retired
pool. Registration rejects additional IANA special-purpose IPv4/IPv6 ranges,
with public positive controls and no third-party connection tests.

C2 requires server-verified recent MFA for membership and security decisions,
persists it in bounded sessions, and ignores client MFA assertions. OIDC key
rotation/outages, bounded refresh/backoff and malformed callbacks are exercised
through owned HTTPS fixtures. Direct persistence denials are audited. Durable
quotas serialize shared buckets across distinct keys; missing quotas fail closed.
Runtime cannot perform DDL, own objects, mutate/delete history, escalate roles or
invoke cleanup. Maintenance cleanup uses a trusted search path, bounded batches
and retention floors; temporary shadow tables cannot redirect owner execution.

C3 adds failed/active/expired domain states, challenge generations and
reverification which withdraws active decisions. DNS results and ACKs are fenced
by live lease, attempt and challenge generation. Tests cover crashes, concurrent
workers, stale proofs and expiry, and the HTTP lab uses owned loopback UDP DNS.
Explicit sorted revision diffs/previews and immutable route decision/retirement
history accompany active-pointer replacement and collision release.

## Verification

All commands ran from `/home/tiecont/Projects/aegis-gate-sprint02-c` on
2026-11-11. Every database/Compose/full-check/scan invocation held
`/tmp/aegisgate-sprint02-fixtures.lock`.

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock bash -o pipefail -c 'AEGIS_TENANCY_INTEGRATION=1 GOTOOLCHAIN=go1.27.4 go test -race -count=1 -timeout=120s -v ./apps/control-api/internal/persistence -run "TestIntegrationOriginPoolLifecycleAndRuntimePermissions|TestIntegrationNonSuperuserMigrationOwner" 2>&1 | tee evidence/sprint02-c/persistence-role-regression.log'
flock /tmp/aegisgate-sprint02-fixtures.lock bash -o pipefail -c 'make check 2>&1 | tee evidence/sprint02-c/make-check.log'
flock /tmp/aegisgate-sprint02-fixtures.lock bash -o pipefail -c 'make security-scan 2>&1 | tee evidence/sprint02-c/security-scan.log'
git diff --check
```

The focused regression returned exit0. It proves migration application twice
under a non-superuser owner, actual runtime permissions, maintenance retention
and temporary-relation isolation, and final pool retirement. PostgreSQL removes
explicit ACL entries when the runtime role becomes table owner during the
negative ownership probe; the test now restores grants after restoring ownership.
`persistence-after-fix.log` preserves the earlier failed run for context and is
not passing evidence. Temporary raw commit diagnostics were removed.

`make check` passed formatting, Go vet, Rust clippy, contract compatibility/drift,
dashboard lint/type checks, Go race tests, Rust/Node/Python tests, all builds,
actual PostgreSQL/HTTPS OIDC/UDP DNS integration, fixture image initialization
and restart, security negatives and deliberate-defect gate self-tests.

`make security-scan` returned exit0 for dependency/secret/filesystem/image checks,
SBOMs and local immutable-image identity validation. Its inherited history
wrapper falsely reports PASS when the container cannot resolve a worktree's
external Git directory: the raw log contains `0 commits scanned`. That empty
result is not accepted as evidence. A supplemental command mounted the actual
shared Git directory read-only and returned exit0, **15 commits scanned**, no
leaks found:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock bash -o pipefail -c 'docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/repo:ro" -v /home/tiecont/Projects/aegis-gate/.git:/home/tiecont/Projects/aegis-gate/.git:ro -v "$PWD/.local/evidence/security:/reports" ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f git /repo --redact --report-format json --report-path /reports/history-secrets-worktree.json --no-banner --log-opts=--all 2>&1 | tee evidence/sprint02-c/history-secrets-worktree.log'
```

Selected raw scanner reports are retained in `evidence/sprint02-c/security/`.
The wrapper deficiency must be handled during root integration; this branch
does not replace the root-owned security-gate implementation. No public load,
abuse or security traffic, live DNS records, paid services or deployment occurred.
