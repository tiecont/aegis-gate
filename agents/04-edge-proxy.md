# AGENT 04 — Rust HTTP Proxy, Routing and Reliability

**Dependency:** 01 Go/No-Go = YES, 03. **Gate:** `M1-EDGE-ROUTING`.

## Tasks

1. Implement Rust edge atop selected reviewed proxy framework; connect to config-agent immutable snapshots.
2. Build strict SNI/Host/authority normalization, verified hostname mapping, method/path route priority and collision detection. Reject unknown host (not default upstream).
3. Implement safe HTTP forwarding rules: strip hop-by-hop and untrusted forwarding headers; set trusted `Forwarded`/`X-Forwarded-*` with explicit upstream proxy trust CIDRs and known ingress mode.
4. Implement upstream HTTPS transport, DNS resolution restrictions, no arbitrary proxy-to-private IP, cert chain/hostname validation, bounded redirect behavior (normally pass 3xx through untouched).
5. Add weighted round robin (or documented health-aware strategy), active/passive health checks, connection pooling, request and idle timeouts, circuit breaker, failover.
6. Stream requests/responses; bounded buffer, max headers/body size, max in-flight streams/connections, cancellation propagation.
7. Retry only replayable/idempotent methods with replay-safe bodies and limits; POST/financial mutation retry disabled by default unless explicit scoped contract.
8. Support HTTP/1.1, HTTP/2, gRPC proxy/trailers and WebSocket upgrade tested; graceful shutdown/drain.
9. Expose readiness separate from liveness; edge readiness requires loaded valid config, TLS readiness, listener health.
10. Record per-request reason codes (allowed/rejected/upstream-timeout/auth-denied) with sanitized metrics.

## Acceptance

- Host/path/method correct under multi-tenant fixture; SNI != Host rejected safely.
- Invalid/expired/untrusted origin cert causes controlled error, never insecure bypass.
- WebSocket/gRPC long-lived sessions function; client cancellation releases resources.
- Slowloris, oversize body, connection exhaustion tests bounded; memory stable under soak.
- Degraded/unhealthy origin handled with controlled 502/503/504; no retry storm; preserved `Retry-After` semantics where needed.
- In-flight request before config swap uses consistent snapshot.

## Security focus

Avoid request smuggling and host confusion by relying on maintained parsers and negative corpus. No arbitrary user controlled request URL as upstream. Strict egress destination policy. Allow proxy headers only from explicit trusted IP range, not all public clients.

## Deliverables

Rust runtime modules, integration fixtures, proxy matrix, performance baseline, README and report.
