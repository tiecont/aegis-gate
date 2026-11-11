# AGENT 11 — Security Hardening, Threat-Driven Validation

**Dependency:** 02..10 functional. **Gate:** `M4-SECURITY`.

## Tasks

1. Review `docs/THREAT_MODEL.md`, update threat register with new dependencies, authentication flows, data stores and upstream provider boundaries.
2. Map OWASP API Security Top 10 and selected ASVS controls to implementation, tests and evidence links.
3. Build cross-tenant negative test suite for admin API, request routing, analytics, audit, billing, domain claims, cert metadata and background jobs.
4. Fuzz/mutate HTTP paths, duplicate Host, malformed headers, CL/TE, chunked encoding, protocol downgrade, IDNA normalization, SNI mismatch, invalid authority, WebSocket/gRPC framing.
5. Verify SSRF handling against IPv4/v6 loopback, private, link-local, cloud metadata, domain DNS rebinding and redirects with controlled test server.
6. Verify TLS: wrong origin certificate, expired chain, malformed certificate, unsupported ALPN, cert/key rotation, no logged private keys.
7. Verify JWT/key: alg confusion, none, JWKS poisoning, wrong issuer/audience, stale claims, key rotation, large token and unknown kid storms.
8. Validate rate limits under Redis failure, burst abuse, slow client/origin, auth brute force, origin pool overload and tenant noisy neighbor.
9. Add SAST/SCA/SBOM/image signing and policy enforcement, minimal privileges, secrets detection, dependency/maintainer review; track high severity fixes.
10. Arrange scoped external pentest/security review before public GA; document findings, owners, dates, remediations, explicit risk acceptances.

## Acceptance

- All T01–T20 controls from threat model mapped to test evidence; no critical/high known bypass unresolved without formal approval.
- Security tests prove both negative behavior and isolation across at least two tenants.
- Credentials not leaked to API responses, exceptions, logs, traces, metrics, environment dumps or images.
- No insecure origin TLS or signed config bypass.
- Reviewer can reproduce tests in owned isolated environment without external targets.

## Security focus

The purpose is *defensive validation*, not unrestricted offensive infrastructure. Only test authorized local/staging resources. Do not auto-promote security test payloads to public internet scans.

## Deliverables

Threat register updates, security test corpus, findings register, SBOM/provenance evidence, release risk report.
