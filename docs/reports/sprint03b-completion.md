# Sprint03-B Completion Report

Date: 2026-11-11. Repository: https://github.com/tiecont/aegis-gate.
Baseline: `771b006c8075f038c0c55baf7fe251b36f666b98`.
Integration branch: `sprint/03b-integration`.
Reviewed integration PR: https://github.com/tiecont/aegis-gate/pull/10.

## Executive summary

**Module03: M1-CONFIG-SAFETY PASS (local scope).** Signed configuration
distribution is implemented, integrated and independently accepted. A real
restricted PostgreSQL transaction/outbox and worker produce immutable signed
artifacts; mutual-TLS JetStream hints enter authenticated admission; consumers
authenticate artifact fetch, validate/precompile, persist encrypted LKG and
atomically activate; authenticated ACK/health gates control durable canary
expansion. Approved old content restores through a newly signed monotonic
generation. No production proxy or selected edge engine is included.

**Module01: NO-GO.** The focused maintained Envoy setting still produces69/75
on the unchanged immutable corpus. F independently reproduces the same six
failures and origin-byte observations. Additional bounded raw-H2/drain probes
pass but do not resolve the mandatory strict-parser failures. No human
architecture approval is recorded. Modules04-12 stay locked; production is
BLOCKED. Module00/02 local acceptance remains intact.

The integrated implementation source is
`da3598c0a048e6c1e479ccd1f54729efb63a8efc`. Locked repository checks and meaningful
input security scans both exit0; hosted run43052478453 passes both required
jobs on that exact commit. Independent F acceptance is against
`ce7c9b2c0fc9f3f9b347aec1ea93e7289ae133fa`; its test/evidence/report are
integrated as `9701122` and `ec71e45`. Subsequent changes record acceptance and
evidence. Final documentation-head hosted checks and merge SHA are attached
to PR10, avoiding a self-referential commit receipt.

Closeout repeats the locked full check and full scanner on
`5161a61df1a09affd239cfc26a529485a3c04686`: both exit0. The scanner inspects110
commits (20.53MB) and12.41MB worktree with no leaks. The cross-language golden
vector and locked fixture teardown also exit0. `closeout/commands.json` binds
the exact source, timings and hashes; final changes add only this receipt and
evidence tooling/output, with no runtime-source changes.

## Work by agent and source

All work used isolated branches/worktrees. Integration followed review and
regression fixes; no independent competing snapshot envelope was introduced.
The component reports retain exact author source commits and commands.

| Agent / branch | Completed work / principal files | Integrated commits / report |
| --- | --- | --- |
| A `feat/module03-snapshot-trust` | `internal/configsnapshot/`, embedded `schema-v1.json`, Go signing/verification/trust, Node/OpenSSL golden vector, `docs/CONFIG_PROTOCOL.md`; RFC8785 JCS, Ed25519, context and bounds | `418f10e`, `0b20c04`, `1d2500c`; `sprint03b-a-trust.md` |
| B `feat/module03-publisher` | `internal/configpublish/`, `apps/config-publisher/`, `apps/control-api/internal/persistence/publication*.go`, migration008, public runtime facade, real mTLS fixture adapters; durable approved revisions/outbox, leases, immutable artifacts, JetStream, preview/rollback | `0622f54`, `ece66f1`, `48130aa`, `60afdd9`; `sprint03b-b-publisher.md` |
| C `feat/module03-config-consumer` | `internal/configconsumer/`; pinned mTLS HTTPS fetch, full staged verification/precompilation, atomic immutable generations, captured readers, AES256-GCM LKG, replay floor/restart/readiness, bounds and safe ACK/NACK | `2a822cc`, `4bef7e5`, `e2ac9bd`, `15be55c`, `0a82af4`; `sprint03b-c-consumer.md` |
| D `feat/module03-rollout` | `internal/configrollout/`, `docs/CONFIG_ROLLOUT_RUNBOOK.md`; signed durable admission, canaries/quorum, PostgreSQL CAS/audit, mTLS ACK, retry/health/security pauses, telemetry and audit cleanup | `8e7462d`, `26b4768`, `63265fb`; `sprint03b-d-rollout.md` |
| E `research/module01-maintained-parser-resolution` | `spikes/envoy/recovery-*.mjs`, immutable corpus evidence/upstream inspection, raw-H2/drain, dependency assessment and proposed ADR-011 addendum | `bcf6fe4`, `2c9c8ef`, `595e403`; `sprint03b-e-parser-resolution.md` |
| F `review/sprint03b-security` | `internal/configreview/`, `sprint03b_independent_e2e_test.go`, independent malicious signed payloads, actual integrated mTLS/DB/NATS/outage/rollback proof and E reproduction | `b7b1ea0`, `9701122`, `ec71e45`; `sprint03b-f-security-review.md` |
| Integration / `feat/module03-management` | Authorized management preview/publication/rollback HTTP routes, OpenAPI/generated Go/TS/schema and `scripts/module03-contracts.mjs`; separately reviewed with real HTTP/OIDC/DB reproduction | `40ecefa`; acceptance included in F report |
| Integration / `sprint/03b-integration` | Compression/crypto advisory repair, evidence-runner formatting, final gates, status/risk/threat/ADR synchronization and this report | `3c1998b`, `da3598c`, final PR10 commits |

Author-to-integration commit mapping is preserved by Git history and the reports.
`evidence/sprint03b-root/commit-map.json` records integrated implementation/review
commits before the final report/evidence closeout.
PR10 is the single integration PR; separate component PRs are not claimed.

## Actual execution and immutable evidence

Evidence directories `evidence/sprint03b-{a,b,c,d,e,f}/` preserve successful,
failed and incomplete observations. Each command record binds source, argv,
timestamps, exit code and SHA256. Root integration evidence lives in
`evidence/sprint03b-root/`; its SHA256 manifest binds logs and scanner outputs.

| Executed command / check | Exit / result | Source and evidence |
| --- | --- | --- |
| `flock /tmp/aegisgate-sprint02-fixtures.lock make check` | 0 | `da3598c`; `evidence/sprint03b-root/final/check.log` |
| `flock /tmp/aegisgate-sprint02-fixtures.lock make security-scan` | 0 | `da3598c`; `evidence/sprint03b-root/final/security-scan.log` |
| Same two locked full commands, closeout repeat | 0 / 0 | `5161a61`; `evidence/sprint03b-root/closeout/{check,security-scan}.log` |
| `flock /tmp/aegisgate-sprint02-fixtures.lock env AEGIS_TENANCY_INTEGRATION=1 go test -race -v ./apps/control-api/internal/persistence ./apps/control-api/internal/transport ./internal/configreview ./internal/configconsumer ./internal/configsnapshot ./internal/configrollout ./internal/configpublish -count=1` | 0 | F `ce7c9b2`; `evidence/sprint03b-f/commands.json` and `independent-module03.log` |
| `go vet ./internal/configreview ./internal/configconsumer ./internal/configsnapshot ./internal/configrollout ./internal/configpublish` | 0 | F same source; `evidence/sprint03b-f/vet.log` |
| `node --check scripts/module03-contracts.mjs` | 0 | F same source; `evidence/sprint03b-f/syntax.log` |
| `node internal/configsnapshot/testdata/verify-vector.mjs` | 0 | A `84df9d8`; `evidence/sprint03b-a/node-golden.log`; independently verifies shared Go-produced bytes using Node/OpenSSL |
| `flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/recovery-run.mjs` | Recorder0; nested lab/evaluator1 | F tracked-clean `1cb6d00`; unchanged75 result69/75, `evidence/sprint03b-f/parser-runtime-host-retention/` |
| Raw-H2/drain command with manifest/output args in `sprint03b-f-security-review.md` | 0 | F `parser-raw-h2.json`: three malformed-frame cases, zero origin connections,32 partial-header connections drain in148ms |
| GitHub `foundation-quality` / `supply-chain-security` | PASS / PASS | Exact `da3598c`, run43052478453, jobs130633044592 /130633044106 |

Key SHA256 values:

```text
ebeab72888a34640319073b0c6aa5c90eac54aca548422ba4e4ae7e1ea456b04  evidence/sprint03b-root/final/check.log
de8b27a76c67a2ab57776fce8347c73039a3414eaf71f09695f4f42351c58e46  evidence/sprint03b-root/final/security-scan.log
a77a8d3c3de40f74cf446243b9d3d15aae34fbad45ab16a05e2791b6ec3397b1  evidence/sprint03b-f/independent-module03.log
9f0adc8ea16568a3b741e706064bcec6b077ff57d782489fe1cf8f13e265c405  evidence/sprint03b-a/snapshot-race.log
b70231f4426915989e6bc8f80a43fe385089b11e94afcca540a6192cb9595d9a  evidence/sprint03b-a/node-golden.log
1a69707582f8b879512c9cb92d465380c44069063a40aabc64bc881d97172f75  evidence/sprint03b-root/closeout/check.log
de8b27a76c67a2ab57776fce8347c73039a3414eaf71f09695f4f42351c58e46  evidence/sprint03b-root/closeout/security-scan.log
```

Full filenames/hashes and final documentation verification are in the root
manifest, `final/commands.json` and `closeout/commands.json`.

The successful integrated scanner has meaningful inputs:106 Git commits,
12.03MB worktree, module/dependency scans, SBOM/filesystem and pinned image
checks. It retains Pingora maintenance warnings. The earlier checkpoint scan
exits2 because it detects new compression/crypto advisories; the amended
dependencies and actual passing rerun are preserved. No ignore or security
test suppression was added. Initial hosted run43050815764 fails formatting;
`da3598c` fixes it and run43052478453 passes. F's initially missing `ws` parser
fixture and corrected outage-injection attempt are disclosed in its report.
Raw Compose/scanner stdout retains trailing whitespace and final blank lines.
The full evidence-inclusive whitespace check therefore exits2; source-only
whitespace validation passes. Raw log bytes and their original hashes are
preserved rather than normalized to manufacture a clean evidence check.

Historical source manifests are interpreted against their recorded immutable
commits. D's original manifest matches all current files except the evidence
runner formatted by `da3598c`; its original runner hash
`15b09fd32bcae2191956d1b6b74a2992494684280b4d2c3f91e8c383dc00328f`
matches `git show 63265fb:scripts/sprint03b-d-evidence.mjs`. A's earlier dependency
hashes and C's earlier source similarly remain historical, not rewritten to
pretend the source never changed. Root `manifest-verification.json` records
current matches and explicit historical Git-object matches separately.

## Full Module03 acceptance matrix

Every task/acceptance row below is PASS for local scope. F's race-enabled
execution includes all seven relevant packages with the integration switch
enabled, without test-selection exclusions; the final `make check` retains
Module00/02, generated contracts and deliberate-defect gate tests.

| Requirement | Implemented boundary and actual proving tests |
| --- | --- |
| Transactional publication/outbox | `TestIntegrationConfigPublicationNegativeAndRecovery`: atomic approved revision/outbox/audit, transaction rollback, concurrent generations, stale lease fencing, crash retry and unapproved rejection |
| Versioned frozen wire contract | Embedded v1 schema and RFC8785 JCS; `TestSignedSnapshotRoundTrip`, `TestRFC8785Golden`, `TestGoldenVector`, Node/OpenSSL vector; all envelope fields bound to `AEGISGATE_CONFIG_V1` |
| Signing/trust custody and rotation | Maintained stdlib Ed25519; production signer interface and disposable local fixture; pinned-root authenticated bootstrap, `TestAuthenticatedTrustRotation`, negative bootstrap/key-bound tests; overlap and retirement tested. Production secret-service deployment is outside local scope |
| Whole tenant/domain/origin/policy snapshot | Approved immutable Module02 references, current verified ownership, global hostname uniqueness, preview and signed-unsafe validation; cross-tenant/missing auth/unsupported operators fail closed |
| Immutable artifacts and bus hints | Restricted quota-bound LocalStore, mTLS authorized fetch, `TestNegativeImmutableStorageCrashRecoveryAndRetention`, `TestIntegrationJetStreamMutualTLSBoundedDurabilityNegative`; durable admission rejects forged high-generation notices before floor advance |
| Authenticated fetch/stage/atomic apply | `TestAuthenticatedHTTPSFetchAndEndpointNegatives`, `TestNegativeHTTPSRedirectAndArtifactReplacement`, `TestConcurrentAtomicGenerationAndReaderBounds`; complete precompiled routing/auth/pool generation captured for request lifetime |
| Encrypted LKG/restart/readiness | AES256-GCM restricted disk, durable stage before activation; `TestCrashStagingAndColdRestart`, `TestEncryptedRestrictedLKG`, no-LKG unready, expired checkpoint floor, startup replay and newer valid recovery |
| Canary/quorum/health and rollback | All canaries healthy before expansion, rejecting canary pauses; real end-to-end test restores approved generation1 content as signed generation3 with audit; `TestHealthyCanariesThenAllEdgesAdmittedBeforeQuorum` |
| Management simulation/approval | Actual preview/publication/rollback HTTPS endpoints; `TestIntegrationPublicationHTTPPreviewApprovalRollbackNegative`, explicit role/MFA/CSRF and idempotency binding including TTL |
| Telemetry/retry/retention/revocation | Lag/skew/ACK/NACK/last-valid/invalid/stale state, bounded attempts/readers/artifacts; sticky security alerts, durable audit cleanup, documented explicit manual artifact maintenance and emergency fail-safe policy |
| One-byte tamper, wrong digest/signature/context | `TestNegativeSnapshotEnvelope`, `TestSignatureBindsEveryEnvelopeField`, `TestNegativeTamperReplayCrossTenantAndPriorLKG`; NACK retains valid LKG |
| Unknown/retired key, downgrade/rollback/replay | Snapshot/trust negatives, `TestKeyRotationOverlapAndRetiredCandidate`, `TestIndependentRestartGenerationAndStaleRecovery`; no counter rewind |
| Duplicate host/cross-tenant/invalid auth/operator | `TestNegativePayloadValidation`, `TestNegativeValidSignatureCannotAuthorizeUnsafePayload`, `TestIndependentSignedUnsafePayloadsRetainEncryptedLKG`; valid signature cannot authorize unsafe semantics |
| Oversized/malformed/duplicate-key artifacts | Bounded parser/download/depth/UTF-8/schema and notification digest; `TestNegativeBoundedArtifactDownload`, `TestIndependentEnvelopeBindingAndDuplicateKeys` |
| DB/NATS/artifact/control-plane outages | Real end-to-end NATS stop/restart, approval-table permission denial, actual artifact HTTP interruption and consumer cold restart; healthy LKG retained only within trust/ownership/time bounds, fresh consumer unready |
| Crash/concurrent workers/readers | Durable outbox fencing and exact recovered signed approval matching; immutable storage stale-stage crash recovery; atomic captured generation and reader limits; no old routes/new auth mixture |
| Staleness and emergency rejection | `TestNegativeRetirementStalenessAndExpiredOwnership`, `TestExpiredCheckpointPreservesFloorAndRecoversWithNewSignedGeneration`; readiness rechecks validity/trust/ownership and explicit staleness policy |
| Independent integrated proof | `TestIntegrationSprint03BIndependentPublicationToCanaryACKRollback`: real restricted PostgreSQL, lease worker, mTLS Docker JetStream, actual HTTPS artifact handler, two encrypted-LKG consumers, durable rollout and mTLS ACK |

## Module01 targeted result

E classified original candidate failures and inspected maintained upstream
releases/settings/source. The smallest credible executable track uses Envoy's
supported `http2_discard_host_header=false`; no custom parser or three-spike
rebuild was introduced. The unchanged75-case manifest and exact input/expected
assertions remain intact. Both E and F obtain69/75 with the same six failures:
obs-fold reaches origin (263 decrypted bytes, one handler); H2 authority/Host/SNI
confusion emits nine decrypted origin bytes despite zero handlers; four TE
cases return501 instead of the required rejection contract, with zero origin
bytes. These are failed project conditions, not reclassified successes.

Three raw-H2 probes (invalid SETTINGS ACK/PING and stream-zero DATA) return
expected GOAWAY errors with zero origin connections.32 partial-header TLS
connections drain in685ms for E and148ms for F. These bounded probes do not
claim exhaustive H2/HPACK conformance, saturation or production drain.
Pingora `derivative`/`unsafe-libyaml` maintenance risks remain unresolved.

Concrete stop condition: obtain a maintained released parser/strict setting
that rejects obs-fold before irreversible normalization, binds H2
Host/:authority/SNI before any origin bytes, and meets the TE rejection contract.
Then reproduce all75 unchanged cases, all mandatory origin-denial assertions,
protocol/TLS/rotation/cancellation/pooling/generation proofs and new relevant
raw-H2/admission/drain tests from clean immutable sources. Independent review
and recorded human architecture approval remain mandatory even after75/75.

## Independent verdict and residual work

F **ACCEPTS Module03 local implementation**; separate signed-unsafe payload and
end-to-end tests pass. Root returned concrete findings to owners before
integration: stale artifact stage recovery, rollback ownership row locking,
exact recovered-envelope approval binding, durable rollout admission and TTL
idempotency. Fixes and passing regressions are included in F's accepted source.
No unresolved local critical-path finding is recorded. This is an engineering
security review, not a professional production assessment or human release
signoff. F independently concurs with Module01 NO-GO.

| Remaining blocker / owner | Exact next action |
| --- | --- |
| Strict parser / Module01 engine owner and upstream maintainer | Meet the released-parser stop condition above; retain immutable75-case expectations and decrypted-byte evidence |
| Architecture approval / human architecture owner | Review a complete eligible candidate proof; record explicit affirmative decision before Module04 |
| Maintenance / dependency owner | Resolve Pingora derivative/unsafe-libyaml through maintained upstream changes and independent review; no warning suppression |
| Secret custody / platform-security owner | Integrate production secret-service signer and authenticated trust/cache-key provisioning, rotation/retirement and recovery |
| Operations / platform operator | Assemble authenticated delivery transport and production service lifecycle, archive/cleanup with durable-reference checks, HA/backup/restore and alerts; local quota refusal is not automated object GC |
| Emergency revocation / future edge and incident owners | Prove bounded captured-stream completion/drain, disconnected fail-safe, independently authenticated traffic removal and measured revocation window |
| Release / named human owners | Complete Modules04-12, full threat/security/operational/performance evidence and required human signoffs; no production action authorized here |

## Updated gates and next sprint

| Module | Gate result |
| --- | --- |
| 00 Foundation | PASS, local scope; existing acceptance preserved |
| 01 Proxy feasibility | NO-GO; strict-parser/maintenance proof and human decision required |
| 02 Admin/tenancy | PASS, local scope; regression checks pass |
| 03 Config distribution | M1-CONFIG-SAFETY PASS, local scope |
| 04 Edge proxy | LOCKED until01 affirmative GO and03 PASS |
| 05 TLS/domain | LOCKED under02/03/04 prerequisites |
| 06 Identity/access | LOCKED under02/03/04 prerequisites |
| 07 Rate/abuse | LOCKED under03/04/06 prerequisites |
| 08 Telemetry/metering | LOCKED under02-07 prerequisites |
| 09 Dashboard/SaaS | LOCKED under complete task prerequisites |
| 10 Infrastructure | LOCKED under04-09 prerequisites |
| 11 Security hardening | LOCKED under02-10 prerequisites |
| 12 Production validation | LOCKED under all preceding gates |
| Production | BLOCKED; no release or architecture approval invented |

Recommended Sprint03-C: a narrowly scoped maintained-parser/upstream resolution
with the exact Module01 stop condition and independent proof. Maintain the
accepted Module03 regression gates; plan production custody/operations work
without opening locked implementation modules. If no released parser qualifies,
record the precise upstream dependency and keep Module04 locked.

## Agent Completion Report

- Module:03 implementation/independent integration; focused01 research.
- Status:03 complete for local scope;01 blocked by mandatory parser conditions.
- Commits/files/contracts: table above, frozen CONFIG_PROTOCOL v1, additive
  migration008, additive OpenAPI and generated Go/TypeScript/schema.
- Tests: actual commands, exit codes and immutable hashes above and manifests.
- Performance: bounded local32-connection drain only; no production SLO claim.
- Human review needed: Module01 architecture decision after eligible proof,
  production security/operational/release signoffs; none fabricated.
- Next unblocked work: focused01 remediation and maintenance of00/02/03;
  no dependent production-edge module is opened.
