# Sprint05C B: H2 origin isolation scoped stop

Status: targeted investigation complete; **no eligible H2 repair**. The unchanged
original H2 case remains **FAIL**. Module01 stays NO-GO, Modules04-12 LOCKED,
production BLOCKED. No architecture/contract change, push or merge.

## One New Mechanism And Its Causal Difference

Tested one released maintained mechanism: Go1.27.4 public
`net/http.Transport.Protocols` with HTTP2 enabled and HTTP1 disabled on H2
origin routes. `http.Server` and `httputil.ReverseProxy` supply the maintained
downstream codec and streaming proxy. No raw production parser/codec, internal
Go API, ACK manipulation, pool disablement, observation-window change, window
tuning, sleeps in original tests or protocol downgrade was introduced.

The source-supported hypothesis was inline ACK flush before later response
frames. Pinned Go `src/net/http/internal/http2/transport.go:2066` reads and
processes frames serially. `processSettings:2723` locks the writer, updates
settings, calls `WriteSettingsAck` and `Flush` before returning. This differs
from the retained Envoy/nghttp2 generated-frame/deferred-send lifecycle in
[Sprint05B B](sprint05b-b-h2-lifecycle.md). It is a supported alternative runtime
mechanism in a lab adapter, not a proposal to replace the accepted architecture.

The hypothesis produces a visible ordering difference. In
`go-ordering-02/original75-wire.json`, relay connection1 uses verified
SNI=lab-origin.test and ALPN=h2. Event58 receives origin SETTINGS; event60
observes the exact nine-byte ACK at offset135; event61 ends the preceding
successful H2 request. At event62 the original identity case fails, with both
offsets unchanged at144. Thus no origin byte occurs in that original failing
interval. These are JS relay observations, not kernel/internal timestamps.
The passive recorder's inherited direction names `envoy_to_origin` and
`origin_to_envoy` denote proxy/origin endpoints here; the proxy is Go.

**Zero measured bytes does not repair the case.** Its third userinfo input is
rejected by Go with RST_STREAM1/NGHTTP2_PROTOCOL_ERROR rather than the unchanged
required400/421. Go's pinned `httpcommon.go:590` rejects `@` authority with
`userinfo_in_authority`; server.go:2197 converts this invalid request into a
stream protocol error. No reset is credited as a successful status response.

## Actual Original Results

The lab adapter was deliberately narrow. It does not reproduce Envoy's H1
strictness, health balancing or connection/stream resource policies. The
existing Envoy **73/75 and19/23 remain the last accepted baseline measurements**;
they are not replaced by this adapter or claimed as freshly reproduced here.

| Fresh capture | Result | Child exit | Interpretation |
| --- | --- | ---: | --- |
| go-ordering-01 | Incomplete original suite; H2 FAIL logged |1 | Source-filter fixture defect; no aggregate score |
| go-ordering-02 original75 | **56/75** |1 | Original H2 FAIL, origin counters0/0/0/0 |
| go-ordering-02 unchanged evaluator | FAIL |1 | No repaired candidate claim |
| go-ordering-02 original23 | **17/23** |1 | Six failures retained |
| go-ordering-02 additive matrix | **11/12** |1 | Userinfo status requirement still FAIL |
| recovery-01 | Removed first attempt's owned staging directory |0 | Separate recovery, no retroactive cleanup PASS |

The complete75 retains19 failures: CL/TE and TE/CL, obsolete folding,
Connection-nominated trusted header, three absolute-target authority/scheme
cases, fragment, CONNECT status, two pipelined CL/TE cases, folded TE, four
invalid-TE status cases, original H2 identity, weighted health failover and the
bounded reference benchmark (two errors). All failures and raw counters remain
in `original75.json`. This is not a strict-ingress, balancing, capacity or
performance success. Valid encoded targets, HTTP1 pipelines, H1/H2 streaming,
WebSocket, gRPC echo/trailers/cancellation, verified wrong/expired/untrusted
origin TLS negatives, config/certificate rotation, pooling and upload
cancellation execute in that suite and pass.

Original23 failures are: settled three-authority negatives, individual
userinfo, connection-specific raw H2 header,65-stream refusal, eight partial
header timeouts, and270-connection cap. HEADERS0 and zero WINDOW_UPDATE pass
on this different codec, but do not repair the failed original H2 case or
make the other six failures acceptable. No C-owned repair claim is made.

## Executable Boundary And Positive Matrix

The separate matrix tests a controlled counterexample without changing original
inputs or excluding control bytes. Native origin `session.settings` updates
use the ordinary released API; no frame generation code alters the proxy.

| Additional observation | Actual outcome |
| --- | --- |
| Cold Host mismatch |421, zero origin accepts/bytes/handlers |
| Six sequential valid H2 requests |200, same origin connection1 |
| Eight simultaneous slow H2 streams |200, same connection1 |
| Warm Host and authority mismatch |421, zero origin bytes/handlers/dials |
| Warm userinfo |RST1, zero origin effects; required status FAIL |
| Idle independent origin SETTINGS(maxConcurrentStreams31) |Exact nine-byte ACK, zero downstream requests/new dials/handlers |
| SETTINGS(maxConcurrentStreams29) overlapping denied Host |421 plus exact nine-byte ACK, no new dial/handler; aggregate-zero counterexample |
| Two tenant routes, same origin endpoint |Separate connections1/2 |
| Generation1 to2 during slow response |Old response completes generation1; new connection3/generation2 |
| Trust retirement and restoration |503 without new handler; restoration uses connection4 |
| Response streaming cancellation |First4096 bytes arrive; origin stream closes after CANCEL |
| Bidirectional gRPC |Two messages streamed before completion, status0, complete trailer |
| SIGTERM drain |Established slow H2 response completes200; launcher exits0 |

The ACK remains `000000040100000000`, SHA256
`a9fd441cc14ae4b467f3ea0a0ed70de71bb5834db34815eca9cceb70017adfd6`.
The counterexample covers invocation of peer SETTINGS and denied request
through both completions. It is an additive controlled overlap, **not a claim
that original75 saw nine bytes on Go**, or a universal impossibility theorem.
Both control intervals retain every observed byte. SETTINGS alone causing the
same ACK corroborates the prior reviewed Envoy causal evidence by reference.
Inline initial ACK flush is therefore insufficient to guarantee aggregate
zero bytes across independent subsequent peer control activity on a reused
H2 connection. There is no basis for another tuning pass or a second mechanism.

Matrix capture is bounded at2MiB/4096 events:11,090 bytes,91 events,0 omitted.
The original passive trace retains493,225 bytes/174 events/2 connections,
0 omitted. Raw captures contain synthetic owned fixture traffic only.

## Provenance, Reproduction And Limits

Worktree `/tmp/aegisgate-05c-b`, branch `feat/sprint05c-h2-isolation`, baseline
`078d83c0ab1cb1364d0245d4c4f62f0fe0439e97`, tree
`28aa22cf761092e31c84dc3d07d0d7593784afd3`. Only B-owned names are added.
Source was committed before execution; evidence is a separate commit235fe4a.

| Execution | Clean source | Tree |
| --- | --- | --- |
| go-ordering-01 |9e5c6111b9e3a6ede860bd05454975283abecf3c |2295d6259535c025c398b2115d5f2907299e75af |
| recovery-01 / go-ordering-02 |f57a56ccccae96168b62391ceeb7d678f5a8d7a1 |7c47c7718756134daa32669aa653009cd31b5890 |

Pinned Node26.13.0 SHA256
`0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`;
Go archive SHA256 `7ecd542f86ccbbb5017de33ac529872bc48c71f4edb658d63a18d2206f482b9b`;
Go executable SHA256 `de0ae3e082ce7599eae4fb69fa2ef1e43b8f31ffd3fce62cdf81930aa9005050`.
The runner compares cached source, compiler and linker bytes to the pinned
released archive, records its cached ziphash/version and actual buildinfo,
uses GOAMD64=v1/GOTOOLCHAIN=local and strict unchanged npm lockfile install.
This verifies locally cached provenance, not a new sumdb authentication claim.
Successful measured proxy SHA256
`303cbd18d62c843f73e56658de636d2c20e855451139a33bc95604807bc1134d`.

Native prlimit enforces core0/nofile1024/cpu180. There are no memory/PID cgroups
or read-only rootfs; **resource_eligible=false** and **security_pass=false**.
The adapter is fixture-only, not signed Module03 configuration integration.
TLS remains verified on both hops; H2 routes offer H2-only transports and check
negotiated H2 on responses. Per-route/per-generation transports preserve reuse,
trust identity and in-flight snapshot consistency within these finite tests.

All fixture setup, suites, cleanup and hashing hold the shared lock. All
listeners bind127.0.0.1; only the original lab's owned reference container is
used. Ports are dynamic, no fixed networks/public endpoints. Exact argv,
versions, safe environment, exits, source/stream hashes and raw errors are in
each receipt with SHA256.json. The collector exits0 for complete observations
while recording all four failed child exits1. It does not turn them into PASS.

Attempt01 lacked the original lab's127.0.0.1-only source restriction. Its
unapproved127.0.0.2 test failed and later generated an unhandled timeout before
results.json/final cleanup, after the H2 failure had been logged. No completed
score is inferred. Its trace/stdout/stderr and cleanup error remain unedited.
Sourcef57a56c adds the source restriction and owned-process recovery only;
the H2 mechanism is unchanged. Locked recovery finds no live owned process and
removes the retained staging directory. Attempt02 completes all75/23/matrix,
cleans native processes/private fixture material and leaves `.local` empty.

Reproduce from a clean source checkout using fresh suffixes:

```sh
NODE=/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05c-b-run.mjs evidence/sprint05c-b/go-ordering-03
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05c-b-verify.mjs evidence/sprint05c-b/verify-02
```

The verifier accepts only the measured scoped stop, failed userinfo/original
scores, both exact ACK counterexamples, complete capture/cleanup, protected
baseline objects, source bindings and retained failed history. It runs existing
protected tests/syntax/whitespace and pinned offline owned secret scans. Its
exit0 is evidence consistency, never runtime acceptance. Full make check,
security-scan, hosted gates, architecture and independent F signoff are not
claimed here.

Executed `verify-01` at clean source34eb5d4/tree
f79c7741a25a6ee3d48e6e83961d1f909f28e7dd exits0. It verifies54 retained
artifact hashes,91 captured-source bindings and all7,273 baseline objects.
Existing protected tests pass11/11 with zero skips. Every syntax/format check
and the pinned gitleaks8.30.1 source/evidence/report scan exits0; each scan
report is `[]`. Receipt SHA256 is
`df70b57efe196fb01b491d9f98ad28e82990034dba0c1cedac1b0f3b63cd8f59`.
The final report addendum is followed by another owned scan/verification receipt;
no runtime or original-suite execution is repeated for this documentation change.

## Agent Completion Report

- Module/status:01, Sprint05C B scoped executable stop complete; H2 repair blocked.
- Commits/files: B-only source/report/evidence; source9e5c611/f57a56c and evidence235fe4a; final verifier/report commits follow.
- Architecture/ADR decisions: none; no accepted runtime or isolation contract revision.
- Contracts changed: none; original75/23, all-byte counters and deadlines preserved.
- Positive tests: actual commands above;56/75,17/23 and11/12 additive matrix, with all failures retained.
- Security negatives: original H2 still FAIL, userinfo RST1, independent and overlapping exact9-byte ACK; TLS/trust/tenant/config controls as measured.
- Performance: no benchmark/cgroup/resource/capacity success claimed.
- Risks/blockers: failed original/supplemental gates, H1 strictness/resource/health gaps, independent review and existing architecture approval.
- Human review needed: root/F exact-source scoped review; no approval fabricated or requested to continue this completed investigation.
- Next unblocked action: independent reproduction/review of this stop; no further mechanism tuning or locked-module implementation.
