# Local signed configuration rollout

Scope: Module03 engine-independent local library. No production edge, public
listener, architecture approval or release is provided by this runbook.

## Provisioning

Provision the signing trust bundle, deployment allowlist, artifact TLS CA and
client identity through authenticated installation. Never learn keys or an
artifact endpoint from JetStream. Use `NewHTTPSFetcher` with one pinned HTTPS
origin and mTLS identity. `NewSignedAdmission` additionally requires the durable
`Store.VerifyPublication` approval callback; a notice cannot advance the rollout
generation until that approval, raw artifact digest and signature all verify.

Provision rollout tables with `PostgreSQLStore.Migrate` using an owner role in a
dedicated schema. Runtime receives SELECT/INSERT/UPDATE on
`config_rollout_state`, SELECT/INSERT on `config_rollout_audit`, and schema USAGE.
It receives no audit UPDATE/DELETE or schema CREATE grant. Maintenance cleanup
uses a separate authorized role. The local fixture proves these restrictions;
production database TLS, identity custody, backups and HA require release work.

## Normal rollout

1. Preview and approve a whole immutable publication through the authorized
   management API. The publisher records its outbox and signed artifact.
2. Treat the JetStream rollout subject as a planner hint. Read the approved
   artifact using signed admission before `Controller.Begin`. Consumers never
   subscribe to a broadcast and activate it directly.
3. Supply a fixed registry of at most128 edges, group membership, canary group,
   quorum, ACK timeout, retry backoff and at most five attempts. These values
   are trusted operator policy, not message fields.
4. `Tick` durably records each targeted dispatch before sending it. Deliverer
   transports must authenticate registered edge identities and honor the
   five-second send context. Consumers authenticate fetch and verify independently.
5. ACK reports enter `/acks` over mTLS with server-side client-chain verification.
   `ACKHandler` derives edge ID from the pinned URI SAN registry. ACKs must match
   deployment, generation and artifact digest and use a bounded safe reason code.
6. Every canary must return a healthy ACK before expansion. Every remaining edge
   receives a dispatch before quorum can complete the rollout. A rejecting or
   unhealthy edge pauses expansion, including a late rejection after completion.

State and each outcome audit event commit in one PostgreSQL CAS transaction.
Concurrent controllers retry a conflict after reading state; they cannot silently
overwrite decisions. Audit rows carry bounded codes, never candidate bodies,
credentials or certificate keys. Captured requests retain one complete immutable
generation; this controller does not combine old routes and new authentication.

## Outage and recovery

Postgres failure prevents new controller transitions or publication approval.
JetStream loss prevents notification progress. Artifact-store failure prevents
fetch/admission. These failures do not remove a consumer's still-valid encrypted
LKG. No snapshot means not ready; expired trust, domain ownership or snapshot
and excessive staleness deny new captures under the explicit consumer policy.

Restart a controller with the same durable PostgreSQL state. It can repeat a
previously recorded dispatch after its bounded timeout. A consumer with the
exact active artifact uses `CurrentAck` to retransmit an ACK lost in transit;
`Apply` still rejects replay. After attempts exhaust, the phase pauses.
`Retry` resumes only a transport/timeout pause. A signature, policy or health
rejection is sticky and requires a new approved signed generation. Late healthy
ACKs do not clear the security pause or stale/invalid artifact alarms.

## Rollback and emergency action

Rollback invokes authorized `RollbackPublication` for an earlier approved
payload, rechecks ownership and creates a NEW monotonic generation. Publish,
verify and canary that generation through the same path. Never edit an artifact,
rewind a counter, disable signature verification or manually mark an ACK healthy.

For urgent revocation, publish a new approved deny/empty snapshot and observe
all required ACKs. Update authenticated signing trust to retire compromised
keys; consumer readiness rechecks current trust. Existing captured operations
retain their generation until bounded completion/drain. If a control-plane or
network outage prevents delivery, remove traffic through the operator's
independently authenticated upstream/LB controls. This library cannot promise
instant revocation on disconnected nodes or terminate an external engine's
active streams. Production needs named emergency owners and a measured drain
budget before activation.

## Retention and telemetry

The controller bounds edges128, events2048 per generation, attempts5, ACK
timeout1s–10min and retry1s–1min. Consumer and artifact-store limits are configured
separately and fail closed at quota. Retain one encrypted consumer disk checkpoint
and bounded in-flight generations. Artifact deletion is an explicit maintenance
operation only after checking durable deployment references; never delete active,
rollback or in-flight artifacts. The local object store refuses quota overflow.

`CleanupAudit` requires an independently verified archive digest and a cutoff
at least30days old, retains the latest generation, deletes at most1024 rows and
records the archive event transactionally. Verify archive recovery before calling
cleanup; production archival automation is not implemented by this local library.

`Controller.Telemetry` exposes generation, phase, healthy ACK/NACK/pending counts,
maximum observed propagation lag and version skew, and sticky invalid/stale
artifact alerts. It measures maxima, not a p95 or a production SLO. Export using
bounded deployment/group dimensions; never label with URLs, paths, raw errors,
tokens or arbitrary edge input. Alert on security pause, invalid artifact, stale
artifact, exhausted retries, missing quorum and dangerous consumer staleness.
Pair this with consumer ACK/NACK/invalid counts, last-valid-update and readiness.
Healthy traffic continues only within the signed validity and staleness policy.

## Local reproduction

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock env AEGIS_TENANCY_INTEGRATION=1 go test -race -v ./internal/configrollout -count=1
go vet ./internal/configrollout
```

The fixture lock spans the whole local database/TLS test lifetime. Tests use
isolated schemas/roles and disposable loopback certificates. Combined real
publisher/JetStream/artifact/consumer acceptance and independent security review
are required in addition to this component suite.
