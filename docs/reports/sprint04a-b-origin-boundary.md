# Sprint04-A B Origin Boundary

2026-11-13 UTC. Branch `test/module01-origin-boundary`, worktree
`/tmp/aegisgate-04a-b`. Investigation complete; **Module01 remains NO-GO**.
Unchanged and diagnostic all75 runs independently reproduce **69/75** with
the same six failures. Nine origin bytes are a SETTINGS ACK, and still fail
the immutable zero-byte contract. No gate, production parser, TLS policy,
candidate configuration, corpus input or expected output was changed.

## Restored Sources and Scope

Read mandatory project rules, architecture, threat/config/quality/risk documents,
Module01 assignment, ADR-011 and Sprint03-A architecture/Sprint03-B E/F/completion
reports, current execution contract and prior B wire report before changes.

Restored the missing owned worktree with
`git worktree add --force /tmp/aegisgate-04a-b test/module01-wire-boundary`
at `256de386559e84b35a4a5126db8bf5a76ad2221e`; created
`test/module01-origin-boundary` and executed `git rebase origin/main`, pinned
to `3e03940848c81751c87bbcec131238abb7d28e1b`. All nine old commits replay
without patch differences: `origin-verification/rebase-map.stdout.txt` records
each old/new SHA. Restored head is `76397e7d88db137c18e3b735491ae3e4c8be57a7`.

Historical attempts01-04, both verification directories, receipts and prior
report are preserved. Original manifest and source hashes validate against
their original Git objects; historical proofs are not rebound to rebased SHAs.
The old branch remains intact. The historical unchanged68/75 weighted-health
failure, attempt01 timeout/interruption and preflight failures remain evidence;
later69/75 observations do not erase or dismiss them.

Owned changes are additive test-only `spikes/envoy/wire-*`, B evidence/report.
No other worktree, shared gate, merge, agent, public listener, third-party test
or upstream publication was used. Existing local Node/packages are exposed
through ignored directories only. Required source commits precede proofs:

| Commit | Purpose |
| --- | --- |
| `9deb50b9e4eb1eb1f6f8139a590202deea9d454a` | Native H2 direct/observer identity control; verified locked fixture cleanup |
| `1ca8a5492000181672daa30db6547c160082303d` | Retained dependency preflight failure; clean source for attempt05 |
| `50112658defa32645fa2dce4f683a301ce3ff5c9` | attempt05 evidence; committed source for origin verification |

The report/evidence and receipt commits follow these sources. Root can inspect
the full branch against `origin/main`; do not independently replay original
pre-rebase commits on top. Root owns integration and E owns independent review.

## Nine Decrypted Bytes

Both75 runs record **nine decrypted bytes, zero handler invocations, zero
parser errors, zero transport errors** in
`HTTP2-authority-Host-and-SNI-confusion-rejected`. The first Host variant
violates the byte assertion, so that case does not establish the later variants.

The diagnostic trace first records connection1 with verified origin SNI
`lab-origin.test`, H2 ALPN and candidate-side TLS1.2. It receives a24-byte H2
preface,39-byte SETTINGS,13-byte WINDOW_UPDATE and172-byte stream1 HEADERS
for the valid H2 control. At `2026-11-13T09:54:05.593Z`, the next chunk/frame is:

```text
000000040100000000
length=0 type=4(SETTINGS) flags=1(ACK) stream=0 bytes=9
SHA256=a9fd441cc14ae4b467f3ea0a0ed70de71bb5834db34815eca9cceb70017adfd6
```

The independent warm-valid-then-Host-denial probe isolates exactly this ACK on
the existing connection during rejection:421, nine bytes, zero new connections,
zero handlers and zero parser/transport errors. Its interval contains one frame
and no HEADERS or DATA. These are connection control bytes, not TLS handshake
records or a dispatched request. The diagnostic decoder observes frame
envelopes only; it does not decode HPACK or claim exhaustive conformance.

**The zero-byte contract fails.** No byte subtraction, control-frame allowance,
sleep in the immutable test or changed counter is used. The warm probe's
`status=pass` means its observation assertions completed; its explicit
`zero_byte_contract=FAIL` remains authoritative for the contract. Its whole-probe
handler/byte totals include the preceding valid request. Settled and cold
observations do not retroactively make the immediate interval zero.

## Unchanged75 Outcomes

Both lab commands and both evaluators exit1. They execute all75 without skips:

| Failed case | Actual origin/rejection observation |
| --- | --- |
| `malformed-HTTP-invalid-transfer-encoding` |501; zero bytes/handlers/errors |
| `malformed-HTTP-obsolete-folded-header` |263 bytes, one handler, zero parser/transport errors |
| `strict-ingress-TE-repeated-chunked` |501; zero bytes/handlers/errors |
| `strict-ingress-TE-not-final-chunked` |501; zero bytes/handlers/errors |
| `supplemental-repeated-transfer-encoding-fields` |501; zero bytes/handlers/errors |
| `HTTP2-authority-Host-and-SNI-confusion-rejected` | Nine bytes, zero handlers/parser/transport errors |

All other69 pass, including encoded targets/valid pipeline, TLS/SNI/certificate
rotation and invalid-origin certificates, H1/H2, WS/gRPC/cancellation, pool/trust
partitioning and snapshot/generation controls. This is local functional evidence.
The four TE failures are response-contract failures even without forwarding;
obs-fold forwarding and the H2 byte failure are separately classified.

## Observer Transparency and Limits

Three focused observer tests pass in attempt05; all13 focused tests pass again
in origin verification with no skips. The byte control sends/echoes exactly
37843 synthetic bytes directly and through the observer, SHA256
`814492f3243b52ec0c40be131e59025e439d93efe4286906d2a4c61b121615ca`.
Direct/observed certificates match within each fixture; both negotiate verified
TLS1.3 and H2. Wrong SAN, expired and untrusted upstream certificates yield
transport errors with zero decrypted bytes. Wrong downstream hostname and
untrusted CA reject. TLS verification remains enabled on every client hop.

The new native H2 direct/observed controls preserve GET, `/bad%20target`,
`/encoded%2Fsegment?value=%2520`, authority `synthetic-authority.test` and SNI
`lab-origin.test`. Streams1/3 reuse one native connection per path; the marker
header appears only on stream1. Observed traffic is139 decrypted bytes. This
deliberate authority/SNI difference proves that the relay forwards HTTP authority
without binding or rewriting it; the relay is not the authorization policy.

Candidate post-negative controls independently preserve both encoded targets,
rewrite origin authority to `lab-origin.test`, preserve configured origin SNI,
negotiate H2/TLS1.3 on the relay-to-native hop and reuse native connection2 for
streams1/3 without marker-header bleed. Candidate-to-observer TLS1.2 in the
diagnostic75 is a distinct hop; no TLS-session equivalence is inferred.

The observer reterminates TLS and creates a separately verified TLS session.
It preserves the tested application bytes/semantics and configured origin
identity, not original peer IP, authenticated client identity/mTLS, cipher,
session, timing, packet/chunk boundaries or resumption. It is bounded to64 active
pairs,2s handshakes and5s idle timeouts; diagnostic retention is64 connections,
4096 events and65536 decoder bytes/connection. Scalar counters continue beyond
sample limits. The overflow unit deliberately omits112 events; attempt05 probes
omit0. HEADERS/DATA payloads are not retained by the diagnostic decoder.

## Bounded Probe Outcomes

All23 have final results:16 observation/assertion passes, seven failures,
probe/recorder exit1. `recording_complete=false` is the runner's failure flag
because probes exit1; neither75 run timed out and there is no probe fatal error.

| Probe group | Actual outcome |
| --- | --- |
| Cold/settled Host and settled authority |421, zero origin bytes/handlers |
| Immediate warm Host | Nine-byte ACK, explicit zero-byte FAIL |
| Combined authority variants and independent userinfo | Two failures: `user@edge-b.test` operation deadline; zero request dispatch; local timeout/cancellation gives rstCode8, not proof of a peer-sent rejection |
| SETTINGS ACK payload / short PING | GOAWAY FRAME_SIZE_ERROR6, zero origin bytes/handlers |
| DATA stream0 / unexpected CONTINUATION | GOAWAY PROTOCOL_ERROR1, zero origin bytes/handlers |
| HPACK indexed field0 | GOAWAY COMPRESSION_ERROR9, zero origin bytes/handlers |
| HEADERS stream0 / zero WINDOW_UPDATE / uppercase / connection header | Four failures: no received error frame before peer close; zero origin bytes/handlers; exact sent hex retained |
| Post-negative reuse/identity | Two correct encoded targets on native connection2, streams1/3, no marker bleed |
| Paused native reader,8MiB | Failure: all8388608 bytes produced in200ms despite128 write pauses |
| Raw1KiB window, no WINDOW_UPDATE |1024 downstream DATA bytes,16777216/67108864 producer bytes after300ms,256 pauses; origin closes11ms after cancellation, rstCode2 |
| Partial upload |16384 bytes received; closure11ms after cancellation, rstCode0; no exact CANCEL-code propagation claim |
|65 raw concurrent streams |64 handlers; stream129 RST_STREAM REFUSED_STREAM7; held origin streams close after teardown |
| Eight partial H1 headers | All close in3080ms; zero origin bytes/handlers |
|270 TLS connections |256 admitted/14 refused; zero origin bytes/handlers |
|32 partial-header connections, SIGTERM | All close, launcher exits0 in437ms; zero origin bytes/handlers |

These are bounded local observations, not RSS, fairness, exhaustive H2/HPACK,
production capacity, active WS/gRPC graceful drain or SLO evidence. Producer
bytes do not identify which transport layer buffers them. None of the seven
failures is waived or converted into a conformance pass.

## Commands, Cleanup and Evidence

Actual commands from this worktree:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock .local/toolchains/node/bin/node spikes/envoy/wire-run.mjs evidence/sprint04a-b/attempt05
flock /tmp/aegisgate-sprint02-fixtures.lock .local/toolchains/node/bin/node spikes/envoy/wire-closeout.mjs --origin
```

The first exits1, `2026-11-13T09:52:13.688Z` through09:54:50.877Z. The prior
launch failed before fixture creation because a directory symlink appeared
untracked; `attempt05-preflight.json` retains the exact command, error and repair.
No proof is claimed from it. The successful launch starts with committed clean
sources. `attempt05/commands.json` binds full argv/environment, exact times,
exits/signals, executable/source/log hashes. All new proof phases finish.

The outer flock covers unit fixtures, both full lab/container lifetimes, probes,
process/container stops and fixture-secret deletion. Cleanup polls owned
launchers, checks Docker mounts restricted to this worktree, verifies no owned
containers remain, then removes the fresh `wire-proof-*` and three `envoy-run-*`
directories. The record lists those four directories and an empty remaining
container list. No B live fixture remains. The old committed evidence is retained.

The second command exits0 on clean source `5011265`: seven syntax checks,
13 focused tests, source whitespace, five attempt SHA256 manifests/original
source checks, preserved old evidence diff and nine-commit rebase map all pass.
All75 IDs,41 negative raw hashes, encoded controls and raw/expected source
hashes match both historical baseline `e5adeb4` and current main `3e039408`.
The baseline corpus hash is
`8dd056bb69f53e0a41bf6445c7054f2345ce969d3c22784a7567268e0733f141`.

Offline pinned Gitleaks source/evidence scans exit0:117188/1550433 bytes,
no leaks. Exact scanner digest/options and hashes are in
`origin-verification/commands.json`. This is scoped secret scanning; no full
repository gate, SCA, hosted CI or independent acceptance is claimed by B.
Report-only scan and final status/manifest receipts follow separately.

Node26.13.0 SHA256
`0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`,
OpenSSL3.6.5; Ryzen7 4800HS,16 logical CPUs,24573239296 memory bytes. Pinned
Envoy1.40.2 image digest
`09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`,
one worker,256MiB container memory,2 CPUs. No fixture keys/certificates are
committed. Evidence SHA256 (relative to `evidence/sprint04a-b/attempt05`):

```text
21baa8697b314070855a99695ad0f5edaa5a6c476a42ed1f3c4bf389418fb761  unchanged75-results.json
21c64e8fde2e6b846bbf13720d5ac0c483760e69dd0d488cb1a5a7f8806976a2  diagnostic75-results.json
b2e286a6fe7f3aa19c6cb03f2515c9c034c82afffa9d546cb90771e917e250d4  diagnostic-wire.json
cf2ae06c5594871f6f8947fc9acb22eed99d69212a0f26b3ba9f758f4a903101  probes.json
ebf316ae62f28c5bf911e25ca71e764e8386a358377876a4838e58203f8c7d40  commands.json
```

## Agent Completion Report

- Module:01, Sprint04-A Agent B origin-boundary investigation.
- Status: complete investigation and evidence; candidate NO-GO.
- Commits/files: restored/rebased prior B work; sources/evidence listed above;
  current report and final receipts follow. No merge or shared gate edits.
- Architecture/ADR decisions: none. Classification does not waive zero bytes.
- Contracts changed: none; immutable75, raw inputs, outputs and encoded/pipeline
  controls remain byte-identical.
- Positive tests executed: both75 runs69/75; new native H2 and byte/TLS controls;
 13 focused tests; exact commands/exits in evidence above.
- Security negative tests executed: unchanged75 failures and23 bounded probes;
  seven probe failures retained, explicit control-byte failure preserved.
- Performance: bounded local observations above; no production capacity/SLO claim.
- Known risks/release blockers: six mandatory failures, userinfo deadline,
  four missing error frames, native-reader buffering, historical weighted-health
  failure and Pingora maintenance warnings remain unresolved.
- Human review needed: root/E inspect committed code, original/rebased provenance
  and manifests; independently reproduce from a fresh output under the full
  fixture lock. Required human architecture approval remains outstanding.
- Next unblocked work: obtain a maintained pre-normalization parser/validator
  path meeting unchanged framing, authority, response and zero-byte contracts;
  rerun all75 plus relevant probes independently. No eligible candidate or GO
  is established. Modules04-12 stay locked; production remains blocked.
