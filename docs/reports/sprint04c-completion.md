# Sprint 04-C completion and decision handoff

Status: component work complete; evidence repair and final integration gates in progress.
Module01 **NO-GO**;04-12 **LOCKED**; production **BLOCKED**. This report is
updated only from actual receipts. No eligible strict-ingress runtime exists.

## Baseline and ownership

Refreshed starting main `a325b9ecc086e09467f61b49f17da241bf8e43ea`; PR12/13/14
merged. Exact baseline hosted43478235586 passes foundation-quality132067665540
and supply-chain-security132067666000. Raw fresh API responses, invocation,
source/tree/tool versions/timing/exits/stream hashes are retained in
`evidence/sprint04c-root/baseline-{main,jobs}/`. Previous Sprint04-B source,
reports, failed attempts and manifests remain immutable.

| Owner | Branch | Exact component head / scope |
| --- | --- | --- |
| A / root | docs/sprint04c-architecture-decision |02bad67, explicit contract tradeoff, proposed ADR addendum and human checklist |
| B | research/sprint04c-envoy-upstream |12abd255b754b553480544edbf9452b7f65d9a4d, fresh released/API source and focused upstream package |
| C / root | design/sprint04c-ingress-alternatives |49f2d55, maintained boundary screening, ownership/threat diagram and conditional acceptance |
| D | test/sprint04c-h2-security-proof |d9a2004167a178a3a1d4549cc97378fe4b02c360, additive maintained H2/HPACK capture diagnostics/adversarial tests |
| E | hardening/sprint04c-regressions-sanitized |212677805416a3e38d44724bfaf1101c8e11a0d5; corrected source dc30375 and fresh attempt02 |
| F | review/sprint04c-security |cede69eb3e11c42cc66c21b5e7b5d7c55ea037a1; A/B/C/D and corrected E accepted; earlier helper rejected |
| Root | sprint/04c-integration |isolated contract, full gate helper, accepted integration and hosted closeout |

Final PR and merge SHA are recorded only after observed execution. A later
receipt addendum may supersede checkpoint pending fields without rewriting
historical proof or asserting a self-referential containing commit hash.

## Architecture owner, decision and ADR012

Actual accountable human architecture owner/name/role: **PENDING/not supplied**.
Actual accountable human security owner/name/role: **PENDING/not supplied**.
Formal architecture/security decision, approval reference/date: **PENDING**.
The human delegated engineering decisions; root recommends **retain Option1**
aggregate zero-byte acceptance and maintained Envoy strict-ingress API research.
No runtime architecture selection, requirement waiver or production approval.

ADR012 remains PROPOSED. Its Sprint04-C proposed addendum, A's security
comparison and approval checklist make the bounded decision actionable.
Option2 is not universally equivalent/stronger: it permits attributed legitimate
H2 control traffic while requiring causal no-dial/stream/HPACK-effects evidence
absent from the byte-only oracle. Complete stateful observer validation,
independent review and explicit formal requirement-revision approval are needed.
Original75 and23 inputs/expected/evaluators stay unchanged in this sprint.
Response/status/handler-only acceptance is explicitly rejected.

## Maintained upstream capability and publication

B refreshes official stable releases and exact sources:

| Project | Released source | Result |
| --- | --- | --- |
| Envoy1.40.2 |b2d89e0ae53916f28770771fbdd49c5c99c5c5a2 |13 inspected files unchanged; strict-fold rejection hook missing/unproved |
| Pingora0.9.1 |f86ffda5d3ae5c3baf5125682138b33b26c01b08 |4 files unchanged; original-target/framing/pipeline and maintenance gaps retained |
| Hyper1.12.0 |7f67699ce32d717081deb7018b4da7d679277ac0 |2 files unchanged; incoming CL/TE and URI provenance gaps retained |

Five inspected unreleased parser files also match04-B despite advanced
Envoy/Hyper default-branch hashes. No relevant maintained RELEASED trigger;
no full known-failing candidate rebuild or private codec fork. Exact raw source
hashes/official metadata, reproducibility steps, expected/observed results and
desired maintained API are in `sprint04c-b-upstream.md` and
`evidence/sprint04c-b/`. Upstream issue/change drafts remain **NOT PUBLISHED**;
no maintainer obligation or unsupported upstream vulnerability is asserted.

Focused H1 proof now demonstrates a supported status-only local501-to400
mapper: all four TE vectors return400 and actual peer close on fresh/reused
connections, with zero origin bytes/new dials/handlers/errors. Default listener
still501. Actual upstream501 remains501; six encoded targets and ordered
pipeline pass. This is a partial API proof, not a changed original75 score.
Folded/unfolded headers both200,177 decrypted origin bytes/one handler and same
parsed value. Trailer200/214-byte observations still do not establish delivery.
The old provenance blocker therefore remains.

B's minimal H2 controls retain exact raw input/frame/TLS/counters; its warmup
consumes SETTINGS ACK and does not reproduce the original interval. Three
focused negatives have zero measured origin effects, but HPACK/status decoding
is absent and these results cannot supersede the original9-byte FAIL.
First H2 collector's missed DATA-END_STREAM observation is retained ineligible;
corrected02 proves actual valid completion. Every old failure remains mandatory.

## Separate ingress architecture assessment

C screens actual HAProxy3.4.7 LTS source, checksum-verified official archive
`ccfd342f3724c2cd659574044d788f44e20b212467c6bd5edbbfc517a2775dca`.
Its inspected H1 continuation path normalizes CR/LF/HT before parsed policy;
no complete released strict capability is established. No proxy is built or
benchmarked. This scoped screen is not proof about every future/other engine.
The NEW boundary design covers TLS/SNI/cert custody, authenticated client-IP/
client-cert propagation, keepalive/pipelines, H2/HPACK, WS/gRPC, backpressure/
cancel/drain, pool/trust separation, signed-generation capture and parser
differentials. Ownership diagram, threat delta, maintenance/migration cost and
conditional end-to-end proof are in `sprint04c-c-alternatives.md`. Stop until
released capability plus separate human new-boundary authorization exist.
Source01's wrong optional archive-member failure remains retained; source02
corrects collection and does not supply runtime feasibility.

## Original corpus and seven supplemental failures

No complete proxy candidate/corpus rerun is claimed this sprint. Latest accepted
immutable results stay Pingora63/75 historical, Envoy69/75 independently
reproduced, Hyper70/75 historical, original supplemental16/23. Protected Git
objects, manifests and unchanged extraction/evaluator checks are independently
verified. Six mandatory Envoy failures remain:

- malformed-HTTP-invalid-transfer-encoding
- malformed-HTTP-obsolete-folded-header
- strict-ingress-TE-repeated-chunked
- strict-ingress-TE-not-final-chunked
- supplemental-repeated-transfer-encoding-fields
- HTTP2-authority-Host-and-SNI-confusion-rejected

D's fresh17 bounded diagnostics preserve all7 original supplemental FAILs:
two authority/userinfo rejection requirements remain unproved; four malformed
H2 cases close around1s without required RST/GOAWAY; paused8MiB completes by
500ms before cancel. Original expectations/timing are not changed or relabeled.
Exact root cause and conforming-close behavior remain unresolved.

The32MiB control produces16842752 bytes while relay DATA reaches16777216 and
client stream window0. RSS, application writes, transport windows and observed
receipt are distinct samples, not production memory bounds/fairness. Incomplete
response/upload cancellations reach origin with actual RST_STREAM2. Valid WS
(two echoes/close1000), gRPC (two echoes/trailers/cancel), verified TLS, encoded
relay transparency and native/gRPC upstream reuse controls pass locally.

## H2 origin attribution and remaining observer gaps

Existing original negative remains9 origin bytes,0 handlers:
`000000040100000000`, SETTINGS ACK on an existing previously valid connection.
It still FAILS aggregate-zero. No control-byte subtraction, shifted observation
interval or alternate expectation. New research does not waive it.

D uses existing maintained golang.org/x/net0.62.0 Framer/HPACK Decoder without
product/dependency changes. Adversarial tests exercise partial forbidden
HEADERS, CONTINUATION, DATA, HPACK state-only updates, new dials/no handlers,
forged/missing maps and lost/truncated captures. Raw captures are bounded128KiB
per direction, with streaming all-byte hashes and dropped-byte accounting.
Native response capture retains131072 of25179723 bytes and explicitly fails
complete classification; native and gRPC requests lack authenticated dispatch,
tenant and generation maps. Exact HPACK mutation audit/control causality is
also incomplete. **All decoded observations report semantic_security_pass=false**.
The observer improves trustworthy diagnostics; it is not a complete Option2
observer, security PASS or production parser. Details: `sprint04c-d-protocol.md`.

## Accepted module regressions and dependencies

E corrected sourcedc30375 executes actual PostgreSQL/NATS/Redis/mTLS, tenant/RBAC/isolation,
snapshotv1 publication, encrypted LKG/anti-replay/provisioning floor, drain,
canary/rollback/prune/archive and recovery controls. All11 Go packages,88
top-level tests and151 subtests pass with no skips. Dashboard's five checks,
contracts, edge tests and fixture credential/image/stale-volume/persisted
restart/dynamic-network controls pass. No scoped product fix was justified.

Eight dependency scans pass with real lock/database inputs; Pingora's two
unmaintained warnings remain explicitly open. Latest released typescript-eslint
8.72.2 still declares TypeScript>=4.8.4 <6.1.0; strict TS7 resolution fails
ERESOLVE as expected. Compatible TS6.0.3 pins/minimatch11.0.7 stay unchanged.
No scanner ignore, peer force or finding suppression. External generation floor
remains provisioning interface, drain does not cancel engine I/O, archive
custody/production monotonic storage/secret service remain outside local proof.

E attempt02 retains49 compact command receipts,98 exact stream slices and source/tool/
manifest hashes; all verify. Shared fixture lock covers setup/tests/scans/
evidence/teardown. Isolated Compose/stale resources are absent; owned private
material is removed after in-memory credential exclusion. Raw rendered Compose
and private keys are never committed. No Module10 implementation.

### Independent scanner finding and repair

F's subsequent full component secret scan found a JWT-shaped public Netlify RUM
value in the fetched typescript-eslint website HTML. No value is reproduced,
replayed or scanner-suppressed. The first E acceptance is superseded; attempt01
is ineligible. Safe command/source metadata, original stream digest and explicit
REDACTION remain; the whole stdout stream and raw finding report are omitted.
Their original manifests are deliberately incomplete and are not claimed PASS.

Corrected E source resolves official GitHub Markdown at an immutable revision,
then reruns the entire local regression/dependency lifecycle as fresh attempt02.
The publishable integration ancestry excludes original unpublished E5515913
and its root descendants. Exact source hashes and safe failed-attempt metadata
preserve the explanation without distributing the flagged blob. Root uses a
fresh transfer-only clone of this clean reachable ancestry for history scanning;
no baseline history, scanner policy or acceptance expectation is rewritten.

F also found that root's added private-output assertion could skip deletion on
failure. Fix cb9c309 executes owned cleanup in a separate guarded block while
preserving failed status. An isolated in-memory fault test44fc689 exercises
clean output, deliberate synthetic fixture leakage and private-key markers;
both negative cases exit1 yet perform cleanup/inventories and disclose no values.
This synthetic test is not a full gate or fixture runtime receipt.

F subsequently rejects cb9c309: an unguarded Docker inventory can still throw
before deletion. Its independent reproduction and exact E acceptance are in
`sprint04c-f-final-review.md`, committed at cede69e. Repair578d78f guards Docker
cleanup, inventories and scanner evidence copying independently, then attempts
each owned private-path removal separately. Failure is retained in the final
receipt; an unavailable inventory cannot be represented as empty. Independent
fault-path review of this replacement is pending. Both earlier failures remain
historical evidence and are not represented as passing helpers.

## Independent review and full gates

F exact-source A/B/C/D and corrected E decisions: ACCEPT as scoped documentation,
research, diagnostic tests and local regression evidence. The final E acceptance
supersedes earlier E pending/rejected checkpoint fields only for corrected
2126778. Root helper replacement and final integration review remain PENDING.
Root full locked make check/security-scan/cleanup: PENDING integration.
Exact final PR-head and merge foundation-quality/supply-chain-security:
PENDING after local and independent acceptance. Existing baseline successes
are not substituted for final integration CI.

## Blockers, accountable handoff and next executable trigger

| Remaining blocker | Accountable handoff / next action |
| --- | --- |
| Released strict parser provenance | Root engineering coordinator retains B's maintainer-ready package; upstream delivery uncommitted, publication requires separate authorization |
| Incomplete observer and7 protocol/resource failures | Root/D technical followup; complete authenticated map/HPACK/control-state and bounded conformance/resource proof before any eligibility claim |
| Runtime/contract architecture decision | Actual human architecture/security owners PENDING assignment; use A checklist and proposed ADR addendum |
| TS7/dependency maintenance | Root monitors explicit released peer support and Pingora warning removal; no forced update |
| Production systems/signoff | Future module/release owners, unassigned; downstream locks remain binding |

Resume executable candidate work only with exact supported RELEASED capability
and demonstrated change in historical failing behavior (or an explicitly
approved new-boundary PoC scope). Then targeted failures, unchanged75, all
mandatory TLS/identity/protocol/stream/cancel/pool/config/resource/dependency
proof, independent exact-source reproduction, full local/hosted gates and
recorded affirmative human architecture/security approval. No repeated69/75
benchmark or external maintainer wait is required to merge safe reviewed work.

| Module/release | State |
| --- | --- |
|00 | PASS local; fresh regressions retained |
|01 M0-PROXY-GO-NOGO | NO-GO |
|02 | PASS local; fresh regressions retained |
|03 | PASS local; snapshotv1/recovery preserved |
|04-12 | LOCKED |
|Production | BLOCKED |
