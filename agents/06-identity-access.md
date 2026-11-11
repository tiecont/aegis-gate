# AGENT 06 — Authentication and Authorization

**Dependency:** 02, 03, 04. **Gate:** `M2-AUTH`.

## Tasks

1. Define separate admin management RBAC vs tenant traffic auth, with explicit names/permissions and deny precedence.
2. Implement secure API key issuance (single reveal), hashing/HMAC+pepper and constant-time verification, expiration/revocation/rotation, scopes and route selection.
3. Implement JWT verification via vetted Rust crypto/JWT library: issuer/audience, expiry/nbf, max age, leeway policy, accepted algorithms, key-to-alg match.
4. Build JWKS provider registry with SSRF-protected HTTPS source, bounded fetch, cache TTL/refresh, stale-key handling policy, unknown kid bounded refresh + backoff.
5. Policy DSL v1: `auth_required`, `api_key`, `jwt`, `method`, `path`, `required_scopes`, `allow/deny`; deterministic compile-time validation; never arbitrary JS/Lua execution.
6. Policy simulate/preview in control plane with test vectors to explain allow/deny and no raw secret leakage.
7. Precompute static rules in data plane; keep fast-path verification local using configured keys/cache; remote introspection not part of MVP.
8. Add origin identity forwarding contract: sanitize incoming auth impersonation headers; forward trusted claims through scoped signed headers if required, with expiry and origin verification, never generic `X-User-ID` trust.
9. Negative tests: wrong aud/iss, alg none/confusion, malformed token, bad kid, JWKS timeout, clock skew, expired API key, policy missing, tenant route mismatch.
10. Add audit for sensitive key actions; prevent brute-force against admin API with MFA at IdP and session protection.

## Acceptance

- Missing token on protected route rejected; valid tenant-bound token accepted only on matching resource.
- JWKS source outage cannot downgrade to anonymous; logged error reason does not contain token.
- Viewer role cannot edit policies; security-admin cannot change billing unless separately authorized.
- Edge policy evaluation produces same expected result across all nodes/config versions.

## Security focus

AuthN != business authorization: origin must still enforce object-level permission (e.g. user A cannot read user B order). Do not use untrusted JWT fields for tenant routing without binding to verified route tenant.

## Deliverables

Auth libraries, policy DSL and schema, preview API, test vectors, auth threat coverage, docs.
