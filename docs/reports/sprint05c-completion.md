# Sprint 05-C Measured Completion

Status: component engineering and independent mechanism reproductions complete;
final source review, local gates and hosted delivery PENDING. Module01 remains
NO-GO. Baseline main `078d83c0ab1cb1364d0245d4c4f62f0fe0439e97`, tree
`28aa22cf761092e31c84dc3d07d0d7593784afd3`; exact run43672825174 passes both
hosted jobs. Actual final head/merge receipts follow observed events, never a
self-referential containing commit hash.

## Executable Answers

| Question | Disposition | Evidence and boundary |
| --- | --- | --- |
| A: strict late syntax and zero origin effects with mandatory streaming | TESTED/FAIL for implemented design | A1019a60:77 controls,653 split boundaries,six bytewise controls. Staging lacks early body progress; F CL10/abc/EOF yields400 after89 origin bytes/one handler. |
| B: all-byte H2 denial with valid reuse | TESTED/FAIL for one new maintained mechanism | Bf57a56c inline Go ACK flush changes initial ordering, but original userinfo status still fails; independent SETTINGS overlapping denial produces exact9-byte ACK. |
| C: four protocol assertions | TESTED/FAIL as a complete repair | Cbecc220 runtime oghttp2 gives20/23:two old frame negatives PASS, unexpected CONTINUATION regresses, two userinfo failures remain. |
| D: complete adversarial attribution | IMPLEMENTED/PASS bounded fixture; full runtime UNRESOLVED | Dee67bdd plus F overlays fail closed after four independent false-PASS findings were fixed. Full proxy dispatch map/exact dynamic-table mutations unavailable. |

These scoped results are not universal impossibility proofs. No complete
candidate qualifies for a combined runtime trial or replaces the baseline.

## Code And Ownership

| Branch/owner | Exact source / report | Implemented work |
| --- | --- | --- |
| feat/sprint05c-strict-ingress A |1019a60 /dc5d966|Unchanged maintained llhttp9.4.4 incremental H1 TLS admission, identity, exact targets, ordered pipelines, bounded disk/stream paths, cancellation/quotas.|
| feat/sprint05c-h2-isolation B |f57a56c /0444023|Maintained Go1.27.4 HTTP2 Transport/ReverseProxy fixture, ACK timeline and original75/23 plus finite protocol matrix.|
| fix/sprint05c-h2-errors C |2487ebb/becc220 /7255fa2|Released Envoy alternate codec, peer-frame relay, explicit hidden-option experiment and separate runtime-key proof.|
| test/sprint05c-request-isolation D |ee67bdd /cbc73f5|Authenticated event ledger, Framer/HPACK state, raw both-direction capture, identity/stream/final-decision/header causality.|
| test/sprint05c-regressions E |a8e27f2 /dd1eaa4|Actual accepted-module regressions; scoped stale-volume namespace allowlist.|
| review/sprint05c-security F |Final checkpoint PENDING|Independent clean-source reproduction, malicious overlays, known-length EOF proof, original baseline.|
| sprint/05c-integration Root |1dafb9f execution;c3db637 provenance|Sole shared status/evidence ownership, collector/actual binary hashes,05c gate/export namespaces.|

See A-F reports and `docs/sprints/05c-execution.md` for isolated worktrees and
exact commands. Source/tree, versions, argv, exits, raw output and SHA256 are
retained. All fixture/scanner lifecycles hold the shared lock through cleanup.
No public listener, production parser fork, upstream publication or Module04
implementation exists. No architecture approval is supplied by engineering work.

## Original Matrices

| Candidate | Previous | Fresh result | Eligible replacement |
| --- | --- | --- | --- |
| Combined Envoy original75 |73/75|73/75 independently reproduced by F|Unchanged baseline|
| Combined Envoy original23 |19/23|19/23 C and F|Unchanged baseline|
| New Go fixture original75/23 |Unmeasured|56/75,17/23;additive11/12|NO:strictness/resource/health gaps|
| Alternate Envoy oghttp2 original23 |Baseline19/23|20/23 direct,relay and runtime-key|NO:mandatory regression|

No original75 assertion is repaired in an eligible runtime. Two old original23
assertions PASS on an isolated alternate codec, which loses a previously passing
case. Counts do not imply acceptance. The11 protected input/evaluator/observer
files remain byte-identical, inventory SHA256
`85de42e7d2ac54b0f199bcced46760bec41b7687dd7c7016dd580ea4a300c1fa`.

| Failure ID | Current actual disposition |
| --- | --- |
| malformed-HTTP-obsolete-folded-header |Baseline FAIL263 origin bytes/one handler. Exact A finite H1 negative400/no origin effects; complete original-runtime assertion unrepaired.|
| HTTP2-authority-Host-and-SNI-confusion-rejected |Baseline FAIL9 bytes `000000040100000000`,zero handlers. Go original sees zero bytes but userinfo resets instead of400/421; independent control overlap still9 bytes.|
| settled-reuse-identity-and-three-authority-negatives |FAIL baseline/alternate codecs; RST_STREAM1 is not required400/421.|
| individual-settled-userinfo-denial |FAIL baseline/alternate codecs; reset/deadline not reclassified.|
| raw-H2-HEADERS-stream-zero |Baseline FAIL; alternate oghttp2 unchanged assertion PASS with peer GOAWAY1,zero origin effects.|
| raw-H2-zero-WINDOW_UPDATE |Baseline FAIL; alternate oghttp2 unchanged assertion PASS with peer GOAWAY1,zero origin effects.|

New alternate-codec regression `raw-H2-unexpected-CONTINUATION` closes without
required error frame. Baseline four TE and two malformed-header repairs remain
PASS. No payload, deadline, evaluator or observation-window change occurred.

## Admission And H2 Proof

A caps private stages at1.5MiB each/2MiB aggregate/three files, origin work at
two slots/two waiters, reads16KiB, TCP6 and bounded handshake/request/idle/origin
deadlines. Stages are0700/0600, removed after cleanup; disk plaintext crash
recovery/encryption is unimplemented. Oversize/quota returns413/503.2MiB CL
upload streams before completion;1MiB chunked upload waits for full trailers.
Whole-fixture RSS peak121,749,504 bytes is not isolated runtime/cgroup proof.
Expect/upgrades/CONNECT, H2/gRPC/WS and origin pooling are unsupported here.

F's CL10 sendsabc, waits confirmed origin3 body bytes, then EOF:400 after89 wire
bytes/one aborted handler. ValidCL3 half-close gives200/84 exact bytes. Known
framing cannot guarantee future truncation-free admission. Prior05B folded late
trailer proof retains1,049,201 forwarded bytes. Staging prevents those effects
but delays progress; finite staging is not indefinite streaming or contract relief.

B's supported inline ACK flush occurs before the preceding response completes
in the original trace. The case still fails userinfo400/421. Additive ordinary
origin SETTINGS without downstream requests and overlapping denial each produce
the exact9-byte ACK on a valid reused pool, without new dial/handler. No bytes
are subtracted and no interval shifts. Finite tenant/trust/config rotation,
reuse/concurrency,gRPC,cancellation/drain/TLS controls execute, but the Go fixture
fails additional original gates and has no memory/PID cgroups.

C's hidden/work-in-progress explicit codec field is not a stable production API;
separate Bootstrap runtime-key activation reproduces20/23 without that field.
Actual peer GOAWAY1 precedes close in the two old negatives. Userinfo remains
RST1 and unexpected CONTINUATION lacks a peer frame. No permissive validator,
private patch or reset-as-status workaround is accepted.

## Observer And Review

D records signed sequence/previous-MAC fixture events, raw captures/hashes,
verified SNI/tenant/generation, request/stream/dial/handler/final-decision state.
Maintained Framer/HPACK decodes fragmented blocks and dynamic references. Limits
include256KiB capture,2048 events,64KiB compressed blocks and bounded fields.
Nine-byte control remains current-contract FAIL while separate bounded research
can attribute unrelated control only with complete capture. Module01 gate output
is always false. Fixture signer trust is not a production dispatch map; HPACK
history hashes are not exact dynamic-table mutation records.

F found final-decision overwrite, downstream stream alias, absent HEADERS and
handler-before-END_HEADERS false-PASS defects. All four are repaired at ee67bdd;
own race suite and expanded five-test independent overlay pass. Failed overlays
remain retained and superseded, not relabeled. Complete runtime attribution is
UNRESOLVED; late-rejection attribution does not prevent earlier forwarding.

F independently reproduces A77 controls plus EOF stop, B56/75/17/23/11/12 plus
both ACK controls, C20/23 and frames, D own suite/overlays, E full real regressions
and baseline73/75,19/23. Final hash/scanner/source verdict remains a delivery
checkpoint before push/merge. Standalone proof never grants complete runtime GO.

## Regression And Delivery

E passes actual PostgreSQL/Redis/NATS-JetStream/mTLS, tenancy/RBAC/OIDC,
snapshotv1 signing/publication/trust rotation, encrypted LKG/floors/rollback/
canary/drain/recovery/archive/prune:11 packages,89 tests,151 subtests,zero skips.
F independently reruns it. Contracts/five dashboard checks and image identity,
credentials/nonroot/restart/stale-volume/data retention/cleanup pass. Compatible
TypeScript6.0.3/typescript-eslint8.72.2/minimatch pins stay. External generation
floor is still a provisioned interface, not production monotonic storage.

Retained failures include A pause/stage/EOF/handshake iterations, B initial
source-filter/timeout with separate recovery, E old namespace rejection, F `/tmp`
ENOSPC and four D findings. Cleanup and failed exits remain distinct. Only owned
generated E caches were removed for space; evidence branches are preserved.

Full locked check/security-scan/teardown, exact PR-head hosted jobs, actual merge
SHA and exact-main hosted jobs are PENDING. Additive receipts must name actual
source and events. No component result substitutes for final gates.

| Gate | State |
| --- | --- |
| Module00/02/03 |PASS local|
| Module01 |NO-GO|
| Modules04-12 |LOCKED|
| Production |BLOCKED|
| ADR012/human architecture owner/security owner/approval |PROPOSED/PENDING/PENDING/PENDING|

Next engineering action requires a supported pre-codec userinfo response path
and malformed-frame emission without CONTINUATION regression. A wider ingress
needs executable complete-message/EOF/trailer admission compatible with mandatory
streaming, a new causal H2 mechanism for the unchanged byte interval and complete
authenticated dispatch instrumentation. Do not repeat rejected pool/window/flush
settings. GO still requires unchanged75/23, full TLS/identity/config/resource
proof, independent review, local/hosted gates and recorded human approval.
