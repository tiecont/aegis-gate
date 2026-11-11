# Sprint03-B C — engine-independent configuration consumer

Module03 component implementation; final module acceptance belongs to the
independent integration report. Branch `feat/module03-config-consumer`.

`internal/configconsumer` consumes the shared `internal/configsnapshot` contract.
An authenticated fetch adapter supplies a bounded stream; an untrusted notice
cannot substitute its deployment, generation or exact-artifact SHA256. The
consumer revalidates every signed field, trust key, payload reference, validity
and maximum staleness before constructing complete route/policy/pool indexes.
Only exact path matching is defined by snapshot1.0. This library opens no edge
listener, proxies no traffic and implements no customer authentication engine.

`NewHTTPSFetcher` pins one HTTPS artifact origin, verification CA and consumer
certificate. TLS hostname/chain validation is mandatory, TLS>=1.2, redirects
are denied, connection/header/time limits apply, and only exact lowercase digest
paths can be fetched. Disposable loopback mutual-TLS tests exercise success,
wrong name/CA, missing client identity, forged locations, redirects and replaced
artifact bytes. The final end-to-end review also uses B's actual artifact handler.

Apply serializes staging, persistence and an atomic immutable pointer swap.
Each captured operation holds one private generation with fully resolved
references. Copies returned by `Resolve`/`Snapshot` cannot mutate active state.
Reader and retained-generation limits defer publication rather than freeing
objects held by an operation. Close captures promptly. The library retains one
disk checkpoint, at most eight memory generations and at most4096 readers;
deployments explicitly choose smaller limits. Fetch performs one bounded
attempt under a five-second context; transport adapters must honor cancellation
and enforce network deadlines. There is no unbounded retry queue.

The checkpoint uses standard-library AES-256-GCM with a fresh random nonce,
identity/deployment-bound associated data, an externally supplied key source,
0700 directory and0600 regular file. Rooted filesystem operations and exclusive
random staging names avoid path traversal and symlink staging. File fsync,
rename and directory fsync precede activation. A crash can restore either
complete old or complete new signed checkpoint; neither combines policies.
No cache key or signing private key is written by this library.

Startup verifies the checkpoint before processing an incoming candidate, even
when the caller omits explicit `Restore`. No checkpoint means unready until a
valid remote generation arrives. A corrupt checkpoint blocks remote apply until
authenticated reprovisioning, preventing corruption from silently erasing the
generation floor. `MinimumGeneration` permits an authenticated provisioning
floor when restoring a lost disk. Directory ownership/secret custody and the
floor are installation responsibilities. Full-disk rollback by an actor able
to restore both ciphertext and provisioning state requires an external durable
monotonic anchor in production; local file permissions are not hardware rollback
protection. Production secret-service deployment remains blocked.

An authentic expired/over-stale checkpoint retains only its verified generation
floor using A's `VerifyCheckpoint`; it never becomes ready. A newer valid signed
generation can then recover automatically. Retired/untrusted or corrupt
checkpoints require authenticated reprovisioning. `CurrentAck` can retransmit a
lost ACK for the exact still-valid active artifact; `Apply` continues to NACK all
replayed generations. Raw JetStream hints go to the rollout planner, and only
its selected group receives apply dispatch; direct bus-to-consumer apply would
bypass the canary control and is unsupported.

Readiness and new captures reverify trust, ownership expiry and hard validity;
maximum staleness is explicitly configured and cannot exceed24h. During
control-plane/messaging/fetch outages a still-valid LKG remains ready. Expired,
over-stale, retired-key or ownership-expired state denies new captures. Existing
operations retain their captured generation; emergency revocation requires
drain/traffic removal as described by the rollout runbook. No outage makes auth
optional. Trust updates accept only stores obtained from authenticated bootstrap.

Actual local commands executed successfully during implementation:

```sh
GOTOOLCHAIN=go1.27.4 go test -race ./internal/configconsumer ./internal/configsnapshot
GOTOOLCHAIN=go1.27.4 go test -race ./internal/configconsumer -count=1
```

The suites exercise tamper/digest/signature/schema/tenant/missing-auth negatives,
replay, wrong deployment/generation, oversized download, concurrent captured
generations and defensive copies, staging failure/crash boundary, cold restart,
empty/corrupt startup, encrypted/permission-restricted cache, identity/key binding,
AEAD corruption, staleness, key overlap/retirement, outage and reader/retention
budgets. Immutable source-bound rerun logs and hashes are retained separately
under `evidence/sprint03b-c/`; final integration independently reproduces the
real PostgreSQL/JetStream/mTLS path. Unit fetch outage simulation alone does not
prove those external transports.

## Agent Completion Report

- Module:03 consumer component.
- Status: implementation complete; independent review and combined acceptance pending.
- Files: `internal/configconsumer/{consumer,lkg,consumer_test}.go` and this report.
- Contract: A shared signed snapshot1.0; exact-artifact digest in notifications.
- Tests: commands above, exit0; no skipped consumer tests.
- Performance: no proxy workload, capacity or production SLO claim.
- Risks: external secret custody/monotonic recovery anchor and transport deployment
  remain production work. Existing operations require bounded drain on emergency
  revocation. Independent integration must verify all local module criteria.
- Human review: no architecture substitution requested; production signoff pending.
- Next modules: none opened by this component report.
