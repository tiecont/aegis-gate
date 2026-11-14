# Sprint05B A: persistent llhttp admission feasibility

Result: the narrow test-only feasibility proof passes. Full-message staging
rejects the exact original folded inputs and late folded trailers with zero
origin activity. Prefix streaming exposes 113 origin bytes before a malformed
trailer is available. Module01 remains NO-GO.

The binding now retains one llhttp parser and its callback settings
across independent `feed(Buffer)` calls. It compiles unchanged released
llhttp9.4.4 sources into the Node process. No parsing subprocess, parser fork,
production runtime, corpus change or engine decision is introduced.

## Implementation and boundaries

`spikes/envoy/sprint05b-llhttp-addon.c` exposes `createParser()` with `feed`,
`finish` and idempotent `close`. Each completion returns `HPE_PAUSED`; the next
feed resumes the same parser and consumes only new input. Returned `consumed`
is local to that feed, `totalConsumed` is cumulative, and an unconsumed pipeline
suffix must be resubmitted. Non-pause errors and EOF are terminal. Closing
removes the wrapper and frees the allocation; GC is a fallback. The maintained
API owns framing and validation. No body, field or target bytes are retained by
the binding. The parser/settings allocation measures 344 bytes on this build.
EOF after a completion pause performs llhttp's zero-byte post-message
transition before calling its EOF API. All leniency flags remain strict.

Native limits are 32 KiB per feed, 16 MiB lifetime wire bytes, 8 MiB decoded body,
16 KiB field/value bytes (headers and trailers combined), 2048 target bytes,
1024 messages and 1,000,000 calls. These are test limits, not product policy.
`sprint05b-a-admission.mjs` has four TCP connections including handshakes,
one 32 KiB slab per admitted connection, at most 128 KiB allocated staging,
four queued messages, a pause threshold of two messages, 700ms idle timeout,
1200ms absolute request deadline, 1000ms origin deadline and 16 KiB stream high
water marks. It waits through trailers, forwards unchanged complete requests
sequentially over verified TLS, pipes responses with backpressure and destroys
the upstream on client cancellation. The loopback fixture checks edge SNI but
does not implement tenant/Host authorization. It is not an edge runtime.

`sprint05b-admission.mjs` is a separate sequential staging experiment used by
the harness, not a second native parser API. It enforces fixed 32 KiB memory and
128 KiB file caps, handles partial writes and uses 16 KiB disk read chunks. Its
tests cover cancellation, private
temporary file cleanup and unchanged bytes over verified origin TLS. The
single disk experiment is serialized; it is not a production spool manager
with crash recovery, disk reservation, encryption or concurrency admission.

## Measured evidence

Accepted proof at committed source
`95ded76883c7b550285df01139a642a7def24941`, tree
`b4e910624270e81a03297fab9cabdca630287adb`, is in
`evidence/sprint05b-a/run-06/receipt.json`. Root executed the unchanged command
in its socket-enabled environment; CLI A ran the verifier against that receipt
and the committed/current source hashes. The proof records 714 split points plus
one-byte feeds over six inputs, including both exact original obs-fold inputs,
valid and folded SP/HTAB trailers. The original 82-byte folded header rejects
with `HPE_INVALID_HEADER_TOKEN`; the original 111-byte folded TE rejects with
`HPE_INVALID_TRANSFER_ENCODING`. Separate parser instances interleave safely;
truncated EOF rejects; completed EOF succeeds. A 1 MiB body completes across 65
feeds without accumulating the body in native state. Target, metadata, body,
message-count and wire-lifetime limits reject. Build and commands are recorded
with raw exits, tools and hashes.

The complete run exits 0, as do all 11 recorded setup/build commands. The verifier
exits 0. All 34 TLS wire controls and six staging controls complete, including:

| Control | Observed result |
| --- | --- |
| Exact original 82-byte obs-fold and 111-byte folded TE |400, actual peer end, zero origin bytes/dials/handlers/parser or transport errors |
| Folded trailer SP/HTAB, fresh/reused, delayed |400; zero origin activity before final fragment and after rejection |
| Valid unfolded/late trailer |200; exact 142 original bytes and trailer retained |
| Nine CL/TE controls |400; zero origin activity, including smuggled pipeline suffixes |
| Six encoded targets |200; target and full wire bytes unchanged |
| Valid pipeline |200/200; 159 exact original bytes |
| Valid followed by original folded request |200/400; only 62 first-message bytes forwarded |
| Partial upload cancel, idle and absolute deadline |Zero origin activity; deadline 1202.72ms against 1200ms setting |
| Cancel admitted request waiting on origin |Origin response closed in 13.90ms after client cancellation |
| Slow 8 MiB response |42 pause events before cancellation; peak client writable length 49152 bytes |
| Oversized body/header |413 with zero origin activity |
| Eight-message pipeline, four-message cap |Four 200 responses then 429; 248 bytes for four accepted requests only |
| Five connections against cap four |Fifth closes; measured peak four connections and 131072 allocated staging bytes |
| Origin certificate hostname mismatch |502; zero request bytes and verification enabled |
| Disk-staged 96 KiB body |98384 exact request bytes forwarded only after completion; cap 128 KiB |
| Disk cancel, folded trailer and over-cap body |Zero origin activity; temporary files removed |

Recorded downstream identities verify TLS1.3 with HTTP/1.1 ALPN; the observer's 25
origin TLS connections verify the intended hostname. High water marks are
backpressure thresholds, not hard total-memory caps. The 49152-byte observation
is deliberately reported rather than equated to the 16384-byte setting.

Cleanup is inside the same flock: fixture absent, zero sockets, listeners,
native handles and allocated slabs. The complete lifecycle takes 11216ms.
Evidence SHA256 values are:

```text
command.json fa1cf10b91f4a4e460dd3ed1a7b3697558ccb3e2f42a7f0dc560d238bf938e3b
receipt.json 81c8a410c8253b5b4e00083f17a4df8b8b421380f4d30ac677acc177a920da92
verification.json 49ef6bd17e9f3999ea1204e95a1d3ed8e2692004e5bcd82b89fbf882f901bc0d
```

Tools are pinned main Node v26.13.0, GCC16.2.1 and OpenSSL4.1.0. Node binary
SHA256 is `0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`.
Compiler, OpenSSL, curl and Node API header hashes are in the receipt. Upstream
release revision is `816485216511b86459b2e6478190e14c38c14891`; all five
upstream files match the immutable Sprint05A source pins. Generated parser C
SHA256 remains `f3ef756529b7444630717fa5540d4a1c9a1256874bda823c49c5a99c37f89429`.

## Streaming decision

Strict zero-origin-byte rejection of malformed late trailers requires delaying
admission until the complete request is known. The executable harness checks
this delay and a peer waiting for origin progress before sending final trailers.
It also implements the competing experiment: parse and forward a valid prefix,
then feed a malformed trailer. Origin prefix bytes cannot be recalled after
llhttp rejects that trailer. Finite disk staging changes the accepted size cap
and storage location, but still waits for completion. Larger bodies eventually
reach a finite cap; streaming before completion sacrifices the unchanged
zero-byte rejection contract. The run measures 113 origin bytes and one dial
before the folded trailer in the streaming alternative, then
`HPE_INVALID_HEADER_TOKEN`. Full-message staging measures zero bytes/dials at
100ms and 408 when a client waits for origin progress before finishing trailers.

## Reproduction

Use the pinned main Node distribution via the local toolchain link. From this
worktree, with a fresh output directory and clean committed source:

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock .local/toolchains/node/bin/node spikes/envoy/sprint05b-a-proof.mjs evidence/sprint05b-a/run-06
.local/toolchains/node/bin/node spikes/envoy/sprint05b-a-verify.mjs evidence/sprint05b-a/run-06
```

The shared flock covers setup, all fixture observations, hashing and cleanup.
`command.json` retains the child command, raw exit and captured output;
`receipt.json` binds committed source/tree, source hashes, unchanged upstream
hashes, compiler/header/Node identity, commands, assertions and cleanup.
`SHA256SUMS` binds both files. Setup subprocesses download pinned source,
compile and generate disposable PKI; all parsing occurs in process.
The separate `verification.json` records nine raw zero exits: the receipt/source
verifier, committed diff whitespace check, unchanged corpus check and the six
JavaScript syntax checks. No traffic fixture is created by these checks.

## Failed attempts

- Initial source `2d5c68c`: synchronous Node child APIs returned `EPERM` in
  this managed environment even when a child produced output. No fixture was
  created and the wrapper exited 1 before it could write a receipt. Async
  spawning was directly checked with `git rev-parse HEAD` and exited 0.
- `run-02`, source `1e4e896`: exit 1 at strict addon compilation because the
  draft referenced nonexistent `LLHTTP_VERSION_STRING`; numeric released
  macros now supply the version. Raw compiler diagnostics are retained.
- `run-03`, source `8d202e0`: exit 1 after 714 fragmentation checks at the
  completion-pause EOF assertion. The wrapper now executes the maintained
  post-completion transition. Two test handles remained before process exit
  in this failed attempt; the corrected harness uses `finally` to close them.
- `run-04`, source `dbb2153`: native controls pass; exit 1 at loopback bind
  `EPERM`, before traffic probes. Cleanup records zero native handles,
  sockets and listeners and no remaining fixture.
- `run-05`, source `dbb2153`, root socket-enabled environment: 29 wire probes
  pass, then exit 1 at the cancellation helper's vacuous `[].every(...)`
  assertion. The final source excludes cancellation from successful-response
  byte equality and measures actual deadline/cancellation times and response
  pauses before teardown. Cancellation still requires zero origin activity.

## Agent Completion Report

- Module: Sprint05B A, Module01 feasibility only.
- Status: complete for the narrow A feasibility assignment; Module01 partial
  and NO-GO because mandatory streaming/security/release gates remain unmet.
- Commits / files changed: owned Sprint05B addon, admission/staging, build,
  runner, proof/verifier, plan, evidence and this report only.
- Architecture/ADR decisions: no approved architecture change; Module01
  remains NO-GO. No supported Envoy integration is claimed.
- Contracts changed: test-only persistent parser API described above;
  original75/23 manifests, inputs, expectations and evaluators unchanged.
- Positive tests executed: exact reproduction commands above exit 0; run-06
  build, 714 split points, six one-byte controls, interleaved instances,
  completed EOF, 1 MiB body across 65 feeds, valid trailers/targets/pipelines,
  staging/backpressure/cancellation and TLS controls pass. All six JS modules
  also pass pinned Node `--check`; `git diff --check` exits 0.
- Security negative tests executed: exact original obs-fold, SP/HTAB folded
  trailers, truncated EOF, oversized feed and five native limit controls pass;
  all rejection, capacity, deadline and TLS-negative controls above pass.
- Performance data: no throughput, RSS/soak or production resource guarantee.
- Known risks and release blockers: full-message staging conflicts with upload
  streaming; finite caps reject larger bodies; H2/WS/gRPC, full identity,
  end-to-end streaming/resource proof, independent D/F review and human
  architecture/security approval remain outside this narrow result.
- Human review needed: independent D/F review and eventual architecture/security
  decision; root wire reproduction is recorded, not inferred approval.
- Next unblocked module(s): broader independent feasibility validation only;
  Modules04-12 remain locked.
