# AGENT 08 — Observability, Analytics and Durable Usage Metering

**Dependency:** 02, 03, 04, 06, 07. **Gate:** `M3-TELEMETRY`.

## Tasks

1. Instrument Rust proxy with OpenTelemetry traces, metrics and structured logs; align HTTP semantic conventions and expose low-cardinality route/tenant safe labels.
2. Establish request ID and trace ID from trusted sources; reject attacker-controlled high-cardinality IDs in metric label names. Propagate context to origin safely.
3. Emit metrics: requests by outcome/status class, TLS handshakes, active connections, proxy-added latency, origin latency, retry/timeout, auth deny, rate block, config ACK/staleness, edge capacity.
4. Implement redact-first structured logs: default no request/response body, authorization/cookie headers, query PII, private keys or raw tokens; retention tiers and access RBAC.
5. Build OpenTelemetry Collector/export to Prometheus, Grafana, Loki/Tempo only as demanded. Disable expensive full-fidelity log collection by default, use sampling quotas.
6. Build durable usage pipeline independent of sampled telemetry: deterministic request/event id, bounded resilient buffer/worker, persistent broker/ledger; billing event count and definition.
7. Create usage aggregates by tenant/project/route/plan period, idempotency and reconciliation job. Instrument lag/drop/dead-letter; no double charge on replay.
8. Expose dashboard reporting API with tenant filtering, pagination/retention, privacy-compliant deletion/export, synthetic alert rules.
9. Add chaos tests for telemetry sink down: bounded queue + declared drop behavior; billing ledger backpressure handled without silently losing billable usage.
10. Build panels: edge saturation, p95/p99, upstream status, limit rejects, certificate expiry, config freshness, publisher lag and billing discrepancy.

## Acceptance

- Sensitive values absent from logs/traces/metrics using automated sentinel test payloads.
- New random URL paths do not cause metric cardinality explosion.
- Simulated dashboard user from Tenant B cannot query A's usage/logs.
- Usage events replayed twice do not double bill; reconciliation produces actionable discrepancy record.
- Metrics/log sink outage does not crash proxy or cause unbounded memory; alerts trigger appropriately.

## Security focus

Treat request logs as customer data. Protect analytics queries from BOLA and leakage through error messages. Production raw log retention must be explicitly approved.

## Deliverables

Instrumentation, collector config, dashboards, ledger + reconciliation service, telemetry schema/tests.
