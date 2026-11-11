# Deployment, Operations & Incident Response

## Environments

**Local:** Compose with self-signed lab certs. Hosts bound to loopback by default. Demo origin and synthetic load; not public traffic. Secrets as local untracked env fixtures only.

**Staging:** Isolated cluster/project, separate domains, ACME staging, synthetic customers, rate tests allowed only on owned load-generator and demo endpoints. Config signing key distinct from production.

**Production:** Provider-managed L3/L4 mitigation, protected L4 balancer, multiple Rust edge replicas (prefer multi-zone), private Go admin API and database. Postgres encrypted backup/PITR, Redis availability aligned to quota guarantees, durable NATS JetStream storage with limits. Network policies deny all except explicit flows. Admin and tenant ingress are segregated.

## Secrets

Use KMS/Vault/cluster secret management with audited least-privilege access; unique environment keys; no private key/pepper/DB password checked into git or embedded in images. Test renew/rotate and revoke. Configure service account permissions minimally. Separate TLS certificate issuer from config signing authority.

## Golden signals

- Data plane: request throughput, edge outcome (origin vs reject), error/429 ratios, latency histograms, concurrent connections, active TLS handshakes, proxy connection reuse, origin health, CPU/RSS, queues, config generation/staleness.
- Security: rate policy counts, auth deny rate (coarsely grouped), suspicious host, failed domain validations, cert lifecycle, secret/key access, emergency blocks and rule changes.
- Control plane: DB pool/saturation, outbox lag, NATS publish ACKs, edge config ACK/NACK, rollout lag/rollbacks, admin auth failures, billing ledger lag.
- Billing: usage ingestion delay, dedupe conflicts, reconciliation mismatch, plan quota warning, spend / egress budget.

Metrics label cardinality MUST be bounded; raw path/query, token, user ID and full IP do not belong in metric labels.

## Alerts

Page for inability to serve customer traffic, cert expiry imminent/failed renewal, widespread auth bypass symptoms, high config reject across edges, control plane outage with dangerously stale config, global rate backend failure with severe impact, unknown origin egress, backup/PITR failures. Ticket rather than page for minor UI latency or noncritical dashboard freshness. Document owners and escalation paths.

## On-call runbook skeleton

1. Confirm incident scope, region, affected tenants and whether security event.
2. Check external provider and L4 health; check edge readiness, config generation and certificate status.
3. If abuse, apply verified emergency block via control plane; if unreachable, act at upstream provider/load balancer with documented break-glass authorization.
4. If bad deployment, drain/revert binaries or publish new signed config generation from last approved config (never unsigned edits).
5. If origin issue, alert affected customer with request IDs/aggregate metrics, do not expose other tenants.
6. Record timeline/commands/change approver and customer communications.
7. Postmortem with corrective action, regression test and runbook update.

## Disaster recovery

- Postgres PITR and backups (encrypted) to different failure domain; restore into isolated cluster and validate schema/config revisions/tenant data.
- Immutable snapshot archive, signed envelope verification, trusted key recovery escrow.
- Secrets/cert store recovery separately from DB; a SQL backup alone cannot restore cert keys.
- Document certificate reissuance procedures and ACME issuer limits; always test staging.
- Restore order: secrets/trust roots -> Postgres -> config publisher/outbox -> edge LKG rejoin -> Redis/NATS/telemetry -> dashboard/billing.
- Do not accidentally replay old billable events without idempotency.

## Scaling

- Scale edge based on concurrent connections, CPU, RSS, TLS handshakes, request rate and load distribution; ensure shared/global rate semantics.
- Scale Go control plane by request/worker latency, DB pool and outbox lag; workers use leases/idempotency.
- Protect Postgres and Redis with bounded connection pools, timeouts, shard planning only after evidence.
- Cost monitor egress, TLS, security provider, CPU, observability/log storage and reserved capacity.

## Continuous security

Monthly dependency upgrades, certificate issuer health, secret rotation, quarterly incident tabletop/restore. Maintain supported runtime versions, EOL policy and risk register. Security disclosures and responsible vulnerability handling contact before GA.
