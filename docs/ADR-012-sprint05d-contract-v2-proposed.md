# ADR-012 Amendment v2: Admission And Origin Isolation (PROPOSED)

Status: PROPOSED, NOT EFFECTIVE. Baseline aa289da,2026-11-15. This versioned
decision package changes no original75/23 assertion or current gate. Formal
architecture owner/security owner/approval reference/date remain PENDING.

## Decision Required

The tested complete-message and streaming policies make different guarantees.
For an H1 request declaring Content-Length10, the header and body prefix abc
are identical until the client either supplies the remaining seven bytes or
ends the connection. The maintained incremental parser cannot determine which
suffix will arrive before that suffix exists. Forwarding the common prefix to
the origin gives the later-invalid request origin effects.05C independent proof
records89 origin bytes/one handler before400. The new05D strict-staged path
holds both prefixes without origin admission, then accepts the valid suffix or
rejects EOF. Delayed folded trailers have the same tested design boundary.

This is a causal counterexample for these request types and tested streaming
guarantees, not a universal theorem about all protocols or a parser defect.
Buffer-size tuning cannot make an origin receive a prefix and also never have
received it when the request later fails. Bounded complete validation supports
finite messages; indefinite/bidirectional progress needs a different explicit
contract. H2 unrelated SETTINGS control traffic is a separate issue.

| Option | Enforceable property | Costs and losses | Approval state |
| --- | --- | --- | --- |
| 1 retain current contract unchanged | Zero all origin bytes for every rejection interval, complete strict validation before any origin admission | Finite H1 staging forbids early body progress; unrelated reused H2 control can fail aggregate interval; current complete runtime remains ineligible | Current effective contract; no new GO |
| 2 proposed request isolation v2 plus explicit admission classes | Forbidden rejected-request effects never occur; fully attributed unrelated H2 control stays visible; finite strict messages stage through completion | New observer authority/HPACK/dispatch audit, encrypted spool quotas/latency/custody/crash deletion; streaming classes still need an explicit late-invalidity decision | PROPOSED; no waiver active |
| 3 keep unrestricted streaming and revise late-invalidity semantics | Early bounded stream dispatch after strict headers; later malformed/truncated input cancels and cannot route subsequent requests | Origin has already received data; irreversible application effects cannot be recalled. Weaker property requires explicit threat/risk acceptance and new tests | PROPOSED alternative only; not recommended without owner decision |

## Recommended Architecture Direction

Recommend an explicit two-profile ingress decision for human review, with
maintained parser/codec ownership and signed route policy rather than an
implicit universal guarantee. Strict finite-message routes use complete framing
and trailer validation plus encrypted bounded staging before verified origin
admission. Streaming/gRPC/WS routes remain disabled until a separately reviewed
message/stream-level threat contract defines what can be invalidated late and
which origin effects are permitted. This is not a production substitution or
permission to enable any profile now. A maintained complete H1/H2 ingress must
own TLS/SNI, tenant/auth/config capture, parser errors and pool trust epochs in
one reviewed boundary. A collection of existing PoCs is insufficient.

For H2, prefer the proposed causal request-isolation property only after
authoritative runtime instrumentation proves every request/stream/dial/header/
DATA/HPACK effect and loss indication. Do not infer it from zero handlers or
post-capture nonce correlation.05D runtime tracing improves correlation but has
no public pre-wire stream/dispatch hook, signed-generation integration or exact
HPACK mutation API. Those are explicit implementation prerequisites, not assumed
features. Until they exist the current zero-byte contract remains effective.

The maintained Envoy track additionally needs public strict pre-normalization
H1 rejection, an H2 invalid-authority HTTP-response hook before reset, and
non-regressing error-frame emission. A hidden codec field, permissive header
validator, private patch, observer-generated response or status-only acceptance
cannot substitute. No external issue publication is authorized by this package.

## Required Versioned Acceptance And Migration

1. Preserve original75/23 inputs, expected outputs, evaluators and all FAIL
   history. Run those unchanged beside any new research suite; never relabel an
   old failure as a new-contract PASS.
2. Explicit signed route admission class, max wire/body bytes, deadline, quota,
   staging-key custody, startup orphan reclamation and rejection statuses must
   be reviewed with backward compatibility and downgrade behavior. Unknown,
   absent or unsupported class fails closed; no silent streaming fallback.
3. Strict class requires zero dial/decrypted bytes/header blocks/DATA/handler/
   parser effects on header, trailer, EOF, cancellation and staging failure,
   plus exact target/pipeline/valid-message controls and measured resource caps.
4. H2 research class requires complete authenticated downstream-to-origin
   mapping and raw capture including every control byte, partial HEADERS and
   CONTINUATION, HPACK state, DATA, dials and parser/transport/handler events.
   Omitted/reordered/forged/unattributed/lost coverage is INCOMPLETE. Preserve
   all four05C false-PASS regression tests and independent adversarial overlays.
5. Simultaneously report current aggregate-byte and proposed causal results;
   legitimate reused-connection SETTINGS/PING/WINDOW_UPDATE are never removed
   from raw evidence. No borrowed quiet interval or control-byte subtraction.
6. Prove H1/H2/TLS/identity/tenant/signed-generation/rotation/pools/reuse,
   cancellation/backpressure/WS/gRPC, dependency maintenance and bounded crash
   cleanup end-to-end before runtime eligibility. Independent clean-source
   review, full locked local gates and exact head/main hosted CI are mandatory.
7. Explicit human architecture/security approval of the exact version/tests/
   runtime is required before any gate migration. Rollback retains protected
   baselines and fails closed instead of reverting to weaker admission. A
   research-contract success alone never opens Module04 or production.

## Accountability And Next Action

| Field | Actual record |
| --- | --- |
| Accountable human architecture owner | PENDING; no person supplied |
| Accountable human security owner | PENDING; no person supplied |
| Effective contract | Original aggregate zero-byte, unchanged |
| Proposed admission classes/contract selection | PENDING; no activation |
| Exact eligible runtime and independent acceptance | PENDING; no complete runtime |
| Human approval reference/date | PENDING; none recorded |
| Engineering owner for proof and API specification | Root/Module01 agent; not human architecture approval |
| Production signoff | BLOCKED, separate release decision |

Autonomous work may finish bounded prototype reliability, adversarial tests,
maintainer-ready public API specifications and local compatibility proofs.
It may not accept a contract revision, assign a human owner, enable streaming
under new semantics, substitute production runtime or unlock downstream modules.
Resume a wider candidate only after a new supported released mechanism passes
the exact targeted failure without regression, or after formal approval of a
versioned alternative contract and its complete instrumentation requirements.
Do not automatically start another pool/window/parser/codec comparison sprint.
