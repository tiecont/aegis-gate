# Sprint 03-B execution contract

Baseline: `771b006c8075f038c0c55baf7fe251b36f666b98`. Local fixtures only.
This plan authorizes Module03 implementation and isolated Module01 research;
it grants no production runtime, release or architecture approval.

| Work | Isolated branch | Code / acceptance |
| --- | --- | --- |
| A snapshot trust | `feat/module03-snapshot-trust` | `internal/configsnapshot`, versioned schema, `docs/CONFIG_PROTOCOL.md`; canonical bytes, signature/trust/tenant/schema negatives |
| B publisher | `feat/module03-publisher` | `internal/configpublish`, `apps/config-publisher`, additive management migrations; real PostgreSQL outbox/fencing, mTLS artifacts, JetStream |
| C consumer | `feat/module03-config-consumer` | `internal/configconsumer`; signature/digest/replay validation, immutable staged generations, restricted AES-GCM LKG, restart/staleness/concurrency |
| D rollout | `feat/module03-rollout` | canary/quorum/health, audited pause/retry/rollback, bounded retention and telemetry |
| E parser research | `research/module01-maintained-parser-resolution` | maintained-parser source/settings, unchanged75 corpus, precise remaining blockers; no automatic GO |
| F review/integration | `sprint/03b-integration` | independent review and reproduction of A–D and E, end-to-end acceptance, exact-source check/scan and exact-head hosted CI |

The frozen shared library owns envelope interpretation. Notices carry exact
artifact SHA256 and are hints only; consumers reauthenticate fetch and verify
the signed envelope. No independent competing envelope or production proxy is
authorized. All shared Compose/DB/fixture command lifetimes hold
`/tmp/aegisgate-sprint02-fixtures.lock`.

Sequence: A publishes shared API while B creates durable outbox and C consumer;
E researches independently. D integrates frozen A/B/C interfaces. F reviews
immutable commits, adds adversarial regressions, and reproduces real local
publication/fetch/activation/ACK and outages. Findings return to owners before
sequential integration. Required final commands are `flock
/tmp/aegisgate-sprint02-fixtures.lock make check` and `flock
/tmp/aegisgate-sprint02-fixtures.lock make security-scan`, plus all Module03
integration/negative suites and both hosted jobs. Each run records source,
argv, actual exit code, logs and SHA256 without secrets.

Module03 passes only on complete acceptance plus independent review. Module01
remains NO-GO pending a complete maintained implementation proof and recorded
human architecture decision. Module04 requires both gates;05–12 remain locked
under the sprint scope. Production remains blocked. Final status must reflect
executed evidence, including any incomplete criteria.
