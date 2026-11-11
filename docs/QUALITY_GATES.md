# Quality Gates, SLOs and Validation Matrix

## 1. Release levels

- **Local proof:** minimal feature with unit tests and local E2E; no public customers.
- **Private alpha:** authorized test users in staging/protected environment; known limits documented, no SLA.
- **Production candidate:** test evidence, runbooks, HA, backups, monitored certs, security hardening and responsible owners.
- **GA:** human-reviewed release decision, support/on-call, terms/privacy, emergency runbooks, agreed SLOs, security assessment and known residual risk acceptance.

## 2. Provisional SLO targets (not achieved values)

Set real SLOs only after measuring under declared environment and workload. Initial targets to evaluate:

| Signal | Proposed launch target | Measurement |
|---|---|---|
| Gateway customer request availability | >=99.9% monthly for eligible tenants | Good requests / eligible requests, filtered user errors documented |
| Proxy-added latency | p99 <= 10ms at declared reference load | Edge ingress -> origin dispatch/response overhead, excluding origin processing/network path; histogram |
| Config propagation | p95 <= 10s in healthy regional deployment | Admin publish committed -> edge majority ACK |
| Unsafe/malformed config acceptance | 0 | Mutation/fuzz corpus + deployment negative tests |
| Cert expiration due to automation failure | 0 | Expiry monitors; renewal drill, 30/14/7-day escalation |
| Tenant isolation failures | 0 | Cross-tenant matrix, red-team review |
| Billable usage mismatch | <=0.1% before invoice finalization; reconciled correction required | Durable usage ledger vs authoritative edge counters, not sampled telemetry |
| Recovery | RPO <= 15 min; RTO <= 2 h (provisional) | Restore drills and backups, test at least quarterly |

`p99 <= 10ms` is an aspirational reference target, not a promise: define TLS handshake inclusion, cache state, connection reuse and throughput before benchmarking. Be explicit with customer-facing SLAs about excluded network/provider failures.

## 3. CI pipeline per PR

1. `gofmt`, `go vet`, lint/test Go; race detector where applicable.
2. `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`; security-sensitive crates reviewed.
3. `eslint`, TypeScript check, unit/e2e dashboard tests.
4. OpenAPI + schema compatibility and generated type diff check.
5. Docker/Compose integration tests with Postgres, Redis, NATS, demo origins.
6. Security negative suite (host confusion, JWT, SSRF, policy tamper, cross-tenant).
7. SCA/dependency scan, secret scan, SBOM and build image security scan.
8. Reproducible container images pinned by digest; branch protection + reviewer approvals.
9. PR artifact: test summary and security impact notes.

## 4. E2E matrix

| Scenario | Pass evidence |
|---|---|
| Valid host & path | correct tenant and origin |
| Unknown SNI/Host or cross-tenant Host | deterministic rejection, no tenant leak |
| HTTP/1.1 and HTTP/2 | functional request/response correctness |
| WebSocket/gRPC | handshake/stream and graceful close validated |
| Client disconnect during body streaming | bounded memory, cancelled upstream call |
| Slowloris/oversized headers/body | bounded timeout/413/4xx, no process crash |
| Origin TLS invalid | 502 or policy-defined safe failure; no insecure fallback |
| Origin slow/unhealthy | passive/active health, bounded timeout, circuit status |
| Signed config corruption | rejected, old generation serves |
| New edge bootstrap with no config | not ready, does not accept unknown host |
| Edge mid-stream config swap | request uses consistent generation |
| JWT invalid/missing/aud/iss mismatch | 401/403 per API contract |
| Tenant B accesses A's management config | denied; audit generated |
| Redis outage | documented fallback; no unlimited acceptance |
| Postgres/NATS outage | existing traffic survives LKG; admin publish fails visibly |
| ACME issuance/renewal/key rotation | automated and expired cert alerts function |
| Emergency block | takes effect in bounded window, with audit |
| Crash/restart, node termination | existing capacity absorbs; graceful termination |
| Billing event duplicate/replay | dedupe, no double count |

## 5. Performance validation

Declare environment and baselines: instance CPUs/memory, NIC bandwidth, TLS settings, number of domains/routes, payload distribution, HTTP versions, keepalive, origin behavior, load-generator placement. Run closed-loop and open-loop tests (where tooling supports), measure throughput vs p50/p95/p99 latency, CPU, RSS, allocations, error/429, redis latency, event drop rates, system time. Use warm-up, 30min steady state, at least 2h soak for launch candidate, and forced outages. Never run load tests against third-party customer origins or production without permission.

Prioritize correctness and bounded overload over maximum RPS. Thresholds are candidates, not promised generic hardware numbers.

## 6. Deployment/HA validation

- Rolling replace one edge with in-flight HTTP/2, WS and gRPC sessions.
- Single-node / single-AZ failure in a multi-zone topology; capacity budget documented.
- Restore PostgreSQL in isolated environment; verify config/outbox integrity.
- Redis, NATS, OTel, certificate store and admin API partial outage drills.
- Expired/rotated config signing key and expired origin cert drills.
- Rollback from bad auth policy without exposing traffic.
- Document scale-up/down and edge drain procedures; keep minimum replicas per failure domain.

## 7. Human release signoff

- [ ] Threat model current and known critical/high findings closed or formally risk-accepted.
- [ ] Every active hostname has verified domain ownership and valid cert.
- [ ] Logs and analytics meet data minimization/retention policies.
- [ ] Pager, dashboards and on-call drills are functional.
- [ ] Infrastructure quota and cloud bill alerts exist.
- [ ] Incident runbooks and customer notification process reviewed.
- [ ] Recovery drill and security review evidence attached to release.
- [ ] Contracts, payments, privacy/compliance and support terms reviewed.
- [ ] GA capacity/SLO numbers match measured environment.
