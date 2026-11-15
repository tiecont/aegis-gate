# Maintained Ingress API Requests - Local Draft Only

Not published. These are engineering capability requests, not vulnerability
disclosures. Original acceptance and ADR012 remain unchanged. Official release
metadata is refreshed by `spikes/envoy/sprint06a-c-audit.mjs`; pinned source/API
stops and actual peer traces are reused by digest, not claimed freshly executed.

## Minimal Reproduction Package

From a clean repository checkout with pinned Node26.13.0:

```sh
node spikes/envoy/sprint06a-c-package.mjs /absolute/fresh/package-directory
```

This produces five byte-exact public synthetic input vectors, hashes, expected
results, immutable raw-peer references, exact release/source pins, the minimal
historical bootstrap and positive-control IDs. It starts no runtime. The
historical bootstrap paths are disposable fixture paths; supply newly generated
private certificates, verified CA and origin on owned loopback before replay.
Never commit private fixture material. The canonical runnable fixture/selected
original assertions and raw frame captures remain in the referenced05D B source
and evidence; the frame variants are bound to original23 by exact sent hex.

For a single diagnostic against that already-owned fixture, write a private spec
with `synthetic_owned_fixture=true`, `host=127.0.0.1`, a nonprivileged `port`,
`servername=edge-a.test` for H1 or `edge-b.test` for H2, and absolute `ca_file`.
Keep the same shared lock through fixture setup, replay, capture/hash and cleanup:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock node \
  spikes/envoy/sprint06a-c-replay.mjs /absolute/private-spec.json \
  raw-H2-unexpected-CONTINUATION /absolute/fresh-peer-diagnostic.json
```

Other package vector IDs and `individual-settled-userinfo-denial` are supported.
This bounded raw-peer/native-H2 diagnostic never grants security PASS, lacks its
own complete origin observer, and is not the original acceptance evaluator.
It is intentionally not executed in06A: no newer supported API qualifies for a
new runtime trial. Original deadlines/payloads/evaluator are never edited.

## C1: Strict H1 Before Normalization

Request a documented strict codec setting that rejects header AND trailer
continuation syntax before parsed-map/filter normalization, retains error
offsets, and never forwards rejected syntax. Historical folded-header input
currently reaches one handler/263 decrypted origin bytes in the accepted Envoy
candidate. Released llhttp9.4.4 already rejects the syntax; it does not itself
provide a complete gateway. Test original folded/TE-fold vectors beside valid
unfolded headers/trailers, encoded targets, pipelines and large finite bodies.
Late trailer/EOF safety additionally needs complete admission: a strict header
flag cannot retract an already-forwarded body. This is an explicit project
policy; do not infer a vendor vulnerability from permissive normalization alone.

## C2: Authority Decision Before Irreversible Reset

Request a supported bounded pseudoheader validation decision point that exposes
verified SNI and can safely produce HTTP400/421 before stream reset, with no
origin admission. Exact authority `user@edge-b.test` currently receives peer
RST_STREAM1 (`00000403000000000100000001`), no response HEADERS. Existing public
stream-error override controls reset scope. HTTP filters/local replies run too
late; inspected UHV fields are hidden/unsupported. Positive Host/authority421
and exact target/reuse controls must retain their original assertions.400/421
is AegisGate policy, not proof that reset-only handling is a vendor vulnerability.

## C3: Serialize Protocol Error Before Close

Request a public supported error-submission/send-completion API on the codec/HCM
boundary, with actual error code, bounded drain and close result. Inspect
ProcessBytes error returns versus adapter Send and HCM FlushWriteAndDelay.
Network-buffer flushing alone cannot serialize unsent adapter frames. The
concrete protocolErrorForTest helper is not a runtime extension point. Require
HEADERS on stream0, zero WINDOW_UPDATE and unexpected CONTINUATION to all emit
the originally accepted peer error before close. Alternate historical20/23
regresses CONTINUATION; accepted baseline19/23 remains. Compare specific RFC9113
error requirements separately from the project's bounded observable-frame rule.

## C4: Authoritative Effects Ledger

Request a versioned pre-wire admission/dispatch instrumentation interface with
stable downstream connection/stream, verified SNI/tenant/signed generation,
origin dial/connection/stream, full header-block/HPACK mutation/DATA effects,
cancellation/final decisions, authenticated sequence and explicit coverage/loss.
Public Transport/httptrace/Framer/HPACK correlation does not prove this complete
authority. Missing/aliased/omitted events must be INCOMPLETE. Preserve all raw
control bytes and demonstrate SETTINGS ACK with no downstream request and during
denial. Current aggregate nine-byte FAIL remains authoritative; a causal research
classification cannot approve a contract revision or excuse late-invalid H1.

No upstream issue, PR, vendor report or external message is authorized or sent.
Resume a wider runtime only with a genuinely released supported mechanism,
targeted unchanged historical assertions and non-regression controls, followed
by independent review and all remaining gate requirements.
