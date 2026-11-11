# Modules 01/02 security test review support

Scope: planning and read-only review of the Pingora feasibility spike and Go
tenancy module. This report does not approve either gate and contains no
production or public endpoint testing.

## Module 01: Pingora proof requirements

The current `spikes/pingora` executable is an intentional exit-78 shell, so no
runtime capability is proven yet. The gate must attach each result to a local
fixture and preserve exact command output:

- Dynamic SNI must select two distinct certificates for two names, reject an
  unknown name, and rotate the certificate for new handshakes while an existing
  connection continues with the old session. A test that only swaps an `Arc`
  and checks a unit value does not prove handshake behavior.
- HTTP/1.1 and HTTP/2 need request/response body streaming, client cancellation,
  upstream cancellation, timeout bounds, and trailer preservation. WebSocket
  upgrade and bidirectional gRPC streaming need real local loopback peers. A
  successful unary request is insufficient for the streaming acceptance gate.
- Origin TLS negatives must use the generated wrong-host, expired and untrusted
  certificates with hostname verification enabled. Search the final source and
  build flags for `insecure`, `skip_verify`, or equivalent bypasses. Redirects
  must not turn into a second unvalidated dial.
- The malformed framing corpus must include duplicate `Content-Length`,
  `Transfer-Encoding` plus `Content-Length`, conflicting lengths, obsolete
  folded headers, duplicate `Host`, HTTP/2 `:authority` versus `Host`, invalid
  request-targets, and premature WebSocket upgrade. The assertion is rejection
  or safe termination, never forwarding an ambiguous request.
- Config generation tests must capture a generation at request start and prove
  an atomic immutable swap cannot mix route and policy generations. The
  captured generation should be observable in a local test result, not only in
  a benchmark log.
- Any benchmark must declare loopback topology, payload mix, keepalive,
  concurrency, CPU/RSS measurement and reference implementation. It cannot
  be used to claim an SLO or production readiness.

Pingora 0.9.1 is the current pinned candidate in the spike. The repository's
pre-collected advisory evidence includes past request-smuggling, HTTP/2
authority/Host, header forwarding and resource-limit advisories. The enabled
feature tree and `cargo audit` output for the exact lockfile must be recorded;
an upstream release note or an ignored optional advisory is not a project
exception.

## Module 02: tenancy and control-plane negative matrix

The test database must contain two organizations/projects and at least three
users with mixed roles. For every collection and item endpoint, exercise:

- Tenant B reading, updating, deleting, publishing or previewing Tenant A
  resources by replacing path IDs, query IDs, body `tenant_id`, `X-Tenant-ID`,
  `X-Forwarded-Host`, host casing, percent-encoding and UUID forms. Expected
  results are 403/404 according to the API contract, with no resource existence
  leak beyond the documented envelope.
- Viewer, developer, billing-admin and security-admin role boundaries for
  policy publish, secret/API-key operations, billing resources, member/role
  changes and audit export. A JWT claim or caller header cannot choose tenant
  authority. Admin authentication must be separate from customer traffic auth.
- Revoked, expired, missing, wrong-issuer, wrong-audience and CSRF/session
  credentials. OIDC discovery/JWKS must be HTTPS, bounded, allowlisted or
  otherwise SSRF-protected; failed identity-provider access must fail closed.
- Domain claims with Unicode/punycode and trailing-dot/case variants, duplicate
  active hostname reservations across tenants, expired/replayed/wrong-token DNS
  proofs, and a pending/unverified domain attempting to publish. DNS challenge
  tokens must be random, single-claim scoped, expiring and absent from logs.
- Origin URLs with userinfo, credentials, fragments, non-HTTPS schemes, CRLF,
  explicit private/link-local/loopback/metadata IPv4 and IPv6 forms, IPv4-mapped
  IPv6, disallowed ports, redirects and DNS rebinding between validation and
  dial. Resolution and concrete destination validation must be repeated at
  dial time; no public DNS lookup result may be trusted indefinitely.
- Concurrent host claims, idempotency-key reuse with a changed request body,
  stale ETag/revision publishes, route collisions and rollback/retry behavior.
  PostgreSQL constraints and transactions must be tested after process restart,
  rather than relying on an in-memory uniqueness map.
- Audit entries for denied sensitive actions must contain actor/resource/action
  and a redacted diff without bearer tokens, API-key plaintext, DNS secrets,
  request bodies or private keys. Pagination must be tenant-scoped and bounded.

## Release blockers

Neither module can pass from compilation or happy-path tests. Module 04 remains
blocked until Module 01 has an explicit Go/No-Go with measured evidence; Module
03 cannot consume tenancy references until Module 02 has durable, tenant-scoped
contracts. A failed Pingora capability or dependency proof requires an ADR with
Envoy and Hyper/Tokio alternatives and human architecture review. A failed
tenant negative test stops downstream config, edge, auth, billing and dashboard
work.

No tests in this support review contacted public endpoints or generated load.
