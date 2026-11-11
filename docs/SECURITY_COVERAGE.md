# Threat evidence tracker

This tracker records evidence, not security certification. The threat register in `THREAT_MODEL.md` remains authoritative. A foundation test proves only the foundation behavior it exercises; it does not establish tenant isolation, safe proxying or production readiness.

| Threat | Required proving module(s) | Current evidence / gate |
|---|---|---|
| T01 Host/SNI and domain takeover | 01, 02, 04, 05, 11 | NOT PROVEN: verified ownership, global uniqueness, canonical authority and mismatched SNI/Host rejection needed. |
| T02 Cross-tenant BOLA | 02, 03, 04, 08, 09, 11 | NOT PROVEN: two-tenant single/list/mutation/job/analytics/billing integration matrix needed. |
| T03 SSRF / DNS rebinding | 02, 04, 06, 11 | NOT PROVEN: concrete dial destination and IPv4/v6/mapped/metadata/redirect/rebind matrix needed. |
| T04 Token confusion | 06, 11 | NOT PROVEN: vetted JWT, alg/key/iss/aud/time/kid and JWKS outage tests needed. A dummy fixture issuer is not deployed authentication. |
| T05 Config tamper/replay | 03, 11 | Module03 local PASS: canonical Ed25519/digest/context, authenticated trust/fetch, replay/rollback, encrypted LKG and independent signed-unsafe negatives. Production custody/revocation and module11 review remain. |
| T06 Header spoofing | 04, 07, 11 | NOT PROVEN: explicit trusted proxy identity and spoofed forwarding headers matrix needed. |
| T07 Parser differential | 01, 04, 11 | NOT PROVEN: maintained parser with duplicate Host/CL/TE and downstream/upstream framing corpus needed. |
| T08 Exhaustion / slowloris | 01, 04, 07, 11, 12 | NOT PROVEN: finite connection/stream/body/header/queue budgets, timeout/cancellation and memory observations needed. |
| T09 L7 flood | 07, 11, 12 | NOT PROVEN: bounded local lab overload/fairness and quota evidence needed. |
| T10 L3/L4 flood | 07, 10, 12 + operator | NOT PROVEN: upstream provider/network architecture and incident exercise; no standalone gateway claim permitted. |
| T11 TLS MITM / key leak | 00 fixtures, 01, 04, 05, 10, 11 | NOT PROVEN: fixture tests do not establish Pingora upstream verification or certificate rotation. |
| T12 Admin privilege abuse | 02, 06, 09, 11 | NOT PROVEN: OIDC/session/CSRF/revocation and role matrix with audit needed. |
| T13 Telemetry leakage | 02, 08, 09, 11 | NOT PROVEN: secret sentinels in real errors/logs/traces/metrics/audit needed. |
| T14 Supply chain | 00 baseline, 10, 11, 12 | NOT PROVEN: pinned dependencies/images, actual SCA/secret/image scans, SBOM/provenance and review needed. |
| T15 Rate backend outage | 07, 11, 12 | NOT PROVEN: conservative bounded local fallback with alarm and cross-edge tolerance needed. |
| T16 Origin rewrite | 02, 04, 11 | NOT PROVEN: URL/CRLF/userinfo/hop-by-hop/egress matrix needed. |
| T17 Config races | 01 spike, 03, 04, 11 | Module03 local PASS: captured immutable generation, concurrent atomic swap, fenced publication, durable canary/CAS and rollback tests. Actual production edge/module04 and module11 remain. |
| T18 Billing manipulation | 08, 09, 11, 12 | NOT PROVEN: durable event dedupe, reconciliation and webhook replay/order tests needed. |
| T19 Exposed administration | 00 dev baseline, 04, 10, 11 | NOT PROVEN: loopback dev bindings are not production network isolation. |
| T20 Cardinality explosion | 07, 08, 11 | NOT PROVEN: bounded identity/route labels, randomized path/load test needed. |

## Release policy

Local01/02 evidence addendum: `reports/01-root-security-review.md` records actual
SNI/hot rotation/protocol/TLS/generation proofs but **T07 has a reproduced
malformed-target failure**, so module01 is No-Go. `reports/02-root-security-review.md`
and `reports/02-management-checkpoint.md` record scoped T01/T02/T03/T04/T11/T12/T13
management evidence: actual HTTPS OIDC-PKCE and database-backed HTTP isolation,
CSRF/revocation, ownership jobs and immutable revisions. T03 dial-time protection,
full IdP/DNS lifecycle, application database privileges and the remaining module
acceptance matrix are not proved. Neither addendum closes a global threat or a
production release requirement.

Sprint02 addendum: `reports/sprint02-d-security-review.md` independently reviews
the completed local management candidate: actual least-privilege PostgreSQL,
HTTPS OIDC rotation/outage/MFA, owned UDP DNS transport and lease lifecycle,
tenant/role/list/item/mutation/job negatives, bounded retention/quotas and
contracts. `reports/sprint02-d-integration.md` records the final module gate.
Root repeats the stricter Pingora corpus:57/65, eight failures; T07 remains a
blocker. Image/config/layer identity, scanner history preflight and actual
nonempty history scans close the Sprint02 CI findings; signed production images
and provenance are still later release work. The table above remains a global
threat-closure checklist, not a denial of these scoped local proofs.

Sprint03-B addendum: `reports/sprint03b-f-security-review.md` independently
accepts the local T05/T17 configuration paths, with actual restricted PostgreSQL,
mutual-TLS JetStream, authenticated HTTPS artifact retrieval, encrypted consumer
restart and authenticated canary ACK/rollback. T02 gains signed cross-tenant
reference and publication HTTP/database isolation negatives. T11 gains config
transport identity/redirect/endpoint tests. T12 gains approved publication role,
MFA/CSRF/idempotency checks. These proofs do not close downstream global threats.
`reports/sprint03b-completion.md` binds local check/scan and hosted results.
The focused maintained-parser69/75 proof preserves T01/T07 NO-GO; bounded raw-H2
and32-connection drain results do not close T08. Maintenance warnings remain
visible. Modules04-12 stay locked and no production edge was implemented.

Production remains blocked until all module gates, the complete quality matrix, security assessment and named human release signoffs have evidence. No entry is closed solely by documentation, compilation, a mocked transport or adding a CI workflow that has never run.
