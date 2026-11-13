# Sprint04-B Execution Contract

User-authorized mission: close Sprint04-A, prepare a human architecture decision,
specify maintained strict-ingress capabilities, classify seven supplemental
failures, preserve Modules00/02/03, and independently review/integrate evidence.

## Sequencing And Ownership

Phase0 merges PR12 only after exact-head hosted jobs, independent security
acceptance, clean source/receipt provenance and complete local gate receipts.
PR12 merged as `cbb5f71db84b9489bf4a6260696bbba29ab4a561`. Wave1 starts from
that exact main only after both merge-commit hosted jobs pass. Refresh remote
state before mutations; newer findings take precedence. Main is unprotected;
that is not an implementation blocker or a security approval.

| Owner | Branch | Owned deliverables |
| --- | --- | --- |
| Root/A | `docs/sprint04b-architecture-decision` | `docs/reports/sprint04b-a-architecture.md`, proposed ADR amendment, security-contract memo and alternative test design |
| B | `research/sprint04b-maintained-ingress` | `docs/reports/sprint04b-b-upstream.md`, additive reproducers/source receipts under `evidence/sprint04b-b/` and `spikes/envoy/sprint04b-*` if needed |
| C | `test/sprint04b-protocol-resilience` | `docs/reports/sprint04b-c-protocol.md`, additive bounded probe suite/receipts under `evidence/sprint04b-c/` and `spikes/envoy/sprint04b-*` |
| D | `hardening/sprint04b-local-reliability` | `docs/reports/sprint04b-d-reliability.md`, own regression/dependency receipts under `evidence/sprint04b-d/`; scoped fixes only for reproduced defects |
| E | `review/sprint04b-security` | independent phase0/A-D/integration reviews and `evidence/sprint04b-e/` |
| Root | `sprint/04b-integration` | reviewed sequential integration, status/risk/ADR coordination, local/hosted gates, closeout/completion receipts |

Use isolated worktrees. Commit source before proof; keep exact source/tree,
argv/cwd/tool versions, UTC times, raw logs, exits and SHA256. Never rewrite
historical receipts or failed attempts. Preserve branches/objects referenced by
retained evidence. Shared PostgreSQL, Compose, proxy and scanner fixtures hold
`/tmp/aegisgate-sprint02-fixtures.lock` throughout setup, use and cleanup.
Use distinct Compose projects and discover their actual network dynamically.

## Research And Decision Scope

The requesting human stated: "you just choice, i approve anything you choice".
Root selects maintained Envoy strict-ingress API research as the default based
on demonstrated integrated TLS/protocol/streaming controls and a precise parser
boundary gap. This authorizes that bounded research choice. It does not supply
a security-qualified runtime, change the origin-byte contract, approve an
architecture substitution or sign a production release. Record formal owner
and architecture/security decision as PENDING where not explicitly supplied.

A reconciles executable proof versus source research for Envoy, Pingora and
Hyper. Compare waiting/contributing to maintained Envoy, maintained Pingora,
maintained Hyper and a separately maintained strict-ingress front end as a NEW
TLS/identity/protocol boundary. For each specify capabilities, ownership,
migration, tests and stop conditions. Analyze separately forbidden forwarding,
new origin connections, origin HEADERS/DATA and all decrypted bytes on existing
H2 connections. Prepare a proposed ADR and separately reviewed alternative test
design; no existing acceptance expectation changes.

B refreshes releases and exact public source APIs before building anything.
Require rejection of folded headers/trailers before normalization, preserved
Host/:authority/verified-SNI identity, TE4xx/actual-close rejection and valid
encoded-target/ordered-pipeline preservation. Separate released APIs, supported
partial hooks, experimental/unreleased patches, missing capabilities and
disproven approaches. Deliver minimal executable reproducers and unpublished
upstream drafts. No private production codec fork. A new version alone is not
a build trigger: first prove relevant changed behavior. If no credible released
fix, stop new candidate work and report upstream NO-GO. Conditional candidate
proof starts with historical failures, then unchanged75 and mandatory controls.

C preserves the historical23-probe manifest/results and investigates exactly
two authority/userinfo deadlines, four missing H2 error-frame observations and
8MiB paused-reader exhaustion. Distinguish proxy behavior, permitted protocol
closure, observer omissions, race/timing and lifecycle ordering. Bound traffic,
memory and observation time. Record TLS identity, raw requests, H2 state,
origin bytes/handlers/connections and deadlines. Distinguish application and
transport buffering/window updates from memory/backpressure. Retain uncertain
failures. Independently verify WebSocket/gRPC streaming and cancellation.
Observer improvements cannot grant a security PASS.

D verifies recovery/prune/archive/drain/encrypted rollback regressions on new
main, plus fixture credentials/stale volumes/image identity/lock lifetime and
dynamic Compose networking. The external generation-floor provisioning API
is not an implemented production monotonic storage service. Verify supported
TypeScript/dashboard stack and whether a released typescript-eslint explicitly
supports TypeScript7; retain compatible pins/minimatch override/scanners unless
a separately reviewed change has evidence. Do not implement Module10.

## Review And Integration

E independently reviews A's contracts and proposed alternative tests, verifies
B against exact upstream revisions, inspects C raw observations and unchanged
expectations, and checks D rollback/tenant/fixture behavior. Independently
reproduce any eligible candidate. Verify original75 case IDs/raw input/expected
hashes unchanged and inspect origin/parser/transport counters. Publish scoped
ACCEPT/REJECT for exact commits. Root integrates accepted content only and runs
full `make check` and `make security-scan` under the fixture lock, with cleanup.
Both hosted jobs must pass on the exact final integration head and main merge.

No production deployment/public listener, live DNS, external abuse/load tests
or upstream publication. The six Envoy failures and zero-byte assertion remain
mandatory. Nine H2 bytes `000000040100000000` are a SETTINGS ACK on an existing
valid connection; they still FAIL the current contract. No subtraction,
observation delay or expected-result change may manufacture success. Historical
Pingora63/75, Envoy69/75, Hyper70/75 and supplemental16/23 remain evidence, not GO.

Module01 remains NO-GO until complete protocol/TLS/cancellation/pooling/config
and security/resource proof, maintenance and independent reviews, and recorded
affirmative human architecture approval.75/75 alone is insufficient.
Modules04-12 remain LOCKED; production BLOCKED. No Module04 implementation.

Completion report must bind PR12 merge/main CI; exact ownership/commits/PRs;
architecture owner/decision; upstream capabilities; unchanged75/failure IDs;
seven supplemental dispositions; origin/H2 raw observations;00/02/03 and
dependency regressions; independent review; local/hosted gates; module matrix;
and exact technical resume conditions. Honest upstream NO-GO can close the
research sprint with concrete decision and remediation handoff.
