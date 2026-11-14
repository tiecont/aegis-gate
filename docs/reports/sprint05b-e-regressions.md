# Sprint 05-B E Regression Results

Status: scoped regression execution COMPLETE; independent review pending.
Modules 00/02/03 retain local acceptance. Module 01 remains NO-GO;
Modules 04-12 LOCKED; production BLOCKED.

## Source And Evidence

Baseline `8758b1c84b4186449cd79fabae461ca53ee05100`. Branch
`test/sprint05b-regressions`, worktree `/tmp/aegisgate-05b-e`.
Collector source `a59e9f9`; full source/tree and Node binary SHA256 are in
`evidence/sprint05b-e/attempt-02/commands.json`. Runtime evidence commit
`50a5198`. SHA256SUMS covers every raw command stream and receipt.

Executed under the shared fixture lock:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  scripts/sprint05b-e-regressions.mjs evidence/sprint05b-e/attempt-02
```

Attempt 01 stopped at `go version` before fixture creation: system Go requires
AMD64 v4 support unavailable in this environment. The collector then selected
the existing pinned Go 1.27.4 binary. Failed attempt 01 remains retained;
cleanup returned no owned containers, networks or volumes.

## Measurements

Attempt 02 completes successfully. Actual PostgreSQL/Redis/NATS JetStream and
mTLS tests execute with isolated Compose project and discovered network.
The full Go race/integration suite has 11 passing packages, 88 top-level tests,
151 subtests and zero failures/skips. Coverage includes tenant/RBAC/OIDC
negatives, signed snapshot v1, publication/approval, trust rotation, encrypted
LKG and floors, rollback/canary, atomic consumer generations, drain, archival
references and recovery. No product source changed.

Fixture credential/TLS checks, image identity and restart integration pass.
The retained stale-volume probe verifies changed credentials are rejected,
original data persists, PostgreSQL runs as non-root, and the probe publishes
no ports. Both isolated probe resources are removed. The existing fixture
collector accepts a 05-B project name; its security assertions are unchanged.

Strict npm resolution succeeds for root, dashboard and spike lockfiles.
Dashboard lint, typecheck, tests, build and integration pass. Generated contract
checks and actual contract integration pass. Current registry metadata reports
typescript-eslint 8.72.2 with TypeScript `>=4.8.4 <6.1.0`; compatible TypeScript
6.0.3 and the minimatch override remain unchanged. No dependency upgrade,
scanner suppression or compatibility bypass is introduced.

All project containers, networks and volumes are absent after teardown.
Generated password/token/JWT values have zero matches in retained runtime
output; private PKI and fixture configurations are removed while locked.

## Limits And Handoff

This report does not claim a new 75/23 ingress result, fresh full image/advisory
scan, full root quality gate or hosted CI. Those are separate integration checks.
The original TE, H2 header and positive protocol controls remain mandatory in
root/F matrix execution. Existing historical scan evidence is not relabeled as
fresh. The external generation-floor interface is not a production monotonic
storage service. No locked module or production secret custody is implemented.

## Agent Completion Report

- Module/status: 00/02/03 scoped local regression complete, independent review pending.
- Files: additive collector/receipts/report; fixture project-name regex extended.
- Contracts/architecture: unchanged; no human approval recorded.
- Tests: all attempt-02 commands exit 0; raw argv, versions, timing, exits and SHA256 retained.
- Risks: strict ingress blockers, formal decisions, full security/hosted gates remain.
- Next action: independent review and root full matrix/gates; Module 04 stays locked.
