# Sprint04-A Architecture Decision For Human Review

Status: **proposed, NO-GO retained**. Human architecture owner: unassigned.
Approval link/date: none. Baseline `3e03940848c81751c87bbcec131238abb7d28e1b`.
This decision package records bounded technical prerequisites, not permission
to replace the production architecture or change the immutable acceptance tests.

## Decision Requested

Authorize a maintained upstream strict-ingress resolution track and assign its
human architecture owner. Keep Module01 NO-GO, Modules04-12 locked and production
blocked until complete engineering proof and explicit architecture approval.
Modules00/02/03 retain local PASS subject to integration regressions.

The current Envoy release accepts obsolete folding before application policy.
Its Balsa adapter hard-codes continuation rejection off, discards CR/LF before
value callbacks, and exposes only parsed header maps through the validator.
Changing a later filter cannot distinguish folded input from a valid unfolded
header with the same value. The missing capability is a **released supported
reject-before-normalization option/callback**, on every request and trailer.
A's report pins source/API evidence; C's matrix and unpublished maintainer
drafts specify the exact requested upstream work.

The observed H2 nine bytes must remain a failed zero-byte assertion even if B
classifies them as delayed control traffic on an already-valid pooled origin
connection. Explaining their origin does not authorize counter subtraction,
changed observation timing or a control-frame exception. A supported identity
policy and origin-connection lifecycle must satisfy the existing contract.
The four TE501 cases also still fail the4xx/close contract. Local-reply mapping
is a released partial API worth proving only after the primary codec blocker
has a credible solution; it does not recover original folded syntax.

## Bounded Alternatives

| Track | Work and ownership | Eligibility prerequisite |
| --- | --- | --- |
| Maintained Envoy strict API | Request supported Balsa continuation rejection before normalization; prove Host/:authority/verified-SNI and pooled-origin lifecycle; narrow TE rejection mapping. Own release/image pinning and future xDS/SDS integration design. | Released supported option/extension with original syntax available, then all75 and relevant new tests; no private codec patch |
| Maintained Pingora strict path | Request rejection rather than target escaping, enough original framing provenance, ordered valid pipeline handling; remove derivative and unsafe-libyaml through maintained releases. | Released strict parser and dependency remediation, fresh lock/audit and full protocol/TLS/origin proof |
| Maintained Hyper incoming strict path | Request incoming CL+TE reject-both and reject-fragment/raw-target policy before normalization. Own larger proxy assembly, routing/pools/health/stream lifecycle and resource limits. | Released supported incoming hooks plus a bounded isolated assembly proving the complete unchanged corpus |

An additional ingress layer is a new trust/deployment boundary, not an assumed
solution. Before authorization it needs an identified maintained strict parser
and an integration design covering TLS/SNI/client identity, every keepalive and
pipelined request, upgrades, backpressure, cancellation, origin byte policy,
generation capture and bounded drain. No such eligible adapter is claimed here.

## Next Review Gate

1. Choose a track and named architecture owner; keep any upstream request local
   until publication is separately authorized. No schedule or maintainer promise
   is invented by this package.
2. Obtain a released public API meeting the precise missing capability. Inspect
   immutable source/image provenance before implementation. Stop if original
   framing/identity distinctions have already been lost.
3. Execute six failed Envoy cases first for an Envoy candidate, then all75
   unchanged, encoded/pipeline/TLS rotation/verified upstream TLS/WS/gRPC/
   cancellation controls and new H2/resource/generation negatives. Record raw
   input/output, origin bytes, handlers, parser and transport observations.
4. Require maintained dependencies, meaningful full quality/security gates,
   independent security reproduction and explicit human architecture approval.
   Passing75 alone creates an eligible proof, not a GO decision.

Dependency or local configuration improvements can integrate independently
after review and their own gates. No completed research or evidence-only merge
means production readiness, an accepted data plane or Module04 authorization.
