# Sprint05B B: H2 lifecycle scoped stop

Status: scoped investigation complete; **no supported H2 repair demonstrated**.
The unchanged aggregate zero-byte assertion remains **FAIL**. Module01 remains
NO-GO; Modules04-12 stay LOCKED and production BLOCKED. Root integration and
independent F review remain separate. No push, merge, shared status/contract
edit, production parser, protocol disablement or authorization/TLS waiver.

## Result and scope

The exact digest-extracted Envoy1.40.2 binary with the unchanged Sprint05A
combined configuration reproduces **73/75 original tests and19/23 supplemental
probes**, both with and without the new passive tap. In both runs the original
`HTTP2-authority-Host-and-SNI-confusion-rejected` test reports **9 decrypted
origin bytes, 0 handlers, 0 parser errors, 0 transport errors**. The folded H1
header is the other original failure. All original75/23 inputs, expectations,
assertions, observation windows and aggregate byte counters are unchanged.

These two full75/23 captures are **native protocol diagnostics**, not complete
container/resource eligibility proof. Hardened-container startup missed the
unchanged original startup deadline on three attempts, with zero executed tests.
The native launcher uses the exact image binary, same combined config and host
libraries, with `prlimit core=0,nofile=1024,cpu=180`; it lacks Docker memory/PID/CPU
cgroups, read-only rootfs and container restrictions. This limitation is explicit
in every native receipt/log. It does not establish an improved candidate.

| Evidence under `evidence/sprint05b-b/` | Outcome | Collector exit |
| --- | --- | --- |
| combined-tap-01/02/03 | Original startup fatal; tests0, no H2 conclusion | 1 each |
| native-tap-01 | Full original73/75, supplemental19/23; raw H2 ACK9 | 1 |
| native-plain-01 | Same original73/75, supplemental19/23 without tap | 1 |
| cause-01 | Hardened container; causal/reuse controls4/4 | 0 |
| source-01 | Retained404 for removed Bazel source path | 1 |
| source-02, settings-source-01 | Correct pinned APIs, codec and dependency sources | 0 each |
| cleanup-01 | Locked recovery of B-owned first failed fixture | 0 |
| verify-01 | Executable scoped STOP, immutable objects/hashes/tests | 0 |

The native collectors exit1 because the unchanged optional17-control diagnostic
contains two Docker-PID-only resource helpers. Both
`paused-native-reader-large8` and `paused-native-reader-large32` fail at
`docker inspect --format {{.State.Pid}} aegis-envoy-...`, since no such native
container exists. The remaining15 observations complete, including partial
upload cancellation, WebSocket, gRPC trailers and cancellation. The failures,
stderr and `recording_complete:false` remain visible; the verifier requires
those exact failures. No successful full17/resource claim is made. Each
original75, unchanged evaluator and original23 process exits1 as expected.

## Endpoint and event order

`native-tap-01/wire.json` duplicates unchanged TLS relay `data` events and
outgoing `write` arguments. It does not replace the relay callback, change
payloads, pause a connection, buffer a response or move any original counter.
Limits are4MiB,64 connections and16000 events. Actual capture:493385 bytes,
2 relay connections,143 events, **0 omitted**. Frame decoding runs offline
through the existing test decoder. Captured bytes are disposable lab traffic.

`analysis-verify-01/receipt.json` maps relay connection1: SNI `lab-origin.test`,
ALPN `h2`; Envoy-side peer `127.0.0.1:37718`, observed origin relay
`127.0.0.1:43183`. This is the already established connection used by the prior
successful H2 request. Original source `spikes/pingora/lab.mjs:330` and the
unchanged TLS relay identify the endpoint roles.

| Sequence | Monotonic observation ns | Direction / event |
| --- | --- | --- |
| 56 | 24065359134106 | Envoy -> origin: preface, SETTINGS, HEADERS stream1 |
| 57 | 24065363313837 | Origin -> Envoy: empty SETTINGS, ACK of Envoy SETTINGS, response HEADERS and END_STREAM DATA stream1 in one chunk |
| 58 | 24065364743771 | Prior `HTTP2-downstream-and-upstream-ALPN` PASS; Envoy->origin offset235 |
| 59 | 24065367772096 | Envoy -> origin: SETTINGS ACK, flags1, stream0, payload length0; offset235..244 |
| 60 | 24065372726019 | Original authority/Host/SNI FAIL; Envoy->origin offset244 |

The sole Envoy ACK before that boundary corresponds to the sole observed
non-ACK origin SETTINGS. Its full nine bytes are `000000040100000000`, SHA256
`a9fd441cc14ae4b467f3ea0a0ed70de71bb5834db34815eca9cceb70017adfd6`.
The original counter increases3032 versus3023. No HEADERS/DATA or new origin
connection occurs inside that failing interval. No byte is subtracted or
exempted. Times are JavaScript relay observations, not Envoy internal scheduling
timestamps or kernel packet-send timestamps. The trace establishes endpoint,
frame identity and ordering; it does not prove an internal event-loop schedule.

## Causal control and source support

The separately added `cause-01` runs the unchanged combined configuration in
the original hardened container, with verified origin TLS and loopback fixtures:

1. Cold mismatched Host returns421 with zero origin TCP accepts, bytes or handlers.
2. Two sequential plus four concurrent valid H2 requests use one origin pool.
3. After the initial SETTINGS exchange is acknowledged, the owned origin calls
   `session.settings({maxConcurrentStreams:31})` while no downstream request is
   in flight. Native origin acknowledgment callback completes. Exactly nine
   bytes reach the origin: the same ACK; no handler or new TCP accept occurs.
4. A subsequent valid request uses the same connection and returns200.

This demonstrates that origin SETTINGS alone cause the ACK independently of a
denied request. The additional fixture awaits native SETTINGS events solely to
isolate cause; it does not replace, insert waits into or change original75/23.
It is **not a fix or exemption**. The original zero-byte assertion still fails.

Pinned Envoy source `b2d89e0ae53916f28770771fbdd49c5c5a2` supports the mechanism:

- `http2/codec_impl.cc:1135`: decoding can generate outbound frames; dispatch
  flushes them through `sendPendingFrames`, which calls adapter `Send` at1768.
- `http2/codec_impl.h:225`: SETTINGS callbacks feed codec state; ACK callbacks
  have no request/authority authorization hook.
- `http/conn_pool_base.cc:126`: the pool explicitly permits requests before
  receiving peer SETTINGS; waiting would impose a latency penalty.
- `protocol.proto:754`: `use_oghttp2_codec` is hidden, work-in-progress, intended
  for removal. The fallback runtime guard is false with a performance-regression
  comment. Neither is offered here as a supported repaired candidate.
- Named windows/custom SETTINGS configure advertised values, not peer ACK
  suppression or a response-completion ACK barrier. Keepalive adds PING traffic
  and cannot establish an aggregate-zero guarantee. No supported causal
  lifecycle setting was identified in the inspected pinned APIs.

`settings-source-01` follows Envoy's exact `MODULE.bazel.lock` registry URL,
verifies source metadata SHA256 and the upstream nghttp2 release archive SRI,
then extracts the SETTINGS receive routine. At `nghttp2_session.c:4420`, a
non-ACK peer SETTINGS queues `NGHTTP2_FLAG_ACK`; the ordinary receive path calls
it with `noack=0` at4470. All seven registry patches are integrity-checked and
their touched files/symbol mentions recorded. This is source corroboration,
not a locally rebuilt Envoy or a claim about every possible implementation.

No Sprint05A windows/HPACK/identity/partition/max-requests experiment was
repeated as a new fix hypothesis. Those mechanisms already failed. Only the
combined baseline reproduction, passive bidirectional capture and additional
causal fixture were executed. No new supported candidate config was invented.

## Executable stop and next condition

The executable stop is `sprint05b-b-verify.mjs`: it requires73/75 and19/23 in
both full native runs, the exact original H2 failure and9/0/0/0 counters, the
explicit resource-helper failures, causal controls4/4, source/tree bindings,
all retained evidence hashes and complete owned-fixture cleanup. It exits0
only when this scoped failure conclusion is reproduced from the retained data;
`security_pass` is always false. It verifies every5647 tracked baseline object
against `8758b1c84b4186449cd79fabae461ca53ee05100`, inventory SHA256
`d0a24bdab306dce04834e71aedc4ea9824053c7267676166bfabb2b3f66a7036`.
Unchanged corpus extraction, all B script syntax checks and11 unchanged
contract/evaluator/TLS-observer/wire-observer/TE-config tests pass.

Stop scope: the inspected released/supported configuration surface has no
demonstrated repair for this all-byte lifecycle overlap. This is not a theorem
that every future runtime/version fails. Reopen B only with a released supported
mechanism that changes peer-SETTINGS/response completion ordering, backed by
source/API evidence; then rerun unchanged75/23 in an eligible hardened runtime,
plus cold/warm/reused/concurrent, TLS/config, H2/gRPC and resource controls.
No polling/sleep, timing adjustment, ACK subtraction, pooling disablement,
protocol downgrade or raw production codec is an acceptable next step.

## Exact commands and provenance

Working directory `/tmp/aegisgate-05b-b`. `NODE` below is
`/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node`, v26.13.0,
binary SHA256 `0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`.
The exact argv, safe environment, tool output, command exits, times and stream
hashes are in each receipt. Docker29.9.3; OpenSSL version is retained per run.
Envoy image is
`envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`;
native executable SHA256
`1d64506e25c1844f146162ddb2ece7010fa4e784faddb40a079021491f1f03cc`.
Each native run independently creates a network-none image container, copies
and verifies this binary, records version/host libraries and removes the
extraction container before testing. It deletes the copied binary on cleanup.

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock env PATH=/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin:/usr/bin:/bin npm ci --ignore-scripts --no-audit --no-fund
# Previous command cwd: /tmp/aegisgate-05b-b/spikes/pingora; exit0, unchanged lockfile.
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05b-b-run.mjs evidence/sprint05b-b/combined-tap-01 tap
"$NODE" spikes/envoy/sprint05b-b-source.mjs evidence/sprint05b-b/source-01
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05b-b-cleanup.mjs evidence/sprint05b-b/cleanup-01
"$NODE" spikes/envoy/sprint05b-b-source.mjs evidence/sprint05b-b/source-02
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05b-b-run.mjs evidence/sprint05b-b/combined-tap-02 tap
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" --import ./spikes/envoy/sprint05b-b-tap.mjs spikes/envoy/sprint05b-b-cause.mjs evidence/sprint05b-b/cause-01
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05b-b-run.mjs evidence/sprint05b-b/combined-tap-03 tap
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05b-b-run.mjs evidence/sprint05b-b/native-tap-01 tap native
"$NODE" spikes/envoy/sprint05b-b-settings-source.mjs evidence/sprint05b-b/settings-source-01
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05b-b-run.mjs evidence/sprint05b-b/native-plain-01 plain native
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05b-b-verify.mjs evidence/sprint05b-b/verify-01
```

Use fresh evidence directory names. Runtime lock covers setup, capture, evidence
hashes and cleanup. The source-only collectors do not create fixtures/listeners.
Every candidate listener is loopback-only. No credentials, PKI files or binary
are committed. The abandoned first fixture was removed by locked `cleanup-01`;
a Created-state container left by attempt02 was removed in attempt03 cleanup.
Final verifier finds no B fixture directory or B native runtime process.
Container cleanup is limited by names and mount paths in this isolated worktree.

Failed history is retained. An initial analyzer invocation to empty `analysis-01`
exited1 because it required the whole collector success flag. The corrected
analyzer requires completed original75/23 command results while explicitly
retaining `overall_collector_complete:false`, errors and resource ineligibility.
It does not change any oracle or repair a failed resource test.

Source commits were made before their measurements. Exact source/tree pairs:

| Capture | Source commit | Source tree |
| --- | --- | --- |
| original container01/source01 | dc0b3dd2f2964e704abeb4a828d84f8a13d43489 | 57af265522771762a40ba284de4c850cc6546dc1 |
| source02/cleanup01 | 540b101eff1aa31aa1e9a4e32008bafb15420b9e | 8bea37973768717dd42e79138a05e884a4001dba |
| cause01/container02 | d961720db2e6e09d9efb1f57257f7cf9a3604f3d | 92d641cff5386497d66bfc695a78ab2489ed4376 |
| container03 | bab20ccd117f90f1430103ee3529ad0ae54cd992 | 0a5f8facdcb88b5266eb1c10b1e8095b10e7950a |
| native-tap01 | a43775fe29d6130ab6ad0d5ad45a5280732e3585 | 96233901824e7c29c4bc656140b02f273966151a |
| native-plain01/settings-source01 | 4171d99d51bcac65d669612ae0957dac712c4372 | 017aaf212f955039e13b38a42b59170b470baa9e |
| verify01/analysis | b49b19d3916760752f1b6adb36793508befc2ab1 | d5039be2ec0fa688b1e1f5722b101e6e13b95404 |

Selected SHA256 receipts (each directory also contains a full `SHA256.json`):

| Receipt | SHA256 |
| --- | --- |
| native-tap-01/receipt.json | fbff8d4e98e4045816ddaa7e4492b3616c9aba1e1f848507fb16564fb674aabf |
| native-plain-01/receipt.json | 57ff630a07ee76f303ecc8491640eacf24e107b76cfcc1d2b160c268118aca5a |
| cause-01/receipt.json | d3d1ce3b3bbc38755fe798499f1c1dcf52f5aa0ff738837d8a64b33d1a33d358 |
| source-02/receipt.json | 212621f32a9f1dabbc77f8cc74545dfcb17fd89ad0f95f4f0c7477924500ab54 |
| settings-source-01/receipt.json | f1a0d2edb37ace6706a787da172d936a3d02cbe4ef100ef98424daec7d470d5a |
| analysis-verify-01/receipt.json | ee319c3d8c0f08824bd4c7270a56e4f22bfec067c5d357e0a6061344a7a6932e |
| verify-01/receipt.json | 625c738e96f15922531854dca1fc3e815fb08790b734c6d0ed4d49b0ebee655c |

The final owned source/report/evidence package and final scan commands are
enumerated by `evidence/sprint05b-b/checks-01/receipt.json` and the package
`evidence/sprint05b-b/SHA256.json`; the latter excludes itself. No full project
`make check`, broad security gate, hosted CI, release/security signoff or
independent F acceptance is claimed by B.

## Agent Completion Report

- Module/status:01, Sprint05B B investigation complete; supported repair blocked.
- Commits/files: owned `spikes/envoy/sprint05b-b-*`, this report and B evidence.
- Architecture/ADR decisions: none; original zero-byte gate remains binding.
- Contracts changed: none; original75/23 and all5647 baseline objects unchanged.
- Positive tests: hardened causal controls4/4; unchanged verification tests11/11;
  original valid H2, H1/H2 streaming, reuse, WS, gRPC, TLS/config controls retained.
- Security negative tests: unchanged H2 fails9 bytes in both full native runs;
  folded header and four supplemental failures remain; no repaired claim.
- Performance: native results are not cgroup/resource/capacity eligibility proof.
- Known risks/blockers: H2 all-byte gate, obs-fold, supplemental failures,
  original hardened startup, native resource helpers, independent review/gates.
- Human review: existing architecture/security gates remain required.
- Next unblocked work: root/F can reproduce the exact scoped STOP. Any new
  repair hypothesis needs a released supported mechanism and fresh eligible
  unchanged-oracle proof. Module04 remains locked.
