# Sprint 04-C execution contract

Baseline: `a325b9ecc086e09467f61b49f17da241bf8e43ea`, refreshed 2026-11-14.
Remote main and clean local main match. Main hosted run43478235586 completes
successfully: foundation-quality132067665540 and supply-chain-security132067666000.
PR12/13/14 are merged; their retained closeout receipts remain immutable.

## Authorization and assignments

The requesting human authorizes isolated engineering, local tests, branches,
pushes, PRs and reviewed merges. No upstream publication, runtime architecture
substitution, production activation or acceptance revision is authorized.
Architecture owner, security owner, formal decision and approval reference/date
are PENDING / not supplied. This sprint prepares their explicit decision.

| Owner | Branch | Exclusive scope |
| --- | --- | --- |
| A / root | docs/sprint04c-architecture-decision | architecture report, proposed ADR012 addendum, human checklist |
| B | research/sprint04c-envoy-upstream | upstream source/API refresh, standalone reproductions, unpublished drafts |
| C / root | design/sprint04c-ingress-alternatives | new boundary design/threat delta/conditional proof |
| D | test/sprint04c-h2-security-proof | additive test-only maintained H2/HPACK attribution and diagnostics |
| E | hardening/sprint04c-regressions | actual00/02/03 regression and dependency compatibility |
| F | review/sprint04c-security | independent exact-source review and adversarial reproduction |
| Root | sprint/04c-integration | accepted integration, full local/hosted gates and closeout |

All worktrees start from the exact baseline above. A and C are authored by
root; B/D/E run independently in parallel, with F assigned independently after
a slot becomes free. F never reviews its own implementation. Root integrates
only exact independently accepted component commits and reviewed repairs.

## Evidence and fixture rules

Commit source before execution. Receipts bind source commit/tree, argv, tool
versions, UTC interval, exits, raw streams and SHA256. Preserve unsuccessful
attempts and corrections. Do not commit rendered Compose, credentials, PKI
private keys or image archives. Keep evidence bounded; reference immutable
prior results rather than repeatedly creating unchanged full candidate runs.

Every shared PostgreSQL, Compose, proxy or scanner fixture holds one exclusive
`/tmp/aegisgate-sprint02-fixtures.lock` through setup, execution, evidence and
cleanup. Compose uses isolated project names and discovered networks. Root
runs full make check/security-scan and cleanup under that lifetime lock.
Hosted foundation-quality and supply-chain-security must pass on exact final
PR head and merge. Bind receipt-only successors by source equality; never claim
a commit contains its own hash. Retain evidence-referenced historical objects.

## Stop conditions and gate matrix

No maintained released strict-provenance capability: stop candidate builds,
report exact upstream dependency and unpublished maintainer request. A new
number or unreleased patch alone is not an implementation trigger. A separate
front end is a new trust boundary needing explicit architecture authorization.

Original75 and23 probe inputs/expectations/evaluators remain unchanged. Their
latest accepted outcomes stay Envoy69/75 and16/23, Pingora63/75 and Hyper70/75
historical. SETTINGS ACK9 bytes still FAIL aggregate-zero. Partial header, HPACK,
new-dial and capture-loss diagnostics cannot grant original-gate PASS.

Modules00/02/03 retain scoped local PASS subject to fresh regressions;01 NO-GO;
04-12 LOCKED; production BLOCKED. An eligible candidate still needs complete
technical/security proof, independent reproduction and recorded affirmative
human architecture/security decision. Human decisions remain PENDING until
actually supplied. Prepared documentation may be COMPLETE without approval.
