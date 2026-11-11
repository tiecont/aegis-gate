# Threat evidence tracker

This tracker records evidence, not security certification. The threat register in `THREAT_MODEL.md` remains authoritative. A foundation test proves only the foundation behavior it exercises; it does not establish tenant isolation, safe proxying or production readiness.

| Threat | Required proving module(s) | Current evidence / gate |
|---|---|---|
| T01 Host/SNI and domain takeover | 01, 02, 04, 05, 11 | NOT PROVEN: verified ownership, global uniqueness, canonical authority and mismatched SNI/Host rejection needed. |
| T02 Cross-tenant BOLA | 02, 03, 04, 08, 09, 11 | NOT PROVEN: two-tenant single/list/mutation/job/analytics/billing integration matrix needed. |
| T03 SSRF / DNS rebinding | 02, 04, 06, 11 | NOT PROVEN: concrete dial destination and IPv4/v6/mapped/metadata/redirect/rebind matrix needed. |
| T04 Token confusion | 06, 11 | NOT PROVEN: vetted JWT, alg/key/iss/aud/time/kid and JWKS outage tests needed. A dummy fixture issuer is not deployed authentication. |
| T05 Config tamper/replay | 03, 11 | NOT PROVEN: actual signature, hash, monotonicity, authenticated transport and LKG tests needed. Schema validity alone is insufficient. |
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
| T17 Config races | 01 spike, 03, 04, 11 | NOT PROVEN: request captures immutable generation, actual concurrent swap/rollout tests needed. |
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

Production remains blocked until all module gates, the complete quality matrix, security assessment and named human release signoffs have evidence. No entry is closed solely by documentation, compilation, a mocked transport or adding a CI workflow that has never run.
