# Sprint04C F independent final integration source verdict

Verdict: **ACCEPT exact integration SOURCE within this scope** at
`dd5b48441982bf76a53982a16c53b948e59b175e`, tree
`616cd569b30c022eff47b4e7bbfdbdbe6e48362d`.
No remaining source-integrity finding was established in this audit.
**Final integration acceptance remains PENDING**: helper578d78f fault-path
review is separate, and final local/hosted receipts have not been audited here.
Human architecture/security owners and approval remain PENDING; Module01 NO-GO,
04-12 LOCKED, production BLOCKED. No security waiver or Module04 authorization.

## Exact source and unchanged requirements

All 3,115 baseline objects outside the three declared shared documents retain
their exact modes/blobs versus `a325b9ecc086e09467f61b49f17da241bf8e43ea`.
The only modified baseline files are IMPLEMENTATION_STATUS.md, RISK_REGISTER.md
and the proposed ADR012. Their reviewed additions retain pending approval and
downstream locks. All other Sprint04C changes are additive documentation,
evidence, test-only spike sources and the gate helper. Production code,
authorization/TLS, dependencies, scanner policy, workflows, threat model,
quality gates, original75/23 inputs/expectations/evaluators and historical
evidence are unchanged. All 3,576 integration working files match target blobs
and modes before execution.

| Owner | Accepted exact head | Equal changed objects |
| --- | --- | ---: |
| A | `02bad67b51a8171493ad3ff1eee245e3f07d6e2f` | 20 |
| B | `12abd255b754b553480544edbf9452b7f65d9a4d` | 137 |
| C | `49f2d554d30fd9002f6d15e7ee39999a6e866d5c` | 33 |
| D | `d9a2004167a178a3a1d4549cc97378fe4b02c360` | 70 |
| E corrected | `212677805416a3e38d44724bfaf1101c8e11a0d5` | 39 |

The prior F review objects also equal `cede69e` exactly. Rejected unpublished
E `551591395880ce87863b4e861c05d266c719b91f` is not an ancestor of the target.
No global Git/history scan was run in this shared object store. The publishable
clean clone `/tmp/aegisgate-04c-gates` remains the required full history-scan
location; this ancestry assertion does not substitute for that scan.

## Evidence integrity and eligibility

All27 Sprint04C manifests verify519 present entries. Exactly two entries remain
deliberately absent: E attempt01/stdout.log and F receipts01/secrets.json.
Their original digests, redaction explanation and failed/ineligible status are
retained. Neither incomplete manifest is a complete-manifest PASS. The original
omitted streams were not reconstructed or fetched. Historical failed B reprot01,
C source01, D verification01, F ace01 and superseded E/earlier helper evidence
also cannot become eligible merely because retained hashes match.

Sixteen A/B/C/D/F receipt groups bind exact source/tree objects,295 source
hashes,173 commands and346 stream hashes. Nineteen F upstream stdout references
resolve to the unchanged retained Sprint04B sources; no duplicate source fetch
or public protocol test was performed. Corrected E separately verifies49
commands and98 contiguous stream slices, including expected lock-conflict/TS7
failures. Its11-package/88-test/151-subtest/no-skip Go record and empty retained
cleanup inventories agree. This is receipt verification, not another complete
E regression run. Deleted original credentials are not reconstructed;
credential_matches remains null for this audit.

No committed binary/archive or added file over1MiB was found. Eight duplicate
payload groups over1KiB are enumerated by hash: tool/upstream metadata, repeated
HAProxy source and unchanged Pingora warning output. These are storage copies,
not additional independent executions. Two exact immutable helper test sources
contain a synthetic BEGIN-key-marker literal without key material; their blobs
are recorded. The scanner policy is unchanged. Node26 binary SHA256 matches
the recorded Node receipts; no historical decoder executable was rebuilt or
claimed independently reproduced in this source audit.

## Executed verification

Committed verifier source `e0a88f72c49f22a957439159322212c5959b1337` produced
`evidence/sprint04c-integration-audit/final-04/`, exit0:

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04c-integration-audit/final-source.mjs evidence/sprint04c-integration-audit/final-04
```

The original corpus extraction, six original evaluator unit tests, authored
whitespace and12 integration Node syntax checks pass. Re-evaluating unchanged
historical Envoy75 intentionally exits1:69/75, all six failures retained,
including9 origin bytes/zero handlers. Original supplemental16/23 and its seven
failures are unchanged. D's semantic_security_pass remains false. This audit
does not rerun75/23 or turn diagnostics into a replacement acceptance oracle.

Three in-memory verifier negatives reject restored omitted evidence, a hash
mismatch and an unexpected missing stream. Pinned Gitleaks, offline with the
unchanged repository configuration, scans563 integration/F-audit files and
exits0 with an empty findings array. The full lifecycle flock covers verifier
execution, scanner staging, streams/manifests and staging removal. No helper
fault tests, full gates or external security traffic were executed here.

Extended attempts final01/02 stopped on this verifier's missing reference-schema
handling and overbroad marker assertion. Final03 completed source/evaluator
checks but its new verifier's adjacent marker strings triggered the scanner;
the redacted failed scan is retained. String construction was corrected without
changing scanner policy or owner files. All three attempts remain unsuccessful;
only final04 supplies this source verdict. Preliminary proof01/02 and their
separate report remain historical and unchanged.

## Agent Completion Report

- Module: F independent Sprint04C final integration source audit.
- Status: scoped source/evidence audit COMPLETE; final integration PENDING.
- Changes: additive F verifier/plan, retained attempts, evidence and this report.
- Architecture/ADR decisions and contracts changed: none.
- Positive/security-negative tests: exact commands, expected exits, source/tree,
  tool identity, UTC intervals, streams and SHA256 in final04; no runtime claim.
- Performance data: none; no capacity or production security claim.
- Remaining: separate helper fault verdict; full locked gates/cleanup and clean
  clone history scan; exact PR-head/merge hosted jobs; followup source/receipt
  binding after actual receipts are supplied. Baseline CI is not final CI.
- Human review: named architecture/security decision and production signoff
  remain PENDING/BLOCKED; no downstream module is unlocked.

## Publishable Import

Root imports the exact final verifier and retained audit outputs as file content,
not the intermediate review branch ancestry. That unpublished branch contains
an assertion-literal scanner rejection subsequently corrected without changing
scanner policy. The exact verifier bytes and SHA256 are preserved; failed audit
attempts remain failures. This avoids publishing the rejected intermediate
source while retaining safe commands, original digests and redacted findings.
The successful source verdict concerns dd5b484, not a future integration head.
