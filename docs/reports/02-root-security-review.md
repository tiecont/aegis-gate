# Module 02 root security review

Checkpoint reviewed. M1-ADMIN-TENANCY remains CLOSED because the full module
acceptance backlog is not complete. No production signoff.

## Integration harness

The PostgreSQL isolation test requires `AEGIS_TENANCY_INTEGRATION=1`; the prior
shared integration command did not set it and therefore skipped this new test.
`make integration` now sets it explicitly after bringing up the owned loopback
fixtures. A skipped integration test cannot satisfy the tenancy gate.

## Review checkpoints

- Every pgx multi-host/fallback connection must require verified TLS unless its
  destination is a literal loopback test address. Check the expanded configs,
  including Unix socket fallback and `sslmode=allow/prefer/require/verify-ca`.
- OIDC metadata and JWKS retrieval must remain within the configured trusted
  HTTPS origin (or an explicit reviewed origin allowlist), reject redirects,
  bound chunked/unknown-length responses and fail closed on TLS errors.
- Token validation must reject future `nbf`, bad `azp` even with a single
  audience, and wrong nonce, issuer, audience, key, algorithm and expiry.
- Domain proof, HTTP session/CSRF, all-resource isolation, denied-action audit
  and synchronized contracts remain required; persistence tests alone do not
  establish the HTTP authorization boundary.

## Resolved checkpoint findings

- F02-01: integration Make target skipped PostgreSQL tests without the explicit
  opt-in. Fixed target and actual final integration executed with no skip.
- F02-02: OIDC metadata could expand JWKS trust to another HTTPS origin. A real
  two-origin trusted-TLS test reproduced acceptance, then passed after pinning
  all outbound OIDC endpoints to the configured origin. No wildcard allowlist.
- F02-03: over-limit chunked discovery could be truncated into valid accepted
  JSON. The regression reproduced acceptance. Bounded complete buffering now
  rejects a body exceeding1MiB; finite network deadlines remain enabled.
- F02-04: review required every pgx expanded fallback to verify TLS. The agent
  fixed all candidates and tested plaintext/nonverifying modes and multi-host
  fallbacks, plus a verified multi-host configuration. No non-loopback database
  was contacted by these config tests.
- F02-05: final filesystem scan found HIGH CVE-2026-116587 in go-jose4.1.4.
  Upgraded to4.1.6. Full patched check and security scan both returned exit0.
  The initial failing scan remains preserved. Govulncheck alone had missed
  this advisory; multiple independent scanners remain required.
- F02-06: idempotent create retry returned the latest mutable resource after
  revision. Reads now join immutable generation1; route HTTP/persistence
  revision and retry tests preserve the original create response.

The scan's RFC6455 public nonce finding in the isolated Pingora lab was a
published protocol example, not an exposed credential. Its runtime encoding
now preserves the same bytes without an ignore rule. The whole lab was rerun
and retained its real parser failure; scanner success does not open its gate.

## Evidence and open risks

`02-root-patched-make-check.log` and `02-root-patched-security-scan.log` both
record exit0. Actual HTTPS HTTP responses are checked against source OpenAPI;
two-tenant/three-user list/item/mutation/revision/audit/job isolation, PKCE,
browser-bound state/replay, session expiry/revocation, CSRF and role denials
execute on owned fixtures. Immutable approved references, unverified-domain
denial, concurrent host/idempotency/approval and membership revocation during
DNS are covered. These are local scoped results, not a full threat-model pass.

`02-management-checkpoint.md` is the current remaining-work record. In
particular, least-privilege DB roles, OriginPool/Endpoint lifecycle, all-state
quotas/retention, organization-denial audit, IdP rotation/backoff/callback matrix,
domain active/reverification and real DNS transport, explicit revision diff and
independent final review remain open. Do not open module03 from these passing
checkpoint checks. Production auth, config propagation and edge dial-time SSRF
remain separate mandatory gates.
