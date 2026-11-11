# Product Scope — AegisGate SaaS

## Personas

- Platform owner/operator: cluster health, capacity, on-call, infrastructure, emergency blocks.
- Organization owner: invite members, plans, project isolation, billing.
- Security admin: domain verification, route auth policy, IP rules, secrets policy, audit reviews.
- Developer: origins, routes, API keys, TLS status, deployment history.
- Analyst/viewer: request analytics and alerts, read only.

## MVP user journeys

1. Signup -> create organization/project -> add DNS TXT ownership proof -> assign API hostname.
2. Add origin HTTPS endpoint -> perform safe health probe -> create host/path route -> publish staged config.
3. Issue managed certificate using ACME challenge -> validate hostname/cert -> activate HTTPS.
4. Enable JWT verification via issuer/JWKS or API key per route -> test with preview/simulate.
5. Apply route/identity/IP quota and deny rules -> inspect reasons, status and metrics.
6. Browse request metrics, sampled sanitized logs, 4xx/5xx, latency histograms; export audit events.
7. Manage subscription, plan caps, invoices from an external payment provider and internal durable ledger.
8. Review version diff, canary config, rollback by publishing a new generation based on a known-good revision.

## Core entities

Organization, Membership, Project, DomainClaim, OriginPool, OriginEndpoint, Route, RouteVersion, Policy, PolicyVersion, APIKeyCredential, JWKSProvider, TLSCertificateReference, ConfigRevision, Deployment, EdgeNode, UsageEvent, UsageAggregate, Subscription, InvoiceReference, AuditLog, SecurityIncident.

All customer resource tables have explicit `tenant_id` (or project_id referencing tenant), immutable owner binding and safe compound uniqueness where needed. Unique hostname claims must have one canonical owner globally across tenants while active.

## MVP vs extensions

| Area | MVP | Later |
|---|---|---|
| Networking | HTTP/1.1, HTTP/2, gRPC pass-through, WebSockets, host/path | HTTP/3, advanced connection coalescing |
| TLS | managed single-host certificate, SNI, origin TLS verify | BYOC, wildcard, HSM, custom cipher policy |
| Auth | API key, JWT/JWKS, OIDC issuer validation | OAuth introspection, full custom PDP, mTLS client identity |
| Abuse | IP/key/route limits, connection/time/size budgets | bot fingerprinting, WAF rule packs, enterprise threat intel |
| SaaS | dashboard, roles, plans, usage, billing adapter | enterprise SSO, reseller, custom compliance reports |
| Reliability | one-region HA, config LKG, backup/restore | multi-region active-active with global traffic management |

## Business model draft (no fixed market price)

- Free developer: low allowed request quota, 1 domain, limited retention.
- Team: multiple domains, roles, custom policies, longer logs retention, alerts.
- Business: dedicated capacities, increased limits, private origin link (future), SLA/support.
- Bill using clearly defined successfully received edge requests / eligible billable events, separate egress and log storage if necessary. Exclude control-plane health checks, internal synthetic monitoring and billing retries. Disclose billing calculation/rounding.

## Product success metrics

- Time to first verified + secured request.
- Setup failures: DNS, ACME, origin TLS, config validation.
- Policy change p95 propagation and rejection rate.
- Tenant isolation incidents (target zero).
- Request success and p95/p99 proxy-added latency.
- Auth-deny correctness and false positive rates under traffic simulation.
- Billing reconciliation mismatch and customer-facing support events.
