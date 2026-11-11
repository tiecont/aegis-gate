# Sprint03-B B — durable approved snapshot publication

Module03 publisher component, local scope. Branch `feat/module03-publisher`.
Implementation commits `a93e98a`, `6d9dd0b`, `89ca3d4`; dependency repair is
recorded separately. Independent integration and final hosted checks remain
required before any module acceptance.

The additive008 migration records immutable approved whole snapshots and a
durable outbox in the same transaction, with generation/audit rollback on any
failure. Preview/approval resolve only approved immutable Module02 route,
origin/pool/endpoint and policy revisions, currently valid globally owned
domains and complete tenant-scoped references. Approval requires existing
membership authorization, fresh verified MFA and a matching preview digest.
Idempotency binds payload, rollback target and TTL. Rollback preserves approved
content as a new monotonic generation and rechecks current ownership under row
locks. Historical approvals are immutable; publication journals have a1000
revision quota rather than unbounded growth.

Workers claim bounded fenced leases, persist exact signed artifact bytes before
delivery and recover the same bytes after crashes, signing-key changes or
storage/bus outages. Stale workers cannot stage, retry or finish a reclaimed job.
Exhausted crashed final leases become terminal so later approved generations can
proceed. Artifact verification binds all approved timestamps, generation and
payload before storage or notification.

Restricted local immutable storage uses0700/0600 permissions, descriptor-rooted
digest paths, process-wide file locking, fsync and atomic no-replace linking.
Stale staging files are recovered under the same exclusive lock. Quotas fail
closed; corruption/replacement and symlink reads are denied. Its bounded mTLS
handler authenticates certificate URI SAN identity and authorizes deployments.

Maintained nats.go uses mutual TLS with pinned server trust and client identity,
finite connection timeouts, no discovered endpoints/reconnect buffer and bounded
JetStream file retention/dedup. The publisher can emit only rollout admission
hints; it cannot command edge groups. A bus notification cannot authorize
configuration or advance rollout without independent signed/durable approval
verification. Dedicated local pinned-image tests verify real restart/redelivery,
dedup, missing/unmapped client and wrong-server rejection, and subject ACLs.

The executable preserves foundation `--check`, refuses implicit startup and
supports explicit `--local-config` with private settings/DSN/key files and an
owned-loopback artifact listener. `LocalFileSigner` is a disposable fixture
provider only; production requires an audited implementation of the shared
Signer interface. No key/credential is logged or committed. The control API's
authorized HTTP publication endpoints are owned by root's management commit.

## Agent Completion Report

- Module:03 publisher component; implementation complete, independent acceptance pending.
- Contracts: A shared signed snapshot1.0; notification contains deployment,
  generation, exact-artifact digest and authenticated location only.
- Positive/security tests: source-bound commands, actual exits and log hashes
  are in `evidence/sprint03b-b/commands.json`; integration uses real PostgreSQL
  restricted runtime roles and real pinned Docker JetStream under the fixture lock.
- Negatives: transaction injection, unauthorized/MFA/stale/changed-TTL approval,
  unapproved drafts, cross-tenant references, concurrent lease fencing,
  immutable/crash/outage recovery, exact approved envelope binding, storage
  corruption/perms/quota, mutual TLS and message ACLs.
- Risks: production secret service, managed object store custody, multi-region
  HA and archival procedures remain later release work. No proxy or production
  capability is claimed. Root/F own complete acceptance and hosted checks.
- Next modules: no module gate opens on this component report.
