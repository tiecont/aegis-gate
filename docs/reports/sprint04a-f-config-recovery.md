# Sprint04-A F configuration recovery

Date: 2026-11-13. Branch: `hardening/module03-local-recovery`.
Baseline: `3e03940848c81751c87bbcec131238abb7d28e1b`.
Committed proof source: `99e41a2438d42c9588620d7766d2b03ebc557a14`.

Local assignment complete, pending E's independent review/reproduction and
root integration checks. No shared gate/status, frozen v1, parser expectation,
TLS/authentication, schema, dependency or production custody change. Module01
remains NO-GO;04-12 remain locked; production remains BLOCKED.

## Changes and executable coverage

| Boundary                                     | Implementation and executed regression                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Independent floor / full-state rollback      | `TestRecoveryExternalProvisioningRejectsEncryptedFullStateRollback` uses real DiskLKG ciphertext: apply7, retain its encrypted bytes, apply9, restore9 at equal external floor, replace the entire disk checkpoint with7. The unanchored positive control restores7; provisioning floor9 rejects it, stays unready and refuses even generation10 on the diagnosed instance. Lost-disk reprovisioning rejects7/9, accepts10, persists and restores10, and rejects replay. Invalid out-of-range floors now fail construction.                                                                                                                                                      |
| Cache-key outage / restart                   | The same test injects an actual CacheKeySource failure, checks cold startup stays unready and sticky, then creates a new consumer after key recovery and restores the durable generation10 checkpoint. No key fallback or plaintext recovery.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Signer outage / immutable retry / retirement | `TestRecoverySignerOutageStagedRestartAndRetirement` exercises Worker with Signer/Queue/Notifier test doubles: signing outage cannot stage/store/finish; delivery outage preserves signed bytes; reconstructed worker resumes those exact bytes while signer remains unavailable, without another Sign call; retirement prevents re-store/republication. Durable queue behavior remains covered by the existing actual PostgreSQL end-to-end suite.                                                                                                                                                                                                                              |
| Captured generation drain                    | New `Consumer.Drain` requires a deadline, permanently refuses readiness/captures/activation, lets coherent generation1 finish while generation2 is active, and refuses subsequent capture access after grace/deadline. `TestRecoveryCapturedGenerationDrain` checks graceful Close, real one-second deadline expiry, Resolve/Snapshot refusal, idempotent Close/retention release and restart preserving generation2. Uses existing `cancelled` ACK, no new wire code.                                                                                                                                                                                                           |
| Disconnected emergency fail-closed           | `TestRecoveryDisconnectedEmergencyFailClosed` checks healthy LKG survives fetch failure, then denies readiness, new captures and healthy ACKs at separate staleness, snapshot, domain ownership, authenticated root-signed trust expiry and scheduled retirement boundaries. Trust/retirement cases use Bootstrap, not notification-supplied trust.                                                                                                                                                                                                                                                                                                                              |
| Durable references / prune / restart         | New explicit `Store.PrunePublicationArtifacts` holds PostgreSQL SHARE/NOWAIT locks through filesystem prune/fsync, collects all outbox and rollout/audit digests, and combines externally coordinated reservations. `TestIntegrationRecoveryDurableReferencesPruneAndRestart` uses real approved revisions/outbox stages, published/failed/leased/unsigned-pending rows, separate rollout-only/audit-only references and an external disconnected-LKG reservation. After reconnect/reopen it removes one aged orphan, retaining every reference and all four immutable approvals. Missing rollout tables, conflicting writer locks and invalid external digests refuse deletion. |
| Archive / restricted cleanup                 | That test exports/restores actual outbox bytes, validates JSON/equality/checksum and detects corruption, without deleting immutable history. `TestIntegrationRecoveryArchiveRoundTripBeforeAuditCleanup` separately exports/restores actual durable audit records and verifies sequence/generation/digest coverage before cleanup; runtime deletion is denied, maintenance deletes only the old generation, preserves current history, records archive checksum and survives rollout-store restart.                                                                                                                                                                              |

Operational steps and exact limitations are in
`docs/CONFIG_RECOVERY_RUNBOOK.md`. The executable implementation plan was
committed with the source in `docs/reports/sprint04a-f-plan.md`.

## Actual proof and provenance

The source commit was created before the first proof. `attempt-01/source.json`
records an empty initial Git status, exact source commit and SHA256 for the
configuration/persistence sources, dependencies, frozen contract, runbook and
recorder. All proof commands run with `GOTOOLCHAIN=go1.27.4`.

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint04a-f-evidence.mjs attempt-01
sha256sum --check evidence/sprint04a-f/attempt-01/SHA256SUMS
```

Both exit0. Recorder execution: `2026-11-13T10:09:09.511Z` through
`2026-11-13T10:09:56.546Z`, excluding lock acquisition wait. The outer lock
covers the entire recorder, private fixture creation/build, PostgreSQL startup,
all real DB/NATS/mTLS fixtures, tests and cleanup. The recorder uses its own
Compose project `aegisgate-04a-f`; PostgreSQL binds only127.0.0.1:54329. No F
container remains after recorded cleanup. No third-party abuse tests occur.

| Command, after lock acquisition                                                                                                                                                                                                                                         | Exit / evidence                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `go version`; Node `--version`; Docker client/server version                                                                                                                                                                                                            | 0 each; Go1.27.4 linux/amd64, Node26.13.0, Docker29.9.0/29.9.0                                                                                                                          |
| `go test -race -v ./internal/configconsumer ./internal/configpublish ./internal/configsnapshot ./internal/configreview -count=1`                                                                                                                                        | 0; `unit.log`. Integration-only JetStream deliberately skips here, then executes in the full enabled run below.                                                                         |
| `make fixture-images`                                                                                                                                                                                                                                                   | 0; `fixture-images.log`; fresh private local secrets/PKI and pinned local image builds, no publication                                                                                  |
| Project-scoped Compose `up -d --wait --wait-timeout 90 postgres`                                                                                                                                                                                                        | 0; exact argv in `commands.json`, `postgres-up.log`                                                                                                                                     |
| `env AEGIS_TENANCY_INTEGRATION=1 go test -race -v ./apps/control-api/internal/persistence ./apps/control-api/internal/transport ./internal/configreview ./internal/configconsumer ./internal/configsnapshot ./internal/configrollout ./internal/configpublish -count=1` | 0; `module03-integration.log`; all seven packages pass, no test skips. Includes existing independent actual publication-to-canary-ACK/rollback/outage proof and new six recovery tests. |
| `go vet ./apps/control-api/internal/persistence ./internal/configconsumer ./internal/configpublish ./internal/configsnapshot ./internal/configrollout ./internal/configreview`                                                                                          | 0; `vet.log`                                                                                                                                                                            |
| `node internal/configsnapshot/testdata/verify-vector.mjs`                                                                                                                                                                                                               | 0; independent Node/OpenSSL golden verification, `golden.log`                                                                                                                           |
| `git diff HEAD --check`                                                                                                                                                                                                                                                 | 0; records no uncommitted source edits during proof, `source-whitespace.log`                                                                                                            |
| Project-scoped Compose `down`                                                                                                                                                                                                                                           | 0; `postgres-down.log`; under the same fixture lock                                                                                                                                     |

`evidence/sprint04a-f/attempt-01/commands.json` retains exact argv, start/end,
source commit, exit, signal/error and raw log SHA256. Its manifest verification
passes for all13 listed files. No failed or incomplete proof attempt occurred;
the single first committed-source attempt passed. Unit-pass integration skips
are not represented as integration proof. Raw logs are retained unchanged.

Key SHA256 values:

```text
32f57b56d06d7bd0d6d1c3158e99a9bd677ef87da4c9dd503b884d2d1758bfbe  module03-integration.log
eb22c7284d349071d0727d21ec798e926246c84f96d0aedd1b48beb9066138c7  unit.log
feea068447486c3553f7dda051c552b7aeec006802107404b12ba76f574e8c1a  golden.log
de62382235ac0236eb08c67e140c1d9a02217517851f090ef855190b39111d35  postgres-down.log
```

## Review limits and remaining work

- The independent floor is authenticated provisioning through the existing
  MinimumGeneration API, not an implemented external counter service. Full
  rollback of disk, provisioning record, trust and clock remains undetectable.
- Drain bounds access to this local configuration read model. It cannot recall
  already copied values, cancel engine I/O, remove LB traffic, or prove active
  H2/WS/gRPC completion. Those remain future edge/operational release work.
- Maintenance retains every durable journal reference, including failed rows;
  it only prunes aged unreferenced objects. No automatic journal archival,
  immutable approval deletion, GC service, backup/restore service or HA claim.
  The caller must coordinate references outside the locked schema/tables.
- Archive coverage is verified by the operator/test before CleanupAudit;
  CleanupAudit itself trusts a supplied already-verified checksum. Tests do not
  claim that a digest string alone authenticates an archive or creates custody.
- No repository-wide `make check`, `make security-scan` or hosted gate result
  is claimed for F. Root owns those on the eventual exact integration head;
  E's independent review/reproduction remains required before integration.

## Agent Completion Report

- Module:03 local operational recovery regressions/additions.
- Status:complete for assigned local scope; independent E acceptance pending.
- Commits/files:source `99e41a2`; consumer drain/floor bound, persistence
  retention wrapper, six recovery tests, recorder, plan and recovery runbook;
  this report and `evidence/sprint04a-f/` added in the handoff commit.
- Architecture/ADR decisions:none; no gate or architecture change.
- Contracts changed:none on the wire; additive local Go maintenance/drain APIs.
- Positive/security-negative commands and outcomes:exact table/commands above;
  race-enabled integrated run exits0 without skips.
- Performance:no throughput/capacity/SLO claim; local one-second capture drain
  deadline regression only.
- Known risks/release blockers:external provisioning/custody and clock rollback,
  actual engine/LB emergency drain, archival automation and all release gates.
- Human review needed:existing architecture/security/operational release
  decisions remain with their owners; E independently reviews these changes.
- Next unblocked work:E reproduction, then root sequential integration and
  full exact-head checks; Modules04-12 stay locked.
