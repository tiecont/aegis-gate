# AGENT 07 — Abuse Prevention, Rate Limits and DDoS Integration

**Dependency:** 03, 04, 06 (identity-based budgets). **Gate:** `M2-ABUSE`.

## Tasks

1. Implement always-on resource guardrails: max TCP connections, TLS handshakes/second, header count/bytes, body bytes, read timeout, idle/stream timeout, concurrent origin requests and memory queue caps.
2. Implement local per-worker/per-node token bucket with bounded memory/time-window cleanup; keys include verified tenant/route/identity/IP bucket and never raw token.
3. Add Redis atomic distributed quota (Lua/GCRA/token-bucket script or supported atomic primitive), accurate clock strategy, key TTL, bounded timeouts and max connection pools.
4. Define fairness: per-tenant budget, per-identity budget, subnet/IP budget, origin concurrency budget. Consider NAT/shared-IP false positives and IPv6 subnet aggregation.
5. Design explicit fail modes: on Redis outage use conservative local limits and surface degraded status, never silently unlimited. Document inaccuracies in distributed quotas and paid plan wording.
6. Implement CIDR allow/deny, emergency tenant/route kill switch with approved provenance; allowlists must not bypass parser/body/concurrency guardrails.
7. Build rules for abnormal spikes based on transparent heuristics (rate, 401/403 ratio, connection churn), dry-run first, with operator confirmation for broad blocks. No ML claims for MVP.
8. Add 429 headers/`Retry-After` where meaningful, structured reason codes; bound response sizes; avoid leaking policy details to attackers.
9. Integrate upstream network anti-DDoS provider strategy (config, trust and incident playbook). If provider APIs are available, design adapters behind permissioned operator actions; no auto-changing global firewall policy blindly.
10. Build authorized load-test suite: burst, slow requests, mixed tenant traffic, Redis failover, bad-client/legitimate-client mix, origin overload.

## Acceptance

- Legitimate Tenant B not affected by Tenant A rate storm beyond defined shared-capacity/quotas; fairness test.
- Same source/key across two edges triggers documented global quota tolerance; stats and caveats recorded.
- Redis down -> conservative local fallback + alert, no unlimited pass.
- Slowloris/body floods bounded by connection/read/size caps; queue memory remains bounded.
- Repeated auth failures block according to policy; NAT/shared-IP low false positive test documented.
- L7 mitigation accurately described as distinct from upstream volumetric L3/L4 protection.

## Security focus

No exposure of user API keys in Redis key names. IPv4/IPv6 spoofed forwarded-header headers not used as identity. High-cardinality keys bounded with eviction/TTL. Tests must run only against authorized local/staging targets.

## Deliverables

Limit engine, Redis scripts, policy schema, load-test reports, incident integration guide and report.
