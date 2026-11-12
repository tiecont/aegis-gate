# Sprint04-A Agent A - Envoy strict ingress

Branch: `fix/module01-envoy-strict-ingress`; worktree: `/tmp/aegisgate-04a-a`.
Status: investigation in progress. Module01 remains NO-GO; no architecture,
contract, production runtime or gate change is authorized by this report.

## Execution plan

1. Read the Sprint04-A contract and its mandatory project/prior-proof guidance.
2. Collect current official Envoy release/support metadata and immutable source
   for Balsa, the legacy codec, validator interfaces, H2 identity handling and
   rejection mapping using committed `spikes/envoy/strict-research.mjs`.
3. Identify a public maintained pre-normalization folding-rejection path. Only
   implement a bounded pinned isolated candidate if that prerequisite exists.
   Otherwise stop with exact source/API evidence, without repeating the existing
   known-failed broad proof or claiming every possible build was exhausted.
4. Preserve immutable75 inputs/expectations, encoded/pipeline controls and the
   zero-byte contract. Hold the fixture lock for any complete fixture lifetime.
   Record clean source commits, argv, versions, times, exits and SHA256; retain
   failed research and proof attempts.
5. Commit report/evidence for independent review and root integration. Root
   owns shared gate/ADR/risk files and integration; no other agents or merges.

The collector performs bounded read-only source retrieval only, so it does not
acquire or operate shared fixtures. Any later executable candidate must use the
shared fixture lock, verified TLS and existing immutable harness.
