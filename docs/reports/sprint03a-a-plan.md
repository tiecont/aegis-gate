# Sprint03-A Agent A execution plan

Scope: `research/pingora-blocker-fix` in the assigned Sprint03-A worktree.
Research only: `spikes/pingora/`, `evidence/sprint03a-a/`, and this report family.
No production, gate/status, dependency patches or corpus edits.

1. Reuse the explicitly permitted root release binary in this worktree, record
   its SHA256 and source equality; run the absolute root comparison runner with
   `AEGIS_CANDIDATE_ROOT` pointing here. Every lab/scan invocation holds
   `/tmp/aegisgate-sprint02-fixtures.lock` for its full lifetime. Preserve all65
   baseline cases, supplemental cases and failing assertions. Export results
   without private fixture material. Root added `AEGIS_RUN_ROOT`; set it to
   this worktree's owner-only `.local` directory before execution.
2. Run `spikes/pingora/sprint03a-research.mjs` with the root Node toolchain:
   refresh stable release/crates/main, relevant parser/options/custom-session
   APIs, strict-ingress searches, maintenance issues/PRs and both advisories.
   Compare cached source against published crate archives/checksums. Record
   exact source line evidence and distinguish source review from runtime proof.
3. Evaluate supported integration against every-request framing, pipelining,
   encoded target preservation, TLS/SNI identity, H2, upgrade, streaming,
   backpressure, timeout and cancellation obligations. Implement a PoC only
   if a maintained supported solution is available; otherwise exact NO-GO.
   Never substitute a private patch, first-request-only byte scan, custom HTTP
   parser or rejection of valid encoded controls.
4. Fresh locked audit and inverse dependency trees for `derivative` and
   `unsafe-libyaml`; document actual startup exposure, removal paths and
   remaining review cost. No ignore or maintenance waiver.
5. Commit reviewable executable research, evidence, commands/hashes and final
   completion report. Independent review precedes any merge; Root owns gate
   disposition and architecture decisions.
