# Sprint04-B A Architecture Decision Package

Status: research direction selected; runtime architecture decision **PENDING**.
Module01 **NO-GO**,04-12 **LOCKED**, production **BLOCKED**. Baseline is verified
main `cbb5f71db84b9489bf4a6260696bbba29ab4a561` (PR12). This package makes no
runtime modification and does not accept a substitute engine.

## Requested Decision And Accountable Owner

The requesting human said in this execution session: "you just choice, i approve
anything you choice". Root therefore selects **maintained Envoy strict-ingress
API research** as the bounded default. This is recorded authorization for the
research choice, not a fabricated technical proof or named security signoff.

Formal human architecture/security owner: **not supplied / PENDING assignment**.
Personal name, accountable role appointment and durable architecture approval
reference: **not supplied**. The repository account or workstation username is
not evidence of an architecture/security appointment. Root is the engineering
handoff owner and must record the actual human owner when formally provided.

Decision request: acknowledge the selected research track, appoint the
architecture/security owner, and choose whether to retain the current all-byte
origin contract or review the separately proposed request-isolation contract.
Default while unresolved: retain the current contract, no engine substitution,
no candidate rebuild without relevant maintained released capability. The
[proposed ADR amendment](../ADR-012-strict-ingress-decision-proposed.md) and
[security-contract memo](sprint04b-security-contract.md) provide concrete choices.
Upstream drafts remain local; publication is separately authorized work.

## Executable Evidence Versus Research

Accepted prior reports are the evidence source, not fresh benchmarks by A.
Original75 manifest SHA256:
`8dd056bb69f53e0a41bf6445c7054f2345ce969d3c22784a7567268e0733f141`.
Sprint04-A E independently reproduced Envoy and checked all candidates' retained
histories. Exact source revisions below are published-release source, while
current release freshness belongs to B's separately executed refresh.

| Candidate / released source | Published executable proof | Source/API research and outstanding blockers |
| --- | --- | --- |
| Envoy1.40.2 / `b2d89e0ae53916f28770771fbdd49c5c99c5c5a2` | Independently reproduced69/75; folded header263 decrypted origin bytes/one handler; four TE cases501 with zero bytes; H2 negative9 bytes/zero handlers | Balsa disables continuation rejection and removes CR/LF before parsed-map validation. Inspected released public API supplies no proven pre-normalization hook. Host-retention guard and local-reply mapping are supported partial prospects, not a complete repair. Trailers also require proof. |
| Pingora0.9.1 / `f86ffda5d3ae5c3baf5125682138b33b26c01b08` | Historical independently reviewed63/75;12 failures, including raw invalid target rewriting, framing and valid ordered pipeline | Public raw-header accessor can receive an already-rewritten target. Strict no-retry parsing and complete ordered proxy integration are unproven. Low-level pipeline APIs exist. `derivative` and `unsafe-libyaml` maintenance warnings remain; PR1117 is not an accepted released replacement. |
| Hyper1.12.0 / `7f67699ce32d717081deb7018b4da7d679277ac0` | Historical independently reviewed70/75; CL/TE in both orders, fragment and corresponding pipelined ambiguity failures | Incoming parser removes/skips CL when TE coexists; dynamic URI parse loses fragment provenance before service policy. No inspected released incoming reject-both/raw-target policy hook. Server bounds/pipeline APIs are partial controls. Full proxy assembly remains project-owned. |

Envoy's six immutable failures are
`malformed-HTTP-invalid-transfer-encoding`,
`malformed-HTTP-obsolete-folded-header`, `strict-ingress-TE-repeated-chunked`,
`strict-ingress-TE-not-final-chunked`,
`supplemental-repeated-transfer-encoding-fields`, and
`HTTP2-authority-Host-and-SNI-confusion-rejected`. All remain mandatory.
No claim about every extension, unreleased branch or future version is inferred
from a scoped public-source inspection. Research does not prove runtime behavior.

## Alternatives

| Alternative | Required upstream capabilities | Ownership / migration complexity | Required proof / stop condition |
| --- | --- | --- | --- |
| Wait for or contribute to maintained Envoy | Released bounded rejection of original H1 folded headers AND trailers before normalization; preserved Host/:authority plus verified SNI for pre-origin identity denial; proven TE4xx/close; valid raw encoded targets/pipelines | Upstream owns public codec behavior/security updates; project owns pinning and a supported config/extension integration. Medium research cost, high eventual migration from the proposed Rust engine: xDS/SDS, snapshot ACK/LKG, policy and cert ownership require a separate decision. No private production fork. | First execute the old failures, then unchanged75 and mandatory TLS/stream/pool/config/resource controls. Stop if API is private, parsed-map-only, unreleased, or one mandatory failure remains. Default track, not approved runtime. |
| Maintained Pingora strict parsing | Released strict no-escape/no-normalization target policy, original framing/TE rejection, ordered pipeline integration and dependency maintenance disposition | Upstream owns parser/maintenance fixes; project owns existing Rust hooks, trust-aware pools and proxy loop. Lowest architecture migration if complete, but several parser/integration gaps and unresolved warning paths increase research uncertainty. | Preserve encoded targets including encoded spaces/controls, every original12 failure, valid pipeline order, TLS/SNI/reload and stream controls; review both warnings without ignores. Stop if only first-request screening/custom parser or target blanket-denial is offered. |
| Maintained Hyper incoming strict parsing | Released incoming reject-both CL/TE in either order, raw-target/fragment rejection before URI normalization, preserved every-message pipeline provenance | Upstream owns library parser hooks; project owns substantially more proxy integration: TLS/SNI, cert reload, health, pooling/partitioning, retries, upgrades, H2/gRPC/cancel and config lifecycle. High implementation/maintenance cost despite70/75. | Prove five original failures, positive encoded/pipeline controls, then full proxy/security matrix and bounded resources. Stop if outgoing sanitation is presented as incoming policy or custom byte scanning is needed. |
| Separately maintained strict-ingress front end | Maintained strict parser for every request/trailer; full TLS/ALPN/H2/upgrades/streaming/cancellation support; authenticated original SNI/authority/client identity transfer | NEW architecture boundary; high migration and dual-stack patch burden. Explicit owner for TLS termination/cert rotation, front/back config coordination, backhaul mTLS, original-client trust, pooling and shutdown required. L4 pass-through cannot inspect encrypted HTTP. | New threat/ADR review, every unchanged75 vector across both stacks, parser differential/identity spoofing/replay/config skew and resource/cancel proof. Stop if trusted identity comes from arbitrary forwarding headers, unverified backhaul, one-shot prefilter, private fork, or boundary ownership is missing. |

Maintenance assignment is a required plan, not an assertion that an upstream
maintainer has agreed to deliver a fix. Root owns release monitoring and the
unpublished requirement package until a project maintainer is assigned. Upstream
issue status, a merged patch, or a larger PASS count cannot grant eligibility.

## Default And Bounded Resume Trigger

Envoy is preferred for the next source/API inquiry because the existing spike
already demonstrates dynamic TLS/SNI, verified origins, H1/H2, WebSocket,
bidirectional gRPC/cancellation, pool partitioning and configuration-generation
controls. Its primary missing folding boundary is precisely identified in a
maintained proxy, and preserving Host/local-response mapping has concrete public
partial hooks. This reduces uncertainty about where to ask for a supported API.
It does not imply lower production migration cost than Pingora or acceptance of
its six failures. Hyper's higher count is outweighed by missing incoming policy
and a larger project-owned proxy surface.

B must provide released provenance and relevant strict behavior change before
conditional feasibility work. Without it, stop new candidate work and retain
NO-GO; do not repeat another unchanged69/75 benchmark. Keep Pingora/Hyper release
requirements versioned so a credible released change can reopen comparison.

## Evidence Needed For Affirmative Architecture Approval

1. Exact released source/image/crate hashes and supported public API/maintenance
   contract; all declared upstream capabilities executable on the selected pin.
2. Targeted historical failures passing, then all75 unchanged with exact IDs,
   raw inputs/expected hashes, encoded targets and ordered pipeline controls.
3. No mandatory origin-byte, handler/parser/transport, TE response/actual-close,
   TLS/SNI/authority/tenant or resource failure. Keep raw all-byte observations.
4. Complete dynamic certificates/hot rotation, verified-origin invalid-chain,
   wrong-SAN/expiry/trust, H1/H2, WebSocket/gRPC/cancel, pool/trust partition and
   config capture/replay/swap/recovery evidence. Supplemental classifications
   alone are not conformance or capacity acceptance.
5. Reviewed memory/buffering/time/connection/stream bounds and actual overload,
   drain/cancellation controls within local scope. Dated dependency/security
   scans, maintenance dispositions, local gates and exact hosted jobs.
6. Independent reproduction/review of the precise eligible source; formal
   architecture owner, option, contract version, limits, approval reference and
   date. Module04 remains locked until this affirmative GO is recorded.

Production additionally requires the full release matrix and named release
signoff. Architecture approval cannot waive unproved runtime security behavior.

## Agent Completion Report

- Module:01 architecture decision research; status: package complete, runtime
  decision/owner PENDING. Commits are recorded by subsequent review/integration.
- Files: this report, proposed ADR012, security-contract memo and alternative
  test design. Architecture/acceptance contracts changed: none.
- Verification: source-protected equality and document checks recorded in
  `evidence/sprint04b-a/`; no new candidate, runtime or performance result.
- Human review: appoint architecture/security owner and review contract choice;
  the selected research direction has session authorization as quoted above.
- Next unblocked work: B upstream capability trigger and independent00/02/03
  maintenance. No dependent production module is opened.
