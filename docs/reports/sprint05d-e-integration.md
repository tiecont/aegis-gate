# Sprint 05-D Integration And Accepted-Module Safety

Modules00/02/03 local regressions PASS. No new complete ingress runtime is
qualified. Module01 remains NO-GO, Modules04-12 LOCKED, production BLOCKED.

Baseline `aa289da3f48334ec8e2156f66ebd2a8f3cfb3324`; branch
`test/sprint05d-runtime-regression`, isolated worktree
`/home/tiecont/.cache/aegisgate-05d/e`. Collector source
`01fdaacb8b6debf2f382422f5d790401cbb28d3f`, tree
`8058a6a0d1611187627c55c9724d63d5d993b7cf`, copies the accepted05C collector
with a05D namespace. The stale-volume helper accepts that namespace; all its
assertions, timeouts and image checks remain unchanged. Dependency pins and
accepted PostgreSQL TCP readiness/serialized package execution remain intact.

## Actual Execution

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
 env TMPDIR=/home/tiecont/.cache/aegisgate-05d/e/.local/tmp GOAMD64=v1 \
 /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
 scripts/sprint05d-e-regressions.mjs evidence/sprint05d-e/attempt-01
```

The exact PATH, argv, versions, tool hashes and command exits are in
`evidence/sprint05d-e/attempt-01/commands.json`. All28 commands exit0.
Real Compose PostgreSQL, Redis, NATS/JetStream and mTLS fixtures passed image,
credential, stale-volume/restart and retained-data checks. Race execution covers
11 packages,89 top-level tests and151 subtests, zero skips. Existing tenant,
RBAC/OIDC negatives, signed snapshotv1, trust rotation, encrypted LKG,
rollback/canary, provisioning floors, drain/recovery and archive references pass.
Contracts and contract integration pass. Root/dashboard/spike strict npm
resolution, dashboard lint/typecheck/tests/build/integration and the supported
TypeScript/typescript-eslint dependency tree pass without forced peers.

Cleanup and remaining-container/network/volume commands all exit0. The lock is
held through setup, capture, private-value inspection, cleanup and hashing.
Private fixture material is removed; no private value matches retained output.
Receipt SHA256:
`3f653cf0ee01ba653a6fd8a70c1196495a68a7f6f8f3fcef75dd6c7d45ea1ac5`.
SHA256SUMS SHA256:
`6065418dee3062d9e0180d686e7a3e715f9a36cd9119a5093fc9d40b569a8589`.

## Integration Boundary

| Scope | Disposition |
| --- | --- |
| Existing accepted management modules | Fresh real integration/race PASS |
| Envoy four TE and two malformed-header repairs | Immutable accepted05A/05C evidence preserved; no candidate change by E |
| Original75/23 | Baseline73/75 and19/23 retained; no new credible repaired candidate yet |
| A strict staging | Isolated finite H1 feasibility only; mandatory precompletion streaming fails |
| B/C codec paths | Require supported mechanism and original targeted PASS before combination |
| TLS/tenant/config, H2 reuse/multiplexing, WS/gRPC end-to-end on combined runtime | UNPROVED; separate PoCs cannot establish this |
| New runtime architecture acceptance | Not granted |

No full75/23 rerun is justified merely to repeat unchanged failure counts.
Complete final-source local security/quality gates and independent F review
remain root integration obligations, separate from these module regressions.
