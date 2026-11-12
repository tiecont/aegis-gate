# Sprint04-A B Independent Wire Review

Branch `test/module01-wire-boundary`, worktree `/tmp/aegisgate-04a-b`.
Executed 2026-11-12 UTC / 2026-11-13 Asia/Ho_Chi_Minh. Investigation complete;
Module01 remains **NO-GO**. No gate, candidate, production parser, TLS policy,
shared harness, immutable corpus or expected result was changed. No agents,
merges, public listeners or external security traffic were used.

## Result and Failure Classification

Pinned Envoy1.40.2 Host retention reproduces the mandatory H2 failure with
**nine decrypted bytes, zero handlers, zero parser errors, zero transport
errors**. The unmodified run in attempt02 completes all75 at **68/75**:
the historical six failures plus `weighted-health-check-failover-and-recovery`
(`24 !== 30` for the required40-request weighted distribution). The diagnostic
run completes all75 at **69/75**, with exactly the historical six failures.
Attempt01 diagnostic also completes69/75. The extra health failure is retained,
not dismissed as environmental or overwritten by the later passing observation.

The six persistent failures are:

- `malformed-HTTP-invalid-transfer-encoding`
- `malformed-HTTP-obsolete-folded-header`
- `strict-ingress-TE-repeated-chunked`
- `strict-ingress-TE-not-final-chunked`
- `supplemental-repeated-transfer-encoding-fields`
- `HTTP2-authority-Host-and-SNI-confusion-rejected`

Obs-fold sends263 decrypted bytes/one handler. Four TE cases emit501 instead
of the required4xx/close, with zero origin bytes. These remain separate failure
classes. No passing count or zero-handler observation grants architecture GO.

The diagnostic trace identifies the nine bytes as:

```text
000000 04 01 00000000
length0 type4(SETTINGS) flags1(ACK) stream0
SHA256 a9fd441cc14ae4b467f3ea0a0ed70de71bb5834db34815eca9cceb70017adfd6
```

They are HTTP/2 connection setup/control traffic, not TLS handshake records,
HEADERS, DATA or a dispatched request. Connection1 already carried the valid
H2 control: 24-byte preface, SETTINGS, WINDOW_UPDATE and stream1 HEADERS.
The delayed SETTINGS ACK arrives on that same verified origin connection
during the subsequent rejection interval. There is no additional origin
connection or request frame in that interval. Cold Host denial observes no
origin connection/bytes; settled Host and authority mismatches return421 with
zero bytes. Immediate valid-then-denied probes repeatedly observe the same ACK.

**The unchanged contract still fails.** No time-window subtraction, control
frame allowance, sleep inserted into the immutable test, changed counter or
relabeling makes nine bytes zero. The warm observation probe's `status=pass`
means it successfully records the observation; its explicit
`zero_byte_contract=FAIL` remains part of the result. Its whole-probe handler
count includes its valid setup request; `rejection_interval` isolates denial.

## Test Tools and Observer Verification

Additive `spikes/envoy/wire-*` files wrap the existing verified TLS relay,
generate bounded synthetic H2 input, inspect frame envelopes and capture
commands/evidence. `wire-trace.mjs` changes only the lab's observer import
through Node's import hook. The lab, corpus, assertions, original observer,
Envoy compiler/launcher and evaluator stay byte-identical. Normal75 has no
hook. The diagnostic trace is additional evidence, not an unchanged-observer
claim. `wire-fixtures.mjs` requires an ancestor holding the shared flock.

Direct/native versus observed TLS controls pass: identical37843-byte synthetic
input and echo, SHA256
`814492f3243b52ec0c40be131e59025e439d93efe4286906d2a4c61b121615ca`,
matching certificate fingerprint, TLS1.3 and H2 ALPN. The origin receives exactly
the same bytes and configured `lab-origin.test` SNI. Wrong SAN, expired and
untrusted upstream certificates produce transport errors and no decrypted
HTTP bytes; downstream wrong-host/untrusted CA handshakes are rejected.
No verification bypass is used. A native H2 positive control also passes in
the focused suite. Fragmentation and decoder overflow are explicitly tested.

Final candidate identity/reuse controls preserve GET and both encoded targets,
rewrite authority to `lab-origin.test`, negotiate H2 and verified TLS, and use
native origin connection2 for stream1 and stream3. A synthetic header appears
only on the first request, confirming no observed header bleed after raw
negative traffic. The observer sees candidate-side TLS1.2 in diagnostic75;
the relay-to-native origin negotiates TLS1.3 in the new probes. These are
distinct TLS hops, explicitly recorded rather than conflated.

## Bounded Probe Results

Final attempt04: **23 probes,16 observation/assertion passes, seven failures**;
probe process/recorder exit1. All results and earlier attempts are retained.

| Probe | Actual outcome |
| --- | --- |
| SETTINGS ACK with payload; PING seven bytes | GOAWAY FRAME_SIZE_ERROR(6); zero origin bytes/handlers |
| DATA stream0; unexpected CONTINUATION | GOAWAY PROTOCOL_ERROR(1); zero origin bytes/handlers |
| HPACK indexed field0 | GOAWAY COMPRESSION_ERROR(9); zero origin bytes/handlers |
| HEADERS stream0; zero WINDOW_UPDATE; uppercase header; connection header | **FAIL** expected protocol error frame absent; peer closed, no received frame; zero origin bytes/handlers. Exact sent hex retained; no inferred conformance pass |
| Cold and settled Host/authority denial |421, zero origin bytes/handlers; immediate warm denial separately retains9-byte contract failure |
| Combined three-variant check and independent userinfo authority | **FAIL** response/end deadline for `user@edge-b.test`; zero origin bytes/handlers. Stream/session closed and rstCode8 recorded after local timeout/cancellation; no claim this proves a peer-sent RST or bounded valid rejection |
| Post-negative encoded GET/header/pool reuse | PASS, two correct targets, same native origin connection, no synthetic-header bleed |
| Native paused reader,8MiB response | **FAIL** producer completed8388608 bytes within200ms despite pause;128 write backpressure pauses. No small-buffer claim |
| Raw reader,1KiB stream receive window, no WINDOW_UPDATE | PASS bounded observation:1024 downstream DATA bytes; producer stopped at16777216 of67108864 bytes after300ms,256 pauses; cancellation reaches closed origin stream in10ms, rstCode2 |
| Partial16KiB upload cancellation | Origin receives16384 bytes; closes10ms after cancellation; rstCode0 observed. This proves closure, not exact wire CANCEL propagation |
|65 concurrent raw streams |64 origin handlers; stream129 refused with RST_STREAM REFUSED_STREAM(7); all held origin streams close after client teardown |
| Eight partial H1 headers | All close in3045ms; zero origin bytes/handlers |
|270 concurrent TLS connections |256 admitted,14 refused at configured256 cap; zero origin bytes/handlers |
|32 admitted partial-header connections, SIGTERM | All close and launcher exits0 in565ms; zero origin bytes/handlers |

Attempt03 independently observes16,842,752 producer bytes under raw window
starvation, cancellation11ms,256 admitted connections and350ms drain.
Attempt02 observes255 admitted (one other connection occupied capacity),
32ms upload cancellation,3051ms header timeout and299ms drain. These are local
observations, not production memory, fairness, capacity or drain guarantees.

## Immutable Sources, Commands and Evidence

Every proof starts with committed clean sources and binds executable hash,
source hashes, exact argv/environment, UTC start/end, nested exit/signal,
stdout/stderr SHA256, origin observations and evidence SHA256 manifests.
`verification/immutable-raw-expected.json` verifies75 IDs,41 raw negative hashes,
encoded controls, zero-byte rejection contract and baseline-identical source
hashes for all raw/expected assertions against
`e5adeb4c3ea163d0028c9f29bed07b1128fb1065`. Baseline manifest hash is
`8dd056bb69f53e0a41bf6445c7054f2345ce969d3c22784a7567268e0733f141`.
All four attempt manifests verify; each historical source hash matches its
recorded Git object, including sources later improved in additive tools.

From this worktree, actual top-level commands were:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock .local/toolchains/node/bin/node spikes/envoy/wire-run.mjs evidence/sprint04a-b/attempt01
flock /tmp/aegisgate-sprint02-fixtures.lock .local/toolchains/node/bin/node spikes/envoy/wire-run.mjs evidence/sprint04a-b/attempt02
flock /tmp/aegisgate-sprint02-fixtures.lock .local/toolchains/node/bin/node spikes/envoy/wire-run.mjs evidence/sprint04a-b/attempt03 --probes-only
flock /tmp/aegisgate-sprint02-fixtures.lock .local/toolchains/node/bin/node spikes/envoy/wire-run.mjs evidence/sprint04a-b/attempt04 --probes-only
flock /tmp/aegisgate-sprint02-fixtures.lock .local/toolchains/node/bin/node spikes/envoy/wire-closeout.mjs
```

All four recorders exit1, preserving candidate/probe or incomplete failures.
Attempt01 initially failed clean-source preflight before fixtures; its rerun
has an unchanged-run240s timeout and manually terminated incomplete probes,
but a complete69/75 diagnostic run. Preflight/interruption receipts name exact
cleanup commands; the outer flock remained held through owned container stops.
Subsequent tools bound operation deadlines, preserve partial progress and
clean matching worktree-specific launchers. No B launcher remains after proof.

The closeout command exits0: seven syntax checks,12 focused tests, source
whitespace, historical hash checks, and offline pinned Gitleaks source/evidence
scans all pass. Scans inspect106950/993304 bytes and find no leaks. Exact
focused-test argv and scanner digest/options appear in
`verification/commands.json`; this is scoped secret scanning, not full
repository SCA/security-scan or hosted CI. Root owns those gates.

Node26.13.0 executable SHA256
`0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`;
OpenSSL3.6.5; AMD Ryzen7 4800HS,16 logical CPUs,24573243392 memory bytes.
Envoy uses pinned image SHA256
`09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`,
one worker,256MiB container memory,2 CPUs. Existing Node/dependency directories
are linked only inside ignored local fixture/tool directories; no shared file
was edited. No PKI key/certificate is included in evidence.

Principal evidence SHA256:

```text
366259e005720539d4f29e2bfa607f4b36d6b9c4337f338cc31ee06a8d2ab5eb  attempt02/unchanged75-results.json
497ebaddc6ce91ea7a93a29382bec398ae834ef0c178d8084e7706bb92365dbf  attempt02/diagnostic75-results.json
465f159d9ec98da83e23021a5e6ed37c1a9d2bcc093e8fe2268668a50d894f33  attempt02/diagnostic-wire.json
29cb03d79ba9995b123069fe11d3e58f5524aa82baa68d175a27be6c4da35776  attempt04/probes.json
cad46ee7341a067e10550f72fc0beba12d3c623a2a8b47eb976ee1e5cd73e405  verification/immutable-raw-expected.json
```

## Observer Limits and Required Next Work

The relay reterminates TLS and establishes a separately verified TLS connection;
it is byte/semantic transparent for these controls, not TLS-session, peer-IP,
client-certificate, cipher, timing, segmentation or resumption transparent.
It preserves configured origin identity, not an original authenticated client
identity. It has64 active pairs,2s handshake and5s idle deadlines. Per observer,
only64 connection samples and4096 events are retained; omitted events are
counted. Scalar total bytes/secure connections continue after sample limits.
The frame decoder has at most65536 pending bytes per sampled connection and
stops classifying after overflow; byte counters continue. It does not decode
HPACK or validate H2 semantics. It retains hashes/metadata, not HEADERS/DATA
payloads. Small synthetic control frames can retain hex. Unit overflow test
deliberately omits112 events; final probe evidence omits0.

The origin has native H2 handlers/parser/transport counters; zero handlers alone
never proves zero bytes. The standalone probes configure both test routes as
H2 to isolate protocol observations; immutable75 still uses its original H1/H2
routes. Raw payloads are small test vectors, not a replacement parser or an
exhaustive framing/HPACK suite. Producer counters are application output, not
RSS or a location-specific buffer measurement. No sustained saturation,
multi-tenant fairness, active WS/gRPC graceful drain, production SLO or mTLS
identity transparency is established.

Obtain a supported maintained strict parser/validator that rejects obs-fold
before normalization and meets all unchanged authority/zero-byte/TE contracts.
Investigate the userinfo deadline, missing error frames, weighted health
distribution and observed response buffering without weakening expectations.
Then rerun immutable75 and relevant added probes independently. Human
architecture approval remains required before Module04; production is blocked.

## Agent Completion Report

- Module:01, Sprint04-A Agent B additive wire review.
- Status: complete investigation and committed tests/evidence; candidate NO-GO.
- Sources: `c168a18c41d1a48758110e42e097ce0bcd39ccb6` initial tools;
  `90a3e4c8ffbd826cb908f96e8a0e2b4e80326150` bound waits, attempt02 proof;
  `89146631e8990cdc65f0327237367ac3af9e9c36` detailed observations, attempt03;
  `a79c446f439f8b09d55d0127c7b1fb6c740d7bfc` final identity probe, attempt04.
- Evidence commits: `4ad40a9c827a282cc7868564740e3d21bca8efb5` preflight;
  later source commits also retain prior attempts;
  `737a52ffc97ca60831b113e6c70f829b5ccd478c` final probe evidence and clean
  source for successful closeout. Final report/evidence receipt commits follow.
- Architecture/contract changes: none; root owns shared gate/ADR decisions.
- Positive/security tests: exact commands, nested outcomes and hashes above.
- Performance: bounded local resource observations only; no ranking/SLO claim.
- Risks/review: seven failed probes, six persistent75 failures and observed
  extra weighted-distribution failure; independent E review and human decision
  remain outstanding. No merge or downstream implementation was performed.
