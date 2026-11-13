# Sprint04-B D local reliability

Branch: `hardening/sprint04b-local-reliability`.
Worktree: `/home/tiecont/Projects/aegis-gate-04b-d`.
Agent thread: `01a1d5d4-9cb4-7fe2-a98c-86478d27a99a`.

Modules00/02/03 local regressions are preserved. No product defect was reproduced
requiring a runtime fix. This assignment adds an owned evidence recorder and a
stale-volume credential probe, without changing runtime, dependencies, contracts,
minimatch, scanners, shared status documents or release gates. Root's final full
gates and E's independent acceptance remain separate requirements.

## Baseline and source

PR12 merge baseline is `cbb5f71db84b9489bf4a6260696bbba29ab4a561`.
Fresh remote/main receipt and GitHub API receipts bind hosted run43466312855
to that exact merge, event `push`, completed/success. Its `foundation-quality`
job132026266730 and `supply-chain-security` job132026267283 both succeeded.
These are baseline hosted results, not hosted results for this D branch.

Source commits were created before proof:

- `c08c882bad892ca803aa6c9b991a7d39ef607c41`: plan, recorder and stale-volume probe.
- `af35a4df7c3b044e8c735c3b35ac24f3e50bf5b6`: explicit compatible Go PATH receipt.
- `54e7ea06b7519e9e2a5aee1ba4b03488897ae355`: remove rendered Compose recording.

Eligible proof uses the last source commit, tree
`1354379318c2fde124b273985be6041c09f23baa`, with224 source-file SHA256 entries
in `evidence/sprint04b-d/attempt-03/source.json`. Initial status contains only
prior uncommitted D attempt receipts; no dirty source. The final source-diff
command checks tracked source remained unchanged throughout execution.

## Reproduction and fixture lifetime

Run from the D worktree with a fresh attempt number:

```sh
env AEGIS_D_GO_DIRECTORY=/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04b-d/record.mjs attempt-03
sha256sum --check evidence/sprint04b-d/attempt-03/SHA256SUMS
```

The recorder invokes `flock --exclusive
/tmp/aegisgate-sprint02-fixtures.lock` around the entire inner process. The lock
was requested at2026-11-13T17:02:35.143Z and acquired before17:03:55.176Z.
Command UTC start/end, argv, cwd, exit/signal/error, source commit and separate
raw stdout/stderr hashes are in `attempt-03/commands.json`.
Execution finished at2026-11-13T17:07:15.840Z with recorder exit0,
`complete=true` and `lock_held_through_cleanup=true`. The64 command receipts
include128 separately hashed logs. All132 entries in the eligible manifest
verify; the failed attempt01 manifest also verifies. A separate verification
recomputed all224 source hashes and128 command-log hashes, counted88 Go
top-level tests plus151 subtests across11 packages with no skips, and found0
matches for local credential values or private-key markers in all retained D
evidence. Attempt02's intentionally removed file is not claimed to verify.

Competing `flock --nonblock ... true` returns1 before setup, after setup, before
regression, before cleanup and after cleanup. All other required commands
return0, except the deliberately unsupported TypeScript7 resolution returns1.
Private fixtures, builds, Compose startup, DB/NATS/TLS tests, dashboard localhost
server and cleanup all run inside that same lock lifetime.

Compose project is `aegisgate-04b-d`; the probe discovers
`aegisgate-04b-d_lab` from structured Compose JSON in subprocess memory. No
rendered configuration is retained in eligible evidence. Sanitized output
contains project/network identity and assertion results only. All four running
container image IDs match their configured immutable references, local image
IDs match the build lock, every container is on the discovered network, and
every published binding is127.0.0.1.

The stale-volume probe initializes a new named PostgreSQL volume using the real
fixture image and original private credential, writes a row, removes the
container, and recreates it on the same volume with a different private secret.
The new configured secret fails TCP authentication, while the original secret
still reads the row. This is expected persisted-database behavior: changing
`POSTGRES_PASSWORD_FILE` does not rotate an initialized database password.
The probe does not weaken authentication, reset an existing shared database or
print either credential. Its container has no published port. The probe removes
both its container and volume; project cleanup removes all D Compose containers,
network and volumes, with empty project-label inventories recorded.

Exact Go path above contains both `go` and `gofmt`; it is the cached official
Go1.27.4 linux/amd64 toolchain. The system `/usr/bin/go` requires unsupported
AMD64-v4 CPU features here. Tool lookup/version receipts record Go1.27.4,
Rust1.99.1, Node26.13.0, npm11.20.0, Docker29.9.3 client/server and Compose5.7.1.
No global toolchain was replaced.

## Executed local regression

In this table `P` expands to `./apps/control-api/... ./apps/config-publisher/...
./internal/... ./packages/test-fixtures/...`; `N` is the pinned Node executable
above, and `npm` is its sibling executable. Every invocation has its complete
literal argv/cwd in `commands.json`.

| Command | Result / retained log label |
| --- | --- |
| `npm ci --ignore-scripts --strict-peer-deps` in root and dashboard | PASS; `root-install`, `dashboard-install` |
| `make fixture-images` | PASS; private credentials/PKI and immutable local builds; `fixture-images` |
| Project Compose `up -d --wait --wait-timeout 90` | PASS; `compose-up` |
| `python3 scripts/integration.py` | PASS; PostgreSQL TCP credential positive/negative, Redis/NATS authentication, JetStream, verified TLS origin plus wrong-host/untrusted negatives; `fixture-credential-tls` |
| `python3 scripts/fixture-image-integration.py` | PASS; real image fresh init, su-exec UID drop, persisted restart/password positive/negative; `fixture-fresh-restart` |
| `python3 evidence/sprint04b-d/stale-volume.py` | PASS; dynamic network/running-image/binding checks and stale-secret/volume lifecycle; `fixture-stale-volume` |
| `make fmt-check`; `go vet P` | PASS; `format`, `go-vet` |
| `AEGIS_TENANCY_INTEGRATION=1 go test -race -v P -count=1` | PASS,11 tested packages, no skips; `go-full-race-integration` |
| `cargo +1.99.1 clippy --workspace --all-targets --locked --manifest-path apps/edge/Cargo.toml -- -D warnings` | PASS; `edge-clippy` |
| `cargo +1.99.1 test --workspace --locked --manifest-path apps/edge/Cargo.toml` | PASS,14 tests; `edge-test` |
| `cargo +1.99.1 build --workspace --locked --manifest-path apps/edge/Cargo.toml` | PASS; `edge-build` |
| `python3 scripts/dev-secrets.test.py -v`; `python3 scripts/image_identity_test.py -v`; `python3 scripts/git_history_preflight_test.py -v` | PASS; private modes/symlinks,31 archive/image identity tests and real history-scan preflight regressions |
| `npm run contracts:check`; `npm run contracts:test`; `N scripts/contract-integration.mjs` | PASS; `contracts-check`, `contracts-test`, `contracts-integration` |
| `N internal/configsnapshot/testdata/verify-vector.mjs` | PASS; independent Node/OpenSSL signature/context/hash/tamper check; `golden` |
| Dashboard `npm run lint`, `typecheck`, `test`, `build`, `integration` | PASS; all five `dashboard-*` logs; owned loopback integration server |
| `go build -o .local/bin/<name> <package>` for control-api, config-publisher and fixtures | PASS; exact packages/argv in three `go-build-*` records |
| `make gate-selftest`; `make security-negative` | PASS; `gate-selftest`, `security-negative` |
| Root/dashboard `npm audit --audit-level=high --json` | PASS,0 vulnerabilities in each; `root-audit`, `dashboard-audit` |
| `git diff --exit-code HEAD -- . :!evidence/sprint04b-d/` | PASS; `source-unchanged` |
| Project Compose `down --volumes --remove-orphans`; label inventories | PASS; `compose-down`, `cleanup-container`, `cleanup-network`, `cleanup-volume` |

## Recovery boundaries

All named tests below actually pass in the enabled full Go race run:

| Test | Verified boundary and remaining limit |
| --- | --- |
| `TestRecoveryExternalProvisioningRejectsEncryptedFullStateRollback` | Real encrypted checkpoint7 is accepted by an unanchored positive control, but refused by independent provisioning floor9. Equal-floor restore9 works; diagnosed instance stays unready/sticky; lost-disk delivery7/9 fails and10 succeeds; cache-key outage/restart/replay and invalid floor bounds checked. `MinimumGeneration` is an injection API, not an implemented external monotonic storage/provisioning service. Rolling back all disk, floor, trust and clock remains undetectable. |
| `TestRecoverySignerOutageStagedRestartAndRetirement` | Signer outage cannot publish; staged bytes survive delivery outage and worker reconstruction without another Sign call; retirement blocks retry. Real durable queue/publication remains covered separately by PostgreSQL integration. |
| `TestRecoveryCapturedGenerationDrain` | Deadline mandatory; coherent generation1 capture survives generation2 activation during grace; new captures/activation fail; graceful Close and actual one-second deadline refusal release retention; restart keeps generation2. Cannot recall copied values, cancel engine I/O or prove H2/WS/gRPC drain. |
| `TestRecoveryDisconnectedEmergencyFailClosed` | Fetch outage preserves valid LKG; staleness, snapshot, ownership, authenticated trust expiry and retirement each deny new work/healthy ACKs at their deadline. Cannot learn a new disconnected emergency decision. |
| `TestIntegrationRecoveryDurableReferencesPruneAndRestart` | Real PostgreSQL outbox/published/failed/leased/unsigned-pending and rollout/audit references plus external LKG reservation survive bounded prune/restart; aged orphan removed; missing tables/conflicting writer lock/invalid digests deny deletion. Actual outbox archive bytes round-trip with checksum/equality and corruption checks. No automatic archive/GC/backup service; caller coordinates external references. |
| `TestIntegrationRecoveryArchiveRoundTripBeforeAuditCleanup` | Actual durable audit rows exported/restored with sequence/generation/digest coverage; runtime deletion denied; maintenance removes old generation only, retains current history, records archive checksum and survives store restart. `CleanupAudit` trusts a caller-verified checksum; it does not independently authenticate archive custody. |

Existing tenant/RBAC/domain/session/SSRF/TLS, transactional publication,
canary ACK/rollback/outage and frozen snapshot negative suites also pass in this
same full run. Foundation edge tests still prove unavailable tenant runtime;
they do not establish an accepted production proxy.

## Dashboard compatibility

Fresh `npm view <package> version peerDependencies engines --json` receipts
cover TypeScript, typescript-eslint, parser/plugin/typescript-estree, Next,
Next ESLint plugin, ESLint, React and react-dom.

| Package | Observed release / compatibility |
| --- | --- |
| TypeScript | latest7.0.2; retained pin6.0.3 |
| typescript-eslint and parser/plugin/typescript-estree | latest8.72.2; TypeScript peer `>=4.8.4 <6.1.0`, excluding7; ESLint peer accepts10 |
| Next / Next ESLint plugin |16.4.6; current pins retained |
| ESLint |10.14.0; supported declared lint peer range |
| React / react-dom |19.3.1; retained supported tree |
| minimatch override |11.0.7; unchanged |

An isolated temporary package/lock copy runs `npm install typescript@7.0.2
--package-lock-only --dry-run --ignore-scripts --strict-peer-deps`, exits1 with
`ERESOLVE`, and explicitly names the incompatible parser family TypeScript
range. No forced resolution or peer override is performed. Supported strict
install/tree, lint/typecheck/unit/build/integration and audits all pass. Root
and dashboard manifests/locks, Dependabot configuration and scanner script
remain byte-identical to baseline. TypeScript7 update stays blocked until a
maintained release explicitly supports7, then needs normal grouped resolution
and repeat compatibility/security acceptance. No full scanner PASS is claimed
by D; root owns the final `make security-scan`.

## Retained attempts and hashes

Attempt01 failed at system Go version before fixture setup; its logs and intact
manifest remain. Attempt02 runtime commands finished successfully, but root
review identified the unsafe rendered Compose recording. Its uncommitted
`compose-config.stdout.txt` was removed before commit. `attempt-02/REDACTION.md`
documents the omission; its original commands/manifest retain the historical
digest and deliberately reference that missing file. Attempt02 is ineligible
and its original manifest is intentionally incomplete. Do not reconstruct the
removed output. Attempt03 is the replacement eligible proof on corrected source.

Key attempt03 SHA256 values:

```text
ef7d7f7200602a02188dd924ce6174d81b01e8e63c85892353bc400bad319633  go-full-race-integration.stdout.txt
2a83191dde3a0e4942f0915a5919cfff5fd212a0148387d687439d2a6d012615  fixture-stale-volume.stdout.txt
407162e84e29ae036600004aa8178af8d7457c4daf5c4d7dce5cb022ad4675d2  typescript7-strict-resolution.stderr.txt
b9284bfc0c1178ba02c8ffe404d88013baf18a86b5ca45eba9363997dcfb81b0  fixture-images.lock.json
```

## Agent Completion Report

- Module:00/02/03 local reliability/dependency regression, Sprint04-B D.
- Status:complete for assigned local scope; independent E acceptance pending.
- Commits/files changed:three source commits above; owned plan, recorder,
  stale-volume probe, attempt receipts and this report. No product source fix.
- Architecture/ADR decisions:none; Module01 NO-GO,04-12 LOCKED, production BLOCKED.
- Contracts changed:none; v1, authorization, TLS and all ingress expectations
  preserved. No Module10 implementation or external storage-service claim.
- Positive/security-negative tests:exact commands/results above and full
  source/argv/cwd/time/exit/hash receipts; unsupported TS7 failure is expected.
- Performance:no capacity/SLO/load claim; local drain deadline correctness only.
- Known risks/release blockers:external floor/trust/clock custody, engine drain,
  independent review and separate final local/hosted gates remain outstanding.
- Human review needed:existing architecture/security/release decisions remain
  pending with their owners; D does not grant a security/runtime GO.
- Next unblocked work:E review of exact source/evidence, then root integration,
  full `make check`/`make security-scan` and exact final-head hosted jobs.
