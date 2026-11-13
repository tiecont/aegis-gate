# Sprint04-B Completion And Handoff

Status: Sprint04-B research/evidence closeout complete; PR13 merged with both
exact-head/main hosted jobs PASS. Module01 **NO-GO**, Modules04-12 **LOCKED**,
production **BLOCKED**. This record is updated only from actual receipts.

Final observed integration merge is `826656f2469ae225a1617438fbb4b3b3a454cc98`.
[The additive closeout receipt](sprint04b-closeout-addendum.md) supersedes
checkpoint pending fields and binds exact source/CI without a self-hash claim.
Formal human architecture/security ownership and decision remain PENDING.

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
on `docs/sprint04b-architecture-decision`; E independently accepts it as a proposal.

| Owner | Branch | Scope / current source |
| --- | --- | --- |
| A / root | `docs/sprint04b-architecture-decision` | source9378c8f, receipt3348ca0; architecture alternatives, proposed ADR012, contract memo and separate alternative test design |
| B | `research/sprint04b-maintained-ingress` | `5de81795963d07486d0621822131d4e1554ccadc`; released API refresh and minimal reproducers complete, E ACCEPT research/failed evidence only |
| C | `test/sprint04b-protocol-resilience` | `71a3dc6381223d54fa8b23ecf84ff205e0b52ea6`; unchanged baseline and bounded lifecycle/resource evidence, E ACCEPT |
| D | `hardening/sprint04b-local-reliability` | `ab4e1f642e2bcbac1723d156390cc1cbebdad157`;00/02/03, fixture and dashboard regression, E ACCEPT |
| E | `review/sprint04b-security` | Phase0 accepted at3d2d056; A/D reviewfb23460, C review8ca7e4f, B/helper reviewa48ad72; integration/local-gate ACCEPT213416c |
| Root | `sprint/04b-integration` | clean full local proof `0cf24f494001711bfb87695536db20732dcb7b1a`; final hosted gates to follow |

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

## Maintained Upstream Resolution

Fresh released-source/API collection is unchanged: Envoy1.40.2
`b2d89e0ae53916f28770771fbdd49c5c99c5c5a2`, Pingora0.9.1
`f86ffda5d3ae5c3baf5125682138b33b26c01b08`, Hyper1.12.0
`7f67699ce32d717081deb7018b4da7d679277ac0`. All16 overlapping inspected
released files match Sprint04-A. Default-branch snapshots are unreleased source
research. No complete supported strict-fold/target/framing path was established;
there is no trigger for a rebuilt/full candidate. Public Envoy Host retention
and local-reply mapping remain partial APIs, with no new passing identity or
TE4xx proof. Exact paths, hashes, version receipts, missing-capability/API
specifications and unpublished upstream requests are in
`sprint04b-b-upstream.md` and `evidence/sprint04b-b/`.

Three standalone attempts exit1 and remain preserved. Repro01's byte tap is
invalid even for positive traffic; its handler/status/peer-close observations
are separate evidence. Its DPE AND501 mapper stays501. Repro02 validates76/76
relay bytes but startup/cleanup ordering exceeds its intended90s bound; owned
container recovery completes under the same lock. Repro03 validates76/76 bytes
and demonstrates folded/unfolded header200,177 origin bytes/one handler,
`first second` after normalization. Both trailer requests return200/214 bytes
but handler trailer maps are empty: trailer normalization/delivery is unproven.
Corrected status-only mapping is unexecuted. Final cleanup hardening is checked
for syntax/integrity, not runtime re-proven. No failed observation grants a
security PASS. No upstream issue was published or production codec fork built.

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

E independently ACCEPTs B5de8179 as upstream NO-GO research/unsuccessful
standalone evidence in `sprint04b-e-b-review.md` at
`a48ad72aa9628774b472b86f900e1009778b01d8`. Seven manifests, receipt streams and
source objects verify. Fresh independent release/tag metadata for all three
projects and eight immutable upstream files match. E also accepts the root
gate helper's scoped invocation and output exclusions; final integration/receipt
audit remains distinct from these component verdicts.

Final independent integration/local-gate ACCEPT is retained at
`213416c` in `sprint04b-e-integration-review.md`. E verifies667 accepted owner
files,2,291 protected baseline objects, all56 gate manifest entries, eight
streams and26 scanner operations. Clean receipt/docs heada58f4cc has identical
executable bytes to tested0cf24f4. No new blocking integration finding; the
unchanged runtime failures, proposed ADR and pending human owner remain explicit.

Next executable sprint trigger: a maintained released strict parser capability
with exact provenance and demonstrated change in the historical failing cases.
Then targeted failures, unchanged75, complete TLS/identity/stream/cancellation/
pool/config/resource proof, maintenance review, independent reproduction,
local/hosted gates and recorded affirmative human architecture approval.
Without that trigger, stop candidate builds and retain the upstream dependency.

## Full Local Integration Gates

Exact clean source `0cf24f494001711bfb87695536db20732dcb7b1a`, tree
`1775707ec26ca995400569b031f271f1acec602a`, passes root attempt01:
2026-11-13T17:29:05.243Z through17:33:13.150Z. `make check` exits0,
`make security-scan` exits0, `make dev-down` exits0 and Compose volume teardown
exits0. No project containers remain. The actual fixture lock is asserted
before/after every child and held through final cleanup. Node26.13.0 and the
official cached Go1.27.4 toolchain avoid the recorded incompatible system Go.

```sh
env PATH="/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin:/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin:$PATH" \
  AEGIS_NODE_BIN=/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  flock /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  scripts/sprint04b-gates.mjs evidence/sprint04b-root/gates-01
```

The full check includes formatting/lint, race tests, Rust/dashboard builds,
contract compatibility, actual PostgreSQL/Redis/NATS/TLS fixtures, negative
controls and deliberate gate-defect self-tests. Scans cover Go/npm/Rust,
282 history commits,34.49MB worktree secret inputs, filesystem and pinned
fixture/Envoy images with SBOMs and image identity checks. No suppressions or
dependency changes. Raw safe outputs, exact argv/exits/stream hashes and
`SHA256SUMS` are in `evidence/sprint04b-root/gates-01/`; all hashes verify.
Rendered Compose credentials are excluded from committed evidence. Historical
component failures and ineligible attempts stay retained with explanations.

## Hosted Integration And Merge Receipt

[PR13](https://github.com/tiecont/aegis-gate/pull/13) integrates this work from
verified PR12 main. Initial head `a58f4cc628e8c56f0c7ccf105b26581ceb9484e1`
starts hosted run43474141994; its captured intermediate state is retained in
`evidence/sprint04b-root/pr13-initial-ci/`. This earlier head is superseded by
the additive final independent review and receipt documentation. It is not the
final-head quality receipt. Both required jobs must pass on the final PR head,
followed by both jobs on its main merge. The PR and run metadata supply exact
successor identities; no commit claims to contain its own hash.

## Final Closeout

Final PR head9600b120 passes both required jobs in43475127149 and merges as
826656f2469ae225a1617438fbb4b3b3a454cc98. Its identical-tree main passes both
jobs in43476258655. Exact jobs and retained cancelled/earlier attempts are in
the closeout addendum and raw `pr13-*` receipts. The receipt-only successor PR
is identified externally by GitHub; root also verifies its exact head/main jobs.
No implementation or security research work remains authorized by this sprint
without the stated upstream capability trigger and formal human decision.
All changes are additive research/test/evidence/docs; no application, dependency,
workflow, threat-model, quality-gate or original corpus/evaluator changes.
No Module04 implementation or production action is permitted by this record.
