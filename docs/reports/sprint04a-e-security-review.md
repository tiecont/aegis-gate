# Sprint04-A Independent Security Review

Status: in progress. Review branch starts at baseline
`3e03940848c81751c87bbcec131238abb7d28e1b`; no merge or gate change.

## Executable Review Plan

1. Pin clean A/B/C/D heads in `evidence/sprint04a-e/review.mjs`. Execute only
   detached review copies; preserve owner worktrees and every proof attempt.
2. Reproduce B unchanged75/diagnostic75 and bounded probes, including the
   nine-byte observation, observer identity/TLS negatives and cleanup. Compare
   raw/expected contracts with baseline. Shared fixture lock covers lifetime.
3. Independently inspect A/C released parser/API evidence and verify archived
   source/receipts/checksums. Keep the specific upstream stop and no candidate GO.
4. Reproduce D strict peer resolution/install, dashboard acceptance and normal
   update, preserving the minimatch override and exact manifests.
5. Wait for F committed clean handoff; inspect recovery/security boundaries and
   independently execute focused and existing Module03 tests under the lock.
6. Record reviewed heads, exact commands/exits/hashes, findings and scoped
   verdict. Root alone integrates accepted changes and owns full/hosted gates.

Initial inspection found F still at baseline with uncommitted work. No F
acceptance is claimed. Preflight `cat .local/toolchains/node/VERSION` exited1
because that non-contract file does not exist; proof records executable
`--version` and SHA256 directly using the pinned main-worktree Node instead.
