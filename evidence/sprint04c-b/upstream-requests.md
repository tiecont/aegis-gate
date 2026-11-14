# Unpublished maintainer requests — Sprint04-C

Publication state: **DRAFT / NOT PUBLISHED**. These are project-policy/API
requests, not vulnerability reports. External issue/PR publication requires
separate authorization. Exact runtime observations are attached by the report;
no success is inferred from the requested behavior.

## Envoy: supported strict obsolete-fold rejection before normalization

Target release: v1.40.2, source
`b2d89e0ae53916f28770771fbdd49c5c99c5c5a2`, pinned distroless image in
`spikes/envoy/image.lock.json`. Scope: default Balsa H1 codec and public
header/trailer validator boundary. The inspected adapter explicitly permits
continuation lines, uses private no-op raw-header/trailer callbacks and removes
CR/LF before parsed-map validation. This does not establish an upstream exploit.

Minimal reproduction, from a clean repository at the report's source revision:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock node \
  spikes/envoy/sprint04c-repro-h1.mjs evidence/sprint04c-b/reproh-02
```

Use Node26.13.0 and the existing pinned image locally; do not send malformed
requests to public services. This fixture creates disposable CA/leaf identities,
verifies both TLS hops, binds loopback and removes its container/keys under lock.
The raw request difference is:

```text
X-Folded: first second\r\n
X-Folded: first\r\n second\r\n
```

Our requested strict mode rejects the latter before admitting that request's
header block to filters/router/origin, while preserving legitimate encoded
targets and ordered keepalive/pipelining. Parsed maps expose the same field
value, so a post-normalization header-map filter cannot implement this policy.

Proposed supported API contract (illustrative names, **not released APIs**):

- Explicit server-codec `reject_obsolete_continuations` policy, documented for
  both request header and trailer parsing, disabled/enabled default stated.
- Rejection acts on original syntax, before CR/LF replacement, field merging,
  filter callbacks, upstream stream allocation or offending block forwarding.
- Public structured rejection reason, bounded4xx/actual close for H1; no retry
  through compatibility normalization and no incomplete parser-state reuse.
- Preserve valid unfolded whitespace/encoded targets and per-message ordering;
  tests for split reads, keepalive second requests, pipelines, trailers and
  CL/TE combinations. A callback alternative must expose lifetime/bounds and
  a supported reject action, not private Balsa symbols or mutable borrowed data.

Trailer caveat: rejecting an offending trailer cannot undo already streamed
headers/body. Please document the exact admission guarantee. If a strict policy
requires zero *whole-request* bytes for eventual malformed trailers, buffering
and resource/streaming implications need an explicit separate project decision.
The empty handler trailer maps in this fixture do not prove trailer delivery.

## Envoy: malformed Transfer-Encoding local response contract

Four historical vectors are taken unchanged from the original manifest plus its
duplicate-field control: invalid TE, repeated chunked, nonfinal chunked, repeated
TE fields. Default release behavior previously observed is501 with actual peer
close. AegisGate requests4xx/close;501 alone is a project-contract failure, not
evidence of a smuggling vulnerability or forbidden origin forwarding.

The H1 script compares default behavior with the supported local-reply status
mapper and an actual upstream501 control. The mapper is a supported *partial*
extension point; the exact new observed outcomes are in the receipt/report.
Question for maintainers: is a documented codec-reason-specific4xx mapper
supported for parser-generated local replies, and what stable response details
or flags identify them without rewriting legitimate upstream501 responses?
Acceptance tests must verify actual peer closure, no origin bytes/dial/handler,
valid reused connections before malformed input and origin501 preservation.

## Envoy: pre-origin H2 identity and side-effect contract clarification

H2 Host retention runtime control exists in the inspected release; it is not a
complete identity/security decision. The project requires original Host,
`:authority`, verified TLS SNI and tenant/generation binding before rejected
request forwarding or a rejection-caused upstream connection/stream.

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock node \
  spikes/envoy/sprint04c-repro-h2.mjs evidence/sprint04c-b/reprot-02
```

This bounded raw H2 script warms a valid origin pool, sends three identity
negatives, and retains raw HEADERS/frame inputs, all origin bytes, connection
and handler deltas. Its frame-envelope observer is explicitly incomplete for
HPACK attribution; it cannot grant request-isolation acceptance. Current
aggregate zero-byte requirement remains binding. Historical nine-byte SETTINGS
ACK is retained as FAIL, without control subtraction or observation-time change.

Question: which released supported integration provides pre-upstream binding
of original identities while documenting the ordering of local rejection,
pool/dial admission and existing H2 control activity? Connection housekeeping
is distinct from forbidden request forwarding. No maintainer is being asked to
call aggregate-byte activity an upstream vulnerability without that evidence.

## Pingora and Hyper release triggers retained

Pingora: released no-retry original-target policy plus strict framing and
ordered ProxyHttp integration, with maintenance dispositions; raw-byte access
after target rewriting is insufficient. Hyper: released incoming reject-both
CL/TE in both orders and original raw-target/fragment rejection before URI
normalization. Outgoing sanitation and closing keepalive are insufficient.
The source matrix/report pins current exact revisions and missing interfaces.
No private production codec fork or new production parser is proposed here.
