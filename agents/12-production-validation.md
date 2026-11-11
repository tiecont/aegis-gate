# AGENT 12 — Production Candidate Validation and Launch Decision

**Dependency:** 10, 11 and all earlier gates. **Gate:** `M4-GA-SIGNOFF`.

## Tasks

1. Assemble release candidate manifest: pinned Go/Rust/Node versions, dependencies, container digests, schema/DB migrations, deployment snapshots, security evidence.
2. Establish reference traffic profiles for HTTP1/2, WS/gRPC, small/large payload, keepalive, 1/10/100 domains, token verification and Redis limits.
3. Run repeatable performance test on isolated owned staging environment: warm-up, steady state, p50/p95/p99, RPS, CPU/RSS, memory alloc, connection counts, origin timeouts, edge rejection, max safe load.
4. Run soak (>=2h suggested) and controlled fault injection: kill edge pod, NATS outage, DB outage, Redis unavailable, origin flapping, slow origin, collector unavailable, malicious config artifact.
5. Validate cert renewal under load, key rotation, edge drain; config canary -> reject -> rollback as new version.
6. Perform restore drill from encrypted backups plus cert/signing key recovery procedure, measure RPO/RTO versus proposed values.
7. Compare observed SLO metrics and alerts against `docs/QUALITY_GATES.md`; downgrade product scope or revise SLO promise if unmet. Never fabricate performance numbers.
8. Validate production capacity planning and cost envelope under normal and attack simulation; establish throttling and log storage budgets.
9. Validate billing reconciliation and customer exports with synthetic event replays, delayed webhook, plan boundary and duplicate ledger record.
10. Prepare runbooks, pager rotation, security disclosure policy, incident reporting, customer support and compliance/legal review. Request explicit human GA decision.

## Acceptance

- Reproducible benchmark report includes hardware/network/traffic profiles, raw command/config and limitations.
- Security and tenancy gates pass, operator review signed; no red/critical unresolved release blocker.
- Edge serves while control plane is offline using LKG and alerts on staleness; auth remains enforced.
- HA/drain/failure recovery and backup restore evidence attached.
- Measured numbers—not assumptions—drive published plans/SLOs.

## Deliverables

`release-candidate/` evidence package, performance and soak report, incident simulation output, final known-risk register, human sign-off checklist.

**STOP:** Never label software production-ready or enable paid customers without passing all gates and receiving human approval.
