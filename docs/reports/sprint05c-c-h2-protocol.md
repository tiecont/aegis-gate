# Sprint05C C: H2 codec and error ordering

Status: **partial; no eligible runtime repair**. Fresh unchanged original23
baseline is19/23. The different released oghttp2 codec yields20/23: two old
frame failures pass, both userinfo failures remain, and unexpected CONTINUATION
regresses. Do not replace the accepted19/23 baseline with this candidate.
Module01 remains NO-GO, Modules04-12 LOCKED, production BLOCKED.

## Concrete Mechanism And Support Boundary

The new mechanism is Envoy1.40.2's maintained QUICHE oghttp2 adapter in place
of its default nghttp2 adapter. No flush/window/header-timeout tuning was
repeated. Original payloads, deadlines, windows, assertions, evaluator and
observer remain unchanged; all11 protected files match baseline8758b1c.

Pinned released source is b2d89e0ae53916f28770771fbdd49c5c99c5c5a2.
`evidence/sprint05b-c/source-01/receipt.json` binds the retained source once;
its SHA256 is39d24cb0fb8b8d9b7801a71d3bd4c933fdaa06ec4436e0547677b16437120514.
The verifier checks its six source artifacts rather than duplicating them.

Actual `source/common/http/http2/codec_impl.cc:988-992` first reads the explicit
`use_oghttp2_codec` option, otherwise the runtime guard
`envoy.reloadable_features.http2_use_oghttp2`. At2541-2555 the server creates
OgHttp2Adapter or NgHttp2Adapter. Client selection is at2428-2436. Thus this is
a real adapter change, not another timeout/flush setting. Retained
`evidence/sprint04a-c/upstream/envoy/source/common/runtime/runtime_features.cc:326`
declares the guard false by default; SHA256
02188275d7be1cda84c4b1b50d6b36063ff1e0c74048c38fef500dc883f8b644.

Important qualification: the protocol proto at
`evidence/sprint04a-a/upstream-02/protocol-api.stdout:754-758` marks the explicit
field hidden/work-in-progress. Root explicitly requested its bounded experiment;
acceptance by the released config loader does not establish a documented stable
production API. Attempts02/03 retain that experiment honestly. Attempt04 uses
the released runtime guard through the ordinary public Bootstrap
`layered_runtime` static layer, without the hidden field. It produces the same
20/23. This tests a released runtime selection mechanism; it grants no runtime
or architecture acceptance and no future support guarantee for a reloadable key.

## Full Original23 Results

| Attempt | Clean source | Mechanism | Result / child exit |
| --- | --- | --- | --- |
|01|2487ebbe398bb4cb7f429f2a956eb0ea774057dc|Untapped combined05A baseline|19/23,1|
|02|2487ebbe398bb4cb7f429f2a956eb0ea774057dc|Explicit oghttp2 option, both directions|20/23,1|
|03|2487ebbe398bb4cb7f429f2a956eb0ea774057dc|Same codec plus separate verified TLS relay|20/23,1|
|04|becc22082e093e7da7e262c0b2f143c2ce900426|Runtime guard selects same codec|20/23,1|

Every collector exits0 for completed recording, not security PASS. Receipts
bind clean source/tree, all relevant executable hashes, actual argv, runtime
versions, binary/extraction provenance, environment, exits and raw observations.
The original suite's child exit1 is preserved. No fresh original75 run or75
repair is claimed by C; the last accepted73/75 remains historical context.

Both oghttp2 direct executions return peer GOAWAY(PROTOCOL_ERROR=1) for
HEADERS-on-stream0 and zero WINDOW_UPDATE, with zero origin bytes/handlers.
Attempt02 frame SHA256 values are respectively
e0b2ed24599a6f359c7084119b88a00160c1df62be1ff18a2a5e2a761b6ea4e3 and
04a80e2c6fcf2fde744d587d46b0b5c124293d79ace6a17bcc03d13709e59d79.
These are original decoder observations of incoming server frames before
client teardown, not synthesized client CANCEL frames.

However, unexpected CONTINUATION now closes with `received_frames=[]`, failing
the unchanged required error-frame assertion. Both userinfo probes still fail
with rst_code1 rather than400/421. Individual userinfo has zero origin bytes
and handlers; the compound probe's preceding valid requests account for its
two handlers. All other original cases pass, including uppercase/connection
headers, backpressure, response/upload cancellation, caps, timeouts and drain.
This preserves18 of the baseline19 passing cases, not all19.

Attempt03's separate downstream relay verifies both TLS hops, SNI=edge-b.test
and ALPN=h2. Connections6/9 retain actual Envoy-to-client RST_STREAM1 bytes
`00000403000000000100000001`; no preceding client RST occurs. Connections11/12
separately retain client-to-Envoy CANCEL8 bytes
`00000403000000000100000008` in cancellation controls. Capture omitted=0.
The relay changes diagnostic transport and cannot substitute for direct timing
acceptance. Its peer attribution applies to the explicit-option execution;
runtime-key execution independently reproduces the original reset observations.

## Source-Causal Stop

The shared dispatch function at1092-1136 calls adapter ProcessBytes and can
return on callback status or short/error processing before sendPendingFrames.
onInvalidFrame at1432-1475 returns ERR_CALLBACK_FAILURE for fatal categories;
HCM conn_manager_impl.cc:562-571 closes with FlushWriteAndDelay assuming GOAWAY
was already sent. The adapter change demonstrably changes which malformed
inputs receive a peer frame. No internal adapter callback trace was captured:
do not infer a specific queued GOAWAY or exact branch for CONTINUATION.

The retained validator source rejects userinfo: HTTP2 validator:362-376 delegates
authority to validateHostHeader, whose header_validator.cc:282-291 rejects `@`.
Those source facts do not identify the exact validator invoked in this binary.
The executable boundary is narrower: neither selected codec produces the
required userinfo status under the original deadline. The hidden/unimplemented
typed header-validator extension remains outside a supported validation-before-
codec repair. No permissive-validation flag, private codec patch, parser fork,
TLS bypass, authority rewrite or changed oracle was introduced.

B's second maintained runtime mechanism is referenced without copying its
bulk evidence: commit235fe4a, file
`evidence/sprint05c-b/go-ordering-02/original23.json`, SHA256
eee326abb2515611d57c02b5720eb11199c2e5612f1cb74ca7380af67c09a27c.
The offline verifier loads that committed object:17/23, both scoped raw frame
cases pass, userinfo still fails and additional cases regress. B's report
locates Go's pre-handler `userinfo_in_authority` rejection and stream-error
conversion. This is B's executed evidence, not an independent C reproduction.
No third runtime was built. Neither different codec satisfies all four repairs
while preserving the original19; further unrelated tuning is not justified.

## Reproduction And Integrity

From a clean checkout, use a fresh output suffix:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint05c-c-run.mjs evidence/sprint05c-c/attempt-05 oghttp2-runtime
```

Modes are baseline, oghttp2 and oghttp2-runtime; optional final argument relay
enables only the separate downstream attribution diagnostic. The runner
reuses the unchanged root native launcher and combined compiler through an
owned resolver. Every fixture lifetime, cleanup and evidence hash is locked.
Only new owned worktree private directories are removed; no Docker containers
are created. All owned native children exit and `.local` is empty afterward.

Pinned Node26.13.0 SHA256
0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b;
Envoy binary SHA256
1d64506e25c1844f146162ddb2ece7010fa4e784faddb40a079021491f1f03cc,
verified against root's committed extraction receipt and image pin. Host
OpenSSL/ldd and actual Envoy version outputs are retained. Native prlimit
core0/nofile1024/cpu180 supplies no memory/PID cgroup or production resource
eligibility. No Go build was repeated by C. No public endpoint was probed.

At sourceac37f61, offline verifier exits0, checking69 artifact hashes,
512 committed-source bindings, protected inputs, actual direct GOAWAY1,
userinfo reset failures, CONTINUATION regression, peer/client reset attribution,
runtime activation bootstrap, retained upstream source and B reference.
Evidence: `evidence/sprint05c-c/verify-01`. Its semantic_security_pass and
resource_eligible are false. No assertion waiver follows from integrity success.

## Agent Completion Report

- Module/status:01/C, partial; no acceptable four-case repair.
- Commits/files:2487ebb runner/config/resolver; becc220 runtime-key activation;
  ac37f61 offline verifier; separate evidence/report commit follows.
- Architecture/ADR decisions: none; no production/runtime selection.
- Contracts changed: none; protected original75/23 unchanged.
- Positive/security execution: exact full23 commands and exits in four receipts;
  baseline19/23; explicit codec20/23; relay20/23; runtime codec20/23; verifier0.
- Performance: original finite backpressure/cancellation controls pass; no
  standalone performance, soak or resource eligibility claim.
- Risks/blockers: both userinfo status failures remain; codec regression blocks
  integration as a repair; hidden-field support limitation retained explicitly.
- Human review: independent F review of narrow tooling/evidence only; no gate
  opening or architecture approval requested.
- Next unblocked work: root/F can reproduce the bounded results; locked runtime
  modules remain blocked. No push/merge; C schedules no further fixture runs.
