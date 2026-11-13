# Local configuration recovery drills

Scope: engine-independent Module03 operations on owned local fixtures. Frozen
v1 envelope, signatures and ACK vocabulary are unchanged. This is no production
secret custody, hardware counter, HA, backup service, emergency transport, stream
termination or Module10 implementation. Keep Module01 NO-GO and04-12 locked.

## Independent floor and encrypted LKG recovery

1. Stop admissions and independently remove affected upstream traffic. Preserve
   the damaged encrypted checkpoint and safe metadata for investigation.
2. Authenticate the deployment, edge identity, pinned root/environment, latest
   trust/retirement state, cache-key source, current time and generation floor
   through installation controls independent of the restored local disk.
3. Provision `Options.MinimumGeneration` from that external record. Restore may
   equal the floor; a newly delivered artifact must exceed it. Never derive the
   floor from an incoming notice. The library does not persist or advance an
   external anchor; operators must retain the latest accepted floor separately.
4. An older encrypted checkpoint is a rollback diagnosis, even with valid AEAD
   and a valid signature. Quarantine it; do not lower the floor. Reconstruct a
   new consumer with a clean private cache and authenticated provisioning, then
   publish/fetch a newer approved signed generation. Keep the diagnosed instance
   stopped; its checkpoint failure deliberately remains sticky.
5. After a cache-key outage restores, create a new instance and revalidate the
   durable checkpoint. Never replace it with plaintext or generate a new key
   to disguise lost access. Missing LKG remains unready until valid recovery.
6. Verify current readiness, generation, exact ACK, required policy and restart
   replay rejection before re-admitting work. Do not export cache/signing keys
   to logs, snapshots or evidence.

Rollback of _all_ local state, externally supplied floor, trust and clock is not
detectable here. Authenticated out-of-band provisioning must itself resist
rollback. Scheduled trust retirement and trust-bundle versions need the same
care on restart; snapshots cannot bootstrap or resurrect trust.

## Signer outage and retirement

Keep publication queued with bounded retry while the signer is unavailable.
Do not switch to an untrusted local signer or change approval/TTL/payload. An
already staged signed artifact can be retried without calling the signer, only
if exact approval binding, digest, signature, current trust and time still pass.
Retirement invalidates staged retries and LKG signed by that key. Deliver a new
approved generation signed by a replacement key during authenticated overlap
before retiring the old key. Retiring the only usable key intentionally causes
unreadiness; recovery requires authenticated trust and a newer valid artifact.

## Captures, drain and disconnected emergency action

Use `Consumer.Drain(ctx)` with an operator-selected deadline. It permanently
stops readiness, new captures, ACK health confirmation and activation. During
grace, existing captures still resolve one coherent generation. `Close` releases
their retention budget. At the deadline/cancellation, further Resolve/Snapshot
calls refuse access even if a caller forgot Close; callers must still Close.
There is no undrain operation. Reinitialize using the normal authenticated
restart procedure. Do not reuse a drained consumer for another deployment.

The library cannot recall a route/snapshot already copied by a caller or cancel
external engine I/O. Independently cancel request contexts and terminate/drain
the engine within the declared budget; verify upstream removal separately.
Local capture refusal is not proof of H2/WS/gRPC stream termination.

When disconnected, only still-valid LKG admits new work. The earliest snapshot,
ownership, trust, retirement or staleness boundary denies subsequent captures
and healthy ACKs; there is no extension for an outage. Disconnected nodes cannot
learn a new emergency decision. Use independently authenticated LB/network
removal, confirm exclusion, then bounded local drain where reachable. Do not
introduce unsigned emergency artifacts or weaken TLS/signature validation.

## Durable references, archival and bounded prune

Use a separately authorized maintenance role and coordinate external LKG,
captured-generation and rollback reservations for the entire maintenance call.
Take a complete inventory across every deployment sharing the artifact store.
Pass those external digests to `Store.PrunePublicationArtifacts`. It locks the
publication and rollout/audit tables in SHARE mode NOWAIT through filesystem
deletion/fsync, re-reads every durable reference, and calls bounded LocalStore
Prune. Concurrent writers, missing tables/permissions, invalid references and
more than1024 keep entries refuse deletion. Supply a deadline for maintenance.

The wrapper retains _all_ staged/published/failed outbox digests and rollout
state/audit digests. It only reclaims old unreferenced orphan objects, at most64
per invocation, with a cutoff at least24h old. It does not delete immutable
revisions/outbox rows or archive journals automatically. Long-lived history can
still exhaust quotas; stop and design a reviewed archival migration rather than
delete durable references to force progress. Filesystem deletion cannot roll
back with a later database failure, so reference locks cover deletion itself.

Export audit/history bytes to a restricted independent archive, calculate its
SHA256, reopen and parse it, and compare restored row sequence, generation and
digest coverage before accepting that checksum. Hold controller/maintenance
coordination while establishing coverage. `CleanupAudit` expects an already
verified archive: it does not fetch or verify archive contents. It only permits
maintenance deletion of older-than30days rows outside the current generation,
retains the current state, and records the checksum transactionally. A checksum
string alone is not archive evidence. Restore and review before any cleanup.

## Reproduction

Commit sources first, then run:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint04a-f-evidence.mjs attempt-01
sha256sum --check evidence/sprint04a-f/attempt-01/SHA256SUMS
```

The recorder owns its Compose project, records setup, every test/check, exits,
source/log hashes and cleanup, and holds the outer lock throughout. It refuses
overwriting an attempt or proving uncommitted sources. Failed attempts remain.
Root owns full repository checks/scans and hosted exact-head checks; E owns
independent reproduction. These local drills cannot change release gates.
