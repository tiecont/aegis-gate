# Unpublished Upstream Requests

Local drafts only. No issue, PR, message, disclosure or source patch was sent to
any upstream. These are capability requests for AegisGate's stricter ingress
contract, not assertions of an upstream vulnerability or RFC noncompliance.
Exact retained sources: `upstream-02/<project>/released/<path>.stdout`.
Actual local Envoy results belong in the Agent B report and repro receipt;
Pingora/Hyper entries below are source-research requests, not executed repros.

## Envoy: Supported Strict Continuation Policy Before Normalization

Target: Envoy v1.40.2, source `b2d89e0ae53916f28770771fbdd49c5c99c5c5a2`.
Would maintainers accept a versioned, supported strict-ingress option that
rejects obsolete continuation lines in both H1 request headers and trailers
before Balsa normalizes them? `balsa_parser.cc:181` sets
`disallow_header_continuation_lines=false`; `:304-305` implements private raw
input callbacks as no-ops; `:450-464` strips CR/LF before header value callbacks.
The public `HeaderValidator` receives parsed maps, including request trailers,
and cannot distinguish a legal `X-Folded: first second` from the folded input.

Standalone reproduction from committed source, local listeners only:

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint04b-repro.mjs evidence/sprint04b-b/repro-02
```

Use an unused output directory. This uses the existing digest-pinned release
image, verifies downstream certificate/ALPN and origin certificate/SAN, generates
disposable PKI, retains raw requests/responses and origin observations, and
cleans up before releasing the lock. It is a bounded standalone H1 demo.

Suggested upstream regression inputs (not a patch): folded headers and trailers,
SP and HTAB continuations, splitting CRLF/continuation across reads, folded TE,
each following a prior valid keepalive request, and a valid second pipelined
request after rejection. Strict rejection should be deterministic 4xx + actual
peer close (or close without response), with no rejected request forwarding.
For trailers, document when upstream headers/body may already have been sent:
an ingress parser hook alone cannot promise zero origin bytes for a late trailer
without whole-message buffering or a separately approved contract. Preserve
ordinary unfolded fields, all six encoded targets, and ordered valid pipelines.
Do not expose a private production codec fork as the integration contract.

## Envoy: Identity And Rejection API Contract

Please document a supported way to retain original Host and :authority together
with verified downstream SNI through identity validation, before upstream stream
or connection work. The inspected H2 codec permits differing Host/:authority;
`envoy.reloadable_features.http2_discard_host_header=false` is a partial
information-retention hook, not an atomic identity/egress fence. Distinguish
rejected request forwarding, new upstream connections, request HEADERS/DATA,
and control bytes on existing connections. AegisGate currently requires zero
decrypted origin bytes across rejection; an existing-connection SETTINGS ACK
still violates that contract. This draft does not propose accepting/subtracting
control frames or changing the immutable expectation.

The released HCM `local_reply_config`/`ResponseMapper`, `StatusCodeFilter`, and
`ResponseFlagFilter(DPE)` permit a scoped 501-to-400 experiment. Ask whether
these cover all unsupported transfer coding paths with actual connection close,
including errors before a logical stream, subsequent requests, fragmented input
and queued successors. Preserve legitimate upstream 501 responses. This hook
does not provide pre-normalization fold rejection or repair identity fencing.

## Pingora: Strict Request-Target And Framing Mode

Target: 0.9.1, source `f86ffda5d3ae5c3baf5125682138b33b26c01b08`.
Request a released opt-in policy to reject illegal raw request targets rather
than retrying with `escape_illegal_request_line` (`v1/server.rs:437-455`), and
to reject CL+TE/repeated transfer codings before CL removal (`:400-432`).
`HttpServerOptions` does not expose the needed no-retry raw-target policy in
the inspected release. Provide supported pre-normalization provenance or
maintained-parser strict behavior, not a custom byte scanner in an application.
Keep valid encoded targets and ordered pipelining (`set_pipelining_enabled`,
`set_pipelined_prefix`, persistent session settings) usable through ProxyHttp.
No new Pingora runtime was built or executed for this draft. Reproduce with
the immutable75 only after a relevant released fix and dependency review.

## Hyper: Incoming Reject-Both And Raw Target Policy

Target: v1.12.0, source `7f67699ce32d717081deb7018b4da7d679277ac0`.
Request an incoming server policy to reject CL+TE in either field order before
removing/skipping Content-Length (`role.rs:275-300`), and a supported raw-target
validation hook before constructing `http::Uri` (`:225-230`). Closing keepalive
when CL+TE coexist does not prevent service dispatch of the normalized request.
The inspected server Builder exposes resource limits, keepalive/pipeline and
header case controls, but no reject-both/raw-target callback. Preserve encoded
targets and ordered pipelines. This is source research, not a new Hyper run;
historical fragment/runtime failures remain historical evidence. A released
parser/API change must precede any conditional full proxy experiment.

## Review And Resume

Named technical owner and architecture/security decision remain PENDING with
root/human review. An upstream response, experimental patch, newer unreleased
SHA or successful narrow repro is not engine acceptance. Verify a maintained
released fix, exercise historical failures first, then unchanged75 and all
TLS/identity/H2/pooling/streaming/cancellation/config/resource controls under
independent review. No publication is authorized by these drafts.
