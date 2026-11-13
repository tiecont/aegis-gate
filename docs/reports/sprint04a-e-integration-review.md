# Sprint04-A Independent Integration Review

2026-11-13 UTC. Reviewer worktree `/tmp/aegisgate-04a-e`, branch
`review/sprint04a-security`. Baseline
`3e03940848c81751c87bbcec131238abb7d28e1b`.

Final verdict: **ACCEPT integrated owner files, root gate/fixture/workflow
changes, local gate evidence and closeout documentation for the exact source
below**. No new blocking integration defect or unsupported readiness claim was
found. Exact final-head hosted acceptance and main merge remain root-owned work.
Module01 remains **NO-GO**, Modules04-12 **LOCKED**, production **BLOCKED**.
No architecture approval, zero-byte waiver, production release or merge is
authorized by this review.

## Exact Reviewed Source

Final reviewed root source `638d4936d2c2efc902630ef3f18c6a8cf475db7d`, tree
`54d8f2ebb404889d2a434fb2e7a116b31efc1500`. Full local gates ran on executable
source `2133b6303c05158c37ed539c23347376d67b0b3c`, tree
`30254ee38e17b3ed2e22c5b50e7aed2ef6e53f5d`. Between them only root evidence,
status, risk and completion documentation changed; runtime, tests, dependencies,
helpers, fixture integration and workflow bytes are identical.

At the initial source checkpoint root tracked sources were clean and new root
outputs were explicitly listed as untracked. At final verification the detached
root snapshot was entirely clean. Neither statement asserts hermetic builds or
empty ignored dependency/build caches.

| Owner | Exact accepted branch head | Equal integrated changed files |
| --- | --- | --- |
| A | `8d83ece166290b7c81e757281e5b1778e83dede4` |293 |
| B | `93dc1223ae09d2562a9b4c5b307b173f960b9ea4` |237 |
| C | `6acbe0f55d50334a14b95c4d3e9888f5d1aebecf` |313 |
| D | `b42bae1e9ffa63b4dfd4c94c9a6376f7129077ce` |64 |
| F | `bf5785eb8bd6449fc34915b7c2f392bd1d46350f` |24 |
| Prior E | `be7fd31ff5eeebb11acd37a991b1ccdec8cfa027` |229 |

All 1,160 files match Git mode/blob identity and working bytes. The root-owned
`docs/sprints/04a-execution.md`, also present in B/D history, is excluded from
owner equality and reviewed separately as the current execution contract.
F executable source remains the independently exercised
`99e41a2438d42c9588620d7766d2b03ebc557a14` source as
accepted by prior E; E has not repeated full fixtures. All protected baseline
`spikes/edge-comparison/`, `spikes/pingora/lab.mjs`, `internal/configsnapshot/`,
frozen CONFIG_PROTOCOL, root/dashboard manifests/locks and Go module files
match baseline objects (30 protected files). The complete original E checksum
manifest verifies (228 entries). No historical owner manifests were rewritten.

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
   Later hosted run43409167346 passes both required jobs at2133b63. Hosted
   acceptance on the final integrated documentation/review head remains root's
   responsibility; this earlier success does not satisfy that final-head check.
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
   custody/drain/archive obligations. The initial working completion report
   understated completed owner/E acceptance. Root's final638d493 documentation
   now records that acceptance and the actual source/exits/failed attempts,
   scanner input and limitations. Hosted final-head acceptance and merge are
   explicitly pending. No correction to those claims is required by E.

## Verified Receipts

`integration-source-01/verification.json` is a successful independent read-only
snapshot from committed verifier `5ea20d1`. It binds every owner file hash and
Git object, all protected files, original E manifest, completed root command
receipts/streams, and ten retained75-case results. At snapshot time gates01/02
were complete failures and gates03 was still incomplete. That record is
deliberately retained; it does not assert the later outcome.

Final command, from E's restored worktree using pinned Node26.13.0:

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04a-e/integration-review.mjs /tmp/aegisgate-04a-e/.local/integration-root-638d493 integration-final-01 638d4936d2c2efc902630ef3f18c6a8cf475db7d
```

It exits0 from committed E verifier/report checkpoint `ab97724`. Its receipt
binds the exact final root source/tree and every owner/protected/root file,
all completed root command streams, ten retained corpus results and all three
root gate manifests. `integration-final-01/verification.json` SHA256:
`089c1e31f5f0336da4871b52e26787e1eb9ab11041d8bd602979d342cb79804f`.

| Root attempt | Verified source | Check / scan / cleanup / volume cleanup |
| --- | --- | --- |
| gates01 | `9beace00414f8eb8a9dd9ebc00f8abe8e9ee29ee` |2 /0 /0 / not run |
| gates02 | `1d1262e121de02f5cfc074205c9bff18ada9ce08` |2 /0 /0 /0 |
| gates03 | `2133b6303c05158c37ed539c23347376d67b0b3c` |0 /0 /0 /0 |

All three are complete; failed earlier attempts remain failed. Gates01 retains
stale default-project PostgreSQL state; gates02 retains the corrected network
failure. Gates03 spans2026-11-13T10:25:47.915Z-10:28:18.231Z. Its56-entry
manifest and all stream hashes verify. Selected SHA256:

```text
187d094019069841692e69317188ad83adef8f8b3c9c5c069dfff697e23a04a9 gates-03/commands.json
39b2105c5ba7d1e1144f3e479ab4e7b00dbadc8bd12f8310db6c6135dc467341 gates-03/SHA256SUMS
99904fb885432becaba4de78bb625ab18b86b8771321413c60e26a7c633f707d gates-03/check.stdout.log
876c2024842f8c0ed0a4cf29181e9fd53a015169e5f63f4b65c20a7033de859f gates-03/check.stderr.log
8f9869b2cf6f974be8699ef4de9ec66f30d21fe378b4cfdf12835c8f35244b32 gates-03/security-scan.stdout.log
```

The scanner has meaningful input:235 history commits/45.51MB,28.12MB worktree,
dependency/filesystem scans, repository/image SBOMs and exact local-image
identity/pinned Envoy checks. The two Pingora maintenance warnings remain;
zero gate-triggering vulnerabilities does not accept unmaintained dependencies.
Safe scan evidence is retained; rendered Compose credentials are absent from
the committed gate evidence.

Read-only hosted metadata additionally confirms run43408513539 at9beace0:
foundation-quality fails, supply-chain-security succeeds. Run43409167346 at
2133b63 completes with both named jobs succeeding. These retrievals dispatch
no workflow or test. They establish neither hosted success on638d493 nor on
the eventual E-integrated final head. Root still owns that exact-head check,
PR12 integration and main merge. Failed/raw/readable original log retrievals
remain preserved rather than rewritten.

Final E closeout command is `node evidence/sprint04a-e/integration-closeout.mjs
integration-closeout-01` using the same pinned binary. Its raw receipt records
actual source/times/exits, both hosted head/job checks, source-only whitespace,
verifier syntax and a scoped offline pinned Gitleaks scan. It preserves the
original E checksum manifest and creates `integration-SHA256SUMS` for this
continuation's report, tools and evidence. This scoped check is separate from
root's full scan and final-head hosted obligations.

One E verifier preflight invocation supplied abbreviated2133b63 instead of the
required full SHA. It exited1 before creating output or making any source
change; repeating with the full SHA passed. This is not a failed product test.
After interruption the temporary worktree directories were absent; E restored
its committed branch atab97724 and created only its own ignored detached638d493
snapshot. Root and all component worktrees were left untouched. Path/shell
exploration errors supply no acceptance evidence. No committed proof was lost.

## Remaining Limits

Prior E's accepted source/security findings and limitations remain binding.
The H2 nine bytes remain a failed zero-byte assertion despite SETTINGS ACK
classification; obs-fold263 bytes/one handler and four TE501 responses remain
mandatory failures. Green local/hosted gates cannot waive these conditions or
replace human architecture/security/release review. No public tests, fixture
reruns, owner/root edits or new agents were used by this integration reviewer.

## Agent Completion Report

- Module: Sprint04-A E integration review, local01/03/dependency maintenance.
- Status: complete scoped integration review; final638d493 source/docs/local
  receipts accepted. Final-head hosted acceptance and merge remain root-owned.
- Files: only this report and `evidence/sprint04a-e/integration-*`.
- Architecture/contract decisions: none; unchanged v1 and acceptance boundaries.
- Positive/security-negative tests: prior E proofs retained; integration source
  and final verifiers exit0, verify equality/checksums and preserve failed gate
  receipts without full fixture runs. Closing checks are recorded separately.
- Performance: none; no capacity, availability or revocation SLO claim.
- Risks/human review: Module01 upstream stop, final-head hosted gate completion,
  production custody/operations and all existing human approvals remain.
- Next unblocked work: root integrates this review, runs required hosted checks
  on the exact final head and completes authorized PR12 handling. Maintain
  Modules00/02/03 locally and resolve Module01's upstream prerequisite.
