# Local Drafts Only - Not Published

These are project-policy/API questions, not claims of an upstream vulnerability.
All traffic reproduction must use the owned loopback harness, verified lab TLS,
and `/tmp/aegisgate-sprint02-fixtures.lock` for fixture startup through cleanup.
Do not run the vectors against upstream maintainers' or third-party services.

## Envoy: reject obs-fold before normalization

Subject: Supported released strict H1 mode rejecting folded fields before Balsa normalization

Version: v1.40.2, commit b2d89e0ae53916f28770771fbdd49c5c99c5c5a2.
Source: `source/common/http/http1/balsa_parser.cc:181,451-465`.
The constructor sets `disallow_header_continuation_lines=false`, then removes
CR/LF before `onHeaderValue`. The header-validator interface receives parsed
maps. Is a released supported option available to reject continuation lines
before that transformation? If absent, please consider a strict codec option
connected to Balsa's existing policy. A post-codec value check cannot recover
whether `X-Lab: first second` originally contained a continuation line.

Minimal wire shape (escaped text; use actual CR/LF bytes in the local harness):

```text
GET / HTTP/1.1\r\nHost: edge-a.test\r\nX-Lab: first\r\n second\r\nConnection: close\r\n\r\n
```

Expected project behavior: 4xx and actual peer close; zero decrypted origin
bytes, handlers and origin parser errors. Historical fixture evidence:
`evidence/sprint03b-e/runtime-host-retention/results.json`, case
`malformed-HTTP-obsolete-folded-header`: HTTP200, 263 bytes, one handler.
Keep valid unfolded fields, encoded paths and pipelined requests passing.

## Envoy: H2 identity and origin setup ordering

Subject: Supported Host/:authority/SNI validation before any upstream connection output

Same version/revision. `http2_discard_host_header=false` retains the original
Host; `codec_impl.cc:2188` permits differing Host/authority, and lines2585-2608
otherwise discard Host. The application must compare both fields to verified
TLS SNI before origin dispatch. Historical retained-Host run rejects with an
expected status/zero handlers but observes nine decrypted origin bytes. Those
bytes were not classified by C; B's independent observation owns the answer.
Please identify a supported mechanism that guarantees validation before origin
setup/preface/SETTINGS output, including connection reuse and rejected streams.

Local harness case `HTTP2-authority-Host-and-SNI-confusion-rejected` in
`spikes/pingora/lab.mjs` is authoritative; retain all its variants and original
zero-byte assertion. Do not infer success from zero handlers or redefine bytes.

## Envoy: TE response mapping (partial path, unexecuted draft)

The legacy codec sets501 for unsupported TE at `http1/codec_impl.cc:919-927`.
Supported `LocalReplyConfig.mappers[].status_code` exists. A bounded followup
could validate a mapper selected by501 (or a supported exact response-detail
filter) to400, while proving actual close and zero-origin counters for all four
TE vectors. Does codec-error handling consistently traverse local-reply mappers,
including errors before a request decoder exists? Source includes a direct
codec-write fallback; do not assume mapping is universal or that it fixes folding.
This draft was neither applied nor runtime-tested by C.

## Pingora: strict target/framing mode and pipelining

Version0.9.1, commit f86ffda5d3ae5c3baf5125682138b33b26c01b08.
`pingora-core/src/protocols/http/v1/server.rs:437-455,1765-1795` retries invalid
request lines through percent-escaping; `get_headers_raw_bytes` then exposes the
new buffer. Please provide a maintained released strict option disabling retry
and rejecting invalid raw targets before normalized URI construction, preserving
raw framing distinctions long enough to reject CL/TE and repeated chunked.
Required negative examples are `/bad target`, `/bad\ttarget`, SOH/NUL, fragment,
unsupported scheme, relative form, repeated TE and their pipelined variants.
Valid `/bad%20target`, encoded control bytes, `%2F`, `%2520` must remain valid.

Public `set_pipelining_enabled(true)` and `ReusableHttpStream::into_parts()` exist
but require ordered proxy reuse integration. Please identify the supported
ProxyHttp-level wiring for these APIs. Merely closing every keepalive pipeline
does not satisfy the project's positive control.

Maintenance followup references (no comments posted):
https://github.com/cloudflare/pingora/issues/889 and
https://github.com/cloudflare/pingora/pull/1117.
Please release removal of derivative while preserving PeerOptions Debug hook
omissions and Backend equality/hash/order ignoring `ext`. For YAML replacement,
preserve startup/default/load/dump compatibility and document MSRV/TLS backend
test results. PR1117's claimed tests are upstream author claims, not C executions.

## Hyper: retain incoming framing and target distinctions

Version1.12.0, commit7f67699ce32d717081deb7018b4da7d679277ac0.
`src/proto/h1/role.rs:275-300` removes/ignores CL with TE before the service.
The incoming URI uses `http::Uri::from_maybe_shared`; pinned http1.5.0
`src/uri/path.rs:20-30` truncates fragments. Please identify a supported server
builder option to reject both headers and raw fragments before these changes,
or provide immutable raw-target/framing provenance to application policy.
Header-case/order preservation, max-header-size, disabling keepalive and
pipeline_flush do not recover these lost distinctions. No custom IO parser or
production fork is proposed.

## Conditional Local Reproduction Commands

These reuse existing historical harnesses; C did not execute them this sprint.
They become useful only after the prerequisite API/released fix is available.

```sh
node spikes/edge-comparison/extract-baseline.mjs --check
flock /tmp/aegisgate-sprint02-fixtures.lock node spikes/envoy/recovery-run.mjs
```

The second command uses the existing known-failing diagnostic track; it is a
reproducer, not a new eligible candidate. Its recorder may exit0 while nested
lab/evaluator exit1. Any new candidate must pin an approved image/source and run
all75 unchanged plus relevant H2/resource/identity/TLS proofs and independent
review. Configuration edits, architecture approval and publication are separate.
