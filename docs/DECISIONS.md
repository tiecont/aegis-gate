# Architectural Decision Records (initial proposals)

## ADR-001: Go control plane / Rust data plane

**Status:** proposed. Go optimizes admin/business throughput and standard ops libraries. Rust chosen as candidate for hot-path performance and memory control. Cost: two toolchains, ABI/API contract and more operational complexity. Avoid Rust for management CRUD absent evidence.

## ADR-002: Pingora for data plane, subject to feasibility

**Status:** pending `agents/01`. Pingora supports HTTP 1.x/2 reverse proxy and configurable TLS, gRPC and WS according to documentation. Investigate dynamic per-tenant TLS selection, safely rotating certificate material without restart, custom rate-limit hooks, connection lifecycle and integration testing. If hard blocker: compare Envoy (Rust filters impossible as general drop-in; requires WASM/extensions) and Hyper/Tokio custom proxy; document total maintenance cost before deciding. Do not write custom HTTP parsers.

## ADR-003: Immutable signed snapshots with authenticated pull

**Status:** accepted for design. Prevents online dependencies in request hot path; protects config integrity; enables atomic apply and LKG. Trade-off: eventual consistency and staleness/revocation window.

## ADR-004: Postgres as source of truth; outbox + NATS as delivery notification

**Status:** proposed. Avoid double-write losing config events; simpler than Kafka at MVP size. Durable immutable blob is authoritative snapshot. No NATS dependency on hot path.

## ADR-005: Redis for global quota + local conservative fallback

**Status:** proposed. Local tokens always available; Redis atomic budget needed for exact-ish global caps. Redis/network outages trigger preconfigured conservative per-node fallback and on-call alert. Business promises must distinguish approximate from hard caps. Evaluate precision and availability tradeoffs before paid quotas.

## ADR-006: Upstream TLS always authenticated

**Status:** accepted. HTTPS origins verify valid cert chains + expected hostname. No `insecure_skip_verify` production path. Mutual TLS available with secret-ref origin identity later.

## ADR-007: No private-network origins in public SaaS v1

**Status:** accepted. Prevent SSRF, metadata access, lateral movement. Enterprise private origins require separate private networking architecture and security review.

## ADR-008: Single-region launch with redundant edges

**Status:** proposed. Reduces cost and complexity, preserves one control-plane consistency domain. 99.9% provisional availability target only if redundant infrastructure validated; no claim of global geo resilience.

## ADR-009: Billing ledger distinct from observability

**Status:** accepted. Sampled log/metrics may lose events. Event IDs + durable aggregate + reconciliation needed for billed units; explicit contract of excluded traffic.

## ADR-010: Provider-level anti-DDoS

**Status:** accepted. A pod-level WAF cannot scrub upstream volumetric attacks. Use cloud/network protection provider, L4 load balancer and edge application-layer limits.
