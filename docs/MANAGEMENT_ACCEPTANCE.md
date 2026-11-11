# Local Management Lifecycle

This documents locally accepted module02 behavior. Root's independent review
and evidence are in reports/sprint02-d-integration.md and
reports/sprint02-d-security-review.md. No API here publishes a signed edge
snapshot, serves tenant traffic or authorizes a public listener.

## Database Identities

Provision three separate credentials: a schema owner for offline migrations, a
runtime login, and a maintenance login. Runtime and maintenance must be `LOGIN
NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION` with no role
memberships. Use an isolated management database/schema owned by the migration
identity. Neither serving identity owns objects. Keep credentials in owner-only
configuration files; do not put passwords in command arguments or ordinary logs.

Run the offline operation with the schema-owner configuration:

```sh
go run ./apps/control-api/cmd/control-api --management-config .local/migration.json \
  --migrate --runtime-role aegis_runtime --maintenance-role aegis_maintenance
```

It applies checksummed additive migrations and grants explicit table/sequence
permissions, then exits. Start serving with a separate `.local/management.json`
whose `database_dsn` authenticates as the runtime login. Startup rejects role
memberships, object/schema/database ownership, administrative role attributes,
schema creation, immutable-history mutation and maintenance execution grants.
Migrations never create or rotate credentials or operate on shared lab volumes.

The maintenance login may call `SELECT cleanup_control_state()` in the trusted
management schema. This fixed function uses `pg_catalog, <schema>, pg_temp`, has
no caller-controlled identifiers and removes at most 1,000 records per category
per invocation. Runtime cannot invoke it. The operator schedules it independently
of the serving process. It deletes expired login attempts; sessions expired over
one day; idempotency records and completed jobs older than seven days; and audit
events beyond the organization's retention (365 days by default, minimum 30).
Immutable configuration/approval/retirement history is retained. Audit records
cannot be updated, and only the schema owner via retention cleanup can delete
expired records. Reaching a quota fails closed until maintenance or an operator
resolves capacity; it does not discard required audit records.

## Authentication And Permissions

Login uses OIDC authorization code, PKCE, state, browser binding and nonce. Each
login requests a fresh IdP authentication (`max_age=0`, `prompt=login`). Sessions
last at most 15 minutes and never outlive the verified ID token. Membership
changes/revocation, policy changes, pool/route approval and route retirement
require both the existing explicit role grant and signed IdP `amr` containing
`mfa` with `auth_time` at most five minutes old. These values are persisted with
the opaque server-side session. Client headers cannot assert MFA. Repeat login
to obtain fresh evidence. Existing sessions remain bounded and revocable during
an IdP outage; new login fails closed. JWKS refresh is at most once per second;
network/429/5xx failures back off exponentially from 2 to 32 seconds. Trusted
same-origin HTTPS endpoints, response sizes, connections and timeouts remain
bounded. IdPs with other MFA claim conventions require an explicit reviewed
mapping; they do not receive an implicit bypass.

Owner manages members; owner/admin/developer manage project/domain/origin/route
drafts; owner/admin/security-admin manage policies and approvals. Viewer and
billing-admin cannot change security. Membership, organization, project and
security denials are durably audited by the direct persistence operations;
transport also audits CSRF and resource denials. Audit responses expose only
server-defined action/outcome/time/sequence, scoped to authenticated membership.

## Origins And Revisions

The existing `/origins` single-endpoint contract remains supported. New
`/projects/{project}/origin-pools` and nested `/endpoints` explicitly expose each
pool and endpoint. Creation requires actor/project-scoped `Idempotency-Key`;
updates require quoted `If-Match`. Endpoint creation uses the pool generation;
endpoint update uses the endpoint generation. Pool generations increase for
every endpoint addition/change, and contain immutable endpoint snapshots. Pool
revision/preview endpoints show that history. Endpoint revisions are immutable
and independently addressable. Pagination uses `after` and `limit` (maximum100).

Each endpoint uses normalized HTTPS, DNS hostname, port443 and registration-time
public-address validation. Scope is checked before DNS even for direct callers.
The filter conservatively blocks private/special-purpose ranges, including
deprecated6to4, site-local IPv6, documentation, SRv6 SID and dummy prefixes.
Sources: [IANA IPv4 registry](https://www.iana.org/assignments/iana-ipv4-special-registry/)
and [IANA IPv6 registry](https://www.iana.org/assignments/iana-ipv6-special-registry/),
RFC3879/7526/9602/9637/9780. This does not replace module04 dial-time address,
TLS, redirect and DNS-rebinding enforcement.

Pools/endpoints transition active/disabled/retired. Retirement is final. A pool
cannot be disabled/retired while an active route decision refers to it. Endpoint
edits produce a new draft snapshot while old approved snapshots remain immutable;
routes retain their approved generation until a new explicit decision. Pool
approval requires an active pool and at least one active endpoint. New routes
choose exactly one `origin_id` or `origin_pool_id` and require the pool's current
generation to have approval before a new route approval.

`/routes/{id}/preview?from=N&to=M` returns immutable revisions, sorted field
changes, and validation reasons (staleness, domain proof, policy, pool approval,
collision). Preview is a point-in-time advisory view; transactional approval
rechecks all invariants. Approval captures exact route/origin/policy generations.
Replacing an approval changes only its active pointer. Collision checks use
active, unexpired decisions rather than historical rows. `/retire` requires the
active route generation, retains the decision/retirement history and releases
the route's collision reservation. Retiring the last route returns an active
domain to verified state.

## Domain Proof And DNS Workers

Domain claim state is pending -> verified -> active (active means at least one
approved control-plane route, not edge activation). Proof expires after15 minutes;
verified ownership lasts24 hours. Exhausted three-attempt jobs mark a pending
claim failed. Expired state is materialized by the bounded worker and reflected
by reads. `/domains/{id}/reverify` requires the challenge generation in `If-Match`,
withdraws active decisions, cancels pending leases and issues a fresh one-time
256-bit proof. Old TXT values and old jobs cannot extend replacement ownership.
An expired/failed claim cannot reclaim a hostname reserved by another tenant.

Workers use `SKIP LOCKED`, 15-second leases, three attempts and10-second retry
delay. DNS runs outside database locks with a3-second deadline. Commit rechecks
membership, challenge hash/generation, state, expiry and the live job attempt/
lease. A crash after verification but before ACK recovers only the same unexpired
verified generation. Expired leases and replaced challenges cannot commit or ACK.

`dns_resolver` is an operator-controlled literal address/port; tenants cannot
choose it. The resolver must be a trusted authoritative/recursive public-DNS
service within the deployment trust boundary; no system fallback is used.
This implementation does not claim DNSSEC validation or resilience to a
compromised resolver. The integration lab uses owned loopback UDP transport via
Go's maintained DNS resolver/parser, not third-party DNS/security traffic.

## Durable Bounds

Defaults: 10 owned organizations per actor; 10,000 organizations globally;
50 projects and100 members per organization; 1,000 resources/pools per project;
100 endpoints per pool; 1,000 revisions/approvals/retirements per resource;
5,000 idempotency records per project; 1,000 total and100 pending jobs per
project; 128 sessions per actor and10,000 globally; 1,024 login attempts globally;
100,000 audit events per organization. Inactive/history states count against
bounds. Quotas serialize the actual bucket across distinct concurrent keys;
missing organization quota state fails closed. Only migration/maintenance
operators may change the bounded administrative defaults. These are local
capacity limits, not a measured product SLO.
