# Sprint03-A Independent Observer Follow-Up

Agent E, 2026-11-11, isolated `review/sprint03a-architecture`. The H2/gRPC
decrypted-byte observation defect is fixed for the exercised loopback corpus.
All three unchanged candidates still fail mandatory properties: **NO-GO**.
No architecture acceptance, production change, gate/status edit or additional
agent is authorized by this review. Root owns final integration and hosted CI.

## Committed Source And Artifact Binding

Root commits `bd96d00211a3a78d689282697788061c198bf2a1` and
`502ac330303017b80241e024442fca724aa96462` were cherry-picked sequentially as
`97be33b` and `a442197d9497dc64c306dff4eeba8fd4c58d95d9`. All new units and
candidate runs bind that committed reviewer HEAD in adjacent `commands.json`.
No candidate source changed. Each retained artifact hash is asserted against
the original reviewer run before launch; complete argv/environment, hashes,
timestamps, signals and process exit codes are retained.

| Source | SHA256 |
| --- | --- |
| `spikes/edge-comparison/tls-observer.mjs` | `b07d34259de297eb204298f052220beb782c9e734994ced4e6410665c55bf065` |
| `spikes/pingora/lab.mjs` | `9ba636fe61aab1c4a9e47fe7f64eee5ac9a4826173fc2acab9599627451d6b5d` |
| Immutable65+10 manifest | `8dd056bb69f53e0a41bf6445c7054f2345ce969d3c22784a7567268e0733f141` |

Pingora source remains `ca573d2c8aee21ed1943e3e66778d1e997cd04af`, retained
binary SHA256 `416358486ea4221c8b0141b7d6895b81f61d42d05f65d56d5aaf6184865c0152`.
Hyper source remains `c17e0bf590ad4d229d1d43f139b4dfd25f63df72`, earlier fresh
reviewer build SHA256 `b56cf4410e3f49ea1197d3167dffbb545b9cbafd698c74fede0d3897660fb06b`.
Envoy source remains `f7660dd44582badfd1815aaa17b7f8e6a4b3c58b`, image
`envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`.
Earlier source/archive, retained-binary, fresh build, image identity, audit/scan,
SBOM and actual-process benchmark evidence remains applicable and unchanged.
No repeated Rust build, dependency audit, image scan or separate benchmark was
needed or claimed. The full75 runner still executes its mandatory smoke cases.

## Independent Observer Review

The relay uses maintained Node TLS streams, accepts TLS>=1.2 and ALPN `h2`,
and pauses downstream input until its fixed127.0.0.1 upstream TLS connection
verifies the lab CA, `lab-origin.test` and ALPN `h2`. Both relay/native listeners
bind owned loopback. It counts decrypted downstream chunk lengths before
native H2/gRPC consumption and pipes bytes unchanged in both directions.
It introduces no HTTP parser, frame rewriting, content logging or insecure
certificate mode. gRPC dispatch now records POST `/lab.Echo/Chat` explicitly.

Admission is bounded by `server.maxConnections=64`, an established-pair guard
of64, downstream TLS handshake timeout2s and established socket idle timeout5s.
Socket close/error destroys both ends; lab cleanup destroys retained pairs.
The socket idle timeout also bounds inactivity during upstream connection.
These source bounds and successful cleanup do not prove exhaustive saturation,
slow-reader fairness, total stream lifetime or production drain behavior.

Seven harness/observer units pass with zero skips; the immutable manifest
check exits0. The observer unit counts the exact24-byte H2 preface with zero
handlers, then successfully preserves `/encoded%2Fcontrol` and response body
with positive bytes/one handler. This independently exercises observation before
dispatch. H2 positive lab assertions and all nine positive observations below
also require nonzero bytes and handlers in the reviewer capture script.

The relay counts bytes, not frames. `parser_errors` is the existing H1
`HPE_*`/`rawPacket` counter. Neither a zero value nor semantic HTTP2 session
errors establish low-level raw H2 parser rejection. Raw H2 framing/error
conformance is not an implemented independent proof here. The corrected byte
visibility and handler/status checks close the original native-consumption
defect for these cases without claiming exhaustive protocol correctness.
Extra TLS termination and timing effects mean old/new performance numbers
should not be treated as a controlled performance comparison.

## Fresh Reproduction And Decision Matrix

All75 unique cases execute for every candidate with no skips or exclusions.
Fresh owner-only fixture roots are `.local/observed-pingora`,
`.local/observed-hyper` and `.local/observed-envoy`; old directories are retained.

| Candidate | Pass/fail | Lab/evaluator exit | Mandatory blockers | Decision |
| --- | --- | --- | --- | --- |
| Pingora |63/12|1/1|Original eight failures, three supplemental negatives, valid encoded pipeline|NO-GO|
| Hyper |70/5|1/1|Four CL/TE variants and fragment target|NO-GO|
| Envoy |69/6|1/1|obs-fold, H2 authority confusion, four TE rejection-status failures|NO-GO|
| Observer instrumentation |7/0 units|0|Original H2/gRPC byte visibility gap fixed; raw parser conformance and saturation unproven|Fix verified within stated scope|

Every failure name exactly matches its historical reviewer inventory; the
capture script asserts this. Raw failed results, logs and evaluator decisions
remain in each `observed-*/` directory. Candidate failures are expected evidence,
never suppressed or converted into a passing feasibility gate.

Each cell below is **decrypted bytes / handler invocations / parser errors /
transport errors**, measured in this reviewer run.

| Case | Pingora | Hyper | Envoy |
| --- | --- | --- | --- |
| H2 positive negotiation |139 /1 /0 /0|162 /1 /0 /0|248 /1 /0 /0|
| gRPC bidi/trailers |292 /1 /0 /0|315 /1 /0 /0|410 /1 /0 /0|
| gRPC cancellation |84 /1 /0 /0|85 /1 /0 /0|116 /1 /0 /0|
| H2 authority/SNI/Host denial |0 /0 /0 /0|0 /0 /0 /0|56 /1 /0 /0 **FAIL**, HTTP200|
| H1 cross-tenant SNI/Host denial |0 /0 /0 /0|0 /0 /0 /0|0 /0 /0 /0|
| Wrong origin TLS, whole case |105 /1 /0 /2|88 /1 /0 /2|239 /1 /0 /2|
| Expired origin TLS, whole case |88 /1 /0 /2|88 /1 /0 /2|239 /1 /0 /2|
| Untrusted origin TLS, whole case |89 /1 /0 /2|89 /1 /0 /2|240 /1 /0 /2|

TLS rows include the valid-origin recovery request in `applied()` after the
rejection. Source assertions at the invalid attempt require5xx, no forbidden
body, zero delta handlers/decrypted bytes/H1 parser errors. Thus the whole-case
one handler is recovery, not invalid-certificate dispatch. The two transport
events per case are not relabeled as HTTP parser errors. Detailed bounded
request records and timings are in each `observation-summary.json`/`results.json`.
Envoy authority acceptance demonstrates required identity rejection failure,
not an independently established cross-tenant exploit.

TLS, encoded targets, streaming/WS/gRPC, cancellation, rotation, LKG, pools,
weights and health outcomes remain as described in the original review. The
adapter-only Envoy shared CPU/RSS limitation remains; earlier actual-process
benchmark evidence and its shared-host limitations are preserved. No production
SLO, capacity, exhaustion or candidate performance ranking follows.

## Root Integration And Decision Review

Read-only snapshot `observed-integration-review/root-snapshot/` binds root
HEAD `1fb2d321b3b7344d57f928be19c3c9b26904e09a`. Every copied file is checked
byte-for-byte against that committed Git object; paths/hashes are in
`commands.json`. Inspected exact `2e97ce33a4b548f71d6fb70cd19480a65a86d151`
diff plus current Makefile/security script, decision package, integration
report, status, ADR011, risk register and execution contract.

Makefile adds locked Hyper fetch/fmt/clippy/all-targets/unit/build, Envoy units,
and retains manifest and observer checks. Scan adds both isolated Rust locks,
lab npm dependencies, exact-digest Envoy image HIGH/CRITICAL exit1 scan and
SBOM. Existing application, history/secret, filesystem and fixture-image gates
remain. No scanner ignore, security negative exclusion or TLS/auth weakening
is introduced. Isolated PoC validation does not adopt a production runtime.

Actual combined logs are retained in the snapshot, both `RESULT_EXIT=0`:

| Evidence | SHA256 |
| --- | --- |
| `make-check-final.log` | `5189c17db934489d5ac82dfc1c207f61d375303b93a009e01c5aa923f5e86faa` |
| `security-scan-final.log` | `f632cbedb37a04b2de53f26494843bf7ca740b55eeb94c9ab964ca46499b8432` |

The check includes seven harness/observer units, three Envoy units, four Hyper
units, locked build, race, real PostgreSQL/HTTPS OIDC/UDP DNS integration with
`AEGIS_TENANCY_INTEGRATION=1`, tenancy/security negatives, contracts and
deliberate-defect gates. Mandatory suites are not skipped. Scan shows actual
42-commit history scanning, zero known Rust vulnerabilities, both unresolved
Pingora maintenance warnings, clean npm and zero HIGH/CRITICAL pinned Envoy
findings. Selected raw reports corroborate those summaries. Neither warning
is accepted or suppressed; embedded C++/BoringSSL scan coverage/provenance
limits from the original review still apply.

Those logs were committed in `7d8e0cd`, before `502ac33` bounds. They are
combined local execution evidence, not proof of exact final-head hosted CI.
This follow-up independently covers the bounded observer with units and all
three full75 runs. Root remains responsible for final exact-head hosted checks.
The root decision/status correctly retain all candidates NO-GO, proposed ADR,
Module03 eligible but unimplemented/gate closed and04-12 locked. Their pending
E-review wording is historical at the captured HEAD. There is no independent
architecture acceptance or new gate opening here.

## Commands And Retention

Executed from the reviewer worktree, with flock held for each entire command:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/followup-run.mjs observed-units
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/followup-run.mjs observed-pingora
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/followup-run.mjs observed-hyper
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/followup-run.mjs observed-integration-review
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/followup-run.mjs observed-envoy
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/followup-run.mjs observed-final-check
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/followup-inventory.mjs
flock /tmp/aegisgate-sprint02-fixtures.lock sha256sum --check --status evidence/sprint03a-e/FOLLOWUP-SHA256SUMS
```

The capture script checks its parent's kernel FLOCK and refuses to overwrite
any mode directory. No failed/interrupted/instrumentation-invalid historical
run, checksum, inventory or audit/image/build evidence is replaced. Historical
`SHA256SUMS` binds the original report at `dbbdf3e`; its other files remain
unchanged. `historical-verification.json` verifies those files and that original
report Git object. `FOLLOWUP-SHA256SUMS` binds new evidence and both current
review reports after captures close; it excludes only itself. Final scoped
secret scans and whitespace results are in `observed-final-check/`. Raw HTTP
CRLF/tool-output whitespace is retained; source/docs/JSON must pass. These
editorial distinctions exclude no security test or secret-scan evidence.

## Agent Completion Report

- Module:01 independent observer/security follow-up, isolated proof only.
- Status: complete review/reproduction; observer defect fixed within scope;
  all three candidates NO-GO.
- Changes: reviewer reports/evidence only; prerequisite observer cherry-picks
  are separate commits already integrated by root.
- Architecture/ADR decisions and contracts: none.
- Tests: seven units/manifest pass; all three full75/evaluator runs exit1
  with exact historical failures; root combined local check/scan exit0 reviewed.
- Performance: historical evidence retained, no new ranking/SLO claim.
- Risks: unchanged mandatory candidate failures, Pingora maintenance warnings,
  raw H2 conformance and resource/production proof limits.
- Human review: architecture/security decision remains pending; root owns
  final hosted checks and authorized evidence-only integration.
- Next modules: unchanged prerequisites; this review opens none.
