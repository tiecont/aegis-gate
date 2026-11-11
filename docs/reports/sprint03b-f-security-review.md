# Sprint03-B F independent security review

Date: 2026-11-11. Branch: `review/sprint03b-security`.

Verdict: **ACCEPT for the independently reviewed Module03 local implementation**
at `ce7c9b2c0fc9f3f9b347aec1ea93e7289ae133fa`. No unresolved finding was observed
in the reviewed critical paths and executed tests. This review supplies the
independent-review component of `M1-CONFIG-SAFETY`; it does not assert that the
final integration commit has passed repository-wide or hosted checks. The
integration owner must bind those results to the exact final source commit
before updating the module gate. Module01 remains **NO-GO**, downstream modules
remain locked according to prerequisites, and production remains blocked.

## Scope and independence

F reviewed A/C trust, validation, immutable activation and encrypted LKG;
B compilation, approval/outbox fencing, immutable storage and mutual-TLS
JetStream; and D authenticated rollout admission, durable state, ACK identity,
canary/quorum, rollback and security alerts. F added separate adversarial signed
payload tests in `internal/configreview/review_test.go`, plus a real end-to-end
test in
`apps/control-api/internal/persistence/sprint03b_independent_e2e_test.go`.
These tests do not introduce a production edge engine or use public traffic.

The end-to-end test was committed as
`7488b8f70f76878b546bd6eed8a337711dcb54b6`. Its components are real local
PostgreSQL with a restricted application role, an actual lease-based worker,
private immutable LocalStore, real Docker JetStream with verified mutual TLS,
authenticated HTTPS artifact retrieval, two consumers with AES-GCM encrypted
DiskLKG, durable PostgreSQL rollout state, and authenticated ACK HTTP handling.
The fixture lock covers their entire lifetime. TLS certificates/signing/cache
keys are disposable; none are included in this evidence.

## Acceptance matrix

All rows below passed in the single full race-enabled execution recorded in
`evidence/sprint03b-f/commands.json` and `independent-module03.log`.

| Module03 requirement | Independent evidence and observed behavior |
| --- | --- |
| Transactional durable publication | `TestIntegrationConfigPublicationNegativeAndRecovery`: atomic revision/outbox/audit, failed transaction rollback, concurrent generations, lease fencing, crash/retry and unapproved rejection. |
| Frozen signed wire contract | Snapshot round-trip, RFC8785/golden vector, every-envelope-field binding and malformed/duplicate/UTF-8/depth/size tests; context `AEGISGATE_CONFIG_V1`, Ed25519 and schema/generation constraints enforced. |
| Authenticated trust bootstrap/rotation | Authenticated trust rotation and negative bootstrap/key bounds; valid key overlap and retirement rejection. Production secret-service integration remains an interface, not a deployed service. |
| Tenant/reference/policy compilation | Approved immutable route/reference preview tests, direct-DB/HTTP isolation suites, independently signed cross-tenant/missing-auth/anonymous/unsupported-operator payload rejection. |
| Restricted immutable storage and notification | Real mTLS JetStream durability/permission negatives; immutable artifact recovery/retention; forged notification cannot advance durable rollout floor. |
| Authenticated fetch, verify, precompile, atomic apply | HTTPS endpoint/identity/redirect/replacement negatives; tamper/replay/wrong deployment/generation and concurrent reader bounds; no mixed route/auth generation. |
| Encrypted LKG and readiness | Independent unsafe-payload cases retain prior encrypted LKG; crash/cold restart, missing-LKG not-ready, permission/ciphertext checks, expired checkpoint floor and newer-generation recovery. |
| Canary/quorum/health and signed rollback | Real end-to-end unhealthy canary halts expansion; controller restart, disconnected retry, new signed generation3 restores previously approved generation1 content and leaves an immutable audit trail. |
| Authorized preview and approval | Publication HTTP preview/approval/rollback negative suite and explicit role matrix; changed TTL on an idempotent request conflicts. Missing auth never becomes implicitly anonymous. |
| Telemetry, staleness and bounds | Lag/skew/status and bounded retries/retention tests; sticky invalid-artifact alerts survive late ACK; staleness/key retirement/expired ownership fail closed. |

Specific acceptance negatives independently include a one-byte mutation,
bad digest/signature/context, unknown/retired key, schema downgrade, generation
replay, duplicate hostname, cross-tenant reference, missing/invalid auth and
oversized/malformed artifacts. Signed-but-unsafe payloads are rejected even
when cryptography is valid. Safe diagnostics preserve the prior valid LKG.

The real outage test stops/restarts NATS and injects PostgreSQL permission
failure against `active_route_approvals`, proving both failures while consumers
retain readiness from valid LKG. A fresh edge without LKG is not ready. Actual
artifact HTTP denial/transport interruption and consumer cold restart are also
exercised. This establishes engine-independent configuration behavior only.

## Review findings and disposition

The reviewed source and passing regressions include these security boundaries:

- Artifact crash recovery removes a stale stage file only under an exclusive
  store lock, validates its file type/permissions and preserves immutability.
- Rollback rechecks and locks current domain ownership, revalidates the old
  payload and allocates a new bounded monotonic generation.
- A recovered signed worker artifact must match the exact approved envelope
  generation, timestamps, validity and payload before notification.
- Rollout admission verifies durable publication approval, authenticated fetch,
  digest and signature before advancing its generation. An arbitrary very high
  generation notice cannot poison the durable floor.
- Idempotency binds lifetime as well as digest and rollback target; a changed
  TTL cannot silently reuse an earlier authorization.
- ACK identity is bound to verified TLS URI SAN; forged fields and unhealthy
  canaries fail closed. Late healthy ACK cannot clear a security alarm for the
  same generation.

Dependency fixes present in this source are not a scanner verdict. F executed
`go vet` successfully; the final integration owner must run the full meaningful
input supply-chain scanner, including the amended compression/crypto versions.

An initial development attempt at the end-to-end outage assertion revoked a
table not read by the preview path and failed the assertion. The test now
revokes the actual approval table. This was a test injection error, not evidence
of a product outage-bypass bug. Only the final full suite is the acceptance run.

## Exact Module03 execution

Working tree: `/tmp/aegisgate-03b-f`. Source:
`ce7c9b2c0fc9f3f9b347aec1ea93e7289ae133fa`.

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock env AEGIS_TENANCY_INTEGRATION=1 go test -race -v ./apps/control-api/internal/persistence ./apps/control-api/internal/transport ./internal/configreview ./internal/configconsumer ./internal/configsnapshot ./internal/configrollout ./internal/configpublish -count=1
node --check scripts/module03-contracts.mjs
go vet ./internal/configreview ./internal/configconsumer ./internal/configsnapshot ./internal/configrollout ./internal/configpublish
```

All three exit0. The first starts at `2026-11-11T15:40:55.466948+00:00`
and finishes at `2026-11-11T15:42:23.618525+00:00`. No package/test selection
regex excludes the independent review tests; the integration switch is on.
The verbose log SHA256 is
`a77a8d3c3de40f74cf446243b9d3d15aae34fbad45ab16a05e2791b6ec3397b1`.
Exact argv, timestamps, exit codes and log hashes are retained in `commands.json`.

## Independent Module01 reproduction

F verified E's original `SHA256SUMS`, inspected the focused report and reproduced
the diagnostic Host-retention track from a detached tracked-clean worktree at
`1cb6d00b7a42e78f5cb9433f60afceadc783530d`. No production codec/parser changed.
`parser-runtime-host-retention/commands.json` binds the unchanged 75-case
manifest, shared harness, recorder and adapter hashes. The pinned Envoy image
is `envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`.
The raw `lab.stderr.txt` is retained losslessly as `lab.stderr.txt.gz` because
its HTTP CRLF bytes trigger Git whitespace checks. Decompressing it reproduces
the exact stderr SHA256 recorded in the original commands; no log is sanitized.

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/recovery-run.mjs
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/recovery-raw-h2.mjs /tmp/aegisgate-03b-f-parser/.local/recovery-host-retention/edge-proof-run-CfREv5/manifest.json /tmp/aegisgate-03b-f/evidence/sprint03b-f/parser-raw-h2.json
```

The recorder exits0 when it successfully records a failed proof. Nested
manifest exits0; lab/evaluator exit1. Independently reproduced result: **69/75**,
with exactly the original six failure IDs:

- `malformed-HTTP-invalid-transfer-encoding`
- `malformed-HTTP-obsolete-folded-header`
- `strict-ingress-TE-repeated-chunked`
- `strict-ingress-TE-not-final-chunked`
- `supplemental-repeated-transfer-encoding-fields`
- `HTTP2-authority-Host-and-SNI-confusion-rejected`

Obs-fold sends263 decrypted origin bytes and invokes one handler. H2 sends nine
decrypted bytes with zero handlers, which still fails the mandatory zero-byte
assertion. Four TE cases return501 with zero bytes/handlers and fail the
unchanged rejection contract. Exact original request strings, expected source
assertions and origin observations remain in the preserved results/harness;
none is reclassified as passing.

The extra raw-H2/drain command exits0: invalid SETTINGS ACK and PING produce
GOAWAY error6; stream-zero DATA produces error1; all have zero origin
connections. Thirty-two partial-header TLS connections drain in148ms with zero
origin connections. These bounded probes do not establish exhaustive H2/HPACK
or production saturation/graceful-drain behavior.

The first F reproduction attempt failed before executing the corpus because
the clean worktree lacked the existing spike's `ws` installation. Its command
and logs are preserved in `parser-incomplete-missing-ws/`. After exposing the
already-installed spike dependency through ignored `node_modules` symlinks,
the tracked-clean sources ran unchanged. Both attempts are retained.

F concurs with E's NO-GO and precise stop condition: a maintained released
parser/strict option must reject obsolete folding before normalization, bind
H2 Host/:authority/SNI before any origin bytes, and satisfy the TE rejection
contract with all75 unchanged cases plus relevant new proofs. Pingora's
`derivative`/`unsafe-libyaml` maintenance dependencies also require independent
disposition. The reproduced track does not resolve them or authorize an
architecture change. Human architecture approval remains required for GO.

## Integration handoff and release limits

Integration owner: cherry-pick the independent end-to-end test `7488b8f` and
the F report/evidence commit, without replaying already-integrated dependency
commits. Execute the full repository commands under the fixture lock:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock make check
flock /tmp/aegisgate-sprint02-fixtures.lock make security-scan
sha256sum --check evidence/sprint03b-f/SHA256SUMS
```

Require hosted `foundation-quality` and `supply-chain-security` on the reviewed
integration commit. Only after these pass may Module03 be recorded as
`M1-CONFIG-SAFETY PASS (local scope)`. Existing Module00/02 acceptance must
remain intact. Module01 is NO-GO; Module04 depends on an affirmative Module01
decision and Module03 PASS; Modules05-12 retain their prerequisite locks.
Production deployment, production secret-service integration and a selected
edge engine are outside this local acceptance verdict.

## Agent Completion Report

- Module:03 independent security review; Module01 evidence reproduction.
- Status: local independent review complete; final integrated quality/hosted
  gate evidence is owned by the integration agent.
- Files: independent signed-unsafe tests, real end-to-end test, this report and
  `evidence/sprint03b-f/`; evidence checksum manifest binds report/test/logs.
- Architecture/contracts: no approval or production architecture change.
- Tests: exact commands/exits above and structured evidence; no exclusions.
- Performance: only bounded local drain observation; no production SLO claim.
- Known blockers: final integration checks/CI; Module01 parser/maintenance
  blocker and required human architecture decision.
- Next work: finish Module03 integration gate; keep proxy-dependent modules
  locked and pursue the precise Module01 upstream stop condition.
