# Sprint05C F Independent Security Review

**ACCEPT only the scoped research tooling, corrected bounded observer tests,
technical stops and local Module00/02/03 regression evidence specified below.**
No complete H1/H2 ingress or streaming admission repair is accepted. Module01
remains NO-GO, Modules04-12 LOCKED, production BLOCKED. F hash/scanner checks01
pass; a final closeout-source check follows. Root full local/hosted gates remain separate.

## Independent Execution

F branch `review/sprint05c-security`, worktree `/tmp/aegisgate-05c-f`, baseline
078d83c0ab1cb1364d0245d4c4f62f0fe0439e97/tree
28aa22cf761092e31c84dc3d07d0d7593784afd3. No writer worktree was modified.
F owns only `scripts/sprint05c-f-*`, this report and `evidence/sprint05c-f/`.
Source precedes executable proof; evidence is committed separately. No push,
merge, architecture decision, contract revision or production action by F.

All following captures come from fresh shared clones on the disk-backed cache
filesystem, with clean tracked and untracked source before setup, exact source
and tree, complete tracked-file hashes, binary hashes, argv, environment,
timestamps, exits and raw streams. Every complete capture verifies all11
protected source/oracle files before and after and all tracked bytes afterward.
The shared `/tmp/aegisgate-sprint02-fixtures.lock` covers setup through cleanup,
capture and hashes. SHA256SUMS binds retained F artifacts; nested writer
manifests remain intact. Semantic security PASS is always false in F receipts.

| Capture under evidence/sprint05c-f | Exact clean source | Result |
| --- | --- | --- |
| baseline-originals-01 |078d83c0ab1cb1364d0245d4c4f62f0fe0439e97|Unchanged Envoy73/75,19/23; collector0, failed children1 |
| a-independent-03 |1019a602c4d5ecdb719603445f6a8baf66325207|77 additive controls;653 native splits/six byte controls; F EOF boundary; all collectors0 |
| b-independent-01 |04440235a68c82e2e76f3919453adbb25bf4eb9a|56/75,17/23,11/12; all four evaluated children1; collector/verifier0 |
| c-independent-01 |2487ebbe398bb4cb7f429f2a956eb0ea774057dc|Baseline19/23, explicit codec20/23, relay diagnostics |
| c-independent-02 |7255fa2b38eb657c2b6d0c10e066a13121289b46|Same baseline/explicit codec, final source |
| c-runtime-01 |7255fa2b38eb657c2b6d0c10e066a13121289b46|Runtime guard, direct original23=20/23, child1; verifier0 |
| d-independent-02 |8494aa20b48efd822a85e7b423b99314a7ccd334|Existing suite0; F overlay1: three false PASS findings |
| d-independent-03 |be26f55ec44315e29818688b53a8ea28ca96b5ae|Existing suite0; original F overlay0 |
| d-independent-05 |be26f55ec44315e29818688b53a8ea28ca96b5ae|Existing suite0; expanded F overlay1: fourth false PASS |
| d-independent-06 |ee67bdd3d3ca62a5ce3108fee5a0a24406db7d01|Existing race suite0; all five expanded F tests0 |
| e-independent-01 |dd1eaa40f3e5e02b4fe942c7e44aaeaa74970545|Actual11 packages,89 top-level tests,151 subtests,0 skips; all commands0 |

Reproduce with pinned Node and a fresh F suffix:

```sh
NODE=/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock "$NODE" scripts/sprint05c-f-review.mjs a 1019a60 evidence/sprint05c-f/a-independent-NN
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock "$NODE" scripts/sprint05c-f-review.mjs b 0444023 evidence/sprint05c-f/b-independent-NN
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock "$NODE" scripts/sprint05c-f-review.mjs c 7255fa2 evidence/sprint05c-f/c-runtime-NN runtime
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock "$NODE" scripts/sprint05c-f-review.mjs d ee67bdd evidence/sprint05c-f/d-independent-NN
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock "$NODE" scripts/sprint05c-f-review.mjs e dd1eaa4 evidence/sprint05c-f/e-independent-NN
```

Node26.13.0 SHA256 is
0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b;
Go1.27.4 executable SHA256 is
de0ae3e082ce7599eae4fb69fa2ef1e43b8f31ffd3fce62cdf81930aa9005050.
GOAMD64=v1/GOTOOLCHAIN=local are used by F. Later F receipts additionally
resolve/hash PATH executables and record disk-backed compiler TMPDIR. Earlier
PATH executable entries can be null; this is not relabeled as a hash binding.
Writer child receipts retain their actual tool/extraction pins. Envoy SHA256
1d64506e25c1844f146162ddb2ece7010fa4e784faddb40a079021491f1f03cc
matches the committed image-extraction receipt. Reused llhttp9.4.4 source is
compared to all five accepted pins before compilation; parser bytes are unchanged.

## A: Finite H1 Proof And Streaming Stop

**ACCEPT bounded additive H1 tooling and the measured technical stop at
1019a60; final reportdc5d966 accurately records the independent EOF limit.
REJECT full ingress, original75 repair and future-invalidity-safe streaming.**

F reproduces77 controls, exact historical folded-header/TE inputs returning400
with zero origin activity, strict trailers, identity/framing/target/pipeline
checks,2MiB known-length progress,1MiB private stage, quotas, cancellation,
backpressure and deadlines. Raw handshake cap/half-close failure on01ceb3e
is independently reproduced and fixed by1019a60, whose full suite completes.
Final cleanup has zero sockets/parsers/stage bytes/files/contexts/origin slots
and listeners, with private fixture absent.

The F-owned independent probe keeps origin TLS verified, waits for actual
origin handler/body progress, then sends client write EOF. A request declaring
Content-Length10 but supplying3 bytes returns400 **after89 exact origin bytes,
one handler and3 body bytes**; the origin request aborts. A complete CL3
half-close control returns200 with84 exact origin bytes. Thus the known-length
path is not safe under the requested condition that future syntax cannot
invalidate admission. An earlier unsynchronized EOF probe saw0 origin bytes;
it is retained as a failed test precondition, not a contradictory PASS.

The chunked competing experiment separately sends65,646 prefix bytes to one
handler before llhttp rejects the exact folded trailer. Private staging
prevents those effects only by waiting for finite completion. A's report now
states both limits. No blanket claim for interrupted known-length requests,
indefinite streaming, origin pooling, H2/WS/gRPC, signed config, production
SSRF/auth/policy, crash recovery or hard process-memory isolation is eligible.

## B: H2 Isolation Stop

**ACCEPT B0444023's executable scoped stop and finite positive matrix;
REJECT original H2 repair, full H1/H2 runtime and resource eligibility.**

The released Go HTTP2-only origin transport preserves reuse and finite
concurrent streams/gRPC/config/trust/cancellation/drain tests. Its original H2
case still fails with NGHTTP2_PROTOCOL_ERROR instead of required400/421,
despite zero observed origin bytes/handlers. The unchanged75 scores56/75 and
23 scores17/23; these failures are not replaced by the historical73/75,19/23.
The separate matrix scores11/12 with userinfo still failing.

Both independent origin SETTINGS and SETTINGS overlapping a denied421 cause
the exact nine-byte ACK `000000040100000000`, no new dial/handler, with complete
capture and no omitted bytes. These are additive counterexamples, not the
original Go case's interval. Neither ACK is subtracted or waived. The original
Envoy H2 case independently retains the same nine-byte failure in the fresh
baseline. This is a scoped runtime mechanism boundary, not a universal theorem.

## C: Per-Failure Protocol Verdicts

**ACCEPT C7255fa2 diagnostic tooling/report and scoped codec comparison;
REJECT integration of the codec candidate as a repair.** The final public
Bootstrap runtime layer selects the released oghttp2 adapter without the
hidden explicit protocol field used by earlier retained experiments. Runtime
guard availability is not an architecture/stable-production-support approval.

| Original failure or candidate regression | Independent verdict |
| --- | --- |
| H1 obsolete folded header | REJECT original runtime repair: fresh Envoy263 bytes/one handler; ACCEPT A's separate exact-input400/zero-effect observation |
| H2 authority/Host/SNI all-byte gate | REJECT: fresh Envoy9 bytes/zero handlers; Go also FAIL by reset/status |
| Settled reuse/three authority negatives | REJECT: original reset1 rather than400/421, including final oghttp2-runtime |
| Individual settled userinfo | REJECT: reset1 with zero origin effects is not required status |
| HEADERS on stream0 | ACCEPT this case only on oghttp2-runtime: peer GOAWAY1 before close, zero origin effects; not a runtime candidate acceptance |
| Zero WINDOW_UPDATE | ACCEPT this case only on oghttp2-runtime: peer GOAWAY1 before close, zero origin effects; not a runtime candidate acceptance |
| Unexpected CONTINUATION | REJECT candidate regression: peer closes with received_frames=[]; previously passed on baseline |

The direct runtime selection gives20/23 and preserves18 of the baseline19
passing cases. Its original child exits1. HEADERS0 frame SHA256 is
e0b2ed24599a6f359c7084119b88a00160c1df62be1ff18a2a5e2a761b6ea4e3;
zero WINDOW_UPDATE is
04a80e2c6fcf2fde744d587d46b0b5c124293d79ace6a17bcc03d13709e59d79.
Separate relay diagnostics reproduce peer RST1 and preserve distinct client
CANCEL8 controls; they do not replace direct deadlines/original assertions.
C's source-ordering explanation remains scoped: no internal callback trace
proves a particular queued GOAWAY on the regressing CONTINUATION case.

## D: Reproduced Defects And Corrected Scope

**REJECT D8494aa2/codeb58e7bb and be26f55 bounded security PASS; ACCEPT
ee67bdd only for the corrected bounded research fixture and tested negatives.**
Final D report/evidencecbc73f5 changes no observer executable bytes and accurately
retains the fourth finding and corrected source.

F's overlay edits no D file and reproduces four consistency failures within
the trusted-signer boundary. They are not a claim to detect a compromised signer.

1. A signed final rejection could be overwritten by final allow, hiding earlier
   dial/HEADERS effects. be26f55 makes final decisions immutable.
2. Two request IDs could share the rejected downstream connection/stream;
   binding the allowed alias hid its HEADERS/handler effects. be26f55 reserves
   each downstream identity at request registration.
3. A request/bind/handler ledger without corresponding captured HEADERS could
   be labeled complete/PASS. be26f55 requires earlier matching request HEADERS.
4. That first fix checked only the initial HEADERS frame. A handler recorded
   before the later END_HEADERS CONTINUATION still passed. ee67bdd requires a
   successfully completed HPACK block at an earlier captured sequence.

At ee67bdd all four attacks reject, the forbidden HEADERS/DATA positive control
rejects, and the full existing race/live verified TLS suite passes. Prior failed
evidence remains retained and superseded only for these fixes. The actual
ordinary9-byte ACK remains current-contract FAIL while bounded research may
PASS under its complete fixture assumptions; module01_security_gate_pass
stays false. Final decisions retrospectively flag effects, never prevent them.

No authenticated complete Envoy downstream-to-origin production dispatch map,
exact opaque HPACK dynamic-table mutation trace, complete H2 conformance engine,
system-level loss authority or production tenant/config integration is proved.
HMAC protects supplied events; it cannot prove an honestly omitted event did
not occur. The tested fixture PASS cannot become original-contract/runtime GO.

## E: Accepted-Module Regressions

**ACCEPT Edd1eaa4 local Module00/02/03 regression evidence and the narrowly
scoped a8e27f2 namespace helper change.** Independent complete rerun has11
packages,89 top-level tests,151 subtests,0 skips. Actual Compose/PostgreSQL,
Redis, NATS JetStream, mTLS, credential/image/stale-volume controls, signed v1,
LKG/trust/rollback/drain, tenant/RBAC/OIDC tests and dashboard/contract gates
execute with all exits0. TCP readiness and `go test -p 1` scheduling persist.
The helper only extends05[ab] to05[abc]; no stale-volume assertions are changed.
Containers/networks/volumes are absent and private fixture material is removed.
This is not Module01 or final integration/scanner/hosted acceptance.

## Resources, Integrity And Retained Failures

TLS remains verified on all exercised hops; wrong/expired/untrusted negatives
are retained in the original matrices. All fixtures/listeners are loopback-only;
no public third-party load/security endpoint was used. No dependency manifest,
lockfile, production authorization/TLS or protected evaluator change is accepted.
Native prlimit has no memory/PID cgroups or immutable rootfs. A's buffered and
disk bounds are finite measured limits, not hard total TLS/process-memory bounds.
No production capacity, crash cleanup, global streaming or resource eligibility
claim follows. Root's full gate obligations remain separate.

First D checkout01 hit full12GiB `/tmp` before tests; its incomplete receipt
and empty manifest are explicitly ineligible. Only F's owned partial checkout
was removed. D04 hit linker ENOSPC before overlay; no semantic conclusion
follows. Later compiles use an owned disk-backed TMPDIR. A01/02 settlement
failures and the unsynchronized EOF assertion failure remain retained; A03
supersedes those source/probe conditions with complete cleanup and proof.
F clean clones remain cache-only, with owned private fixtures removed.

Final `scripts/sprint05c-f-checks.mjs` holds the shared lock through protected
tests, syntax/format/whitespace, retained artifact hashes, staged exact reviewed
source/F evidence secret scanning and cleanup. The pinned offline gitleaks image
has no network, runs without capabilities as the current UID and reads source
mounts read-only. Staging avoids the policy's ignored `.local` path, so reviewed
inputs are actually scanned. Its exact receipt and final integration gates
must be assessed independently of the scoped verdicts above.

Executed `checks-01` on clean Fa951e86:677 retained hashes verified,555 staged
inputs scanned, all11 protected unit tests pass with zero skips, syntax/gofmt/
whitespace pass, gitleaks exits0 with `[]`, scanner container/stage absent.
The initial empty ENOSPC manifest remains explicitly ineligible. Closeout checks02
add the final D report and explicit55 protected-source comparisons across all
five reviewed heads plus unchanged dependency manifest/lockfile assertions.
Checks02 passes697 hashes/576 inputs,55 protected comparisons, unchanged
dependencies and the same clean scanner/cleanup result. The unchanged overlay
fixture is subsequently renamed `.go.txt` so ordinary package discovery cannot
include it; only Go's explicit overlay exposes its virtual `_test.go` name.
No executable mechanism or original suite is rerun solely for this report update.

## Integration And Exact Local Gates Addendum

**ACCEPT safe research/test integration and exact local gate evidence at
881fd85cd84e343209b732475e1310f6e6e383e6 only. Runtime and production remain
REJECTED under the findings above.** Reviewed tree is
f923242a13efe0ceeab1218c171ad6c4cdef75ed. Local gates actually tested source
cd32311c81b9eb1b78b0f12c2bf021b0cd40b831, tree
3826a32fa26365d0dd3a8d4519efadffc448912b; subsequent executable source is
unchanged. The intervening changes contain truthful delivery docs and retained
gate evidence. No dependency or protected evaluator change is accepted.

F committed the new independent audit collector before execution at
160908bc7709db6676476c2e27ae2da89e477261. Executed from the F worktree:

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  scripts/sprint05c-f-integration.mjs 881fd85 \
  /home/tiecont/Projects/aegis-gate/.local/sprint05b-gates/evidence/sprint05c-root/gates-04 \
  evidence/sprint05c-f/integration-01
```

Exit0, complete=true, local_gates_accepted=true. The audit independently proves
all five file transformations in cfdc51c and cd32311 are exact pinned
Prettier3.9.10 output; it binds38 integrated source/report files to accepted
revisions, verifies11 protected files at tested/reviewed heads, and confirms
all8280 currently retained gate-clone source objects match the tested tree.
The narrowly scoped namespace/receipt helper changes retain their accepted
semantics; receipt provenance now includes collector and actual binary hashes.

All58 exported files match raw lengths/hashes; output bodies are byte-identical,
with zero redactions. Both manifests and normalized command metadata verify.
Raw command SHA256 is
7d70ea7226aab49638ce9afcafe3988d1dc3848f461e4580bd8eb56f8766968c.
The four actual gate commands check/security-scan/cleanup/cleanup-volumes each
exit0, with continuous fixture locking. The quality output includes actual
race-p1/integration/PostgreSQL, contracts/schema, vet and formatting checks.
All26 scanner PASS labels are present, secret/history reports are empty, and
filesystem/Envoy/four-image reports have zero HIGH/CRITICAL findings.
Cleanup has zero errors; current project container/network/volume inventories
are empty, all eight private paths are absent, and retained private-material
checking reports57 files/zero matches. This read-only cleanup audit also holds
the shared fixture lock throughout.

Failed gate attempts01/02 at734a9d6 and03 atcfdc51c remain failed and retained.
Their formatting/stale-source and missing-fixture scanner failures are not
silently recast as successful runs. The integration receipt SHA256 is
584080a528889ecfa573ecc0ac3a4672c84939242ddc15fe57a0562456e6f8bd;
its manifest also independently verifies with `sha256sum -c`.

After that audit, root supplied intermediate hosted metadata for run43685396399
at the same881fd85 head. F read both `pr21-intermediate-run` and
`pr21-intermediate-jobs` receipts/output, and both three-file SHA256 manifests
verify with `sha256sum -c` from the root worktree. Metadata reports completed/
success for the run and both foundation-quality/supply-chain-security jobs.
These root-owned receipts are to be retained with the integration. This records
the intermediate metadata result only; F has not audited the complete hosted
logs/artifacts, and CI on the later final integrated head remains separate.
The earlier integration receipt's hosted_acceptance_pending flag is preserved
as recorded. No hosted/runtime/production acceptance is inferred from metadata.

**ACCEPT the receipt/documentation-only extension at
4488524a4fd979f640ff6511c9ff6ced04365d94**, tree
6877d556453c3cf25af675b6e88df3b100337e1c. F inspected its exact13-file delta
from881fd85: eight completion-report lines and the three four-file PR/run/jobs
receipt directories only. The PR-open receipt correctly retains its earlier
IN_PROGRESS observation; later run/jobs metadata records success. All three
receipt manifests verify. No executable bytes changed. Reexecuting the same
locked audit command with revision4488524 and output
`evidence/sprint05c-f/integration-02` exits0 with complete=true, the same
5/38/11/58/8280 verified counts and all four local gates accepted. The final
integrated head and its hosted CI remain root's next checkpoint.

## Agent Completion Report

- Module/status: Sprint05C F independent security review, scoped work complete;
  owned checks pass and runtime acceptance remains blocked.
- Commits/files: F-owned source/report/evidence; exact history and receipts retained.
- Architecture/ADR decisions: none; no contract revision or blanket acceptance.
- Positive tests: A77 controls/native splits; B finite matrix; C direct/relay
  original23; D full race suite and five independent overlays; E actual11/89/151.
- Security negatives: four D false PASS findings found/fixed/reproduced;
  known-length EOF and chunked late-trailer effects proved; all original failures
  and candidate regression preserved with per-case verdicts.
- Performance: finite observations only; no capacity/resource/production claim.
- Known release blockers: original H1/H2 failures, userinfo/status failures,
  CONTINUATION regression, streaming admission conflict, missing production
  observer integration, architecture/human approval and final-head hosted gates.
- Human review: root may integrate only specified safe research/test scope;
  no push/merge by F and no production GO.
- Next unblocked action: root final-source integration and exact-head hosted gates;
  Modules04-12 remain locked.
