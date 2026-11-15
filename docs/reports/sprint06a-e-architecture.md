# Sprint06A E: Decision-Ready Finite Ingress Direction

Status: proposed decision package complete, not effective and not architecture
approval. Baseline8929adfd10f245ec0dac70b5304f1a2b445e7357. Branch
`docs/sprint06a-architecture-resolution`, exclusive proposed documents only.
Human architecture/security owners, approval reference and date remain PENDING.

## Recommendation And Actual Proof

One preferred next implementation direction is a strict finite-message H1
component with maintained incremental parsing, complete framing/trailer
validation, authenticated encrypted staging and finite resource reservations.
Verified TLS/SNI, tenant, signed route/policy/origin and generation must eventually
be captured inside one reviewed admission boundary. Streaming, WS and gRPC stay
disabled in this limited research component. They are not silently proxied by a
second stack or relabeled buffered streaming.

The consolidated record is
`docs/ADR-012-sprint06a-finite-ingress-proposed.md`, source27cdf2c. Its additive
inactive suite is `docs/contracts/sprint06a-finite-admission-research-v1.json`,
versionAEGISGATE_FINITE_ADMISSION_RESEARCH_V1. It separates effective original
requirements, executed limited research, and proposed future acceptance changes.
Neither replaces ADR012/v2 or the authoritative original75/23.

| Evidence input | Executed finding used, not inferred acceptance |
| --- | --- |
|05C/05D common prefix and staged proof | Early CL10/abc forwarding can later become EOF-invalid; late-folded trailers similarly invalidate an already-forwarded prefix. Complete finite staging prevents those tested effects and fails early-origin streaming positives |
|06A A source5ca4e3a / runtime817d59a | Actual network-none container controls, finite encrypted-stage faults/restart and hard TCP-reset queued cancellation; scoped67 controls, mandatory streaming still FAIL; independent F acceptance required |
|06A B source260dc7f | Same Module03 trust/consumer signs and captures a bound experimental finite profile;6/42 new race and46/90 normal03 tests pass. Multi-hop fixture captures after staging, not one complete production trust boundary |
|06A C final0bce723 | Official Envoy1.40.2, llhttp9.4.4, Go1.27.4 and x/net0.62.0 remain unchanged; exact public API requirements and locally runnable maintainer package, no new full comparison |
|06A D69a3be8 | Old false consistency plus new omitted/aliased header attacks corrected in bounded wrapper, fresh ACK9 bytes remain aggregateFAIL; authoritative runtime instrumentation still INCOMPLETE |
|Independent F | Exact-source review owns final ACCEPT/REJECT; package publication does not assume acceptance or gateway GO |

Actual component receipts/reports retain source/tree, commands, failures and
hashes. E supplies no extra parser/codec comparison or invented performance data.
The precise design contradiction and current protocol failures stay visible.

## Executable Additive Suite Map

- Finite safety/resource: `scripts/sprint06a-a-container.mjs` and A's own runner/
  verifier report specify exact commands, finite negatives, cgroups and cleanup.
- Signed policy: `scripts/sprint06a-b-run.mjs`, explicit feasibility build tag,
  actual Module03 consumer/trust/lease tests and fixture-only JWT/TLS integration.
- Attribution: `scripts/sprint06a-d-proof.mjs`, unchanged05C/05D and independent F
  overlays plus06A wrapper challenges; output must retain RuntimePass=false.
- Existing authority: `scripts/sprint05b-baseline.mjs` verifies all11 protected
  files and retained73/75,19/23. Those scores do not become profile PASS counts.

The proposed machine-readable suite declares20 control groups and explicit
unsupported capabilities. It is not itself an evaluator or evidence of passing
all groups in a combined runtime. New profile activation needs reviewed executable
assertions and integrated end-to-end proof beside unchanged original acceptance.

## Consequences And Unresolved Dependencies

Staging adds full-upload latency, finite upload/deadline policy, global disk/file
quotas and availability pressure. Ephemeral keys mean crash deletion, not durable
resume. Process buffers cannot prove hardware erasure. Lab host PID visibility
for flock is not a production namespace design. Global quotas do not prove tenant
fairness. Responses lost after origin replay require idempotency policy, not
automatic retries. Per-tenant resource reservations, egress/DNS/SSRF enforcement,
JWKS/auth lifecycle, origin pool trust epochs, signed pre-stage capture and full
H2/WS/gRPC/cancellation/drain remain explicit complete-runtime prerequisites.

The consolidated threat matrix compares aggregate bytes with causal attribution
for hidden HEADERS/DATA/HPACK effects, dials without handlers, independent controls,
capture loss, malicious signer omission and concurrent traffic. A causal H2
control exception cannot excuse late-invalid H1 body effects. Signed post-capture
summaries cannot establish authoritative pre-wire coverage.

Exact upstream requests are C1 strict header/trailer wire rejection, C2 safe
pre-reset400/421, C3 error serialization-before-close without CONTINUATION
regression, and C4 authenticated complete effect/coverage API. No release change
means no new equivalent feasibility comparison. Publication remains unauthorized.

## Decision And Migration Boundary

Autonomous work may harden finite tooling, signed adapters, independent attacks
and maintainer packages. Formal architecture/security decisions are required for
product-supported finite limits/custody/profile schema, any streaming irreversible-
effect semantics, causal H2 exceptions, a new production trust boundary and gate
migration. Owner fields remain PENDING until actually supplied.

Migration is inactive. Future approved canary/rollback must bind authenticated
profile and exact snapshot digest/generation, preserve monotonic floors and
captured leases, retain original evidence, and deny missing/unknown/stale policy
instead of falling back to streaming or weaker auth. Rollback uses a newer signed
generation. Crashed/uncertain requests are never automatically replayed.

## Agent Completion Report

- Module/status:01/E, complete proposed decision package; no runtime acceptance.
- Files/commits:27cdf2c proposed consolidated ADR and inactive JSON suite; this report.
- Architecture/contract decision: preferred finite research direction only;
  effective contract and accepted snapshot v1 unchanged.
- Checks: JSON syntax/control inventory and scoped whitespace reviewed by root;
  executed runtime evidence belongs to A-D/F, not an E execution claim.
- Security/operational risks: staging costs, late-invalid streaming, extra trust
  hops and incomplete instrumentation remain explicit; no accepted downgrade.
- Human review: exact named owner/version/approval fields PENDING; independent
  F downgrade/claims review required before root integration.
- Next action: finish independent A/B/D proof and root gates; wider gateway work
  requires coherent supported unified architecture or a formally approved
  versioned alternative contract. Module01 NO-GO;04-12 LOCKED;production BLOCKED.
