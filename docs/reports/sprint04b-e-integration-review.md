# Sprint04-B Independent Integration Review

Verdict: **ACCEPT**, scoped to the exact integrated research/docs/test sources
and full local gates below. No new blocking integration finding. Final hosted
integration-head and main-merge jobs remain **PENDING**; this is not runtime,
architecture, security-owner or production approval.

## Exact Sources And Equality

Reviewed clean integration `0cf24f494001711bfb87695536db20732dcb7b1a`, tree
`1775707ec26ca995400569b031f271f1acec602a`, and clean PR13 receipt/docs head
`a58f4cc628e8c56f0c7ccf105b26581ceb9484e1` in detached snapshots. Compared
Git modes/blobs and working SHA256 against accepted exact A3348ca0, B5de8179,
C71a3dc6, Dab4e1f6 and prior E8ca7e4f: all667 owned changed files match
(A16, B228, C80, D286, E57). The25 remaining changes are allowlisted root
coordination docs, helper and receipts. All2,291 protected baseline objects
match PR12 merge `cbb5f71db84b9489bf4a6260696bbba29ab4a561`; the only modified
baseline paths are the three reviewed shared status/ADR011/risk documents.
All2,983 integrated working files match their pinned Git objects.

Root helper blob `890a930461899958b45f7682c9d68c2f74dc1da1` is unchanged from
the prior scoped review. It asserts the actual ancestor-held fixture lock,
requires tracked-clean source and preserves safe raw receipts, including
cleanup. It excludes credential-bearing rendered Compose and image archives.
The PR13 delta contains only the expected B/helper E receipts, full gate
receipts and completion document; all E files match accepted `a48ad72`.
Executable, workflow, dependency, contract and original corpus/evaluator bytes
are identical to the tested source.

## Local Gate Evidence

Independently checked all56 manifest entries, exact source/tree, tool hash,
four commands/eight stream hashes, raw outputs and complete receipt inventory
under `evidence/sprint04b-root/gates-01/`. All four exits are0:
`make check`, `make security-scan`, `make dev-down`, and dedicated Compose
`down --volumes --remove-orphans`. Source was tracked clean. Recorded interval
is2026-11-13T17:29:05.243Z through17:33:13.150Z, isolated project
`aegisgate-04b-root`; lock assertions persist through cleanup and no project
containers remain. Raw teardown logs show project network and volume removal.
No rendered Compose or archive is present in retained gate evidence.

Raw check outputs substantiate formatting/lint/type/build, Go race,
Rust/JS/contract tests, real authenticated PostgreSQL/Redis/NATS and TLS
positive/negative fixtures, fresh image initialization/persisted restart,
observer controls, immutable corpus and deliberate gate-defect self-tests.
This independently audits root execution; it does not claim another full rerun.

All26 scanner operations report PASS. Structured outputs contain real inputs:
Rust locks29/206/87 dependencies, npm47/175/34 dependencies and no reported
advisories; Go reports no vulnerabilities. Gitleaks worktree34,490,848 bytes
and history52,622,666 bytes/282 scanned commits report no leaks; preflight sees
311 available commits. Both findings arrays are empty. Filesystem447 packages,
Envoy7 and four fixture images30/29/54/23 packages have no retained
HIGH/CRITICAL findings. Six CycloneDX outputs contain453/8/31/31/55/24
components. Exact immutable image inventory, local build-source hashes and
archive-to-scanner identity receipts verify. Archive identity is audited from
the retained source and successful raw verification logs; removed archives
are not independently regenerated. Scan claims remain bounded to recorded
inputs, databases, versions and configured severity, not absence of all defects.

## Documentation And Remaining Boundaries

Status, risk, ADR011/012, execution contract, closeout addendum and completion
agree with the accepted component evidence. B's invalid initial tap, failed
mapper, exceeded lifecycle bound, empty trailer maps and syntax-only final
cleanup remain explicit. C's unavailable native tap, retained seven failures,
unproven8MiB cancellation and bounded32MiB samples do not become security PASS.
D's ineligible redacted attempt02 remains ineligible; eligible03 is separate.
Proposed request-attributed origin isolation does not activate a new contract.
The9-byte H2 SETTINGS ACK still fails the unchanged zero-byte assertion.

Module01 remains **NO-GO**, Modules04-12 **LOCKED**, production **BLOCKED**.
Formal architecture/security owner and decision remain PENDING. Resume runtime
work only with a maintained supported released capability, targeted historical
failure proof, unchanged75, complete TLS/identity/stream/cancellation/pooling/
config/resource evidence, independent review and affirmative human approval.
Root still must verify both named hosted jobs on the exact final reviewed PR
head and exact main merge. Receipt-only successors require equality binding;
this report does not assert future CI success or authorize merge/publication.

## Reproduction And Agent Completion Report

Both verifiers were committed before proof. From E's worktree, using pinned
Node26.13.0:

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04b-e/integration-review.mjs /home/tiecont/Projects/aegis-gate-04b-e-root evidence/sprint04b-e/integration-source-01
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04b-e/gates-review.mjs /home/tiecont/Projects/aegis-gate-04b-e-final evidence/sprint04b-e/integration-gates-01
```

Both exit0. Fresh output paths are required for a rerun. Source proof verifier
commit489432d; gate verifier/proof checkpointa0fe945. Proof JSON SHA256:

- Source: `53127770c78b8c7826e26d6252c827b8a26bc818e956c419563d4ebe650eeab8`.
- Gates: `f1eb41e1b759bf5b913a3cab5215c0ad03a19423385b9ff5c40cbdc48f063240`.

## Agent Completion Report

- Module: E independent Sprint04-B integration review.
- Status: complete for exact source/local receipt scope; hosted closeout pending.
- Commits/files changed: E-owned verifiers, fresh proof and this report only.
- Architecture/ADR decisions: proposed-only package accepted; none activated.
- Contracts changed: none.
- Positive tests executed: both commands above exit0; source verifier separately
  executes immutable75, root authored-whitespace and helper syntax checks, all0.
- Security negative tests executed: root raw negative/gate-defect receipts audited;
  independent recovery/relay checks remain in accepted A/D and C reports.
- Performance data: no new performance claim or runtime experiment.
- Known risks/release blockers: unchanged six Envoy/seven supplemental failures,
  unsupported parser capabilities, human decision and final hosted/main checks.
- Human review needed: accountable architecture/security ownership and formal
  decision; independent acceptance does not provide those approvals.
- Next unblocked modules: none beyond bounded research/receipt closeout.
