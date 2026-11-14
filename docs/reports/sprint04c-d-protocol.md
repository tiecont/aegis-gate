# Sprint04-C D Protocol And Resource Proof

Status: bounded observer improvement and diagnostic investigation complete;
Module01 **NO-GO**. Original75 and23 expectations, all six Envoy failures and
seven supplemental failures are retained. The9-byte H2 zero-origin-byte failure
is not waived. No production parser, architecture approval or new runtime.

## Scope And Exact Sources

Base main `a325b9ecc086e09467f61b49f17da241bf8e43ea`. Source `9b400cc`
adds isolated Go/Node test-only decoding/capture; exact proof source
`80addb665c00922ec7eb98834b43efe73930c1be`, tree
`82e7c079cf14fecead03eb4f0fa5a86b5ed93b33`, adds relay controls and receipt
runner. All sources are committed before proof; later verification adds
adversarial decompression/continuation bounds and checks them separately.
`evidence/sprint04c-d/attempt-01/commands.json` binds source, argv, times,
tool/image identity, raw streams and hashes. Its12 child commands all exit0;
this means observation collection completed, never candidate security PASS.

`spikes/envoy/sprint04c-protocol.mjs` derives the17 diagnostic scenarios from
Sprint04-B, with only the observer import, capture metadata/final output and
gRPC capture retention added. It neither edits nor executes an alternative
acceptance gate. Original23 is not rerun and remains historical16/23; original75
is not rebuilt/rerun and remains independently recorded69/75. Pinning and
working/Git equality are verified separately. No repetitive75 benchmark.

## Maintained Decoder And Fail-Closed Research

The helper uses existing pinned `golang.org/x/net v0.62.0`,
[`http2.Framer`](https://pkg.go.dev/golang.org/x/net@v0.62.0/http2#Framer)
and [`hpack.Decoder`](https://pkg.go.dev/golang.org/x/net@v0.62.0/http2/hpack#Decoder).
No module/lockfile changes, vendored parser, private fork or production import.
The maintained Framer parses/validates frame envelopes and continuation order;
the maintained HPACK decoder retains compression state across header blocks.
Raw HEADERS/CONTINUATION/DATA and controls are retained only for synthetic
loopback traffic. The decoder emits raw-frame hashes/hex, stream IDs, decoded
fields and full compressed header-block hex. Native TLS identity is retained
beside each bidirectional capture.

Bounds:128KiB retained per connection/direction,16 active/32 sampled origin
pairs,2048 decoded frames,64KiB compressed block,8192 bytes/string,128 fields
and16KiB decoded text per block; HPACK table initially/maximum4096. Streaming
SHA256 and byte counts continue across discarded capture tails. Overflow,
partial frame/block, bad HPACK, invalid continuation, lost bytes, missing
lifecycle, unknown extension/push, unmapped streams, absent identity/generation,
and missing dial registry remain incomplete; semantic security PASS is always
false. `capture_complete` means only the helper's bounded decode/metadata checks
succeeded, not protocol conformance or trustworthy identity authorization.

Adversarial self-tests cover forbidden HEADERS/DATA/RST on reused streams,
partial forbidden HEADERS without a handler, unfinished/interleaved/wrong-stream
CONTINUATION, state-only HPACK table update on forbidden stream, a dynamic-index
reference requiring earlier decoder state, new dial without any handler,
missing/truncated/dropped/open captures, unknown stream maps, duplicate/forged
map metadata, parser/transport errors, frame count/input/decompression bounds.
A received partial block is an incomplete negative, not a clean no-leak result.
Metadata in the offline JSON is caller-supplied; consistency checks do not
authenticate an arbitrary map. No raw frame or metadata-only path grants PASS.

The public HPACK decoder exposes no exact dynamic-table mutation audit log.
Raw table-update/block bytes and the tested stateful reference are evidence of
state progression, not a complete mutation attribution theorem. There is no
authenticated proxy dispatch map from downstream connection/stream to upstream
connection/stream, signed-generation capture, tenant binding, or native Node
client wire tap. The helper is therefore **not a complete ADR012 Option2
observer**. Complete stream-state/HPACK mutation/control causality and identity
instrumentation remain required before considering any proposed-contract gate.

## Fresh Capture Findings

Fresh attempt01 has17 observation-complete diagnostics, no parser/transport
errors and no remaining owned containers. Verified CA/SAN/SNI/ALPN controls
remain enabled. The relay echoes exact encoded target and payload through
native/direct and observed paths with identical configured TLS identity.
Server-side `authorized=false` records that client certificates were not
requested; relay-to-native and clients' origin verification remain enabled.

Four final direction captures represent two reused upstream connections:

| Capture | All decrypted bytes | Retained raw bytes | Result |
| --- | ---: | ---: | --- |
| Native request direction, streams1/3/5 |16810 |16810 |11 decoded frames; no authenticated dispatch/tenant/generation map, incomplete |
| Native response direction |25179723 |131072 |25048651 dropped raw bytes plus partial frame; incomplete |
| gRPC request direction, streams1/3 |525 |525 |11 decoded frames, missing authenticated map; incomplete |
| gRPC response direction |309 |309 |11 decoded frames, missing authenticated map; incomplete |

All-byte streaming hashes are retained even where raw tails exceed bounds.
The four Go-decoded results explicitly return `semantic_security_pass=false`;
no unattributed stream is dismissed as legitimate. Native raw client input hex,
TLS identity, received frame/control hashes and closure lifecycle remain in
individual diagnostics. Node native-client raw capture stays unavailable,
not a zero-byte observation. Raw capture collection/retermination cannot
preserve original peer IP, mTLS client identity, TLS session or timing.

## Seven Retained Failure Dispositions

| Historical failure | Fresh diagnostic observation / disposition |
| --- | --- |
| Combined authority negatives | Host and mismatched authority controls return421; userinfo has no response. Socket closes1002.1ms, then native stream ends/closes with local `rstCode=8`. Original response/end rejection requirement remains unproved and FAIL retained. |
| Individual userinfo | Independent socket closes1001.2ms with no HTTP response; native code8 follows closure. Raw settled input observes only55 setup bytes and closes1054.0ms with no RST/GOAWAY. Peer-sent CANCEL is unproved; FAIL retained. |
| HEADERS stream0 | Immediate closure1004.4ms with0 received bytes; settled1053.6ms with55 setup bytes. No required error frame; zero origin bytes/connections/handlers/errors; FAIL retained. |
| Zero WINDOW_UPDATE | Immediate1002.8ms/0 bytes; settled1052.8ms/55 setup bytes. No required error frame; all origin counters0; FAIL retained. |
| Uppercase header | Immediate1002.3ms/0 bytes; settled1052.7ms/55 setup bytes. No required error frame; all origin counters0; FAIL retained. |
| Connection-specific header | Immediate1000.8ms/0 bytes; settled1052.6ms/55 setup bytes. No required error frame; all origin counters0; FAIL retained. |
| Paused8MiB producer |6684672 bytes produced at200ms;8388608 by500ms and origin completed before cancel. This varies from04B's200ms completion; original23 is not rerun/reclassified. No bounded cancellation proof for the completed8MiB origin; FAIL retained. |

Listeners precede writes; immediate and SETTINGS/ACK-settled malformed probes
use the same original malformed frame bytes. All observed peer closes precede
local cleanup and3500ms deadline. This distinguishes actual observed closure
from local teardown, but does not establish an allowed RFC rejection or Envoy's
internal cause. Missing expected error frames stay unresolved. A response-code
or handler-only assertion cannot repair these failures.

## Buffering, Reuse And Positive Controls

The32MiB control reaches16842752 produced bytes by200/500ms while origin relay
DATA receipt reaches16777216. Client readable length65535 and stream window0
coexist with substantial upstream buffering. Envoy RSS samples are72004,
80252,80268KiB for8MiB and80332,90656,90656KiB for32MiB. These samples,
producer write counts, relay receipt, writable backlog and stream windows
measure different stages; they do not prove steady memory bounds or fairness.
Existing upstream16MiB default-window explanation is consistent with the data;
configuration/windows/observation times are unchanged.

Incomplete32MiB cancellation reaches origin in2.78ms and partial16384-byte
upload cancellation in1.40ms, both with actual upstream RST_STREAM code2.
No downstream native-wire CANCEL8 propagation claim. Native upstream streams
1/3/5 share one captured connection; gRPC streams1/3 share a separate captured
connection, demonstrating scoped reuse alongside cancellation.

Independent WebSocket control echoes two messages, closes1000 at both ends,
and retains verified origin identity. Bidirectional gRPC echoes two responses,
returns statusOK and `lab-trailer=complete`; subsequent cancellation reaches
origin in3.36ms. These are bounded local positive controls, not full draining,
production resource bounds or original75 eligibility.

## Reproduction And Evidence

```sh
AEGIS_GO_BIN=/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go \
PATH=/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin:$PATH \
flock /tmp/aegisgate-sprint02-fixtures.lock \
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
spikes/envoy/sprint04c-run.mjs evidence/sprint04c-d/attempt-01
```

Fresh output directory required. Toolchain Go1.27.4, Node26.13.0,
CLI OpenSSL4.1.0; pinned Envoy image
`sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`,
loopback-only, one worker,256MiB memory/2CPUs. Fixture lock covers setup,
tests, observations, decoding/evidence and cleanup. Ephemeral private material
is removed, no owned containers remain. No Compose/PostgreSQL fixture is used.

Principal attempt01 SHA256:

- Protocol:`a4ea8a57af243dee61cdc3b5eabbcbd135626facacdf689979084b9d2c056860`.
- Receipt:`e6b7cc1896f7f245352c5b63c3ebeffc7f2a2ce75e6eed3affe1a16f0a223250`.
- Observer test stdout:`5acd379a6e00b5ade8786a163b508af661b947aaac21f5784a4b6f2227ab7b2f`.

Verification01 stops before child commands because its equality check did not
allow the intentionally appended adversarial Go tests after attempt01. That
failed verifier receipt remains retained. Corrected verification checks the
original test Git object/hash and requires the final test source to preserve
its entire prefix, then executes the extended tests from a clean final source.
No captured observation or original expectation is altered.

Verifier receipts bind final source, immutable historical objects, all attempt
manifest/stream hashes, scoped syntax/whitespace, maintained module verification,
adversarial tests and offline pinned secret scans. F independent reproduction,
root integration/local/hosted gates and formal human decision are distinct.

## Agent Completion Report

- Module:01/D protocol diagnostics; status: scoped work complete, runtime NO-GO.
- Files/commits: isolated `spikes/envoy/sprint04c-*`, `evidence/sprint04c-d/`, this report; exact source/receipt commits above and in verifier.
- Architecture/ADR decisions: none; human owner/approval PENDING.
- Contracts changed: none; original75/23/all-byte contract unchanged.
- Positive tests: verified relay/HPACK state/reuse, WS/gRPC/trailer/cancel controls with exact raw receipts above.
- Security negative tests: deliberate leakage/capture tests reject or remain incomplete; seven old failures retained; no new candidate acceptance.
- Performance: bounded8/32MiB/window/RSS samples only.
- Known blockers: pre-normalization parser, unchanged six/seven failures, no complete mutation/dispatch/tenant/generation observer, human decision.
- Human review needed: F exact-source review then architecture/security decision; no production signoff.
- Next unblocked work: bounded upstream/observer research, independent verification;04-12 LOCKED, production BLOCKED.
