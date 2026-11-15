# Sprint06-A Completion And Delivery

Outcome B: hardened finite-message feasibility and signed-admission proof,
with exact maintained API dependencies. No complete gateway or architecture GO.
Component engineering, independently executed local integration gates and exact
export/source review are complete. Hosted delivery remains pending below.

## Source And Independent Review

Starting main `8929adfd10f245ec0dac70b5304f1a2b445e7357`, tree
`42e83423f323eb3ab2bf94c0dc8b9797c1b7d2d1`. Integration branch
`sprint/06a-integration`. Starting hosted run43703044528 passes both jobs.
Root baseline receipt is `evidence/sprint06a-root/baseline/`.

| Track branch | Reviewed executable / final branch head | F verdict |
| --- | --- | --- |
| feat/sprint06a-finite-ingress |73d8f41 /20e4d29|ACCEPT finite tooling only|
| test/sprint06a-signed-admission |260dc7f /e18922a|ACCEPT tagged multi-hop experiment only|
| research/sprint06a-upstream-capabilities |2788cd6,4d3b6fa /0bce723|ACCEPT bounded official API-stop/package|
| test/sprint06a-h2-attribution |69a3be8 /716780c|ACCEPT corrected bounded consistency only|
| docs/sprint06a-architecture-resolution |27cdf2c /6a8280e|ACCEPT inactive proposal only|
| review/sprint06a-security |c5520d9 components /329c3f4 local integration|Independent scoped ACCEPT; complete runtime REJECT|

Root cherry-picks preserve component file bytes and original source references.
Integration through `6f8039c0e661fe65596389ef51dbf2ec8ce55c7f`, tree
`7ab3f972f7d224bd191ef77a70ee81f54aaccec1`, includes all six accepted tracks.
Full local gate source `c4a2fc529688ef53ef213e07a6567aeab3fe4fcf`, tree
`db9756b581b3afc70de2a514ebb17bb50a9c7dcb`, includes final A manifest review.
Subsequent changes add F review tooling/evidence and root delivery records;
the candidate runtime files are unchanged. Final PR/merge receipts follow.
Full verdicts and exact reproduction argv are in
[F review](sprint06a-f-security-review.md). Previous failed captures remain.

## Original Acceptance

Original75 before/final:73 PASS,2 FAIL. Original23 before/final:19 PASS,4 FAIL.
These are retained immutable accepted Envoy evidence, not fresh Sprint06A full
runs. No qualifying maintained historical repair justified another comparison.
All11 protected files and observation/evaluator bytes match8758b1c, inventory
SHA256 `85de42e7d2ac54b0f199bcced46760bec41b7687dd7c7016dd580ea4a300c1fa`.

| Historical failure | Final disposition |
| --- | --- |
| malformed-HTTP-obsolete-folded-header |FAIL: accepted Envoy forwards263 bytes/one handler. Exact folded bytes reject before origin in isolated finite H1 only; no original runtime repair.|
| HTTP2-authority-Host-and-SNI-confusion-rejected |FAIL: nine SETTINGS ACK bytes still count under current aggregate contract.|
| settled-reuse-identity-and-three-authority-negatives |FAIL: peer reset does not meet400/421/deadline assertion.|
| individual-settled-userinfo-denial |FAIL: peer reset is not an HTTP response.|
| raw-H2-HEADERS-stream-zero |FAIL on accepted codec; alternate codec regression not accepted.|
| raw-H2-zero-WINDOW_UPDATE |FAIL on accepted codec; no non-regressing supported emission fix.|

Original raw scores/hashes are bound by baseline receipts and each component's
protected checks. Neither new research suite nor observer replaces them.

## Finite Ingress And Resources

New `spikes/envoy/sprint06a-a-*` and container/verifier scripts use unchanged
maintained llhttp9.4.4/05C binding and standard Node AES-256-GCM. All framing,
body and trailers validate before origin admission. Two verified passes over
ciphertext prevent unauthenticated replay; per-message1572864-byte and aggregate
2097152-byte/three-file quotas bound staging. No private parser/crypto fork.

Owner wrapped run08 and independent F clean `a-independent-03` pass67 controls;
F separately passes29 fault/path/admission attacks. Historical fold, delayed
folded trailer and CL10/abc/EOF produce400 with zero origin request effects.
Completing CL10 produces200 exactly once. Exact encoded targets, ordered and
mixed pipelines,512KiB CL/chunk bodies, verified origin TLS and healthy recovery
are measured. Explicit cancellation after observed hard TCP reset removes the
queued request before dial. Ambiguous TLS FIN is retained without a zero-dial
claim; a valid complete half-close still returns200.

Actual network-none Docker ingress uses384MiB memory/no swap,0.75CPU,64PIDs and
8MiB tmpfs. CPU throttling, task EAGAIN, targeted child OOM/SIGKILL and actual
ENOSPC occur; ingress survives and serves healthy exact requests afterward.
Memory cap is402653184 bytes, disk filler8388608 bytes. The OOMKilled flag is
retained as expected evidence. Partial7-byte writes succeed; zero-progress/EIO,
corruption/truncation, unsafe links/inodes/modes and quota exhaustion reject
before dial and release accounting. Idle/absolute deadlines return408 and held
origin deadline504. Two active origins and one queued request are observed;
the configured two-waiter ceiling is not claimed as measured saturation.

Mandatory pre-completion origin streaming actually FAILs: waiting for origin
progress before completing chunk syntax reaches408 with no progress. Finite
staging is not indefinite streaming, WebSocket, gRPC or full Module01 acceptance.
Raw control-by-control measurements are in [A report](sprint06a-a-finite-ingress.md).

## Data And Key Lifecycle

Private staging validates complete bounded startup inventory before deletion,
uses restricted directories/files and descriptor/path identity checks, and
refuses unsafe symlinks/hardlinks/modes. Reachable JS key/IV/tag buffers are
zeroed and ciphertext unlinked on completion/rejection/cancellation. SIGKILL
leaves only encrypted orphans; restart discards them before listening because
ephemeral keys are not persisted. Requests are never resumed or retried after
uncertain execution. Tests exercise real process restart and cleanup.

Physical erasure, OpenSSL/GC/OS copies, active hostile same-UID races, swap or
provider snapshots and production key custody are UNPROVED. Host PID visibility
is lab-only for verifying the actual outer fixture lock, not production process
isolation. All traffic stays on owned127.0.0.1 inside network-none containers.
Failed harness/setup runs and exact fixes remain in A/F reports and evidence.

## Signed Admission And Existing Modules

New `spikes/sprint06a-admission` is a tagged test adapter. Its sole internal hook
is excluded from ordinary builds by `aegisgate_sprint06a_feasibility`. It uses
the actual Module03 TrustStore, bounded JCS, Ed25519, consumer, leases and
encrypted LKG; accepted snapshot v1 schema/wire is unchanged. Signed policy binds
snapshot digest/deployment/generation and tenant/route/resource identity.
Missing/unknown/streaming/unsigned/stale/downgraded/cross-tenant policies deny.
Captured leases remain consistent across concurrent rollback/cancellation.

Fresh tagged6 top-level/42 subtests and normal Module03 race46 top-level/90
subtests PASS with no skips using real PostgreSQL/JetStream/mTLS. F clean-replays
both and independently rejects same-generation conflicting authenticated policy
and mismatched notice digest/deployment/generation, retaining the valid binding.

The executable multi-hop fixture uses unchanged05D finite TLS ingress, signed
Go admission/JWT and verified HTTPS origin. Capture begins after staging;
original client SNI is not recovered at the Go hop. Direct trusted-loopback
callers, static05D generation1, owned-origin allowlist and fixture JWT are
explicit limits. This is not unified pre-stage authority, production SSRF/DNS/
JWKS or composition with A06a. [B report](sprint06a-b-signed-admission.md) records
scope and commands. Full integrated Module00/02/03 replay also PASSes below.

## Upstream Capabilities And H2 Observer

Fresh official sources retain Envoy1.40.2 b2d89e0, llhttp9.4.4 8164852,
Go1.27.4 and x/net0.62.0 source3de643d. No qualifying new API changed a failed
historical path; no new runtime build or full75/23 run occurred. Required APIs:
C1 pre-normalization strict H1 header/trailer rejection; C2 safe authority400/421
before irreversible reset; C3 required error serialization before close without
CONTINUATION regression; C4 complete authenticated pre-wire dispatch/dial/
stream/HEADERS/DATA/HPACK and loss/coverage events.

The local unpublished maintainer package materializes five exact original fold/
frame vectors, immutable rejection/config/raw-peer references and positive
controls. Optional owned-loopback replay is source-reviewed, NOT executed,
and cannot claim security/origin completeness or original evaluator execution.
No external upstream issue/PR is published. See [C report](sprint06a-c-upstream.md).

F finds four new false-consistency cases in D's initial wrapper: untagged extra
upstream/downstream HEADERS and mixed accepted identities in one header block.
Corrected69a3be8 requires one bound probe per block, accounts for all events and
blocks, and binds unique request/completed-response streams and status. D exact
F overlay passes20 top-level/81 subtests under race,0 skips; independent F
clean re-review accepts the correction. Earlier REJECT and raw failures remain.

Actual maintained ClientConn captures SETTINGS ACK with zero downstream requests
and overlapping real TLS/H2 Host denial: both nine bytes000000040100000000,
aggregate FAIL. All raw bytes remain visible. Transcript consistency can pass;
authoritative runtime completeness/Pass/Module01Pass remain false, including
coherent trusted-signer rewrites. Missing pre-wire dispatch/signed-generation/
exact HPACK coverage is a precise API stop, not fabricated authority. See
[D report](sprint06a-d-h2-attribution.md) and versioned capability requirement.

## Architecture Decision And Next Phase

Preferred further proof: finite H1 complete validation with bounded encrypted
staging, disabled streaming/WS/gRPC, and one verified TLS/SNI/tenant/route/signed
generation admission boundary. Request-attributed H2 isolation is separate
inactive research requiring authoritative instrumentation. It cannot excuse a
late-invalid H1 request already forwarded. Per-tenant reservations, key custody,
retry/idempotency, disk availability and complete origin trust epochs remain
required. No collection of independent PoCs is labeled a complete runtime.

[Consolidated proposal](../ADR-012-sprint06a-finite-ingress-proposed.md) and
versioned20-group research manifest separate effective, proved and proposed
claims. They are NOT EFFECTIVE, not an evaluator or combined PASS. Human owners,
decision reference and dates remain PENDING. Formal approval is required for
profile/schema activation, supported finite limits/custody, any streaming
irreversible-effect semantics, causal H2 exception, production trust boundary
and gate migration. No approval is fabricated.

Autonomous next work can harden tooling and implement a unified signed pre-stage
research lease only with coherent authenticated boundary and fresh targeted
tests. The next complete runtime phase requires either a maintained API fixing
an exact historical failure with positive controls, or separately reviewed and
authorized versioned architecture with H1/H2/TLS/identity/streaming semantics.
Then run unchanged full75/23 plus complete new profile acceptance. No automatic
equivalent comparison sprint; no upstream publication without authorization.

## Delivery Gates

Independent F source4bee73d executes exact-source full gates under the shared
fixture lock. All four commands exit0: `make check`, `make security-scan`,
`make dev-down` and Compose teardown with volumes/remove-orphans. Raw58 artifact
hashes,9914 tracked file hashes and all11 protected pins verify afterward;
HEAD/tree remain exactc4a2fc5 throughout. Private matches0, owned containers/
networks/volumes empty. All six filesystem/Envoy/image vulnerability reports
have0 HIGH/CRITICAL. Worktree and complete750-commit candidate history scans
have zero findings; SBOM and image identity checks PASS. Maintenance warnings
remain visible; scanner policy/dependencies are unchanged.

Actual source-bound command (pinned Go/gofmt/Node PATH, GOAMD64=v1,
GOFLAGS=-v and disk-backed TMPDIR are retained in the receipt):

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
 /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
 scripts/sprint06a-f-gates.mjs \
 /home/tiecont/.cache/aegisgate-06a/f/.local/sprint06a-candidate-gates \
 c4a2fc529688ef53ef213e07a6567aeab3fe4fcf \
 evidence/sprint06a-f/gate-run-03 evidence/sprint06a-root/gates-03
```

Full unchanged Go race phases cover11 packages,89 distinct top-level tests and
151 distinct subtests PASS.32 unit skip events resolve only after actual live
PASS; no remaining skipped case. Real PostgreSQL/Redis/NATS/JetStream/mTLS,
tenant/RBAC/OIDC, snapshot/rotation/LKG/canary/rollback/recovery, dashboard,
strict dependencies and generated contracts pass. This is existing local
module safety, not full gateway acceptance.

Raw gate command receipt SHA256:
`20c3834169d6acd20db5bd9f98b38bc333bbd35f5adf1840723206b0623c484e`.
Sanitized derivative `evidence/sprint06a-root/gates-03/` preserves raw digests,
explicit exporter provenance and all59 input files;0 redacted fields were
needed. F gate receipt62d9225 and postgate audit329c3f4 independently verify
local acceptance,703 accepted file mappings and complete candidate history.
The fresh clone uses `--no-local --single-branch --no-tags` with every candidate
ancestor/object retained:750 commits/9260 objects; fsck0. No shallow history,
source change or scanner flag changes are used.

Two failed gate lifecycles are retained, never relabeled PASS. Run01 source
changed during checkout by root while F started gates: exact-source evidence is
INVALID. It also exposed an unavailable Git object alternate inside scanner
mounts. Run02 repacked the full clone and verified all888 old local-ref commits,
but its scanner found two historical values on abandoned unmerged04C refs.
Both flagged commits are proven non-ancestors of candidatec4. The original refs,
failed raw outputs and redacted finding receipts remain intact; no values are
reproduced and no finding is suppressed. A separate self-contained candidate
clone runs the unchanged `--all` history scanner on its entire deliverable
ancestry. Cleanup succeeded even on both failed runs. Full details and paths
are retained in F review and `evidence/sprint06a-f/gate-run-01/02/`.

F `c0e03fb` ACCEPTs exact export/source `8e14132`, tree
`3998c48d5e0f400493c287403fedbdece9245eba`. Corrected export03 verifies59 raw
inputs,57 content files and59 manifest artifacts,0 redactions and all command
fields/raw digests.139 delivery-diff files are identical reviewer bytes or
root delivery records; gated implementation remains unchanged. The first
export audit's omitted root-plan allowlist entry is retained as an F harness
failure; corrected02/03 PASS. Final F head `b744d8e42de21824df2596cb8b82966c714ef388`
includes final-audit04 empty pinned Gitleaks/protected checks and scoped verdict.
Owner reports' earlier pending-review checkpoints are superseded by these exact
F verdicts, without rewriting their historical source/evidence.

Exact final-head PR
foundation-quality/supply-chain-security and actual merge-main jobs: PENDING.
No hosted result is inferred from the local gate or component acceptance.

| Module/gate | Final current state |
| --- | --- |
|00|PASS local, fresh full integration replay|
|01 / M0-PROXY-GO-NOGO|NO-GO|
|02|PASS local, fresh full integration replay|
|03|PASS local, fresh scoped and full race replay|
|04-12|LOCKED|
|Production|BLOCKED|
|ADR012 v2 /06A profile|PROPOSED, NOT EFFECTIVE|
|Human architecture/security approval|PENDING|
