# Sprint02 Agent C execution plan

Worktree: `/home/tiecont/Projects/aegis-gate-sprint02-c`, branch
`feat/module02-acceptance`. Root owns gate disposition.

1. C1: extend the existing resource/revision model with an OriginPool aggregate
   and explicitly addressable endpoints, generation preconditions and immutable
   approval snapshots. Preserve the existing single-origin API. Validate all
   endpoint registrations through the existing public-address policy. Add a
   separate migration entry point and runtime/maintenance grants; exercise actual
   least-privilege roles in PostgreSQL.
2. C2: require recent signed IdP MFA evidence for membership, policy and approval
   decisions; preserve it in server-side sessions. Bound IdP fetch refresh and
   outages, audit denied organization/member and direct persistence operations,
   and enforce durable quotas plus operator-only bounded cleanup/retention.
3. C3: finish domain failure, active, expiry and fresh-challenge reverification
   states; fence durable job attempts and test actual owned DNS transport,
   concurrency and crash recovery. Add explicit revision diff/preview and active
   approval replacement/retirement with immutable decision history.
4. Synchronize OpenAPI, generated Go/TS/schema, local management documentation and
   HTTP/database/security regression suites. Hold the sprint fixture flock for
   every database, Compose, integration and full-check invocation.
5. Execute focused race/integration tests, `make check`, and `make security-scan`.
   Retain redacted command evidence, commit scoped changes, push this branch and
   open a draft PR. Report exact outcomes and remaining limitations in
   `docs/reports/sprint02-c-module02.md` without changing root-owned gates.

Registration checks are separate from future module04 dial-time SSRF enforcement;
control-plane approval does not publish signed snapshots or activate an edge.
