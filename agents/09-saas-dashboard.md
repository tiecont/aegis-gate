# AGENT 09 — Customer Dashboard, API and Billing Integration

**Dependency:** 02, 03, 05, 06 and 08 contracts. **Gate:** `M3-SAAS-MVP`.

## Tasks

1. Build Next.js dashboard with separate organization selector, project navigation, members/roles, security audit and profile/session features.
2. Onboarding wizard: DNS proof record, verification polling/status, origin HTTPS health test, route/policy wizard, managed TLS activation, sample curl command.
3. Security policy builder with validation/preview diff, explicit safe defaults, role-gated dangerous actions and review confirmation.
4. Edge deployment panel: generation, pending/ACK/NACK per node, changed routes, rollback as new generation, error explanation.
5. Analytics: request volumes, 4xx/5xx origin vs edge errors, auth/rate outcomes, p95/p99, certificate issues, usage and retention.
6. Plan management: internal subscription entity, plan enforcement, overage warning, customer usage definition, billing provider interface; choose payment provider only with business approval.
7. Implement webhook receiver for billing provider with signature verification, idempotent event processing, dedupe, subscription state transitions, retry. Never treat browser redirect as payment confirmation.
8. Tenant-aware client SDK/OpenAPI generated API client, CSRF and XSS protections, accessibility, localization readiness, optimistic update conflicts.
9. Add audit viewer with actor/time/resource/diff-redacted; row-level permissions and immutable references.
10. E2E browser tests for onboarding, auth/roles, denied access, expired session, policy rollback and billing duplicate webhook.

## Acceptance

- User can onboard verified custom domain through a working HTTPS route and policy without accessing infra.
- Client-side route guards are never sole security: backend rejects unauthorized actions.
- Billing duplicate events and out-of-order event cases do not create double invoices or incorrect entitlements.
- No secrets displayed after initial API key creation; secret redaction on all logs/UI errors.
- Dashboard clearly differentiates provider/network DDoS protection from L7 gateway limits.

## Security focus

HTTPS-only cookies, CSRF or secure token architecture, strict CSP where feasible, no admin token in localStorage by default, no billing credentials in client bundle. Sensitive account/security mutations audited.

## Deliverables

Dashboard, onboarding UI, generated SDK, billing adapter, E2E tests and product docs.
