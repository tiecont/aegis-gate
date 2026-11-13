# Implementation risk register

This register tracks residual implementation and release risks. It does not accept risks on behalf of a human reviewer. The current module states and actual executed evidence are recorded in `IMPLEMENTATION_STATUS.md`; T01–T20 mappings are maintained in `docs/SECURITY_COVERAGE.md`.

## Sprint04-B Disposition

PR12 is merged at `cbb5f71db84b9489bf4a6260696bbba29ab4a561`; both required
jobs pass on its exact PR head and merge commit. The additive Sprint04-A
closeout and independent Phase0 review bind retained source/evidence hashes,
local gates and historical failures. Main protection absence did not waive
review/CI requirements. No production risk is accepted by that merge.

R01/R04 remain blocking. Root selects maintained Envoy strict-ingress API
research under session delegation, with no engine substitution. Formal human
architecture/security ownership and affirmative GO remain PENDING. ADR012 and
the separate security-contract/alternative-test memos are proposed only: no
origin-byte waiver, handler-only oracle, control-byte subtraction or shifted
interval. The9-byte SETTINGS ACK remains a failed original assertion.

B refreshes exact released Envoy1.40.2/Pingora0.9.1/Hyper1.12.0 sources and finds
no relevant released change. Standalone folded headers still normalize/forward;
trailer delivery and status-only TE mapping remain unproven. Invalid early byte
observations and startup cleanup failure are explicitly retained and excluded
from security claims. No new complete candidate or public upstream request.

R04/T08 protocol-resource closure remains unproven. C reproduces the same six
of75 and seven of23 failures. Settled/immediate malformed H2 diagnostics close
without error frames and without origin dispatch; their exact internal cause
and protocol conformance remain unresolved. Userinfo closes without a response;
native code8 after socket close is not proof of peer-sent CANCEL.8MiB producer
exhaustion is retained; larger producer/window/RSS observations do not prove
production memory bounds or fairness. Unavailable native socket taps and
already-completed origin cancellation are explicitly corrected, not relabeled
as silent-wire or successful cancellation evidence.

R03/R10/R12: fresh D00/02/03 local regressions and independent A/D acceptance
preserve prune/archive/tenant/drain/encrypted rollback protections. External
floor remains a provisioning API; no production monotonic storage service or
engine stream drain exists. Corrected fixture recorder omits rendered Compose
credentials. The initial uncommitted rendered output was removed; that attempt
is explicitly ineligible and only fresh corrected-source proof is accepted.
Historical missing-output hashes remain for transparency, without secrets.

R15: fresh strict TypeScript7 resolution still fails the declared parser peer
range. Existing compatible stack, minimatch override and scanners are unchanged.
R13 full final integration scan/hosted receipts are recorded in Sprint04-B
completion after execution; component scans alone do not supply that gate.
Full locked local integration check/scan/cleanup passes at0cf24f4; independent
source/receipt/scanner acceptance is213416c. Exact final-head/main hosted
verification is a separate merge requirement recorded by PR13 and addenda.
Module01 NO-GO,04-12 LOCKED, production BLOCKED; no risk exception recorded.

## Sprint04-A disposition

R01/R04 remain blocking. Inspected Envoy1.40.2 Balsa source irreversibly removes
folding syntax before public validator callbacks; no supported strict
pre-normalization hook was found. A and C independently pin this missing API.
Host retention and local reply mapping are partial capabilities, not a complete
candidate. The maintained Pingora/Hyper paths also still lose required original
target/framing distinctions. No private parser fork or replacement is approved.

B's fresh unchanged/diagnostic runs reproduce69/75. The nine origin bytes are
SETTINGS ACK `000000040100000000` on an existing valid H2 connection, with zero
handlers. They still fail the unchanged zero-byte contract. Obsolete folding
reaches origin (263 bytes, one handler); four TE cases return501 instead of the
required rejection response. Seven of23 additional bounded probes fail: two
authority/userinfo deadlines, four missing error-frame observations and one
paused-reader buffering assertion. These do not establish exhaustive H2 or
production resource safety. Earlier68/75 weighted-health and incomplete attempts
remain retained, not waived. Reports `sprint04a-a-envoy.md`,
`sprint04a-b-origin-boundary.md` and `sprint04a-c-upstream.md` bind these limits.

R15: the existing dashboard set resolves and passes strict-peer install and
dashboard acceptance; no manifest/lock/override change is justified. The failed
Dependabot TypeScript7.0.2 update needs a maintained typescript-eslint release
whose declared peer range includes7; current8.72.2 excludes it. A forced install
or scanner exception is not a repair. The minimatch11.0.7 override is preserved.
PR11's go-jose4.1.9 upgrade is already merged. See `sprint04a-d-dependencies.md`.

R03/R10/R12 retain production secret custody, authenticated monotonic anchor,
HA/backup/restore, certificate lifecycle and measured stream/revocation/drain
obligations. Local recovery work cannot accept these production risks. Final
review/integration evidence and the unchanged gate matrix are in
`reports/sprint04a-completion.md`; proposed human action is in
`reports/sprint04a-architecture-decision.md`. Module01 stays NO-GO,04-12 locked,
00/02/03 PASS local and production BLOCKED. No risk acceptance is recorded.

Independent E accepts bounded local consumer drain and durable-reference orphan
pruning plus six recovery regressions. Full locked check/scan at2133b63 pass.
The external floor remains authenticated provisioning, not an implemented
monotonic service. Drain cannot recall copied configuration or cancel engine
I/O. Archive coverage and external reservations require operator coordination.
R16: integration exposed old default-project credentials and a hardcoded Docker
network; dedicated disposable root volumes and structured Compose network
resolution repair the local test path. Hosted observer units also exposed a
missing CI lock; workflow now holds it through setup/check/cleanup and scanning.
Failed attempts remain evidence. No production operational risk is closed by this.

## Sprint03-B disposition

R03 is closed for the Module03 local acceptance scope: canonical Ed25519
envelopes, pinned authenticated trust rotation, durable approved outbox,
authenticated artifact fetch/admission, tenant/policy validation, immutable
atomic activation, encrypted LKG, canary/ACK/health, signed newer-generation
rollback and outage/restart negatives pass independent review and integration.
See `reports/sprint03b-completion.md` and `sprint03b-f-security-review.md`.
This supersedes the original R03 absence-of-implementation entry below.

R01/R04 remain blocking. The focused maintained Envoy setting reproduces69/75
with unchanged inputs/expectations and origin byte assertions. Obsolete folding
still reaches origin; H2 authority confusion still sends nine decrypted bytes;
four TE rejection statuses violate the contract. Three additional raw-H2 probes
and bounded drain do not prove exhaustive conformance. A maintained released
strict-parser path and complete proof, followed by human architecture approval,
are required. Pingora `derivative`/`unsafe-libyaml` warnings remain open.

R13/R14 have actual integrated check/scan and hosted evidence. New Go compression
and crypto advisories were fixed, with no suppression; scanners inspected106
history commits and12.03MB of worktree inputs at `da3598c`. PR10 binds final-head
checks. This is time-bound local evidence, not release provenance or risk acceptance.

Residual Module03 release work has explicit owners: platform/security must
provide production secret-service signing and authenticated trust/cache-key
custody; operators must assemble authenticated edge delivery, archive/cleanup
with durable-reference checks, and test HA/backup/restore; the future edge owner
must prove bounded stream drain and emergency revocation. Local storage enforces
quota and manual safe deletion, not automatic artifact garbage collection.
Disconnected consumers fail readiness at signed expiry, retired trust, expired
ownership or configured staleness; instant revocation during disconnection is
not promised. Modules04-12 remain locked and production remains blocked.

## Sprint 02 disposition

PRs1-7 have been independently reviewed and merged after exact-head hosted
foundation/supply-chain jobs passed. Image metadata/layer binding and empty Git
history acceptance are repaired; root repeats substitution and nonempty-history
proofs. Public-origin special-purpose ranges now reject with public controls.
Module02 independent local security review and final integrated check/scan pass;
M1-ADMIN-TENANCY is accepted for local scope. Commands and limits are tracked
in `reports/sprint02-d-integration.md`. Task03 prerequisites are satisfied for a
future scoped wave; its gate is not passed and module04 remains locked.

Module01 remains NO-GO: root rebuild reproduces57/65 with eight strict-ingress
failures. `derivative` and `unsafe-libyaml` warnings remain open, with no ignore
or accepted exception. Human architecture selection/review remains required;
the evidence-only PR5 merge does not authorize replacement. Branch protection,
professional assessment, provenance/signing and human release signoffs remain
production obligations; Git autonomy does not satisfy those release controls.

## Sprint 02 initial findings (historical)

- Supply-chain recovery: baseline hosted Actions run42957348129 fails two image
  identity steps with `KeyError: 'digest'`. Historical local scan success does
  not close hosted acceptance. Exact-fix local and hosted checks are pending.
- Origin registration: root negative tests show baseline `PublicAddress`
  accepts additional special-purpose/non-public ranges including IPv6 site-local
  `fec0::/10`. Agent C remediation and independent regression verification are
  pending. Module02 remains closed; no edge/dial-time SSRF protection is claimed.
- Release controls: GitHub branch-protection API reports `main` is not
  protected (HTTP404). The quality gate requires branch protection and reviewer
  approval; no settings were changed and no release approval is implied.
- Parser feasibility: the strict malformed-target criterion remains failed;
  expanded tests and maintained-upstream evaluation are in progress. No
  architecture substitution or requirement relaxation has been approved.

Evidence and review status: `reports/sprint02-d-integration.md`.

Foundation update, 2026-11-11: module00 local implementation/review passed.
R00, R13 and R14 have foundation evidence in `reports/00-security-review.md`;
their continuing release obligations remain open. The pending language in the
initial risk table below records the original baseline and is superseded for
module00 only. Modules01/02 are in progress; all later gates remain closed.

| ID  | Risk / current limitation                                                                                                                           | Required closure evidence                                                                                                                                                                           | Gate / status                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| R00 | Foundation surfaces can build while the product remains unavailable. Liveness could be mistaken for customer readiness.                             | Retain explicit 503/unready/offline behavior; keep documentation and negative tests aligned.                                                                                                        | 00 review pending; no production readiness claim.                                                                    |
| R01 | Pingora capability and maintenance feasibility are unproven.                                                                                        | Dynamic tenant SNI, hot rotation preserving active sessions, HTTP/1.1/2, WS, streaming gRPC/cancellation/trailers, strict TLS, parser negatives and controlled benchmark with explicit Go/No-Go.    | 01 required; 04/05 blocked until accepted.                                                                           |
| R02 | No durable tenant management, membership authorization or OIDC/session implementation exists yet.                                                   | Two-tenant list/item/mutation/background-job BOLA matrix, roles, revoked/expired sessions, ownership proof and transactional constraints.                                                           | 02 required; tenant isolation NOT PROVEN.                                                                            |
| R03 | No authenticated signed snapshot lifecycle, LKG or revocation delivery exists yet.                                                                  | Canonical envelope, hash/signature/trust rotation, schema bounds, cross-tenant references, replay/stale negatives, ACK/NACK/canary/rollback/outage evidence.                                        | 03 required; error-schema acceptance is not snapshot trust.                                                          |
| R04 | No actual proxy routing, SSRF dial guard, safe retries, framing/stream/body limits or origin TLS enforcement exists yet.                            | Tenant Host/SNI binding, private/metadata/IPv6/mapped/rebind negatives, maintained parser corpus, timeout/cancellation/backpressure and verified upstream tests.                                    | 04 plus 01/11 required.                                                                                              |
| R05 | Disposable lab PKI is not a managed customer certificate lifecycle.                                                                                 | Verified domain ownership, ACME staging issuance/renewal, restricted certificate delivery and audited rotation, expiry and revocation alarms.                                                                      | 05 required; fixture CA must never be trusted in production.                                                         |
| R06 | Dummy JWT fixture keys do not provide production authentication.                                                                                    | Vetted JWT/API-key implementation with algorithm/issuer/audience/time/key binding, bounded JWKS rotation/outage behavior, RBAC and fail-closed negatives.                                           | 06 plus 02/11 required.                                                                                              |
| R07 | Redis availability is not rate-limit correctness or L3/L4 protection.                                                                               | Layered finite budgets, fairness, conservative local outage fallback and alarm, upstream provider architecture and controlled lab overload tests.                                                   | 07 required; no volumetric mitigation claim.                                                                         |
| R08 | No telemetry data minimization, durable usage ledger or billing reconciliation exists yet.                                                          | Secret-sentinel redaction and access matrix, bounded metric cardinality, durable event IDs/dedupe, reconciliation and retention review.                                                             | 08 required.                                                                                                         |
| R09 | Static dashboard is public and has no tenant session or data. CSP currently permits inline Next.js bootstrap.                                       | Module 09 authenticated resource/mutation isolation, CSRF/session policies, private caching, nonce/hash CSP and billing webhook/idempotency negatives.                                              | 09 required before customer UI; current inline policy limited to static local page.                                  |
| R10 | Dedicated local bridge and loopback ports do not prove production segregation/HA. Redis/demo origin use host UID; lab egress is ordinary bridge egress. | Reviewed non-root production workload identity, secret custody, network policies, protected L4 ingress, redundant failure domains, signed images, least privilege and operational runbooks.         | 10 required; Compose is local-only.                                                                                  |
| R11 | Foundation test subsets cannot close the entire threat model.                                                                                       | Threat-driven fuzz/negative matrix across real integrated paths, secret review, supply-chain policy and professional security assessment.                                                           | 11 required; T01–T20 remain open until actual evidence.                                                              |
| R12 | Performance/SLO, backup/restore, HA/outage/soak and operator readiness are unmeasured.                                                              | Declared workload/hardware benchmark, 30-minute steady state and 2-hour launch soak, failure/rollback/restore drills, named owners and human release checklist.                                     | 12 required; no public/production deployment authorized.                                                             |
| R13 | Scanner workflow declarations are not executed supply-chain evidence.                                                                               | Run secret/SCA/image scans and SBOM generation; record exact output, database freshness, findings, remediation and approved exceptions. Network/tool failure must fail visibly.                     | 00 baseline review pending; 10/11/12 release gates remain.                                                           |
| R14 | Cross-language contracts can drift or accept inconsistent input.                                                                                    | Single OpenAPI source, deterministic generation and checked-in outputs, conservative baseline comparison, malformed/unknown-field/UUID/control-character vectors and producer→consumer integration. | 00 review pending; recheck after every contract change.                                                              |
| R15 | Security overrides can drift from upstream dependency compatibility.                                                                                | Dashboard minimatch 11.0.7 dev override is documented and lint/build/integration tested; retain audit checks and remove only after upstream pins patched releases.                                  | Dashboard audit reported zero vulnerabilities on 2026-11-11; this is not an all-repository scan or future guarantee. |
| R16 | Local fixtures expire and may leave persisted dependency volumes or credentials between runs.                                                       | Regenerate disposable files deliberately after teardown; never overwrite keys silently; test strict modes and ignore rules. Review local-volume lifecycle when rotating credentials.                | Development limitation; no credential or volume reuse across environments.                                           |

No human owner, external assessment, risk exception, release signoff or production activation is recorded by this register. Critical/high findings must be closed or explicitly accepted through the release process; ordinary implementation work continues within the authorized scope without weakening gates.

## Module01/02 checkpoint update

The initial table is a historical baseline. R01 now has actual protocol/TLS
evidence but a reproducible No-Go: 34/35 local cases, malformed raw-space target
accepted by Pingora0.9.1. ADR-011 and `reports/01-root-security-review.md` retain
the failure and alternatives. Two unmaintained dependencies remain undisposed;
no warning exception or architecture replacement is accepted.

R02/R14 now have PostgreSQL-backed management APIs and actual OIDC-PKCE/TLS,
HTTP tenant isolation, job/revision/CSRF/revocation and OpenAPI response evidence.
The gate remains partial: OriginPool/Endpoint, least-privilege DB roles,
all-state quotas/retention, full audit/IdP/DNS lifecycle and final independent
review remain required in `reports/02-management-checkpoint.md`.

R13: patched full check and security scan passed. A newly added go-jose4.1.4
HIGH advisory missed by govulncheck was caught by the independent filesystem
scanner and repaired with4.1.6. Keep both scanners; no future scanner/database
state is guaranteed by this result. All production gates remain open risks.

## Sprint03-A architecture evidence

R02/R14 have Sprint02 full local Module02 acceptance and independent review:
`reports/sprint02-d-security-review.md` and `sprint02-d-integration.md` supersede
the earlier partial checkpoint above. Production control-plane operations and
the downstream config/data-plane trust boundaries remain separate obligations.

R01/R04 remain blocking: the common75-case executable comparison currently
reports Pingora63/75, Envoy69/75 and Hyper70/75. All three fail mandatory
security properties, so no weighted comparison or green foundation CI can
grant GO. The proposed decision package is
`reports/sprint03a-architecture-decision.md`; independent final observer review
`ed8d48d` reproduces every failure. Combined local check/scan and reviewed-head
hosted run42992622282 pass; final-head checks/merge are recorded by PR9 and
remain required before integration. All original65 cases and
eight Pingora failures remain enabled, plus ten common supplemental cases.

Pingora rewrites malformed targets before proxy filters. Envoy still forwards
obs-fold and accepts an H2 authority-confusion vector; four TE cases safely
stop before origin but violate the required rejection-response contract.
Hyper removes CL/TE ambiguity and fragments before semantic policy checks.
These are bounded project-policy failures, not proof of an upstream exploit
or cross-tenant compromise. No alternative is authorized for production.

R13 includes the isolated Hyper/Pingora lockfiles, lab Node dependencies and
pinned Envoy candidate image in the common scanner. The two Pingora maintenance
warnings remain open without ignores or accepted exceptions. Candidate-image
scan success does not prove ingress correctness. Intermediate invalid runs
are retained and cannot serve as release evidence. R03/config trust, R05/TLS
lifecycle and all production release obligations remain open.

The native H2 byte-accounting defect is fixed with a bounded verified TLS
observer and independent reruns. The relay observes byte lengths without
parsing frames; exhaustive raw H2 framing/conformance, saturation, slow-reader
fairness and production drain are still unproven. Whole-case invalid-origin-TLS
counters include a successful recovery request; negative-interval assertions
separately require zero handlers and decrypted bytes. See the independent
observer follow-up for exact counters and limitations.
