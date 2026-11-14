# Sprint05A E accepted-module regressions

Status: E ACCEPT for actual accepted-module local regressions; independent F
review PENDING. Runtime and independent receipt verification both exit0.
Module01 remains NO-GO;04-12 LOCKED; production BLOCKED.

## Exact sources and handoff

- Product baseline: `541d1d915ce6a3b679dc3fed3ea0a98f908ce001`, tree
  `89eff9430f2bb7044683eaf9e62e6657a7295a86`.
- Starting worktree: `8e77a4f` (root contract/inventory additions only).
- Committed collector source: `e325d80f45147f3125ebb9ac9428420cdba348c1`, tree
  `ea1b2be6aacdc38e35fa763c5ec5c8ec53fcd1b4`.
- Committed runtime proof: `16f2ffb75ef8ebb4d4ba2e645c8734670287cb60`, tree
  `62c8159adecaa54f07ee98abcc1989c3639cdd93`.
- Plan: `evidence/sprint05a-e/PLAN.md`; collectors:
  `scripts/sprint05a-e-{regressions.mjs,fixtures.py,verify.py}`.
- Runtime: `evidence/sprint05a-e/attempt-01/{commands.json,SHA256SUMS}`;
  independent verification: `evidence/sprint05a-e/verification-01/receipt.json`.
  The report/verification closeout is additive to those two exact commits.

No product, dependency, acceptance policy, snapshotv1 or original75/23 source
changed. The protected Git objects equal baseline and the root inventory hash
`4fb93b05f5fcd796bedafcc8a7bb5154e9ab7b2f2c4f046a878e83a934483662`.
`extract-baseline.mjs --check` passes. No scoped product fix is justified.

## Reproduction and evidence

Run from `/tmp/aegisgate-05a-e` with the supplied Node/Go directories prepended
to PATH; the collector explicitly sets these paths for every child command.

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint05a-e-regressions.mjs attempt-01
python3 scripts/sprint05a-e-verify.py attempt-01 evidence/sprint05a-e/verification-01
```

These exact invocations passed. Use new attempt/output names for reproduction
and commit source first. Both entrypoints acquire the shared fixture flock;
neither requires an outer lock. Runtime held it from setup through tests,
capture, cleanup, stream verification and final evidence hashes. Competing
nonblocking lock probes return1 at setup, regression and after cleanup.

Runtime:2026-11-14T14:46:03.406Z through14:51:59.301Z. All64 commands and128
raw stdout/stderr slices have source/tree, executable identities, actual argv,
safe explicit environment, cwd, UTC start/end, exits, offsets/lengths and SHA256.
The only nonzero exits are the three expected lock conflicts and strict TS7
resolution. No unsuccessful runtime attempt was discarded.

Verification on committed proof rechecks14 manifest entries,64 commands,128
stream slices and57 baseline references, source scope and protected-object
equality. Pinned offline Gitleaks exits0 with empty findings both during runtime
and over all20 then-tracked owned files. No scanner ignore/config change.

Tools: Node26.13.0/npm11.20.0, Go1.27.4, Rust1.99.1, Python3.14.10,
Git2.56.1, Docker29.9.3/Compose5.7.1, govulncheck1.9.0/cargo-audit0.23.0.
Exact binary paths/hashes and version streams are in `commands.json`.

## Actual regression results

The complete command inventory and raw results are in `commands.json`.
Principal positive/security commands all exit0:

```sh
make fixture-images
python3 scripts/integration.py
python3 scripts/fixture-image-integration.py
python3 scripts/sprint05a-e-fixtures.py
make fmt-check
go vet ./apps/control-api/... ./apps/config-publisher/... ./internal/... ./packages/test-fixtures/...
AEGIS_TENANCY_INTEGRATION=1 go test -race -v ./apps/control-api/... ./apps/config-publisher/... ./internal/... ./packages/test-fixtures/... -count=1
cargo +1.99.1 test --workspace --locked --manifest-path apps/edge/Cargo.toml
npm run contracts:check
npm run contracts:test
node scripts/contract-integration.mjs
node internal/configsnapshot/testdata/verify-vector.mjs
bash scripts/security-scan.sh dependencies
```

Go:11 packages,88 top-level tests,151 subtests,0 failures,0 skips, matching04C E
counts. Actual PostgreSQL transactions/migration/runtime permissions, tenant
isolation/BOLA, explicit six-role HTTP RBAC, session/CSRF/OIDC/PKCE/MFA and
OIDC signature/issuer/audience/time/JWKS/rotation/outage negatives pass.

Actual authenticated Redis and NATS/JetStream, credential negatives and origin
TLS wrong-host/untrusted/expired negatives pass. Module03 runs real NATS
JetStream mTLS identity/durability/subject-permission negatives and the real
PostgreSQL-to-signed-artifact-to-mTLS-fetch-to-authenticated-canary-ACK-to-newer
rollback integration. Approval binding, immutable publication/retry, signing
and trust rotation/retirement, tamper/replay/tenant/auth rejection, atomic
generation capture, encrypted restricted LKG/cold restart, independent floor
rollback rejection, signer/cache-key outages, bounded capture drain,
disconnected fail-closed deadlines, durable reference prune and archive
round-trip/checksum corruption/audit-retention controls all pass.

Edge tests, Python secret/image/history self-tests, generated contracts and
public Node signing golden vector pass. All five dashboard commands pass:
`npm --prefix apps/dashboard run lint`, `typecheck`, `test`, `build`,
`integration` (each run separately, exact argv retained).

## Fixture lifecycle

Unique project: `aegisgate-05a-e-attempt-01-8a83326c1e18`; network discovered
from structured Compose config, never assumed from another project. Only owned
named fixture config/inspect is parsed in memory; no rendered config is saved.
All four running images match immutable references and build lock; all published
bindings are127.0.0.1. NATS monitoring remains unpublished.

Fresh PostgreSQL initialization, non-root PID1, password checks and persisted
restart pass. Recreating a container on its named stale volume with a changed
password rejects that password and preserves the original credential/data.
The probe has no published port; its exact container/volume are absent after
cleanup and checked again by the verifier. Compose down removes project
volumes/network/containers; both project-label and owned-label inventories are
empty for container/network/volume. Four generated private values match0 in
owned additions; private-key markers match0. Owned passwords, configs, JWT/PKI
and scanner staging trees are removed while locked.

No fixture image/tag was created: builds resolve to the exact pre-existing
cached immutable IDs, verified before setup and after cleanup. Shared cached
images remain intact; no broad Docker prune/inspection was used.

## Dependencies and limits

Strict `npm ci --ignore-scripts --strict-peer-deps` passes in root/dashboard/
Pingora scopes (all three repository npm lockfiles). Current registry metadata
and official typescript-eslint Markdown at an immutable Git revision still
exclude TS7:8.72.2 peers require `>=4.8.4 <6.1.0`. Disposable strict
`npm install typescript@7.0.2 --package-lock-only --dry-run --ignore-scripts
--strict-peer-deps` returns1/ERESOLVE as expected. TS6.0.3 and the existing
minimatch11.0.7 override remain; no force, peer bypass, pin change or ignore.

Eight fresh dependency gate operations pass; Go/Rust/npm report no
vulnerabilities. Pingora derivative2.2.0/RUSTSEC-2024-0388 and
unsafe-libyaml0.2.11/RUSTSEC-2024-0449 remain unmaintained warnings, unsuppressed.

57 immutable baseline file/blob/SHA256 references avoid duplicating1,314,628
bytes of prior image/SBOM/proof packages. Image/source identity is freshly
checked; historical image/SBOM scans are not fresh advisory clearance. Complete
`make check`, `make security-scan`, fresh image/SBOM scans, hosted exact-head
jobs and independent F acceptance remain root integration gates.

Before/after: accepted-module failures remain0; no ingress repair claim.
Historical original75 scores remain Pingora63/75, Envoy69/75, Hyper70/75 and
supplemental16/23. All mandatory failures, including nine-byte H2 aggregate-zero,
remain open. External generation floors are provisioned interfaces, not a
production monotonic service. Consumer drain cannot recall copied data or cancel
engine H2/WS/gRPC I/O. Archive/secret custody, production recovery and affirmative
human architecture/security release decisions remain pending.

## Agent Completion Report

- Module/status:00/02/03 actual local regressions complete; E scoped ACCEPT,
  independent F review pending.
- Commits/files: exact source/proof above; additive05A E scripts, plan, receipts
  and this report only. No push, merge or agent spawning.
- Architecture/ADR decisions: none; Module01 NO-GO and04-12 LOCKED preserved.
- Contracts changed: none.
- Positive/security tests: exact commands, counts and outcomes above; all
  required local commands pass and expected negatives reject.
- Performance: no benchmark, throughput, HA or production capability claimed.
- Known risks/release blockers: ingress, maintenance, production custody,
  integration/hosted gates and formal decisions listed above.
- Human review needed: independent security/architecture and release signoff.
- Next unblocked action: F review exact E commits; root integration and gates.

Raw Compose progress streams include trailing spaces; `git diff --check` flags
those raw bytes. Evidence is preserved verbatim for the recorded SHA256 and
stream offsets; source formatting checks pass.
