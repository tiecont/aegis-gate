# Sprint04-B Agent C Protocol Investigation

Execution plan: preserve all historical Sprint04-A B receipts and original23
probe implementation, original75 manifest/raw inputs/expectations and strict
zero-byte contract. Commit additive test sources before executing proof.

Run the original75 and23 probes unchanged under the full fixture lifecycle
flock. Add bounded immediate/settled H2 frame observations, userinfo stream and
session lifecycle observations before local cleanup, 8/32MiB application versus
transport/window/RSS observations, and independent WS/gRPC/cancellation checks.
Record exact source/tree, argv/cwd, tool/image identity, UTC timestamps, nested
exits and SHA256. Keep every failed attempt. Never equate completed observation
with security PASS. No production parser, shared documentation, public listener,
architecture substitution or expectation change is authorized.

Prerequisite: PR12 merge `cbb5f71db84b9489bf4a6260696bbba29ab4a561`;
coordinator reports both merge-head CI43466312855 jobs PASS. Root/E own hosted
CI and independent acceptance; this scoped work does not grant those approvals.

## Outcome

Investigation complete, candidate **NO-GO**. Original75 rerun: **69/75**, the
same six mandatory failures. Original23 rerun: **16/23**, the same seven
failures. Both expectations and all historical receipts are unchanged. The
17 new diagnostics completed twice; `observation-complete` is a recorder
outcome, never a security PASS. Both diagnostics explicitly record
`semantic_security_pass=false`.

Source commits: `e8c6fb2648b62ee6779c1c89aa48954175539138` (initial suite),
`160abb4` (native trace/cancellation labeling correction). First receipts are
committed in `77c2101`; focused corrected receipts in `a6d12bb`. The final
verifier and transparency test are additive; exact committed source/tree and
receipt provenance appear in `evidence/sprint04b-c/verification02/commands.json`.
No new candidate or production engine was implemented.

## Seven Historical Dispositions

All seven remain **FAIL under their unchanged assertions**. Each row refers
to the preserved `attempt01/unchanged23.json` and additional
`attempt02/protocol.json` observations.

| Historical probe | Disposition and evidence |
| --- | --- |
| `settled-reuse-identity-and-three-authority-negatives` | First two controls return421. Userinfo receives no HTTP response. Native socket closes1001.6ms after request, then Node stream ends/closes with `rstCode=8`, before any local cleanup. Response-plus-end waiter misses this terminal path. Observer/lifecycle omission explains the deadline label; it does not satisfy expected rejection. |
| `individual-settled-userinfo-denial` | Independently reproduces socket close1002.5ms, then Node stream/session close with code8 and no response. Raw settled userinfo receives only setup frames, closes1053.6ms from connection setup and observes no RST/GOAWAY. Peer-sent CANCEL is unproven; native code8 follows socket closure. |
| `raw-H2-HEADERS-stream-zero` | Immediate: peer closes1005.0ms, zero received frames. Settled: observes SETTINGS, ACK and WINDOW_UPDATE, then closes1053.5ms; no error frame. Zero origin connections/bytes/HEADERS/DATA/handlers/errors. |
| `raw-H2-zero-WINDOW_UPDATE` | Immediate close1002.5ms, no frames; settled close1052.7ms, setup frames only. No GOAWAY/RST. All origin counters zero. |
| `raw-H2-uppercase-header-name` | Immediate close1002.0ms, no frames; settled close1052.7ms, setup frames only. No GOAWAY/RST. All origin counters zero. |
| `raw-H2-connection-specific-header` | Immediate close1001.1ms, no frames; settled close1052.9ms, setup frames only. No GOAWAY/RST. All origin counters zero. |
| `slow-reader-backpressure-and-response-cancellation` | Original8MiB producer exhausts8388608 bytes/128 write pauses by200ms. Corrected probe confirms all8MiB cross origin relay, client readable buffer65535 and stream receive window0; origin already completed normally before cancellation. Cancellation latency is null, not a successful cancellation claim. Historical assertion remains failed. |

Raw malformed-input probes attach listeners before the first write. The
settled variant waits for server SETTINGS, sends ACK, then sends the same bad
frame; exact complete sent hex, TLS identities, frame SHA256 and lifecycle
timestamps are retained. Immediate versus settled ordering changes observed
setup traffic (0 versus55 bytes), but neither recovers an error frame. Each
peer close precedes local cleanup and the3500ms observation deadline. Original23
positive malformed controls still observe GOAWAY codes6,1,9, so the collector
can observe error frames on other inputs. These four cases are therefore
observed transport closures, not proven missed error frames or conforming
protocol rejections. No RFC exception or permitted-closure determination was
proved; conformance and root cause inside Envoy remain unresolved. No GO is
inferred from zero origin dispatch or from connection closure.

## Buffering And Cancellation

The32MiB native paused-reader diagnostic produces16842752 bytes by500ms;
the relay has received16777216 DATA bytes on origin stream3, with the producer's
last writable backlog65536. Client readable buffer is65535 and stream window0.
At200ms the second run had produced11468800 bytes; the first run had already
reached16842752. This is timing variation, not a new threshold. The original
raw1KiB-window/no-WINDOW_UPDATE probe independently delivers1024 downstream
DATA bytes and stops its64MiB producer at16777216 bytes after300ms.

The maintained Envoy protocol source already retained at
`evidence/sprint04a-c/upstream/envoy/api/envoy/config/core/v3/protocol.proto:614`
documents the upstream default16MiB stream window/soft codec buffer and24MiB
connection window. `spikes/envoy/config.mjs` explicitly sets downstream65536
but leaves upstream stream/connection windows at defaults. The observed16MiB
upstream receipt is consistent with that setting, not a proof of the exact
location or accounting of every buffered byte. No configuration was changed.

Envoy RSS samples:8MiB72316->82620KiB;32MiB82684->91004KiB. The combined
origin/relay/client Node process also has separate RSS/heap/external samples.
RSS, producer writes, relay DATA receipt, JS readable bytes, and flow-control
windows measure different things. Three snapshots and a bounded producer do
not establish steady memory bounds, leak freedom, fairness or production
backpressure. Application `pause()` does not itself prohibit transport reads.

Client CANCEL API invocation during the incomplete32MiB response closes origin
in16.95ms; the relay records actual upstream RST_STREAM INTERNAL_ERROR(2),
stream3 hex `00000403000000000300000002`. Partial upload delivers exactly16384
DATA bytes on stream5 and closes4.64ms after cancellation, with upstream
RST_STREAM2, hex `00000403000000000500000002`. Thus bounded upstream cancellation
is observed; exact wire propagation of downstream CANCEL8 is not claimed.

## Independent Protocol Controls

WebSocket independently echoes two separate messages and closes1000 on client
and origin. Origin records `lab-origin.test` SNI and rewritten Host. gRPC
independently returns `echo:one`, `echo:two`, statusOK and
`lab-trailer=complete`; a subsequent call reaches origin cancellation in1.59ms.
Its separate origin relay records stream3 RST_STREAM2 with the same exact
control hex. The gRPC observer's TLS/SNI/ALPN, both frame directions and
HEADERS/DATA/connection counters are in each gRPC test's `origin_wire`, rather
than in the distinct native H2 origin counters shown beside every probe.
WebSocket origin identity/messages/close have their own separate record.

These are local streaming/cancellation controls, not active WS/gRPC graceful
drain, production latency, or exhaustive protocol proofs. The original75 also
independently passes its WS, gRPC/trailers, cancellation, origin TLS negative,
pool reuse, weighted-health and encoded-target controls on this run.

## Observer Scope And Retained Corrections

The additive relay verifies CA/SAN/SNI to the native origin, reterminates TLS,
and taps both decrypted directions without rewriting payload. It supports16
active pairs/32 sampled connections and256 sampled control events per direction;
DATA totals and up to32 stream summaries are independent of control samples.
It decodes frame envelopes only, never HPACK or security semantics. Large
coalesced chunks are drained in16KiB slices before the existing bounded decoder;
oversized individual frames still disable classification. No new production
parser is supplied. Final diagnostic records omit0 events and transport errors0.

Downstream client TLS is verified TLS1.3/H2. Envoy-to-relay TLS is TLS1.2/H2;
relay-to-native TLS is separately verified TLS1.3/H2, with matching origin
certificate fingerprints. Server-side `authorized=false` means client
certificates were not requested, not an origin verification bypass. The relay
does not preserve peer IP, original TLS session, mTLS identity, segmentation
or timing. The final focused observer test compares direct/native versus new
relay request/response bodies, encoded target, configured SNI and certificate
fingerprint, including262144 DATA bytes each direction.

First attempt's native H2 socket data tap records zero because Node consumes
the socket internally. Those zeros **are not wire silence evidence**. The
second attempt explicitly marks native wire capture unavailable; raw-client
and independently tapped origin-relay observations are the wire evidence.
First attempt also records a negative8MiB `cancel_ms` because origin completion
predated cancellation. That is an instrumentation error, not negative latency.
The corrected source records `origin_closed_before_client_cancel=true`,
`cancel_ms=null`, `cancellation_proven=false`. First receipts are retained
unchanged and both source versions remain in Git. These observer corrections
grant no security PASS.

## Unchanged75 And Reproduction

Persistent six failure IDs:

- `malformed-HTTP-invalid-transfer-encoding`
- `malformed-HTTP-obsolete-folded-header`
- `strict-ingress-TE-repeated-chunked`
- `strict-ingress-TE-not-final-chunked`
- `supplemental-repeated-transfer-encoding-fields`
- `HTTP2-authority-Host-and-SNI-confusion-rejected`

Four TE cases still return501, not required4xx/close. Obs-fold forwards263
decrypted bytes/one handler. H2 authority confusion still observes9 decrypted
origin bytes/zero handlers. Historical classification of
`000000040100000000` as SETTINGS ACK does not change the strict zero-byte FAIL.
No observation delay, allowance or subtraction changes any acceptance result.

Actual commands from this worktree (Node absolute path retained in receipts):

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/sprint04b-run.mjs evidence/sprint04b-c/attempt01
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/sprint04b-run.mjs evidence/sprint04b-c/attempt02 --protocol-only
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/sprint04b-verify.mjs evidence/sprint04b-c/verification02
```

First two collectors exit0, meaning receipt collection completed; nested
unchanged75/evaluator/unchanged23 all exit1 and protocol collectors exit0.
Attempt01 runs17:01:55.009Z->17:03:55.098Z on2026-11-13. Both runs start with
committed clean sources, hold the shared flock through PKI/setup/traffic/cleanup,
record no remaining owned containers and remove owned ephemeral key material.
No Compose fixture/network is used. Envoy is loopback-only, one worker,
256MiB container memory/2CPUs. Node26.13.0 embeds OpenSSL3.5.9; CLI OpenSSL is
4.1.0 (distinct tools). Pinned image is
`sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`.

The verifier checks both manifests, command stream hashes, source Git objects,
historical receipt preservation, original23 names/failure set, original75 IDs
and six failure IDs. It executes the focused new relay tests, syntax/whitespace
and offline pinned Gitleaks source/evidence/report scans; nested commands and
outcomes are in `verification02/commands.json`. The first verification attempt
stopped at whitespace: the unmodified raw HTTP stderr includes CRLF and a final
blank line. Its receipt is preserved in `verification01`; the second check
scopes whitespace to source/report and verifies raw receipts by hashes without
rewriting protocol bytes. It is not a whole-repo security
scan, hosted CI or independent E acceptance. Root owns those gates.

Principal SHA256:

```text
c0c7b7921da805294c59ae71be28b8aa7063b18ce9eb6d73c3472a6a6cbe1424  attempt01/unchanged75-results.json
a8d9864a723e97bfe6211cb0b7ff8ce1bebad4699c4d464982a9b292b92f15b5  attempt01/unchanged23.json
21f804896fad3789a25bbe94550ff14ee48e5c357c3c59bb6c2609280b660377  attempt01/protocol.json
6518e607b82fe70259cb9f8d3ae2e9f5e93d459a12882a132e59c42d3638ab11  attempt02/protocol.json
```

## Agent Completion Report

- Module:01, Sprint04-B Agent C protocol investigation; status: complete scoped investigation, candidate NO-GO.
- Files: owned `spikes/envoy/sprint04b-*`, `evidence/sprint04b-c/`, this report only.
- Architecture/ADR decisions: none. Architecture owner/affirmative decision remains PENDING in root's decision process.
- Contracts changed: none; historical23/75, strict zero-byte and six mandatory failures retained.
- Positive tests: independent WS, gRPC streaming/trailers/cancellation, partial upload/response cancellation and focused observer checks, with exact commands/limits above and raw receipts.
- Security negative tests: original75=69/75 and original23=16/23; raw settled/immediate H2 and userinfo diagnostics remain failed/unproven under original expectations.
- Performance: bounded local buffer/window/RSS samples only; no production capacity, fairness, memory or SLO claim.
- Known risks/release blockers: six mandatory failures; seven supplemental failures; exact internal malformed-frame closure cause and protocol conformance unresolved; native downstream wire trace unavailable; no active WS/gRPC drain proof.
- Human review needed: E independent exact-head review, root local/hosted integration gates and explicit affirmative human architecture decision after technical prerequisites.
- Next unblocked work: maintained strict-ingress capability remediation/research and independent review; Module01 NO-GO, Modules04-12 LOCKED, production BLOCKED. Module00/02/03 code/contracts were not changed.
