# Sprint 05-C Execution Contract

Baseline main `078d83c0ab1cb1364d0245d4c4f62f0fe0439e97`, tree
`28aa22cf761092e31c84dc3d07d0d7593784afd3`; refreshed remote agrees.
Exact baseline push run `43672825174` passes foundation-quality and
supply-chain-security. Original scores remain 73/75 and 19/23.

| Owner | Branch | Isolated worktree |
| --- | --- | --- |
| Root integration | sprint/05c-integration | /home/tiecont/Projects/aegis-gate |
| A | feat/sprint05c-strict-ingress | /tmp/aegisgate-05c-a |
| B | feat/sprint05c-h2-isolation | /tmp/aegisgate-05c-b |
| C | fix/sprint05c-h2-errors | /tmp/aegisgate-05c-c |
| D (root) | test/sprint05c-request-isolation | /tmp/aegisgate-05c-d |
| E | test/sprint05c-regressions | /tmp/aegisgate-05c-e |
| F independent | review/sprint05c-security | /tmp/aegisgate-05c-f |

A/B/C execute concurrently; root implements D. E and independent F follow as
slots become free. Sole file ownership is sprint05c-letter source/report/evidence;
root alone edits shared status, risk, execution and completion documents.
No shared-tree candidate edits or acceptance from uncommitted sources.

## Checkpoints And Acceptance

1. Verify the 11 original75/23 protected files against accepted baseline using
   `scripts/sprint05b-baseline.mjs`; retain source, tree and SHA256 inventory.
2. A implements incremental H1 identity/admission and bounded private staging;
   B tests a new supported causal H2 mechanism; C exercises actual supported
   rejection/error paths; D builds maintained Framer/HPACK adversarial attribution.
3. Each significant claim needs committed clean source, versions, exact argv,
   exits, raw observations, hashes and full owned-fixture cleanup. Tests remain
   loopback-only. Every shared lifecycle holds
   `/tmp/aegisgate-sprint02-fixtures.lock` through setup, capture and cleanup.
4. E reruns actual00/02/03/config/tenant/TLS/dependency regressions. F independently
   reproduces candidate and observer claims, verifies original sources and issues
   separate scope verdicts. Root integrates accepted non-production changes only.
5. Full locked quality/security gates and fixture cleanup must pass, then both
   hosted jobs on exact integration head and actual merge. Failed attempts remain.

Original75/23 inputs, expectations, evaluators and measurement windows are
immutable. No ACK subtraction, timing shift, incomplete-capture PASS, parser
fork, scanner suppression, TLS weakening, production or external publication.
Question A (strict late syntax plus streaming), B (original H2 zero-byte with
reuse), C (four H2 rejections) and D (adversarial attribution completeness) each
receive IMPLEMENTED/PASS, TESTED/FAIL or UNRESOLVED with executable evidence.
No complete runtime is inferred from a standalone H1 parser or observer.

Module00/02/03 PASS local;01 NO-GO;04-12 LOCKED;production BLOCKED. ADR012 and
actual human architecture/security owner/approval remain PENDING. Engineering
authorization does not supply architecture or security-contract acceptance.
