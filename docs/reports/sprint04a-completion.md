# Sprint04-A Completion And Blocker Closure

Status: integration in progress; **Module01 NO-GO**, production BLOCKED.
This document is a working closeout until the review and gate receipts below
are populated. No pending check is claimed as passed.

## Baseline And Integration

Baseline main: `3e03940848c81751c87bbcec131238abb7d28e1b` (merged PR11,
go-jose4.1.9). Integration branch: `sprint/04a-integration`; isolated component
worktrees and sequential independent acceptance are required. Final merge and
PR receipts: pending. No component PR or approval is invented.

| Agent / branch | Reviewed source and deliverable | Disposition |
| --- | --- | --- |
| A / `fix/module01-envoy-codec-boundary` | `8d83ece`; [Envoy report](sprint04a-a-envoy.md) | Complete scoped upstream stop; E acceptance pending |
| B / `test/module01-origin-boundary` | `93dc122`; [origin report](sprint04a-b-origin-boundary.md) | Fresh69/75 and classified control bytes; E acceptance pending |
| C / `research/module01-upstream-capability` | `6acbe0f`; [upstream matrix](sprint04a-c-upstream.md) | No eligible released alternative; E acceptance pending |
| D / `fix/dashboard-dependency-resolution` | `b42bae1`; [dependency report](sprint04a-d-dependencies.md) | Compatible existing set; TS7 upstream peer stop; E pending |
| F / `hardening/module03-local-recovery` | [recovery report](sprint04a-f-config-recovery.md) | Implementation/review pending |
| E / `review/sprint04a-security` | [independent verdict](sprint04a-e-security-review.md) | Review/reproduction in progress |

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
| Independent E fresh reproduction | pending | No result claimed yet |

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
| F focused/integration proof | pending |
| E independent reproduction | pending |
| Locked `make check` / `make security-scan` | pending |
| Hosted `foundation-quality` / `supply-chain-security` | pending on exact integration head |

B attempt05 key SHA256:

```text
21baa8697b314070855a99695ad0f5edaa5a6c476a42ed1f3c4bf389418fb761 unchanged75-results.json
21c64e8fde2e6b846bbf13720d5ac0c483760e69dd0d488cb1a5a7f8806976a2 diagnostic75-results.json
b2e286a6fe7f3aa19c6cb03f2515c9c034c82afffa9d546cb90771e917e250d4 diagnostic-wire.json
cf2ae06c5594871f6f8947fc9acb22eed99d69212a0f26b3ba9f758f4a903101 probes.json
```

Agent evidence directories retain complete manifests and receipts; the root
corpus inventory lists all retained75-case result hashes/failure IDs. Scoped
scans and research commands do not stand in for full local/hosted gates.

## Gate Matrix And Human Action

| Module / gate | Disposition |
| --- | --- |
|00 / M0-FOUNDATION | PASS local; regression acceptance pending integration |
|01 / M0-PROXY-GO-NOGO | NO-GO; no eligible candidate or human approval |
|02 / M1-ADMIN-TENANCY | PASS local; regression acceptance pending integration |
|03 / M1-CONFIG-SAFETY | PASS local; recovery additions pending independent acceptance |
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
