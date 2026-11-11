# AGENT 05 — TLS / ACME / Domain Lifecycle

**Dependency:** 02, 03, 04; Pingora TLS proof. **Gate:** `M2-TLS`.

## Tasks

1. Design domain ownership proof with expiring TXT challenge distinct from ACME; reserve uniqueness atomically, verify before any public activation.
2. Implement certificate manager using established ACME client/cert-manager, Let's Encrypt staging then production; support DNS-01 or HTTP-01 only when routing/tenant ownership guarantees are met. Record account/order quotas and exponential backoff.
3. Establish per-domain cert/key secure storage (KMS/Vault or carefully restricted Kubernetes Secret for self-host), no private key in API/DB/config snapshots.
4. Integrate SNI certificate mapping with runtime, atomic hot rotation on new handshakes, check renewal overlap and old session behavior.
5. Validate TLS1.2/1.3 policy, supported cipher suites and ALPN on test matrix; no insecure default transport.
6. Enforce HTTPS origin verification; custom root CA or origin mTLS needs restricted enterprise design, versioned trust and audit.
7. Monitor cert expiry/order status/renewal retries, alert 30/14/7 days and on failures; test key rotation and emergency revoke.
8. Document DNS cutover, challenge troubleshooting, reverse proxy/front CDN mode and trusted client IP rules (TLS path changes under CDN termination).
9. Implement management API + UI fields for `pending/validating/issued/active/renewing/error/expiring`, sanitized errors.
10. Write end-to-end certificate issuance in local CA and ACME staging; never burn production CA rate quota in CI.

## Acceptance

- Unknown/unverified domain cannot get active route; duplicate tenant domain claim rejected.
- Valid client connects with correct SNI cert; wrong name, expired cert, invalid chain fail as expected.
- Renewal replaces certificate for new TLS handshakes without unplanned proxy downtime.
- Certificate key absent from SQL, pubsub payload, debug logs and dashboard API.
- Expiry alert and ACME staging backoff tests pass.

## Security focus

Protect DNS provider credentials; avoid attaching broad DNS change permissions to edge pods. Key rotation supports audit. Do not assume certificate issuance itself proves perpetual domain ownership.

## Deliverables

Domain status machine, ACME integration, secure cert material mechanism, SNI tests, runbooks.
