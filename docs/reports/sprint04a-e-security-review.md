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

## Review Progress For Root Coordination

- B `93dc1223ae09d2562a9b4c5b307b173f960b9ea4`: independent unchanged and
  diagnostic runs both69/75, same six failures. Warm rejection reproduces
  SETTINGS ACK `000000040100000000`, nine bytes, zero new connections/handlers.
  All23 probes complete; same seven failures retained. Cleanup confirms no
  owned containers and removes all fixture directories before lock release.
  Three observer focused tests pass including attempted invalid-origin bytes.
  Acceptable as failed-candidate investigation, never as a passing engine.
- D `b42bae1e9ffa63b4dfd4c94c9a6376f7129077ce`: independently reproduced
  explicit TypeScript7 ERESOLVE and supported strict install plus dashboard
  lint/typecheck/test/build/integration/audit and normal update dry run, all0
  except the expected incompatible update1. Manifests/override unchanged.
  Acceptable as a documented upstream blocker; no TypeScript7 repair claimed.
- A/C exact pinned heads await independent receipt verification. F awaits
  final report/evidence head and independent recovery execution. No final
  combined acceptance or integration recommendation yet.

Update2026-11-13T10:13Z: A/C offline verifiers and manifests pass. F source
`99e41a2438d42c9588620d7766d2b03ebc557a14` passes E's independently owned
Compose/race integration in all seven Module03 packages without skips, plus
vet and Node golden vector. E accepts this source for local scope; final F
evidence/report head and final receipt scan are pending. No gate/waiver/merge.
