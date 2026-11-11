# Threat Model & Security Controls

**Scope:** multi-tenant SaaS admin API and Internet-facing HTTP edge. Use STRIDE + OWASP API Security Top 10 (2023). Threat model must be updated on every new ingress, protocol, secret type, runtime plugin or billing change.

## Assets / trust boundaries

Assets: customer hostnames/domains, TLS private keys, API keys/JWKS trust, signed config, usage/billing ledger, credentials, audit logs, tenant routes, origin networks, public traffic. Boundaries: untrusted Internet ↔ Rust edge; edge ↔ origin; edge ↔ config publisher; tenant dashboard ↔ Go admin API; Go admin ↔ DB/message/secrets; operator ↔ infrastructure.

## Threat register

| ID | Threat | Impact | Mandatory controls | Negative evidence |
|---|---|---|---|---|
| T01 | Host/SNI spoof, domain takeover | Cross-tenant route confusion | Domain DNS proof, canonical host, global hostname uniqueness, SNI/Host binding | Mismatch rejects, expired/abandoned claim can't route |
| T02 | Cross-tenant IDOR/BOLA | Confidentiality/integrity | Authz each resource, tenancy-aware SQL, compound keys, membership checks | Tenant B reads/edits Tenant A → 403/404 |
| T03 | Origin SSRF / DNS rebinding | Internal network access | Deny private/link-local/metadata, resolve+validate on dial, no redirect-follow, allowlisted ports | Local/metadata/IPv6 mapped IPs rejected |
| T04 | Token signature/claim confusion | Auth bypass | alg allowlist, issuer/audience, expiration/leeway, kid pin + JWKS rotation, no `none` | Forged/wrong aud/expired token denied |
| T05 | Policy config tampering/replay | Bypass security | Signed hashes, anti-replay generation, mTLS sync, readonly trusted keys | Tampered/replayed config NACK; LKG persists |
| T06 | Header trust spoof | Fake user IP/auth | Strip untrusted forwarded headers, configured proxy CIDR trust only | Forged `X-Forwarded-For` ignored |
| T07 | Request smuggling / parser differential | Rule bypass | RFC 9112-compliant parser; CL/TE ambiguity rejection; use maintained library | Fuzz corpus malformed HTTP rejected |
| T08 | Resource exhaustion / slowloris | Denial of service | Header/body/time/connection/stream limits, bounded queues, idle timeout | Slow clients capped; no resource leak |
| T09 | L7 request floods | Service unavailability / billing shock | per-IP/key/route/tenant quota; anomaly alerts; upstream protection | 429/deny behavior under controlled load |
| T10 | L3/L4 volumetric floods | Network saturation | Cloud/provider anti-DDoS, firewall, L4 network protections | Provider architecture verified; exercise runbook |
| T11 | TLS MITM / certificate leak | Traffic interception | TLS1.2/1.3, verified origin, private key in KMS/Vault/secret store, rotate, audit | Incorrect origin cert fails closed |
| T12 | Admin session / privilege abuse | Unauthorized config | OIDC, short session, MFA via IdP, RBAC, step-up for risky actions, audit | Viewer cannot publish/disable auth |
| T13 | Data exfiltration via telemetry | Secrets/PII leakage | Redact auth/cookie/query PII, minimize IP retention, controlled sampling/access | Secret-bearing request absent from logs |
| T14 | Supply-chain dependency compromise | RCE / loss | pinned deps, SBOM, SCA, signed images, runtime hardening | build provenance, scanner policy pass |
| T15 | Rate backend outage abuse | Quota bypass | conservative local fallback; alarm; tenant ceilings | Redis down has bounded rejection/allow |
| T16 | Unauthorized origin rewriting | Header injection / SSRF | Strict URL parser, canonical headers, no credentials in URL, egress allow policy | CRLF/hop-by-hop header tests |
| T17 | Config deployment race | Inconsistent auth | immutable snapshots, atomic apply, bounded retained generations | Concurrent rollouts preserve consistency |
| T18 | Billing meter manipulation | Financial loss | dedupe ledger, reconciliation, customer visibility, immutable adjustment audit | duplicate/replayed events not billed twice |
| T19 | Internal admin endpoint exposed | Privilege escalation | Separate ports/hosts/ingress; private network + mTLS, network policy | Tenant edge cannot reach management API |
| T20 | Log/metrics cardinality explosion | Operational DoS | Low-cardinality labels, tenant bucket/safe IDs, sampling quotas | random paths can't create unbounded labels |

## Policy evaluation order

1. Parser/connection safety (always-on).
2. SNI + host verification, tenant binding, routing.
3. Global emergency deny / service disable.
4. Resource and concurrency guardrails.
5. IP/network threat policy and rate budgets.
6. Required authn (JWT/API key) and route authz.
7. Origin access + upstream TLS verification.
8. Audit/usage and optional response policies.

Deny takes precedence. Do not cache `allow` across tenant/project/policy revision boundaries. Missing/invalid authentication config must reject traffic, not silently downgrade to anonymous.

## API keys and JWT

- API key: random high entropy, reveal only once, store HMAC/hash with server pepper in secret store, constant-time comparison where applicable, metadata prefix, scoped/expiring, revoke + rotate workflow; no plaintext logs.
- JWT: use maintained library; validate RS256/ES256 allowlist as policy permits; reject `none`; `iss`, `aud`, `nbf`, `exp`, max token age, key type/alg binding. Bound JWKS fetch timeouts, body sizes, cache TTL, backoff; pin trusted JWKS origin and protect against SSRF.
- Admin access token for SaaS control API is separate from customer traffic JWT validation. Do not let an end-user JWT grant admin rights.
- Route-level auth is not sufficient for business object permissions; origin service must enforce row/object ownership and operations (BOLA/BFLA).

## TLS & key handling

- Public: TLS1.2/1.3 only, valid SNI certificate from a supported CA, coherent ALPN, no insecure origin mode. Build a compatibility matrix for clients and ciphers.
- Management channel: mTLS identity + pinned trust + short-lived credentials; rotation tested.
- Cert keys: preferably key generated by dedicated cert manager; encryption envelope at rest, access only to authorized edge/cert service; avoid exporting keys in admin API. Security posture of propagation from secret store to pod memory must be documented.
- Domain proof and ACME challenge are distinct checks; certificate issuance must not imply indefinitely continuing domain ownership.
- ACME staging for automated tests; production ACME rate limits and retry/backoff must be respected.

## Abuse / DDoS scope

Preventing abusive traffic at L7 includes sustained request limits, body/stream caps, compression bomb limits, max pending requests, per-IP and per-identity budgets, origin concurrency caps, emergency block/allow lists. These mechanisms operate **after** packets reach the protected environment; upstream provider/network controls needed for volumetric attacks. Never recommend attack testing against third-party services; test only lab environments the operator controls.

## Compliance/privacy assumptions

- Logs should not include request/response bodies by default. PII access is role-gated, retention documented, deletion/export supported.
- Dedicated administrative audit trail, append-only or tamper-evident store, time sync, controlled access to raw logs.
- Recording source IP may be personal data under applicable laws; review jurisdiction and data protection requirements before launch.
- Do not claim SOC 2, ISO 27001 or PCI certification merely because controls are implemented.

## Security validation checklist

- [ ] OWASP ASVS/API risk mapping documented.
- [ ] Cross-tenant API integration suite has 403/404 assertions and route isolation tests.
- [ ] Invalid JWT matrix; JWKS rotation/unavailable; auth required → deny.
- [ ] Fuzzing malformed Host, duplicate Host, CL/TE, chunked/body length, encoded path.
- [ ] SSRF deny matrix: IPv4, IPv6, localhost, metadata, redirect, DNS rebind, userinfo URL.
- [ ] Upstream TLS negative tests: expired, wrong hostname, untrusted issuer, revoked? (as policy provides).
- [ ] Secrets redaction in logs, traces, panic, metrics and audit.
- [ ] Config forged/replay/stale, key rotation, ACK/NACK and LKG.
- [ ] Redis failure mode, slow origin, slow client, connection exhaustion.
- [ ] Authorization of domain claim/ACME/cert metadata and admin RBAC.
- [ ] Signed images / SBOM / dependency scanning with tracked exceptions.
- [ ] External security review before public GA.
