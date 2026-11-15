# Sprint 05-D Completion Evidence

Disposition: Outcome B, architecture decision required for the tested designs.
No original mandatory failure is claimed repaired. This report records executed
bounded implementation and exact stops, not a new runtime acceptance. Delivery
review, final local gates and hosted/merge receipts are recorded below as they
complete; pending fields are not PASS.

## Baseline And Source

Starting main `aa289da3f48334ec8e2156f66ebd2a8f3cfb3324`, tree
`8668da5dfce1825d0e8c8c311faeb284b8114f4d`; refreshed remote agrees. Both main
hosted jobs PASS in43689624172. Ownership, isolated worktrees and six-field
experiments are in `docs/sprints/05d-execution.md`. Root branch is
`sprint/05d-integration`. Original11 protected input/oracle/observer files match
the immutable8758b1c baseline. Inventory SHA256:
`85de42e7d2ac54b0f199bcced46760bec41b7687dd7c7016dd580ea4a300c1fa`.
Root protected receipt: `evidence/sprint05d-root/baseline/`.

| Track / branch | Executed source and result | Review/delivery |
| --- | --- | --- |
| A feat/sprint05d-admission-policy | 3a709ae finite encrypted complete-message H1 stage,29 controls; streaming FAIL | Independent driver correction/reproduction in progress |
| B fix/sprint05d-h2-identity-status | Supported pre-reset HTTP-response hook search and exact userinfo capture | Final source/report pending |
| C fix/sprint05d-h2-frame-rejection | 3474579 source/API audit; final5bc9489; no supported post-error adapter-send hook | F review pending |
| D test/sprint05d-origin-isolation | a532ea2 real verified TLS/H2 trace,14 mutation controls/full race PASS; c367fb7 evidence | Independent correlation correction replay pending |
| E test/sprint05d-runtime-regression | 01fdaac real fixtures; f155927 report/evidence; all28 commands0 | F review pending |
| F review/sprint05d-security | Clean-source builds and independent attacks | Final verdict pending |
| Root sprint/05d-integration | 619d883 ownership; 1ff79f3 evidence namespace; 30c9019 proposed ADR | Integration/gates/PR pending |

Agent reports and their receipts carry full source/tree/tool versions, exact
argv, exits, artifact SHA256 and failed-attempt history. Shared fixtures hold
`/tmp/aegisgate-sprint02-fixtures.lock` from setup through raw capture, hashing
and cleanup. Listeners are loopback only; disposable TLS material stays private.

## Original Acceptance Results

| Unchanged suite | Before | Current accepted candidate | Fresh05D complete run |
| --- | --- | --- | --- |
| Original75 | 73/75 | 73/75 | Not repeated: no credible non-regressing runtime repair |
| Original23 | 19/23 | 19/23 | Not repeated: targeted API stops supply no new candidate |
| Alternate oghttp2 historical23 | 20/23 | Not accepted | No known failed comparison rerun |

Immutable complete evidence is reused from05A/05C and independently bound by
the protected checker. Additive H1 controls and observer mutations never count
as new original-case PASS. No assertion, malformed payload, evaluator or
measurement interval changes.

| Mandatory failed ID | Disposition |
| --- | --- |
| malformed-HTTP-obsolete-folded-header | Envoy FAIL,263 decrypted bytes/one handler. Exact input rejects before origin in isolated finite H1 stage only; complete runtime still ineligible |
| HTTP2-authority-Host-and-SNI-confusion-rejected | FAIL,9 decrypted bytes/zero handlers; exact000000040100000000 SETTINGS ACK remains counted |
| settled-reuse-identity-and-three-authority-negatives | FAIL; peer status/deadline requirement remains mandatory; no supported pre-reset status hook established |
| individual-settled-userinfo-denial | FAIL; codec reset is not HTTP400/421 |
| raw-H2-HEADERS-stream-zero | Accepted codec FAIL; alternate historical PASS trades away CONTINUATION, therefore no accepted repair |
| raw-H2-zero-WINDOW_UPDATE | Same: no non-regressing supported codec fix |

`raw-H2-unexpected-CONTINUATION` remains PASS on the accepted baseline and FAIL
on the rejected alternate. Four TE and two malformed-H2-header repairs are
preserved by unchanged candidate/oracles, not replaced by these PoCs.

## H1 Admission And Streaming

The unchanged maintained llhttp9.4.4 incremental binding validates complete
framing and trailers for every strict-staged request. A new isolated runtime
uses finite private AES-256-GCM staging, authenticates the entire ciphertext
before any origin slot/dial, then replays in16KiB chunks. This is neither a
private framing parser nor unbounded plaintext buffering. Keys are ephemeral;
SIGKILL loses them and startup discards validated ciphertext orphans.

The minimal CL10/abc prefix produces no origin effects while incomplete. Its
valid seven-byte suffix produces200/87 exact wire bytes; EOF produces400/zero
origin effects. Chunked valid/EOF/late-fold suffixes similarly produce200/400/
400 with no rejected-message forwarding. Historical folded header, TE/CL,
trailers, targets, pipelines,512KiB uploads, cancellation, quotas, tamper,
timeouts and actual restart are exercised. The early-origin-progress positive
FAILS with408 and zero progress. In05C the streaming CL10/abc/EOF control
produced400 after89 origin bytes; late folded chunked input previously forwarded
1,049,201 bytes before rejection. These are explicit same-prefix causal
counterexamples for the tested request types, not universal protocol impossibility.

Limits:1.5MiB wire/message,2MiB aggregate ciphertext,3 stage files,24KiB headers,
6 connections,2 active origin slots/2 waiters,700ms idle/handshake,2500ms request,
1800ms origin. Size/timeout/quota outcomes are413/408/503; malformed framing400.
Exact quota boundaries and recovery require independent F validation. Hard
process RSS, cgroup isolation, same-UID mutation resistance, production key
custody, signed route policy, H2/WS/gRPC integration remain unproved. Indefinite
streaming is not supplied by finite staging. See A report for raw measurements.

## H2 And Observer Findings

The current all-byte observer counts the independent reused-connection ACK.
05D does not repeat failed pool/window/flush experiments or subtract those nine
bytes. Requests can be denied while unrelated connection-control traffic still
arrives in the original interval. That is a bounded limitation of the tested
design, not proof of universal H2 impossibility.

B examines codec authority rejection, header validation, local replies and
reset ordering. C pins the ProcessBytes early-return versus adapter Send/public
close boundary. A public network-buffer flush cannot submit pending adapter
error frames; ordinary goAway emits NO_ERROR, and protocolErrorForTest is
explicitly test-only. No supported configurable repair is established. C's
fresh audit exits0; three-case/full23 protocol execution is explicitly absent.
Static source anchors do not prove which internal callback ran historically.

D adds actual verified TLS/H2 transport/handler tracing and raw bidirectional
Framer/HPACK correlation on reused connections, replacing hardcoded stream IDs
in the bounded fixture. Whole-capture authentication, capture caps/loss state,
reader joins, generated nonces and observed stream bindings improve diagnostics.
An adversarial reverse-payload EOF initially passed and was corrected. F then
found swapped/duplicate nonces accepted as consistent; same-stream probe/nonce
and uniqueness checks correct that narrower claim, pending independent replay.
All failed receipts remain retained. Full RuntimeComplete/RuntimePass/Module01Pass
always remain false: no authoritative pre-wire dispatch hook, signed generation,
exact HPACK mutation trace or trustworthy complete production capture exists.
An authenticated trusted signer can still omit or rewrite events.

The dual reports remain distinct: current aggregate zero-byte FAIL; proposed
causal research evaluation only. H2 control attribution cannot excuse H1
late-invalid request data. See D report and the versioned proposed ADR for the
side-by-side threat comparison, downgrade risks and acceptance prerequisites.

## Accepted Modules And Quality

E's actual PostgreSQL/Redis/NATS-JetStream/mTLS execution passes11 race-tested
packages,89 top-level tests,151 subtests, zero skips. Tenant/RBAC/OIDC negatives,
signed snapshotv1, encrypted LKG, trust rotation, rollback/canary, provisioning
floors, drain/recovery and archival references remain covered. Contracts and
dashboard strict install/lint/typecheck/test/build/integration pass. No pins,
peer requirements, scanner policy or accepted database scheduling is weakened.
All28 commands and cleanup/container/network/volume checks exit0; E receipt
SHA256 `3f653cf0ee01ba653a6fd8a70c1196495a68a7f6f8f3fcef75dd6c7d45ea1ac5`.
No collection of A/B/C separate proofs is presented as a compatible runtime.

Final exact-source local check/security-scan/cleanup: PENDING.
Independent F per-failure/source/integration acceptance: PENDING.
PR/final-head hosted jobs/merge/exact-main hosted jobs: PENDING.
These delivery fields must be completed before declaring the sprint delivered.

## Decision Boundary And Next Work

Recommendation: review explicit finite strict-message and separately specified
streaming admission profiles, with maintained parser/codec ownership inside one
TLS/tenant/signed-generation trust boundary. Strict finite messages stage to
completion; streaming remains disabled until its late-invalidity guarantees and
irreversible origin effects have explicit human architecture/security disposition.
For H2, any proposed causal control-traffic exception needs complete authoritative
runtime instrumentation before use. The versioned
`docs/ADR-012-sprint05d-contract-v2-proposed.md` is PROPOSED, NOT EFFECTIVE.
No human owner, formal approval reference/date or runtime GO is fabricated.

Autonomous next work can prepare concrete maintained API requirements for strict
pre-normalization H1 rejection, pre-reset invalid-authority HTTP responses,
protocol-error serialization-before-close and authenticated request/stream/dial/
HPACK mappings. A new wider runtime trial requires a released supported mechanism
that passes its exact targeted historical failure without regression, or a
formally approved versioned contract and its complete instrumentation tests.
Do not automatically begin another equivalent pool/window/parser comparison.

| Gate | Actual state |
| --- | --- |
| Module00 Foundation | PASS local |
| Module01 Proxy feasibility / M0-PROXY-GO-NOGO | NO-GO |
| Module02 Control plane | PASS local |
| Module03 Config distribution | PASS local |
| Modules04-12 | LOCKED |
| Production | BLOCKED |
| ADR012/v2 contract and human architecture/security approval | PROPOSED/PENDING |
