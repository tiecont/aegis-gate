# Sprint04-B Completion And Handoff

Status: execution in progress. Module01 **NO-GO**, Modules04-12 **LOCKED**,
production **BLOCKED**. This record is updated only from actual receipts.

## PR12 Closure

PR12 merged at main `cbb5f71db84b9489bf4a6260696bbba29ab4a561`. Exact reviewed
PR head `219cfa7676976772644bcdc8aad9c4d01ee8beca` passed both required jobs in
hosted43457905154. Both jobs passed on the merge in43466312855. Fresh independent
Phase0 ACCEPT and the unchanged passing local check/scan/cleanup source are
bound in [the additive closeout](sprint04a-closeout-addendum.md). Earlier failed
local/hosted attempts and historical manifests remain preserved. All Wave1
branches start from this verified new main.

## Ownership And Architecture

Root selected maintained Envoy strict-ingress API research under the requesting
human's session authorization: "you just choice, i approve anything you choice".
This selects research, not an engine substitution, contract waiver or technical
GO. Formal human architecture/security owner and approval reference remain
**PENDING / not supplied**. The decision package is prepared by root as Agent A
on `docs/sprint04b-architecture-decision`; independent review is required.

| Owner | Branch | Scope / current source |
| --- | --- | --- |
| A / root | `docs/sprint04b-architecture-decision` | source9378c8f, receipt3348ca0; architecture alternatives, proposed ADR012, contract memo and separate alternative test design |
| B | `research/sprint04b-maintained-ingress` | released API refresh, minimal reproducers, unpublished upstream requirements; execution underway |
| C | `test/sprint04b-protocol-resilience` | `71a3dc6381223d54fa8b23ecf84ff205e0b52ea6`; unchanged baseline and bounded lifecycle/resource evidence, E ACCEPT |
| D | `hardening/sprint04b-local-reliability` | `ab4e1f642e2bcbac1723d156390cc1cbebdad157`;00/02/03, fixture and dashboard regression, E ACCEPT |
| E | `review/sprint04b-security` | Phase0 accepted at3d2d056; A/D reviewfb23460 and C review8ca7e4f; B/integration review to follow |
| Root | `sprint/04b-integration` | exact-source accepted integration and final local/hosted gates to follow |

## Gate Matrix

| Gate | State |
| --- | --- |
|00 | PASS local, D regressions independently accepted |
|01 | NO-GO; no eligible maintained released strict-ingress candidate |
|02 | PASS local, D regressions independently accepted |
|03 | PASS local, D regressions independently accepted |
|04-12 | LOCKED |
| Production | BLOCKED |

No result is inferred from the count alone. Historical Pingora63/75,
Envoy69/75 and Hyper70/75, the six mandatory Envoy failures and all seven
supplemental failures remain unchanged until separately documented observations
are available. Nine H2 bytes remain a failed zero-byte assertion, regardless
of their SETTINGS ACK classification on a previously valid reused connection.

## Remaining Closeout Work

## Current75 And Supplemental Evidence

C's fresh unchanged run is69/75, evaluator exit1. Persistent mandatory IDs:
`malformed-HTTP-invalid-transfer-encoding`,
`malformed-HTTP-obsolete-folded-header`, `strict-ingress-TE-repeated-chunked`,
`strict-ingress-TE-not-final-chunked`,
`supplemental-repeated-transfer-encoding-fields`, and
`HTTP2-authority-Host-and-SNI-confusion-rejected`. Four TE vectors return501;
folding sends263 decrypted bytes/one handler; H2 sends9 bytes/zero handlers.
Original input/expected/case hashes and every failure remain unchanged.

| Seven supplemental failures | Reproducible disposition |
| --- | --- |
| Combined three-authority negatives and individual userinfo denial (two) | Peer socket closes around1s, no response; Node stream code8 follows closure. Raw client sees no peer RST/GOAWAY. Original deadlines remain FAIL; peer-CANCEL/conforming rejection unproven. |
| HEADERS stream0, zero WINDOW_UPDATE, uppercase name, connection header (four) | Both immediate and SETTINGS-settled inputs close around1s without error frames; origin connections/bytes/handlers/errors0. Observer setup traffic differs but does not recover error frames. Actual internal cause/conformance unresolved; all FAIL retained. |
| Native paused-reader8MiB (one) | Entire8MiB produced/received at origin relay; origin completed before cancel. Original FAIL retained.32MiB control stalls around16MiB upstream DATA with client stream window0; RSS/window/write counts are distinct bounded samples, not a production memory/fairness proof. |

Seventeen additive diagnostics complete twice with
`semantic_security_pass=false`. Native Node socket tap is unavailable, not
wire silence. Corrected8MiB cancellation is null/unproven; first erroneous
negative-latency observation stays historical. Incomplete32MiB and upload
cancellation reach origin with actual RST_STREAM2; downstream CANCEL8 wire
propagation is not claimed. Independent WS two-message close1000, gRPC
streaming/trailers/cancel and three relay transparency/negative tests pass.
All raw bytes, frames, TLS identities, lifecycle and bounded counters are in
`evidence/sprint04b-c/`; exact report is `sprint04b-c-protocol.md`.

## Local Reliability And Dependencies

D eligible proof source54e7ea06, attempt03:11 Go packages,88 tests and151
subtests, no skips. Six recovery cases cover encrypted full-state rollback,
signer outage/staged retry, captured-generation drain, disconnected expiry,
durable-reference prune and archived-audit recovery. Actual tenant/RBAC/TLS/
transactional publication/ACK/rollback negatives pass. Dynamic isolated Compose
network, credential/stale-volume/image identity and complete lock/cleanup
controls pass, as do dashboard/contracts/edge builds/tests and npm audits0.
No product/dependency changes were needed. Independent E recovery rerun and
source/receipt/security review ACCEPT; report `sprint04b-e-ad-review.md`.

The external generation floor is a provisioning interface, not a production
monotonic storage service; drain cannot recall copied values/cancel engine I/O.
Archive custody and external references remain operator responsibilities.
TypeScript7 strict resolution still exits1/ERESOLVE against released
typescript-eslint8.72.2 `>=4.8.4 <6.1.0`; supported6.0.3 tree and minimatch11.0.7
override remain unchanged. No peer forcing/advisory ignore/security waiver.

Retained D attempt01 fails incompatible system Go preflight; official cached
Go1.27.4 works. Attempt02 runtime completes but rendered Compose output was
removed before commit and its evidence is explicitly ineligible. Safe REDACTION
and original missing-output hash remain; fresh corrected-source03 supplies
eligible proof. Independent E confirms the removed path never entered reachable
Git history and checks private credential matches without logging values.

## Independent Review And Next Trigger

E ACCEPTs A3348ca0 as proposed design only, Dab4e1f6 as local evidence (only03
eligible), and C71a3dc6 as diagnostic classification only. Their raw source/
receipt/immutable hashes and scoped offline scans verify; independent recovery
and three relay tests pass. These verdicts do not activate ADR012, appoint a
human owner or waive any failed original assertion.

Next executable sprint trigger: a maintained released strict parser capability
with exact provenance and demonstrated change in the historical failing cases.
Then targeted failures, unchanged75, complete TLS/identity/stream/cancellation/
pool/config/resource proof, maintenance review, independent reproduction,
local/hosted gates and recorded affirmative human architecture approval.
Without that trigger, stop candidate builds and retain the upstream dependency.

## Remaining Closeout Work

Finalize B upstream/source/API/reproducer receipts and independent acceptance,
root full locked checks/scans/cleanup,
and exact integration-head/main hosted jobs. Record all raw origin/H2 counters,
current75 failure IDs, actual implementation changes and future resume trigger.
No Module04 implementation or production action is permitted by this record.
