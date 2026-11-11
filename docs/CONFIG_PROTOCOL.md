# Config Contract and Publication Protocol

## Goals

Near-real-time config apply without calling the control plane per customer request; bounded stale period, signed immutable snapshots, atomic activation, canary/rollback, tenant isolation, auditable policy activation.

## Snapshot example

See `../examples/gateway-snapshot.json` (values are illustrative; it is *not* schema-validated production config).

Minimum logical envelope:

```json
{
  "schema_version": "1.0",
  "generation": 173,
  "deployment_id": "uuid",
  "valid_from": "RFC3339 UTC",
  "created_at": "RFC3339 UTC",
  "content_sha256": "hex digest of canonical payload",
  "signing_key_id": "string",
  "signature": "base64 Ed25519 signature over defined envelope bytes",
  "tenants": []
}
```

**Signing rules**: define one canonical byte representation (e.g. RFC 8785 JCS or deterministically encoded protobuf), domain-separate the signature context (`AEGISGATE_CONFIG_V1`), sign schema version + generation + hash + expiry + content; verify before parsing as active config. Pin active public keys via authenticated bootstrap, support rotation with overlapping validity and explicit revocation. Reject wrong generation, duplicate hostname, unknown fields and invalid policy operators.

## Lifecycle

1. Operator submits policy and receives deterministic preview + validation errors.
2. DB transaction records approved immutable revision and outbox event atomically.
3. Publisher claims event idempotently, builds whole usable snapshot; checks all tenant references and hostname ownership.
4. Snapshot stored as immutable blob; digest + signature verified in publisher. No raw cert private keys or API key cleartext in snapshot.
5. Notification provides `(generation, hash, location)` over authenticated messaging.
6. Edge fetches snapshot securely, validates signature/schema/timestamps/bounds and precompiles all routing/policy data; load under tight memory cap.
7. Edge stages config; canary subset applies, ACKs health/contract probes. Remaining edge instances apply when canary passes.
8. Apply is atomic pointer swap. Old snapshot retained for in-flight requests + bounded grace. Emit applied generation and audit.
9. On error, NACK with safe diagnostics and **keep LKG**. Alert on stale generation or missing ACK.
10. Rollback creates **new generation**, deriving payload from approved previous generation; never roll version counter backward.

## Edge disconnected behavior

- Boot requires an authenticated validated snapshot from disk or publisher; if none, readiness false / no customer traffic.
- Losing control plane must not remove active auth and security. LKG stays in effect; report stale status.
- Domain revocation and emergency denies have explicit hazard analysis: can send out-of-band emergency rule through independently authenticated channel; if unavailable, operator can remove traffic at upstream provider/LB.
- Local cached certificates and their remaining validity are independent of config availability; never serve expired cert.
- TTL of snapshots for regular use is a policy decision based on acceptable risk, not automatic silent bypass. After configured maximum staleness choose documented fail-safe per tenant/route class; for critical security revocations prefer fail closed.

## Consistency

- No cross-tenant data mixed by consumer: namespace hashes/paths, cross references validated.
- Config serves as single immutable read-model; request uses a captured generation for entire lifetime.
- Config edge deploy visibility: per-edge ACK/NACK, % healthy, p95 propagation, version skew, degraded reason, retry state.
- Fanout can be driven by JetStream events but edges pull from securely authorized artifact store, not arbitrary config bodies in public pubsub.

## Acceptance test contract

- A valid revision starts routing across all healthy edges; generation matched.
- Corrupted signature/hash, schema downgrade, stale replay, duplicate host, invalid JWT policy or forbidden origin rejected.
- One failed edge does not block serving from healthy edges; canary failure pauses rollout.
- Control plane DB and NATS outage: already-active routes continue with LKG and observable stale state.
- Atomic change of route origin under sustained load: requests use either old or new consistent snapshot, never mixed policy.
- Rollback change deploys monotonically increasing generation and produces audit diff.
