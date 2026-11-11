# Module 02 management checkpoint

## Agent Completion Report

- Module: 02 / M1-ADMIN-TENANCY.
- Status: **partial; gate CLOSED**. This report supersedes the initial primitives-only checkpoint in `02-tenancy-control-plane.md`.
- Commits: none. Files: control-api domain/application/identity/persistence/transport, additive migrations001–005, command configuration, shared OpenAPI/generated Go/TS/schema, root Go dependencies and integration Make target.
- Architecture: durable PostgreSQL with membership authorization by issuer/subject, scoped SQL/compound references, maintained go-oidc/oauth2, verified TLS and loopback-only explicit management mode. No accepted ADR was reversed.
- Contracts: additive `/v1` management operations in `packages/contracts/openapi.json`; generated Go/TS/JSON Schema remain synchronized and foundation baseline is preserved.
- Human review needed: no production signoff claimed; module01 architecture decision is separate. Full module02 review still required after remaining work below.
- Next unblocked work: module02 backlog only. Modules03–12 remain locked.

## Implemented behavior

- Local management HTTPS opt-in, operator-configured IdP and DNS resolver, owner-only bounded JSON configuration/private-key files, TLS1.2 minimum, verified system or explicit CA roots. Default executable stays foundation/unready.
- OIDC authorization code + S256 PKCE, independent random state/browser/nonce/verifier, five-minute durable login attempts consumed once, ten-minute fixture login and at most fifteen-minute web sessions, hashed session/CSRF values, Secure/HttpOnly session cookie, SameSite=Lax, explicit Origin and session-bound CSRF on mutations. No default account or bearer-token shortcut.
- OIDC discovery/JWKS and authorization/token endpoints pinned to configured HTTPS origin, no redirects/proxies, finite headers/body/connections/timeouts. Chunked body over-limit and cross-origin JWKS acceptance were reproduced then repaired; tests remain enabled. Some IdPs use different trusted endpoint hosts: these require an explicit reviewed allowlist design, not implicit trust expansion.
- Organizations, projects, six explicit roles, membership changes/revocation, bounded tenant lists, origins, policies and route drafts/revisions, immutable revision preview/ETags, server-generated IDs and actor-scoped idempotency. Generic draft entry rejects domain/route to require their specific workflows. Creation retries return original immutable generation1, not a later edited resource.
- Normalized global domain reservations, 256-bit single-claim DNS proof returned only once and stored hashed, expiry/reclaim with historical tenant binding preserved, durable verification jobs with dedupe/lease/three tries/backoff. Verification releases DB locks during bounded DNS and rechecks membership/expiry/hash before commit.
- Route references bind domain/origin/policy to the same project. Approval requires verified unexpired ownership and valid required auth, stores exact immutable dependency generations, denies stale ETags and serialized conflicting methods on the same domain/path. Approval is a control-plane record only; no config publisher/proxy is activated.
- All expanded pgx hosts/fallbacks require verified TLS except literal loopback fixtures. Per-admin and login budgets have finite state. Mutations have audit records; project HTTP denials record a server-defined redacted action.

## Evidence

`evidence/orchestration/02-root-full-go-contract-tests.log`: explicit
`AEGIS_TENANCY_INTEGRATION=1 go test -race -count=1 -v ./apps/control-api/...`
passed with PostgreSQL integration actually running. The HTTP suite uses an
owned HTTPS OIDC IdP and actual PKCE token exchange for two tenants/three users;
it checks list/item/create/revise/revision/audit/job BOLA through path/query and
spoofed forwarded/tenant headers. It validates real HTTP JSON against the source
OpenAPI schema. It also exercises unverified-domain denial, stale revision,
callback replay, browser binding, forged CSRF, expired/revoked sessions,
membership revocation, strict private files, body limits and finite rate state.

Persistence tests additionally execute concurrent domain claim/idempotency,
old-proof replay after reclaim, membership revocation during DNS, conflicting
route approvals, immutable history and durable store reopen. OIDC tests exercise
wrong issuer/audience/nonce/signature/time/authorized party and
wrong-name/expired/untrusted certificates, fetch errors/redirects and bounds.
`make integration` now explicitly enables these DB tests; skipping them cannot
satisfy the gate.

`02-root-make-check.log` recorded a full passing `make check` before dependency
remediation. The first expanded `make security-scan` failed on HIGH
CVE-2026-116587 in go-jose4.1.4 and a published RFC6455 sample nonce misclassified
as a generic API key. Dependency updated to4.1.6. The nonce is now encoded from
its public sample text at runtime, preserving wire bytes with no scanner ignore.
Final patched `make check` and `make security-scan` both returned exit0;
logs are `02-root-patched-make-check.log` and
`02-root-patched-security-scan.log`. Secret/SCA/filesystem/image scans, SBOMs and
exact image-identity validation passed. `01-02-final-evidence.sha256` binds the
final logs, Pingora reproduction/results and management source contract/locks.
These checks validate this partial checkpoint, not the remaining module scope.
Initial schema-test/compiler failures are retained in
earlier logs and do not represent passing evidence.

## Remaining mandatory work

- Model OriginPool/Endpoint explicitly and validate configuration/diffs across its full lifecycle; the current origin is a single HTTPS endpoint. Extend all API/schema/role/isolation coverage together.
- Separate migration ownership from least-privilege application roles and prove permissions with the actual app role. Local tests currently use the disposable fixture database owner.
- Define org/resource/session/idempotency/audit-retention quotas and cleanup. Login attempts and pending jobs are bounded; this does not bound all durable administrative state.
- Audit denied organization/member changes as well as project actions, including direct use-case callers. Complete explicit publish/security-sensitive role and step-up/MFA requirements with the management authentication policy.
- Add IdP key rotation/refresh/backoff/outage and failed-code/state/nonce callback combinations through the HTTP layer; current primitive tests do not cover the entire callback matrix.
- Complete domain active/failed/reverification lifecycle, DNS resolver operational trust review, actual local DNS transport integration and concurrency/worker-crash cases beyond injected TXT fixtures. Domain lookup in HTTP integration is injected, not a claim of external authoritative DNS verification.
- Add explicit diff/preview response rather than requiring callers to compare two immutable revision responses, strengthen approval lifecycle/collision retirement semantics, and complete all acceptance tests and independent security review.
- Keep public-origin validation at registration separate from module04 dial-time SSRF/rebinding/redirect enforcement. No edge SSRF protection is claimed by this checkpoint.

No production deployment, live DNS change, public listener, third-party security
traffic, paid cloud or live payment operation occurred.
