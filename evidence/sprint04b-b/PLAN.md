# Sprint04-B Agent B Plan

Base: `cbb5f71db84b9489bf4a6260696bbba29ab4a561` (PR12). Ownership:
this evidence directory, `spikes/envoy/sprint04b-*`, and
`docs/reports/sprint04b-b-upstream.md` only. No subagents.

1. Commit the collector and focused reproducer before collecting proof.
2. Refresh official latest stable release/tag revisions for Envoy, Pingora and
   Hyper; retain exact public API/source and default-branch snapshots separately.
   Compare relevant released files with Sprint04-A. A version number alone is
   not grounds for a full candidate rebuild.
3. Under a full-lifecycle shared fixture flock, use the existing digest-pinned
   Envoy image for a standalone parser demonstration: folded versus unfolded
   headers/trailers, unsupported TE with/without a released local-reply mapper,
   peer closure without client FIN, and valid encoded/pipeline controls.
   Preserve raw traffic, identity, origin bytes/handlers/connections and bounds.
   This is not a replacement proxy or a new complete candidate.
4. Write unpublished upstream API requests, clearly separating executed partial
   hooks, released source findings, unreleased proposals and missing proof.
5. Verify receipts, immutable75/source preservation, syntax, whitespace and scoped
   offline secrets; commit report/evidence and hand root the exact head.

Stop: absent a demonstrated relevant released strict-parser fix, no new full
candidate or unchanged75 execution. No fork/publication, architecture substitution,
expectation change, public listener, or Module04 implementation. Root owns full
integration gates and independent review.
