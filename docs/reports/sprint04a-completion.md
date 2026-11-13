# Sprint04-A Completion And Blocker Closure

Status: independently accepted scope and full local gates pass; exact final-head
hosted acceptance and main merge pending. **Module01 NO-GO**, production BLOCKED.

## Baseline And Integration

Baseline main: `3e03940848c81751c87bbcec131238abb7d28e1b` (merged PR11,
go-jose4.1.9). Integration branch: `sprint/04a-integration`; isolated component
worktrees and sequential independent acceptance are required. Final merge and
PR: [12](https://github.com/tiecont/aegis-gate/pull/12). Final merge receipt:
pending. This is the single integration PR; separate component PRs are not claimed.

| Agent / branch | Reviewed source and deliverable | Disposition |
| --- | --- | --- |
| A / `fix/module01-envoy-codec-boundary` | `8d83ece166290b7c81e757281e5b1778e83dede4`; [Envoy report](sprint04a-a-envoy.md) | ACCEPT scoped upstream stop; merge `fcd5ef5` |
| B / `test/module01-origin-boundary` | `93dc1223ae09d2562a9b4c5b307b173f960b9ea4`; [origin report](sprint04a-b-origin-boundary.md) | ACCEPT failed-candidate evidence; owned commits replayed through `b2c96a4` |
| C / `research/module01-upstream-capability` | `6acbe0f55d50334a14b95c4d3e9888f5d1aebecf`; [upstream matrix](sprint04a-c-upstream.md) | ACCEPT upstream matrix; merge `ad92cd8` |
| D / `fix/dashboard-dependency-resolution` | `b42bae1e9ffa63b4dfd4c94c9a6376f7129077ce`; [dependency report](sprint04a-d-dependencies.md) | ACCEPT compatible tree/peer stop; replay through `1d30c1b` |
| F / `hardening/module03-local-recovery` | `bf5785eb8bd6449fc34915b7c2f392bd1d46350f`; [recovery report](sprint04a-f-config-recovery.md) | ACCEPT; source `99e41a2` replayed as `02df40c`, report `a8a01d4` |
| E / `review/sprint04a-security` | [independent verdict](sprint04a-e-security-review.md), accepted heads/report `e8868ca` | ACCEPT scoped changes; merge `9beace0`; final seal and integration follow-up retained on E branch |

All A/B/C/D/F owned file contents match their exact accepted heads; inherited
obsolete coordinator-contract commits from B/D were excluded. Root's current
contract is preserved. Root integration adds gate/corpus recorders, shared
status/risk/ADR/decision/completion documentation and the fixture/CI fixes below.

Historical pre-rebase branches `fix/module01-envoy-strict-ingress`,
`test/module01-wire-boundary` and `research/module01-upstream-resolution` are
preserved remotely because receipts bind original Git objects. Rebased proofs
are never rebound to rewritten hashes. Failed fetches, preflight attempts,
interrupted/incomplete proofs and the lost uncommitted A attempt are explicitly
retained as failures or unavailable evidence, not eligible successes.

## Technical Stop

No new complete runtime candidate was built. A/C independently inspected the
current released Envoy1.40.2 source at
`b2d89e0ae53916f28770771fbdd49c5c99c5c5a2`. Balsa hardcodes continuation
rejection off, keeps raw callbacks private/no-op and strips CR/LF before
header-value callbacks. Public validators receive parsed maps. The precise
missing capability is a maintained released reject-before-normalization API
for obsolete folded request/trailer syntax. A later filter cannot reconstruct
the lost distinction. This is a scoped finding in inspected interfaces, not
an exhaustive claim about all older releases or an upstream vulnerability.

Host retention and local reply mapping are supported partial prospects. They
still need complete H2 Host/:authority/verified-SNI denial before any forbidden
origin bytes and TE4xx/actual-close proof. They do not resolve folding. No
post-normalization compensation, private codec fork or production parser was
introduced. [Human decision package](sprint04a-architecture-decision.md) and
`evidence/sprint04a-c/drafts/upstream-requests.md` provide bounded local-only
maintainer requests. Nothing was published to upstream maintainers.

## Exact75-Case Results

All75 immutable cases remain enabled with unchanged inputs, expectations,
origin-byte assertions and valid encoded-target/pipeline controls. Each final
failed candidate evaluator exits1. Historical results are identified separately;
research collection is not a runtime proof.

| Candidate / evidence | Pass / total | Failure set |
| --- | --- | --- |
| Historical Pingora0.9.1, Sprint03-A E |63/75 | P1-P12 below |
| Historical Envoy1.40.2, Sprint03-A E |69/75 | E1-E6 below |
| Historical Hyper1.12.0, Sprint03-A E |70/75 | H1-H5 below |
| Historical Envoy Host-retention, Sprint03-B F |69/75 | E1-E6 below |
| Sprint04-A B attempt02 unchanged |68/75 | E1-E6 plus `weighted-health-check-failover-and-recovery` (24 !==30) |
| Sprint04-A B attempt02 diagnostic |69/75 | E1-E6 below |
| Sprint04-A B attempt05 unchanged and diagnostic |69/75 each | E1-E6 below |
| Independent E fresh unchanged and diagnostic |69/75 each | E1-E6 below; same seven additional probe failures |

Pingora failure IDs (historical):

1. `malformed-HTTP-invalid-request-target`
2. `strict-ingress-target-raw-tab`
3. `strict-ingress-target-raw-control`
4. `strict-ingress-target-raw-null`
5. `strict-ingress-absolute-unsupported-scheme`
6. `strict-ingress-target-relative-form`
7. `strict-ingress-target-fragment`
8. `strict-ingress-TE-repeated-chunked`
9. `supplemental-space-target-before-pipelined-request`
10. `supplemental-tab-target-before-pipelined-request`
11. `supplemental-repeated-transfer-encoding-fields`
12. `valid-HTTP1-pipelining-preserves-boundaries-and-encoded-targets`

Envoy failure IDs (historical and fresh B):

1. `malformed-HTTP-invalid-transfer-encoding`
2. `malformed-HTTP-obsolete-folded-header`
3. `strict-ingress-TE-repeated-chunked`
4. `strict-ingress-TE-not-final-chunked`
5. `supplemental-repeated-transfer-encoding-fields`
6. `HTTP2-authority-Host-and-SNI-confusion-rejected`

Hyper failure IDs (historical):

1. `malformed-HTTP-CL-TE`
2. `malformed-HTTP-TE-CL`
3. `strict-ingress-target-fragment`
4. `strict-ingress-CL-TE-pipelined`
5. `strict-ingress-TE-CL-pipelined`

B's other69 cases pass, including valid encoded targets/pipelining, H1/H2,
TLS rotation, verified upstream TLS, WebSocket, gRPC/cancellation, pool/trust
partitioning and configuration-generation controls. Additional23 probes have
16 observation/assertion passes and seven failures: two authority/userinfo
deadlines, four missing error-frame observations and paused-reader buffering.
Their observation-pass labels never override a `zero_byte_contract=FAIL`.
The raw observer is bounded, not exhaustive H2/HPACK or production capacity proof.

## Origin Boundary

Fresh B unchanged/diagnostic runs observe nine decrypted origin bytes, zero
handlers, zero parser errors and zero transport errors in the H2 negative.
The isolated warm-valid-then-Host-denial probe identifies a SETTINGS ACK on
the prior valid reused origin connection, no new connection/HEADERS/DATA:

```text
000000040100000000
length=0 type=4 flags=1 stream=0 bytes=9
SHA256 a9fd441cc14ae4b467f3ea0a0ed70de71bb5834db34815eca9cceb70017adfd6
```

**The unchanged zero-origin-byte contract fails.** No subtraction, settling
delay, control-frame exception or handler-only acceptance is introduced.
Obs-fold separately reaches origin:263 bytes/one handler. Four TE cases send
zero bytes/handlers but return501, violating the rejection-response contract.

Direct/observed controls verify37843 synthetic application bytes with identical
hash, native H2 authority/target semantics and configured SNI. Wrong-SAN,
expired and untrusted upstream certificates reject even when application bytes
are attempted. The test observer reterminates verified TLS; it preserves the
tested application bytes/identity semantics, not TLS sessions, timing, chunk
boundaries, peer IP or mTLS identity. See B's explicit bounds and limitations.

## Upstream And Dependency Dispositions

| Released source | Exact remaining capability |
| --- | --- |
| Envoy1.40.2 / `b2d89e0ae53916f28770771fbdd49c5c99c5c5a2` | Supported original-fold rejection, complete H2 zero-byte identity denial, TE response/close proof |
| Pingora0.9.1 / `f86ffda5d3ae5c3baf5125682138b33b26c01b08` | Strict targets before escaping, original framing, ordered valid pipeline integration, maintained dependency replacement |
| Hyper1.12.0 / `7f67699ce32d717081deb7018b4da7d679277ac0` | Incoming CL+TE reject-both and fragment/raw-target policy before normalization, complete proxy integration |

C verifies seven published crate archives/382 files against lock checksums.
Pingora retains `derivative2.2.0` and `unsafe-libyaml0.2.11` through
`serde_yaml0.9.34+deprecated`; audit reports zero vulnerabilities and two
unmaintained warnings, not maintenance acceptance. PR1117 remains unreleased.
Supported partial APIs and unexecuted default-branch observations are clearly
distinguished from released runtime eligibility in C's matrix.

D reproduces hosted run43100142886's dependency conflict locally: strict
TypeScript7.0.2 update exits1 ERESOLVE because typescript-eslint8.72.2 requires
`>=4.8.4 <6.1.0`. Existing TypeScript6.0.3, ESLint10.14.0, Next16.4.6 and
React19.3.1 resolve normally. Strict npm ci/tree, lint/typecheck/tests/build/
integration/audit and compatible normal dry-run update exit0; npm audit reports
zero vulnerabilities. No force/legacy-peer mode, manifest/lock edit, minimatch
override removal or advisory ignore is used. The major update remains an exact
upstream peer-support stop. PR11 is not redone.

## Local Recovery Changes

F adds bounded `Consumer.Drain`, rejects impossible provisioning floors, and
adds explicit `Store.PrunePublicationArtifacts` under PostgreSQL SHARE/NOWAIT
reference locks through deletion/fsync. All durable outbox and rollout/audit
references, plus externally coordinated LKG/capture reservations, are retained.
Missing tables, conflicting writers, invalid references or excessive keep sets
refuse cleanup. Only aged unreferenced orphan objects can be pruned; immutable
approval/journal history is retained.

Six new tests exercise encrypted full-state rollback against the independently
provisioned floor, cache-key failure, signer outage/staged retry/retirement,
captured-generation grace/deadline drain, disconnected security expiry, and
durable-reference/archive cleanup with restart. Race-enabled integration in
all seven Module03 packages passes without skips, plus vet and the frozen
Node/OpenSSL vector. E independently reproduces those checks on99e41a2.

The external generation floor is an existing provisioning interface, not an
implemented hardware counter/service. Drain cannot recall copied values or
terminate engine I/O/LB traffic. Archive coverage is verified before passing a
checksum to CleanupAudit; a checksum string alone is not archive proof. The
[recovery runbook](../CONFIG_RECOVERY_RUNBOOK.md) documents these limits and
production secret custody, HA/backup, certificate lifecycle and emergency gaps.
Snapshot v1 and all acceptance contracts remain unchanged; Module10 stays locked.

## Evidence And Acceptance

Committed sources precede proofs. Receipts retain exact argv/cwd, source/tree,
tool/image revisions, UTC timing, exits, logs and SHA256. Full shared fixture
lifetimes and cleanup hold `/tmp/aegisgate-sprint02-fixtures.lock`.

| Command / receipt | Actual exit and scope |
| --- | --- |
| A `strict-research.mjs .../upstream-04` |0,26 retrieval commands;23 identical released sources |
| A `strict-boundary-check.mjs` rounds01-03 |0, provenance/immutable sources/scoped scans |
| C `capability-refresh.mjs collect current-01` |0,49 collection commands |
| C `capability-refresh.mjs verify verify-01/02 current-01` |0, source/archive/receipt/immutable/scoped scan checks |
| B locked `wire-run.mjs .../attempt05` |1; both75 runs69/75,23 probes16/7, cleanup verified |
| B locked `wire-closeout.mjs --origin -tls-followup` |0;13 focused tests, immutable/provenance/scoped scans |
| D `dashboard-reproduce.mjs` and compatible update |0 recorder; required TS7 nested failure1, others0 |
| F locked `sprint04a-f-evidence.mjs attempt-01` |0; race/integration seven packages, vet/vector, cleanup; manifest13 entries |
| E independent B/D/A/C/F reproduction |0 reviewer receipts and final seals; B nested candidate/probes1 and TS7 nested1 are expected retained failures; ACCEPT scoped changes |
| Locked full gates01 at `9beace00414f8eb8a9dd9ebc00f8abe8e9ee29ee` | check2: old default-project persisted DB did not match fresh credentials; scan0; cleanup0 |
| Locked full gates02 at `1d1262e121de02f5cfc074205c9bff18ada9ce08` | check2: hardcoded default Docker network after isolated DB passed; scan0; cleanup/volume removal0 |
| Locked full gates03 at `2133b6303c05158c37ed539c23347376d67b0b3c` | **check0, security-scan0, cleanup0, volume removal0** |
| Hosted run43408513539 at `9beace0` | foundation failure: required fixture lock absent in CI; supply-chain success. Logs retained; no acceptance claimed |
| Hosted final reviewed integration head | pending; exact head/job receipts will be verified before merge |

Actual full gate invocation, from the integration worktree (pinned Node26.13.0):

```sh
env AEGIS_NODE_BIN=/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint04a-gates.mjs evidence/sprint04a-root/gates-03
```

The recorder executes `make check`, `make security-scan`, `make dev-down` and
project-specific `docker compose ... down --volumes` under that outer lock.
Dedicated project `aegisgate-04a-root` avoids old shared volume credentials.
The restart fixture now derives its network from structured Compose JSON,
instead of hardcoding `aegisgate-local_lab`. CI holds the same lock across
fixture image setup, check and trapped cleanup; the scanner holds it across
fixture setup and scan. Assertions, TLS, credentials and expected results were
not weakened. Failed gates01/02 and initial hosted-log retrieval failures remain.

gates03 runs2026-11-13T10:25:47.916Z-10:28:18.228Z, including cleanup. The scan
inspects235 history commits/45.51MB history and28.12MB worktree input, generates
repository/image SBOMs, checks exact local image identities and pinned Envoy,
and reports no gate-triggering secret/vulnerability finding. Pingora's two
unmaintained warnings remain open. This is dated scanner evidence, not future
database freshness or maintenance approval. Rendered Compose credentials and
private fixtures are excluded from committed evidence; raw safe scan receipts
and all security findings remain retained.

B attempt05 key SHA256:

```text
21baa8697b314070855a99695ad0f5edaa5a6c476a42ed1f3c4bf389418fb761 unchanged75-results.json
21c64e8fde2e6b846bbf13720d5ac0c483760e69dd0d488cb1a5a7f8806976a2 diagnostic75-results.json
b2e286a6fe7f3aa19c6cb03f2515c9c034c82afffa9d546cb90771e917e250d4 diagnostic-wire.json
cf2ae06c5594871f6f8947fc9acb22eed99d69212a0f26b3ba9f758f4a903101 probes.json
```

gates03 key stream SHA256 (complete manifest in its directory):

```text
99904fb885432becaba4de78bb625ab18b86b8771321413c60e26a7c633f707d check.stdout.log
876c2024842f8c0ed0a4cf29181e9fd53a015169e5f63f4b65c20a7033de859f check.stderr.log
8f9869b2cf6f974be8699ef4de9ec66f30d21fe378b4cfdf12835c8f35244b32 security-scan.stdout.log
```

Agent evidence directories retain complete manifests and receipts; the root
corpus inventory lists all retained75-case result hashes/failure IDs. Scoped
scans and research commands do not stand in for full local/hosted gates.

## Gate Matrix And Human Action

| Module / gate | Disposition |
| --- | --- |
|00 / M0-FOUNDATION | PASS local; full regression checks/scans pass |
|01 / M0-PROXY-GO-NOGO | NO-GO; no eligible candidate or human approval |
|02 / M1-ADMIN-TENANCY | PASS local; full regression checks/scans pass |
|03 / M1-CONFIG-SAFETY | PASS local; recovery additions independently accepted; full checks/scans pass |
|04-12 | LOCKED under existing task prerequisites |
| Production | BLOCKED; no release authorization |

Assign a human architecture owner and choose a bounded maintained upstream
track. Authorize publication of the prepared maintainer drafts separately.
Obtain the missing supported release/API before another candidate build; then
run the failing cases first, all75 unchanged and mandatory protocol/TLS/tenant/
generation/stream/resource negatives. Require supply-chain review, independent
security reproduction and explicit affirmative human architecture approval.
Even75/75 only establishes an eligible engineering proof. No architecture,
zero-byte requirement or production risk is silently accepted by this sprint.
