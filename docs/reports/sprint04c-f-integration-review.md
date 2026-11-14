# Sprint04-C independent preliminary integration audit

Verdict: **ACCEPT preliminary source integrity only** for integration
`dd5b48441982bf76a53982a16c53b948e59b175e`. Final integration, full local gates,
hosted jobs and merge acceptance remain **PENDING**. This review grants no
runtime eligibility, requirement waiver or human architecture/security approval.

The verifier was committed before execution at `27eae83`; `proof-02` records
its exact source/tree, tested integration tree, command arguments, binary hash,
tool versions, UTC interval, exits, raw streams and SHA256. Remote main was
refreshed during the audit and remains
`a325b9ecc086e09467f61b49f17da241bf8e43ea`.

## Independently established

- All 3,115 baseline Git objects outside the three explicitly shared status,
  risk and proposed-ADR documents retain their exact modes/blobs. This protects
  production code, dependencies, workflow/scanner policy, all historical
  evidence, original75 corpus/evaluator and original23 probe expectations.
- All 299 changed owner files exactly match the independently reviewed A/B/C/D
  and corrected E heads: A02bad67 (20), B12abd25 (137), C49f2d55 (33), Dd9a2004
  (70), E2126778 (39). No owner source is silently edited during integration.
- All27 Sprint04-C manifests are audited. The deliberately absent original E
  stdout and F scanner findings report remain explicit redacted exclusions,
  matched to retained original digests and classified ineligible. Their missing
  data is neither reconstructed nor counted as complete-manifest PASS.
- Rejected E5515913 is not an ancestor of the audited source. The clean
  replacement ancestry does not distribute its flagged evidence blob.
- Original75 extraction check, authored-source whitespace check and all11
  current Sprint04-C observer/reproducer/root-helper Node syntax checks pass.
  The status, completion report and proposed ADR retain NO-GO, LOCKED, BLOCKED
  and PENDING approval markers.

No fixture, scanner, new proxy candidate or full repository gate is executed
by this source-only verifier. Component runtime acceptance remains scoped to
the separate F review reports; owner byte equality does not independently
reproduce those executions. Current root helper578d78f is syntax checked only
here and requires its separate cleanup-fault review.

## Retained unsuccessful checkpoint

`proof-01` audits the older abcb79a checkpoint, then correctly stops when its
root-helper blob differs from the newer checked-out source. It cannot supply
a syntax or final-source PASS. The receipt remains unchanged. Fresh `proof-02`
uses dd5b484 and verifies exact source equality before every syntax execution.

## Reproduction and remaining acceptance

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node --check evidence/sprint04c-integration-audit/verify.mjs
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04c-integration-audit/verify.mjs dd5b48441982bf76a53982a16c53b948e59b175e evidence/sprint04c-integration-audit/proof-02
```

The retained second command exits0; reproductions require a fresh output name,
a clean committed verifier and the exact tested executable bytes in the working
tree. Source identity checks intentionally fail if that tree has advanced.

Before merge, root still needs independent acceptance of the repaired helper,
complete locked make check/security-scan and cleanup receipts, their exact
source/tree/stream/scanner audit, and foundation-quality/supply-chain-security
on the exact PR head and merge commit. Receipt-only additions must preserve
tested executable bytes. This report does not assert those future outcomes.

## Agent Completion Report

- Module/status: F preliminary integration source audit COMPLETE; final review PENDING.
- Changes: independent verifier, compact proof01/02 and this report only.
- Contracts/architecture decisions: none; ADR012 remains PROPOSED and actual
  architecture/security owners and approval reference/date remain PENDING.
- Positive/negative tests: exact-source equality, baseline and ancestry,
  manifests, corpus, whitespace and syntax checks as recorded; stale-source
  rejection retained. No runtime/performance claim.
- Gate state:00/02/03 retain scoped local PASS;01 NO-GO;04-12 LOCKED;
  production BLOCKED. Original nine-byte H2 failure remains FAIL.
- Remaining risks: final integration/local/hosted review and maintained ingress
  capability plus formal human approval. No downstream module is unlocked.
