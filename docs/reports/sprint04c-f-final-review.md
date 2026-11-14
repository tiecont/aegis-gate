# Sprint04-C independent corrected E and cleanup review

Verdict: ACCEPT corrected E local regression evidence at
`212677805416a3e38d44724bfaf1101c8e11a0d5`, tree
`1bbd377963750776329dff48be3442bf130abbe6`.
REJECT root gate helper at `cb9c30904e3430793d9847d9b9bf3eec3a8d052f`
until the reproduced cleanup defect below is repaired and independently retested.

## Finding requiring repair

P1: `scripts/sprint04c-gates.mjs:92` executes an unguarded Docker container
inventory before the private-file cleanup at line162. An unavailable daemon,
Docker command error, or exception during the preceding cleanup/evidence-copy
work escapes the outer `finally` before the secret-removal block. The helper
therefore does not guarantee cleanup or a complete failure receipt on those
paths. The earlier repair correctly handles private-evidence validation failure,
but protects only exceptions caught by that validation block.

F extended the owner's synthetic harness in memory, preserving the exact helper
source (SHA256 `8900209131660583d5294dc12e947b1360dbc796f329e5b9ee00279af51b915d`).
Injecting an exception specifically from `docker ps` reproducibly aborts module
evaluation and leaves the synthetic password and JWT files present. This uses
only an in-memory filesystem and mocked child processes; no real secret, Docker
operation or fixture is created by this fault test. The clean and two existing
secret-validation failure cases still reproduce their expected0/1/1 results.

Required repair: put private-file removal and failure-receipt finalization in an
outer guaranteed cleanup path, independently guard Docker cleanup/inventory and
evidence copy operations, preserve failure status, and retain the fixture lock.
Test at least Docker cleanup/inventory and evidence-copy exceptions in addition
to the existing secret-validation faults. Complete integration/local/hosted
acceptance remains pending.

## Corrected E evidence

F verified clean exact-head E sources, scoped additions only, and absence of the
rejected `5515913` commit from publishable ancestry. Original repository files,
including75/23 corpus inputs, expected outputs and evaluator semantics, remain
unchanged. The original attempt01 stdout is absent and explicitly ineligible;
its deliberately incomplete manifest and safe rejection metadata remain.
Fresh attempt02 stream offsets, lengths and hashes are complete and contiguous.

F's independent post-cleanup audit checks12 manifest entries,49 command records,
11 Go packages,88 top-level tests and151 subtests with no skips. Container,
network and volume inventories are empty. Removed original credential values
are unavailable for reconstruction: the read-only audit correctly reports
`credential_matches=null`, while the original pre-removal verification records
its own zero-match result. F independently checks private-key markers and
executes recovery/security-negative tests with the Go race detector.

F scans every corrected E added file using the pinned repository Gitleaks image,
unchanged scanner configuration, redaction and disabled container networking.
The actual scan exits0 with an empty findings array; temporary scanner inputs
are removed. Official compatibility collection uses immutable raw GitHub
Markdown rather than third-party injected HTML. TypeScript6 pins, minimatch
override and existing maintenance warning dispositions remain intact.

## Reproducibility and limits

The verifier was committed before execution at
`25c5069` (full exact source/tree and binary hash in `final-01/verification.json`).
Command:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04c-f/review-final.mjs evidence/sprint04c-f/final-01
```

Exit0 means the independent assertions, including reproduction of the helper
defect, succeeded. It does not mean the rejected helper passed. Exact argv,
UTC times, outputs, exit codes, source/tree and SHA256 manifests are retained in
`evidence/sprint04c-f/final-01/`. Node syntax checks pass for collector, owner
helper harness and independently extended harness. The lock covers the full
audit, recovery tests, scanner staging/execution/evidence and cleanup lifecycle.

No runtime candidate, security-contract revision or human architecture approval
is accepted. Module01 remains NO-GO,04-12 LOCKED and production BLOCKED. The
historical9-byte H2 zero-byte failure and16/23 supplemental result remain.

## Agent Completion Report

- Module: Sprint04-C F scoped corrected E/helper review.
- Status: complete scoped review; integration blocked on reproduced helper defect.
- Commits/files changed: F verifier, final-01 raw receipts and this report only.
- Architecture/ADR decisions: no approval; owners and ADR012 decision PENDING.
- Contracts changed: none.
- Positive/security-negative tests: exact commands and successful exits in receipts.
- Performance data: none; synthetic fault injection is not performance evidence.
- Risks/release blockers: helper cleanup exception, full integration gates and hosted CI pending; maintained ingress and formal approval remain prerequisites.
- Human review needed: architecture/security contract decision remains PENDING.
- Next unblocked modules: none beyond accepted00/02/03 local scope.
