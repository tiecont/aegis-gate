# Parallel module execution contract

Opened 2026-11-11 after M0-FOUNDATION passed. Neither module is complete yet.

| Owner | Scope | Gate evidence required |
|---|---|---|
| Pingora feasibility agent | Isolated `spikes/pingora`, ADR011 and module01 report | Actual SNI/hot rotation/HTTP1+2/WS/gRPC/cancel/trailers, verified origin TLS, parser/resource tests, config generation capture, health/pooling/failover, reference benchmark and dependency review |
| Tenancy agent | Go control API, persistence/migrations/auth, additive management contracts and generated bindings, module02 report | Durable PostgreSQL, all-resource two-tenant isolation, OIDC/session/revocation/roles, DNS ownership, HTTPS origin/SSRF, immutable revisions/idempotency/concurrency, audit/redaction and synchronized OpenAPI |
| Security support | Independent review and test-vector evidence | Concrete negative coverage and source-backed findings, no implementation outside opened modules |
| Root | Integration review, gate verdicts, evidence and status | Review exact commands/results, repair cross-module inconsistencies and keep dependent gates closed |

No agent may use an in-memory tenant store as durable implementation, disable
certificate verification, select a tenant from untrusted headers or token claims
alone, or replace Pingora silently. A No-Go requires evidence, alternatives and a
human architecture decision. Loopback fixture origins remain isolated lab tests,
not a private-origin exception in the SaaS origin policy.

The spike has a separate Cargo lock/workspace, so it cannot enable a production
edge before its gate passes. The tenancy agent owns shared Go/OpenAPI changes;
root reviews generation and compatibility integration afterward. Modules03–12
remain locked. Full release requirements and human signoff are unchanged.
