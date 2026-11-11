# AGENT 02 — Go Control Plane and Tenant Management

**Dependency:** 00. **Gate:** `M1-ADMIN-TENANCY`.

## Tasks

1. Implement Go HTTP API in layered/hexagonal packages: transport, application/use-case, domain, persistence, auth middleware.
2. Use Postgres migrations + indexes with organization/project/tenant binding. Implement membership roles: owner, admin, security-admin, developer, billing-admin, viewer.
3. Integrate a standard OIDC admin login via configured IdP; admin sessions isolated from customer API access. Secure cookies/CSRF or vetted SPA token strategy.
4. Domain claims: normalized IDNA host, global active uniqueness, non-guessable expiring DNS TXT token, async DNS verification from authoritative/public resolvers; status machine pending→verified→active or failed/expired.
5. OriginPool and Endpoint APIs with HTTPS-only default, normalized host, port and method/path validation, and public destination SSRF restrictions.
6. Routes + policy resources with immutable revision IDs, optimistic concurrency (ETag/revision) and version diff/preview; do not publish until route validates.
7. Explicit membership + tenant query scoping at every endpoint; admin role authorization for policy/secret/admin actions.
8. Audit every mutation, role and security change, including denied sensitive attempts; redact secrets and PII.
9. Add pagination, idempotency keys, structured errors, per-admin rate limit, OpenAPI and TS client generation.
10. Build test data seed for 2 tenants and 3 users with mixed roles; integration tests verify denial of cross-tenant and BOLA attempts.

## Acceptance

- API can create two tenant organizations with independent verified domains, origins and route draft revisions.
- Every single-item and list endpoint tested for tenant filter; impersonating Tenant A via query/path/header fails.
- Pending/unverified domain cannot publish a serving route.
- Idempotency + transaction tests ensure no duplicate hosts or route versions under concurrent requests.
- Admin auth/revocation/expired session and role matrix covered; OpenAPI matches implementation.

## Security focus

No insecure default admin account; no wildcard CORS; never treat a user-submitted tenant header as authority. SQL queries must parameterize inputs. DNS verification challenges must expire and be single-claim scoped.

## Deliverables

DB schema, API, OpenAPI, migration tests, role matrix, onboarding docs and report.
