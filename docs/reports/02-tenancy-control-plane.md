# Agent Completion Report: Module 02

Historical initial agent checkpoint. The subsequent implementation and current
remaining work are recorded in `02-management-checkpoint.md`; this initial
primitives-only description is preserved as execution history.

- Module: 02 / M1-ADMIN-TENANCY.
- Status: **partial; gate CLOSED**. These are internal primitives and migrations. The existing HTTP executable deliberately remains the unready foundation API; no tenant endpoint or OIDC login is activated.
- Commits: none. Files: `apps/control-api/internal/domain`, `internal/persistence`, `internal/identity`, root `go.mod` / `go.sum`.
- Architecture: PostgreSQL is durable source of truth. Tenant scope is resolved from `(issuer, subject)` membership and the project relationship in SQL, never an untrusted tenant header. Compound resource references prohibit cross-project route bindings. OIDC ID tokens are verified by `go-oidc`, not a custom JWT parser. This does not reverse any accepted ADR.
- Contracts: no external API contract changed because no resource HTTP API is enabled. Existing OpenAPI remains accurate for the current foundation endpoints.

## Implemented

- Domain helpers: normalized IDNA hostnames, explicit role/action grants, HTTPS-only public-origin DNS/IP validation, strict route path/method and required JWT policy shape checks. Origin registration validation alone is not module04 dial-time SSRF protection.
- Embedded PostgreSQL migration with advisory-lock/checksum tracking, organizations/memberships/projects, scoped resources, immutable revisions, globally unique domain-claim storage, compound route references, idempotency records, append-only audit, hashed opaque sessions and expiry/revocation storage.
- Bounded pool, connection/statement/lock timeouts, fail-closed non-loopback database TLS configuration (including every pgx multi-host/TLS fallback), TLS1.2 minimum, authorized/scoped reads, keyset lists, creation/retry and optimistic revision writes. SQL diagnostic details are not exposed through repository errors.
- Management OIDC verification primitive with HTTPS discovery/JWKS, bounded HTTP client, redirects denied, RS256/ES256 allowlist, client audience/issuer/authorized-party validation, nonce, recent issuance, not-before and short session expiry cap. It is positively and negatively tested with owned loopback TLS/JWKS fixtures; it is not wired to an HTTP callback.

## Tests and evidence

Tests added: domain positive/negative IDNA, SSRF/mixed DNS/mapped IPv6 and role/policy validation; OIDC unsafe configuration denial and trusted TLS/JWKS positive login; forged signature/wrong issuer/audience/nonce/subject/authorized party, expired/future/old token and not-before denial; untrusted/expired/wrong-hostname TLS, redirect, oversized discovery, plaintext or unavailable JWKS denial. Actual local PostgreSQL isolated-schema tests cover migration/idempotency, two-tenant/three-user read/list/mutation/revision denial, viewer restrictions, concurrent idempotency, immutable records, store reopen persistence, hashed session lookup/revocation and expiry denial. Database configuration tests reject disable/require/verify-ca/prefer/allow on non-loopback hosts, including insecure fallback after a literal loopback host, without contacting those example hostnames.

Executed successfully (all exit0):

```sh
AEGIS_TENANCY_INTEGRATION=1 GOTOOLCHAIN=go1.27.4 go test -race -v ./apps/control-api/internal/domain ./apps/control-api/internal/identity ./apps/control-api/internal/persistence
AEGIS_TENANCY_INTEGRATION=1 GOTOOLCHAIN=go1.27.4 go test -race ./apps/control-api/... ./apps/config-publisher/... ./internal/... ./packages/test-fixtures/...
GOTOOLCHAIN=go1.27.4 go vet ./apps/control-api/... ./apps/config-publisher/... ./internal/... ./packages/test-fixtures/...
GOTOOLCHAIN=go1.27.4 go build ./apps/control-api/...
GOTOOLCHAIN=go1.27.4 .local/bin/govulncheck -C apps/control-api/cmd/control-api -scan=module
node --check scripts/contracts.mjs
node --check scripts/contract-integration.mjs
gofmt -l apps/control-api/internal/domain apps/control-api/internal/identity apps/control-api/internal/persistence
```

The focused test run passed all eight top-level tests plus eighteen OIDC negative subtests. PostgreSQL integration actually ran against the owned local fixture; it was not skipped. Regression packages passed (some unchanged packages used Go test cache). `gofmt -l` produced no paths. Go module vulnerability scan reported `No vulnerabilities found.` This does not substitute for repository/image/SBOM release checks. Initial Go runs failed while newly added pgx/oidc transitive sums were downloading; explicit dependency fetching resolved those errors. Two initial scanner commands failed from the repository root (no Go files / patterns not accepted for module-only scan); the exact corrected command above passed.

## Remaining mandatory work

- Authenticated HTTP API/application layer, one-time state/PKCE/nonce login callback, secure cookie/CSRF or reviewed token architecture, server-generated session issuance, authenticated logout and full OIDC callback integration (including state/PKCE/replay/rotation/unavailable IdP).
- Application-level validated draft use cases; the persistence CreateDraft/Revise methods currently accept prevalidated JSON and must not be exposed directly to HTTP.
- Domain claim challenge generation/hash, transactional claim allocation, authoritative/public DNS verification and expiry/reverification transitions. The schema alone does not implement these workflows.
- Origin/policy/route CRUD use cases, binding validation, immutable revisions/ETags/preview and unverified-domain approval denial.
- Full list/item/mutation/background-job isolation matrix, denied-sensitive-action audit, membership disable/revocation management, per-admin bounded rate limit, OpenAPI/TS client generation and contract integration.
- Migration app-role privilege/ownership review, bounded resource/organization quotas and audit retention; complete repository/image/SBOM security and release checks once the whole module is implemented.

## Security review

No tenant-serving API is enabled. There is no default admin or TLS verification bypass. Secrets remain in ignored local fixtures, PostgreSQL session rows contain SHA256 token hashes, and tests use the owned loopback database in a fresh disposable schema. Internal OIDC configuration must remain operator-owned; it is not a tenant-configurable URL fetcher. Production runtime trust, callback/replay/CSRF protection and bounded JWKS refresh/backoff remain required. The unexported custom-root constructor is used by trusted TLS fixtures; the public constructor always uses verified system trust. Generic repository writes still rely on validated application callers and must remain inaccessible through transport.

The module cannot pass from these primitives: tenant isolation through actual HTTP/session/application paths is not proven, domain proof is not implemented, and generic repository writes assume validated callers. Modules03 and later remain blocked by this module until all acceptance criteria and security review pass. No production/public/DNS/payment action occurred.
