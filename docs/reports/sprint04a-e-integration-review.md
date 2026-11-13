# Sprint04-A Independent Integration Review

2026-11-13 UTC. Reviewer worktree `/tmp/aegisgate-04a-e`, branch
`review/sprint04a-security`. Baseline
`3e03940848c81751c87bbcec131238abb7d28e1b`.

Verdict at the source checkpoint: **ACCEPT integrated owner files and root
gate/fixture/workflow changes for local scope**. No new blocking source defect
was found. Final documentation and completed receipt verification are pending
the root closeout source; this checkpoint is not final gate acceptance.
Module01 remains **NO-GO**, Modules04-12 **LOCKED**, production **BLOCKED**.
No architecture approval, zero-byte waiver, production release or merge is
authorized by this review.

## Exact Reviewed Source

Root source `2133b6303c05158c37ed539c23347376d67b0b3c`, tree
`30254ee38e17b3ed2e22c5b50e7aed2ef6e53f5d`. Root tracked sources were clean;
new root evidence outputs were untracked and explicitly enumerated. An assertion
of tracked cleanliness is not an assertion that ignored dependency/build caches
were empty or that all evidence was already committed.

| Owner | Exact accepted branch head | Equal integrated changed files |
| --- | --- | --- |
| A | `8d83ece166290b7c81e757281e5b1778e83dede4` |293 |
| B | `93dc1223ae09d2562a9b4c5b307b173f960b9ea4` |237 |
| C | `6acbe0f55d50334a14b95c4d3e9888f5d1aebecf` |313 |
| D | `b42bae1e9ffa63b4dfd4c94c9a6376f7129077ce` |64 |
| F | `bf5785eb8bd6449fc34915b7c2f392bd1d46350f` |24 |
| Prior E | `be7fd31` (full ID in receipt) |229 |

All1,160 files match Git mode/blob identity and working bytes. The root-owned
`docs/sprints/04a-execution.md`, also present in B/D history, is excluded from
owner equality and reviewed separately as the current execution contract.
F executable source remains the independently exercised `99e41a2` source as
accepted by prior E; E has not repeated full fixtures. All protected baseline
`spikes/edge-comparison/`, `spikes/pingora/lab.mjs`, `internal/configsnapshot/`,
frozen CONFIG_PROTOCOL, root/dashboard manifests/locks and Go module files
match baseline objects. The complete original E checksum manifest verifies.

## Findings And Helper Review

1. **Resolved integration failure:** gates02 used the dedicated Compose project
   but `fixture-image-integration.py` hardcoded `aegisgate-local_lab`. The fix
   reads `config.networks.lab.name` from the same resolved Compose files and
   inherited project setting. It retains fresh Postgres initialization,
   persisted restart, wrong-password negatives, immutable image identity and
   private networking. Resolved service credentials stay in subprocess memory;
   the fix does not print or retain rendered Compose JSON.
2. **Resolved hosted failure:** the retained first hosted foundation log shows
   the two observer tests failed on the absent fixture-lock file, followed by
   missing fixture env during teardown. CI now holds the required `flock` over
   fixture setup, check and EXIT cleanup in a single shell. Supply-chain setup
   and scan hold one lock as well. Test selection and assertions remain intact.
   Hosted completion of this fix remains root's responsibility.
3. **Gate helper accepted within its invocation contract:**
   `sprint04a-gates.mjs` runs both full targets without converting a failed check
   into success, records stream hashes/exits and always performs teardown. The
   dedicated project's volumes are removed before completion. It preserves
   earlier attempts and excludes rendered Compose credentials/image archives
   from copied evidence. The helper expects the caller to hold `flock`; its
   invocation string alone is not proof of lock ownership. It checks tracked
   cleanliness only. Receipt hashes bind captured bytes, not hermetic builds.
4. **General recorder accepted:** `sprint04a-evidence.mjs` preserves failed
   command exits, signals, cwd/argv, source/tree and raw stream hashes. It records
   only a small environment allowlist, not a complete environment or process
   executable hash. Read-only hosted retrieval records its local invocation
   source; actual hosted acceptance must additionally inspect the run head SHA
   and named job conclusions. A successful retrieval is not a successful job.
5. **Corpus inventory accepted as inventory:** `sprint04a-corpus.mjs` counts
   retained75-case files, hashes them and explicitly disclaims candidate
   execution. E independently checks ten retained results, including E's own
   two fresh reproductions. Pingora63, Envoy69, Hyper70 and the failed B68
   attempt remain correctly classified. Inventory alone does not check case
   semantics; independent protected-source equality supplies that boundary.
6. **No unsupported gate opening found:** status, risk, ADR and proposed human
   decision retain the six ingress failures, seven supplemental probe failures,
   upstream parser/maintenance limits, TypeScript7 peer blocker and production
   custody/drain/archive obligations. The completion report at this checkpoint
   is explicitly working/pending and understates already completed owner/E
   acceptance; root must update it with actual final receipts before closeout.

## Receipt Checkpoints

`integration-source-01/verification.json` is a successful independent read-only
snapshot from committed verifier `5ea20d1`. It binds every owner file hash and
Git object, all protected files, original E manifest, completed root command
receipts/streams, and ten retained75-case results. At snapshot time gates01/02
were complete failures and gates03 was still incomplete. That record is
deliberately retained; it does not assert the later outcome.

Observed completed root gates03 subsequently records full check0, scan0,
cleanup0 and volume cleanup0 on2133b63. E will verify its final receipt and
manifest against the final documentation source before the final verdict.
Gates01 remains check2/scan0 with stale shared PostgreSQL role state; gates02
remains check2/scan0 with the fixed network bug. The initial hosted foundation
failure and failed/raw/readable log retrieval attempts remain evidence.

One E verifier preflight invocation supplied abbreviated2133b63 instead of the
required full SHA. It exited1 before creating output or making any source
change; repeating with the full SHA passed. This is not a failed product test.

## Remaining Limits

Prior E's accepted source/security findings and limitations remain binding.
The H2 nine bytes remain a failed zero-byte assertion despite SETTINGS ACK
classification; obs-fold263 bytes/one handler and four TE501 responses remain
mandatory failures. Green local/hosted gates cannot waive these conditions or
replace human architecture/security/release review. No public tests, fixture
reruns, owner/root edits or new agents were used by this integration reviewer.

## Agent Completion Report

- Module: Sprint04-A E integration review, local01/03/dependency maintenance.
- Status: source review accepted; final docs/receipt review pending root source.
- Files: only this report and `evidence/sprint04a-e/integration-*`.
- Architecture/contract decisions: none; unchanged v1 and acceptance boundaries.
- Positive/security-negative tests: prior E proofs retained; this continuation
  verifies hashes/source equality and failed receipts without full fixture runs.
- Performance: none; no capacity, availability or revocation SLO claim.
- Risks/human review: Module01 upstream stop, hosted exact-head gate completion,
  production custody/operations and all existing human approvals remain.
- Next unblocked work: root final docs/gate receipts and E final verification.
