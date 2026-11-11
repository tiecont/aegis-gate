# Sprint02 Independent Security Review

Reviewer: root integration role, separate from the A/B/C implementation tasks.
Date: 2026-11-11. Scope: local management and CI recovery, not production signoff.

## Reviewed Candidates

- A: `f53e1d27c9a987b6f1e27945f157f9971b2ef244`, PR6. Full scripts match the
  integrated source; the history regression was also restored to `Makefile`.
- B: `da919d73b24b00b6b48995efb2f7de244dcd09b6`, PR5, evidence only.
- C: `727f5b17dd38bca2f44b94634c53afa1e8504524`, PR7. Rebase of `915644e`;
  application, migrations and contracts are unchanged by the rebase.

## Findings And Disposition

1. The old image validator confused runtime config with a manifest descriptor.
   Reviewed replacement checks schema/type, exact SHA-256, descriptor size,
   OS/architecture/variant, scanner artifact identity and ordered layer diff IDs.
   Root's independently constructed Docker/OCI layer substitutions fail closed;
   both legitimate controls pass. Evidence: `evidence/sprint02-d/image-layer-binding.log`.
2. Empty or failed Git history scans formerly appeared successful in linked
   worktrees. Reviewed preflight resolves/mounts actual read-only Git metadata;
   parser requires a positive commit count and rejects scanner errors. The
   integrated actual scan inspected 18 commits. Four regression tests pass.
3. Root's five special-purpose address cases now fail registration, with public
   IPv4/IPv6 and mixed-answer controls passing. Evidence:
   `evidence/sprint02-d/origin-negative.log`. This closes the registration finding;
   concrete dial address, rebinding, redirect and origin TLS enforcement remain
   module04 obligations.
4. Reviewed project predicates, compound references and membership rechecks for
   pool/endpoint/revision/preview/mutation/job/audit operations. HTTP integration
   uses two tenants, three users, forged headers and all six roles. DNS workers
   reauthorize the persisted actor and fence commits/ACKs by lease, attempt and
   challenge generation. No tenant is chosen from a client header.
5. Reviewed additive migrations006/007, checksums, immutable snapshots/history,
   transactional route collision/retirement, actual migration/runtime/maintenance
   identities and privilege negatives. Runtime cannot own objects, create schema
   objects, alter immutable history or call retention cleanup. Security-definer
   cleanup pins `pg_catalog, trusted schema, pg_temp`, bounds batches and enforces
   audit retention. The ownership negative fixture restores explicit ACLs after
   returning table ownership; the earlier failure is retained, not waived.
6. OIDC uses maintained verification, same-origin HTTPS and verified roots,
   bounded network responses/backoff and server-side state/PKCE/nonce. MFA is
   bound to signed `amr`/`auth_time`, actor and five-minute freshness; client MFA
   headers confer no authority. Real HTTPS rotation/outage/callback, session,
   CSRF/revocation and role negatives execute in the integration suite.
7. Administrative quotas include inactive/history state and serialize quota
   buckets across distinct idempotency keys. Missing quota state fails closed;
   maintenance is a distinct role. Audit denial records use server-defined
   actions and tenant bindings. No scanner ignore, authorization or TLS bypass
   was introduced.

No unresolved critical/high finding was identified in the reviewed Module02
candidate. Independent security review: **PASS for this local module scope**.
Final module gate disposition additionally requires the integrated quality and
supply-chain checks recorded in `sprint02-d-integration.md`.

## Architecture And Release Limits

Root rebuilt the current Pingora release binary and independently reproduced
**57/65, eight failures, exit1**. Raw controls normalize and reach the origin;
relative target sends 192 decrypted bytes and causes two origin parser errors.
All six valid encoded-target controls pass. Evidence:
`evidence/sprint02-d/pingora-results.json` and `pingora-lab.log`.
This confirms **NO-GO**, not architecture acceptance. The ADR011 alternatives
matrix is suitable for human decision; no replacement is implemented.

`derivative` and `unsafe-libyaml` maintenance warnings remain open. A fixed YAML
literal is parsed at startup; absence of untrusted YAML in this proof does not
waive maintenance risk. Human architecture review is required before replacement
or any affirmative feasibility disposition. All production release controls,
external security assessment and human signoffs remain unproven. No deployment,
live DNS/billing, public listener or third-party security/load test occurred.
