# AGENT 01 — Rust/Pingora Feasibility Spike

**Dependency:** 00. **Blocks:** modules 04/05 (and optionally 06/07). **Gate:** `M0-PROXY-GO-NOGO`.

## Tasks

1. Confirm Pingora current stable release, exact crate versions, TLS feature backend support and maintenance advisories. Record licenses and dependency requirements.
2. Implement isolated Rust proof-of-concept with minimal upstream HTTPS origin and two lab hostnames / different certificates.
3. Test SNI-based dynamic certificate selection and hot certificate rotation without dropping established active connections; if API doesn't permit, document wrapper integration needed.
4. Test HTTP/1.1 and HTTP/2 proxy functionality, request/response body streaming, WebSocket upgrade, gRPC streaming (including cancellation/trailers), and timeouts.
5. Test dynamic config update with lock-free/low-contention immutable router snapshot swap, observing in-flight request generation.
6. Test upstream TLS validation and pinned hostname, connection pooling and health check/weighted failover.
7. Verify filter/hook points needed for JWT, custom headers, rate limits, pre-TLS filters and client IP trust.
8. Run a small *controlled* benchmark vs a known reference proxy; record CPU/RSS, p95/p99 latency, timeouts, payload mix, environment, limitations.
9. Produce a decision document: Pingora yes/no, gaps, required custom code, maintainability, migration alternative (Envoy, Hyper/Tokio) with measured reasons.

## Acceptance

- E2E client certificate / SNI proof, HTTP/2 and WS/gRPC demonstration.
- TLS certificate changes reflected in new handshakes; no secret printed.
- Invalid upstream certificate reliably rejected.
- Untrusted malformed HTTP not passed through incorrectly; basic CL/TE tests with maintained parser.
- Explicit Go/No-Go signoff, not assumed based on marketing features.

## Stop conditions

No feasible safe per-tenant dynamic TLS, no reliable streaming/cancellation hooks, or unacceptable dependency risk: stop before service implementation and elevate ADR with alternatives. Do not silently rewrite custom TLS parser or disable certificate verification.

## Deliverables

Small executable spike, test scripts, benchmark config, `docs/ADR-011-pingora-evaluation.md`, Go/No-Go report.
