# Sprint03-B D — rollout and resilience

Branch `feat/module03-rollout`. Core commit `ef8acfd` implements
`internal/configrollout`; the subsequent alert fix and regression retain stale
and invalid-artifact alarms after a late healthy ACK. This component report
does not independently pass the full Module03 or production gate.

The controller authenticates admission against durable publication approval,
an authenticated bounded artifact fetch, exact SHA256 and the shared signed
snapshot contract before advancing its durable generation. It dispatches only
the canary group until all canaries are healthy. Quorum completion still requires
dispatch to every registered edge. Any negative or unhealthy report pauses;
security rejection remains sticky until a new approved generation. Reports bind
generation/digest/deployment and derive identity from a verified mTLS URI SAN.

PostgreSQL CAS state and append-only runtime audit commit atomically. Dispatch
is recorded before network IO; restart/retry can redeliver without skipping
admission. Attempts, edges, body sizes, audit events, timeouts and retry intervals
are bounded. Cleanup retains current-generation audit and requires an archived
digest/cutoff. The runbook documents signed newer-generation rollback, explicit
emergency revocation limits, LKG outage behavior, telemetry and maintenance.

Acceptance exercised by component tests:

| Criterion | Test evidence |
| --- | --- |
| One rejecting canary prevents expansion | canary/quorum sticky rejection suite |
| Healthy canaries gate every other edge | all-edge admission before quorum suite |
| Network retry/controller restart | outage/attempt bounds suite |
| Forged identity, generation, digest and diagnostics denied | ACK negative suite and real mTLS handler |
| Forged bus generation cannot poison floor | signed admission + durable approval negatives before Begin |
| Corrupt persistent phase/policy fails closed | corrupt-state negative suite |
| Rollback is a newer audited generation | rollback/idempotency suite; publisher owns signing/approval |
| Durable CAS, audit rollback, runtime least privilege | actual PostgreSQL integration |
| Invalid/stale alerts survive late healthy ACK | dedicated sticky-alert regression |

Actual command/exit/source/log hashes are retained under `evidence/sprint03b-d/`.
Earlier child runs encountered restricted socket access and missing worktree
fixture paths; they were not counted as database acceptance. Root reported a
successful actual full TLS/PostgreSQL run at core `ef8acfd` after the private
`.local` fixture link. The retained final run below reproduces against committed
alert-fix source with integration explicitly enabled, not a skipped DB test.

## Agent Completion Report

- Module:03 rollout component, engine-independent.
- Status: implementation complete; combined independent module acceptance belongs to F/root.
- Files: `internal/configrollout`, `docs/CONFIG_ROLLOUT_RUNBOOK.md`, this report and hashed evidence.
- Contract: shared snapshot1.0, mandatory signed admission and durable approval callback; no competing envelope.
- Tests: race/unit/admission/security/mTLS/real PostgreSQL, vet and Node syntax commands in retained manifest.
- Performance: bounded local tests only; no capacity, p95 or production SLO claim.
- Risks: production TLS/database custody/HA/archive/drain ownership require release work; disconnected revocation cannot be instantaneous.
- Human review: Module01 architecture approval and production release remain pending.
- Next modules: none opened by this component report;04–12 stay locked under sprint policy.
