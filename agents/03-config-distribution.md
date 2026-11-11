# AGENT 03 — Signed Configuration Distribution

**Dependency:** 00, 02; uses 01 findings. **Gate:** `M1-CONFIG-SAFETY`.

## Tasks

1. Implement transactional outbox in Go for config revision publication with idempotent workers and durable status transitions.
2. Define JSON schema/protobuf snapshot envelope exactly as `docs/CONFIG_PROTOCOL.md`: canonical bytes, signature context, schema version, generation, tenant routing, origin/policy references.
3. Generate signing keys via dedicated secret service for production; expose verification public keys via authenticated bootstrap/rotation, not plain pubsub trust.
4. Publisher resolves validated domain claims, origin and policy references, compiles deterministic snapshot, enforces policy resource limits and global hostname ownership.
5. Store signed immutable artifact in restricted object storage; publish `(deployment_id,generation,digest,location)` notification via JetStream.
6. Implement edge config agent: mutual-auth fetch, verify signature/digest, monotonic generation, parse+precompile into staging, atomically activate, ACK/NACK with structured error codes.
7. Persist encrypted/permission-locked last-known-good snapshot for cold restart, validate trusted signing key on load; startup with no valid snapshot should not serve requests.
8. Canary rollout by edge group, ACK quorum and health gates; rollback means new signed monotonic generation.
9. Add config simulation/preview endpoint before publishing; ensure auth policy cannot become implicitly anonymous due to missing fields.
10. Telemetry: publish lag, skew, invalid artifact count, last valid update, ACK/NACK and stale alarms.

## Acceptance

- Tamper one byte -> NACK; replay previous generation -> NACK; broken cross-tenant host -> NACK.
- Edge uses LKG during Postgres/NATS/control API outage; new edge with no snapshot has no public readiness.
- Concurrent update during traffic never mixes route table from revision X and auth policy from Y.
- Canary rejection stops rollout; re-publish old content as newer generation succeeds with audit event.
- Signing key rotation tests include valid overlap and retired key rejection.

## Security focus

NATS event alone is not trusted config. Do not publish certificate keys or credential values. No unbounded snapshot parsing, downloads, or retained versions. Use authenticated edge identities, per-env trust roots and restricted object store access.

## Deliverables

Publisher, signing/verification library, edge agent, schema, migration, integration tests, operations doc.
