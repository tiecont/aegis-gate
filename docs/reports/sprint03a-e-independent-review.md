# Sprint03-A Independent Architecture And Security Review

Reviewer: Agent E, isolated `review/sprint03a-architecture` worktree. Local
feasibility scope only. **All three independent full75 runs reproduce NO-GO;
no candidate or architecture acceptance is granted.** Root owns final integration,
checks, hosted CI and gate/status files. No additional agents were created.

Observer follow-up: the native-H2 accounting defect below is **fixed and
independently reproduced**. Updated committed harness `a442197` again yields
Pingora63/75, Hyper70/75 and Envoy69/75 with the identical failure inventories,
nonzero H2/gRPC positive byte counts and Envoy authority failure56 bytes/one
handler. See [observer follow-up](sprint03a-e-observer-followup.md) for the
current decision matrix, exact hashes/counters and root integration review.
The original runs, calibration, inventories, build/audit/image and benchmark
evidence remain historical; none is overwritten or retroactively corrected.

## Review Plan And Source Binding

Read AGENTS, operating/orchestration rules, README, master sequencing, status,
architecture/config contracts, module01, Sprint03-A execution contract, ADR011,
threat model, quality gates and original Sprint02 raw evidence/reviews. Review
the immutable corpus and fail-closed evaluator, reproduce each committed
candidate under the shared fixture lock in fresh reviewer directories, inspect
source/dependencies/image findings, compare functional/security/resource proof,
then commit only this report and reviewer evidence. Do not waive failed cases.

- Starting harness: `4179b42b9616c2a5ff5aac0e747564e496bde346`.
- Follow-up harness: root `bd96d00` then `502ac33`, cherry-picked as `97be33b`
  then `a442197d9497dc64c306dff4eeba8fd4c58d95d9`; no candidate source changes.
- Original baseline: `668b8d998d8a39f3a554a9e42ad6a1a270049d27`.
- Pingora candidate: `ca573d2c8aee21ed1943e3e66778d1e997cd04af`, cherry-picked
  here as `f03b2db`. Runtime source and lock are unchanged from baseline/root.
- Hyper candidate: `c17e0bf590ad4d229d1d43f139b4dfd25f63df72`, cherry-picked
  here as `7acc988`; independently rebuilt from exact locked source.
- Envoy candidate: `f7660dd44582badfd1815aaa17b7f8e6a4b3c58b`, cherry-picked
  here as `4c71da3`; independently reproduced against its pinned image.
  Sibling worktrees
  were inspected read-only; no sibling files, toolchains or binaries were edited.

## Findings

1. **Pingora fails required strict ingress and positive pipelining proof.**
   Independent full run reproduced **63/75, 12 failures**, lab exit1 and evaluator
   exit1. All eight original failing cases remain. Raw space/tab/control/NUL
   targets, unsupported scheme, fragment and repeated chunked encoding reach an
   owned origin. Relative target returns502 yet sends **190 decrypted bytes,
   zero handlers and two HTTP parser errors**. Two malformed pipelines and
   repeated TE fields also reach origin; the valid encoded pipeline fails.
   Results: `evidence/sprint03a-e/pingora/results.json`; exact commands and
   timestamps: adjacent `commands.json`. Disposition: **NO-GO**.
2. **Hyper also loses required original framing/target information.** Fresh
   reviewer build reproduced **70/75, five failures**, lab/evaluator exit1.
   Four CL/TE variants dispatch one request each,122 or126 decrypted bytes;
   `/path#fragment` dispatches `/path`,92 bytes. Published Hyper1.12.0
   `src/proto/h1/role.rs` removes/ignores Content-Length when Transfer-Encoding
   is present before `service_fn`; `http`1.5.0 truncates raw fragments in URI
   construction. The exposed-header/URI policy therefore cannot enforce the
   original-byte contract. All functional cases and valid encoded controls pass
   in this run; none repairs the five required failures. **NO-GO**.
3. **Envoy fails ingress normalization and H2 identity binding.** Independent
   run reproduced **69/75, six failures**, lab/evaluator exit1. An obsolete
   folded header returns200 and dispatches once,263 decrypted H1 bytes. A
   conflicting H2 Host/authority/SNI case returns200 and dispatches to the H2
   origin. These are required rejection failures, not proof of an exploited
   cross-tenant route: the test demonstrates a conflicting original identity
   is not rejected. Four malformed/repeated TE cases return501 with zero
   observed handlers/HTTP bytes/parser errors: forwarding rejection succeeds,
   but the unchanged contract explicitly requires4xx or an empty closed peer.
   Those status-policy failures are distinguished from observed forwarding;
   none is waived. All other cases pass, including valid pipelines, configured
   TLS, WS/gRPC, rotation, pools and health. **NO-GO**.
4. **Origin observations must be interpreted by protocol and event type.** The
   corrected H1 origin attaches byte accounting after `secureConnection` and
   classifies `clientError` as HTTP parsing only for `HPE_*`/`rawPacket`;
   TLS alerts are transport errors. This avoids calling correct certificate
   rejection an HTTP parsing failure. Positive encoded controls exercise byte
   accounting; relative-target evidence proves handler-only observation is
   insufficient. Historical H2 origin byte counting used a TLSSocket `data` listener while
   Node's native H2 implementation can consume frames internally: sibling H2
   evidence has actual handler dispatch with zero recorded decrypted bytes.
   Reviewer calibration independently confirms this: H1 receives71 bytes,
   H2 receives zero counted bytes, both invoke one handler and return the
   expected body over verified TLS1.3; H2 ALPN is `h2`. Exact observations and
   timestamps: `evidence/sprint03a-e/origin-calibration.json`.
   Consequently zero H2 byte count alone does **not** prove zero origin frames.
   That defect is fixed by the bounded verified TLS observer before native H2
   consumption. All three fresh follow-up runs observe positive H2/gRPC bytes
   and handlers. Semantic HTTP2 session errors are not low-level raw parser
   proof; the relay counts decrypted byte lengths without parsing frames.
   Exhaustive raw H2 framing/conformance remains unproven. See the follow-up
   for exact scope and current denial counters.
5. **Shared Envoy resource counters sample the adapter process.** The unchanged
   shared benchmark and upload-cancellation RSS check use `[proxy.pid]`. For
   the Envoy launcher this omits Envoy's container process. Preserve those
   observations, but do not use them as Envoy CPU/RSS or cancellation-memory
   proof. B's separate benchmark that samples actual container PIDs must be
   reviewed and distinguished. No resource ranking follows from this corpus.
6. **Evaluator is a checked evidence consumer, not independent packet capture.**
   It validates exact negative wire inputs, all75 unique pass/fail IDs, immutable
   manifest hash, complete setup, test-summary consistency and strict origin
   rejection counters. It independently rejects falsified negative outcomes;
   other functional outcomes remain backed by the reviewed runner's assertions
   and raw result details. An artifact with all functional labels falsified is
   outside what this JSON evaluator alone can detect. Independent execution and
   source/artifact bindings are therefore required, as performed here.

## Harness And Provenance Checks

`prepare/manifest.stdout.txt` confirms exact reproduction of all65 baseline IDs,
32 original negative wire strings, six valid encoded targets and eight original
failures from pinned baseline source/evidence. The supplemental source adds nine
negative cases plus one valid encoded pipeline. No skip or exclusion support is
present. Six harness contract/evaluator tests passed, including deliberately
mutated inputs, missing/duplicate IDs, skips, forwarded bytes/parser failures,
fatal setup and dishonest summaries. Full tests and failures remain retained.

Reviewer `published/verification.json` independently downloads published
`pingora-core`, `pingora-proxy` and `pingora-load-balancing`0.9.1 archives and
checks their SHA256 against this exact Cargo.lock, then compares selected
parser/custom-session/proxy/config sources byte-for-byte with the installed
registry source. Source inspection confirms request-line escaping occurs before
the exposed header-byte hook. No supported strict adapter is proven by the
hidden custom-session interface. These observations support A's limitation;
they do not claim an exhaustive search of every upstream integration.

Retained Pingora binary hash is
`416358486ea4221c8b0141b7d6895b81f61d42d05f65d56d5aaf6184865c0152`,
matching A and the Sprint02 root build/review evidence. Reviewer compares all
four runtime source/lock hashes with root. This is authorized retained-binary
verification, **not a fresh reviewer Pingora build or reproducible-build claim**.

Fresh scoped Pingora audit:206 packages, zero known vulnerability findings,
two unmaintained warnings (`derivative`/RUSTSEC-2024-0388 and
`unsafe-libyaml`/RUSTSEC-2024-0449). Neither is suppressed or accepted here.
The latter is reached through deprecated serde_yaml and parses a fixed YAML
literal at startup; bounded exposure does not remove maintenance risk. Fresh
npm fixture audit reports zero vulnerabilities. Scanner database/time/ignore
settings and exact output remain in `prepare/`.

Hyper independently built in reviewer `.local/hyper-target` with Rust1.99.1,
`--locked --offline`; fresh `.local/cargo-home` contains copied published crate
archives/index only before Cargo unpacks source. All86 registry archive hashes
match Cargo.lock and all unpacked files match those archives, no extra source
files. Fmt, four unit tests, clippy `-D warnings`, release build and exact-lock
audit pass. Audit covers87 packages, zero advisories/warnings, empty ignores.
Reviewer binary SHA256:
`b56cf4410e3f49ea1197d3167dffbb545b9cbafd698c74fede0d3897660fb06b`.
It differs from C's binary; no reproducible-build equivalence is asserted.
The full suite executes this freshly built binary. Dynamic OpenSSL dependencies
are recorded by `ldd`; RustSec does not audit those host libraries. TLS traffic
uses rustls/ring; OpenSSL supplies certificate date checks.

Independent Envoy image review uses exact digest
`09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`.
Its executed version is1.40.2/Clean/RELEASE/BoringSSL at source
`b2d89e0ae53916f28770771fbdd49c5c99c5c5a2`. Pinned Trivy0.69.1 scans the
remote immutable image, reports zero HIGH/CRITICAL findings, and exports SBOM.
Reviewer separately exports the locally executed image, runs repository
`scripts/image_identity.py`, and verifies scanner config identity through
hashed manifest/config/layers and ordered diff IDs: PASS. Inspect ID is the
immutable image/index digest here, while scanner `ImageID` is config digest
`711883897f9d8a5cd5797f1ef41f49800f997291a8e9db812a8786c184466936`;
they are different identifier types and must not be compared directly. Full
binding evidence is in `image-binding/`. Trivy detects seven Debian OS packages
and zero language-specific files: this is not an exhaustive audit of embedded
Envoy/BoringSSL/C++ components or signed build provenance. B's earlier Ubuntu
image findings remain historical evidence; a different digest's clean scan
does not erase them. Specifically the Ubuntu image retained two HIGH package
findings for CVE-2026-109518 (`apt`, `libapt-pkg6.0`2.4.14; fixed
2.4.15ubuntu0.1). No ignore or risk acceptance was added.

## Execution And Retention

All fixture/lab/audit commands are executed with
`flock /tmp/aegisgate-sprint02-fixtures.lock` covering the entire command.
The reviewer capture script checks the parent's actual kernel FLOCK record.
Fresh fixtures/private keys stay in ignored owner-only `.local/pingora/`.
No private keys are exported; published evidence includes bounded result/log
observations, exact argv, environment overrides, timestamps, exit codes and
artifact hashes. `reproduce.mjs` and `verify-published.mjs` retain the executable
review procedure. Failed lab exit1 is expected evidence, never converted to a
passing protocol proof. A completed capture-script exit0 means capture succeeded.

Original interrupted/instrumentation-invalid evidence remains committed with
its candidate. Root's `pingora-instrumentation-failure.json` and A's first run
are not selected as independent complete reproductions. C's first run stopped
at71 cases with fatal snapshot deadline and14 failures; its initial limit run
failed because HTTPS `path` was accidentally passed to `tls.connect`. B's
startup failure/run03 interruption and earlier02/04/05 results, initial Nginx
benchmark failure, and earlier Ubuntu HIGH findings must remain in the final
history. Their later corrections do not retroactively validate them. Reviewer
captures full75 results separately; no failed reviewer run was overwritten.
The initial reviewer summary exporter failed while comparing the inherited
Pingora `lab.mjs` at A's older base to the independently pinned corrected
harness. A captured reproduction of that export failure remains in
`summary-attempt-01/` (exit1). Final export binds the shared lab only to
`4179b42`, and candidate implementation sources to their original commits.
No candidate test was rerun or changed for this metadata correction. The
initial read-only `git diff --check` was invoked without flock, contrary to
the broad check-command rule; it touched no fixtures and is repeated under
flock for the final scoped check. All fixture/lab/Docker/audit runs held flock.

## Architecture Costs And Functional Comparison

Pingora and Hyper independently pass two-certificate SNI, unknown/missing SNI,
pre-TLS source denial, H1 route/header isolation, H2 negotiation, authority
denial, streamed H1/H2 bodies, WS close, gRPC bidi/trailers/cancellation, active
stream rotation with one captured generation, invalid/replayed config LKG,
wrong/expired/untrusted origin TLS, trust-change pool fencing, route pool
partitioning and six-request origin connection reuse. Both pass30:10 weighting,
health failover/recovery, verified invalid-TLS backend exclusion and503 when all
backends are unhealthy. The timing/resource observations remain smoke bounds:
first stream chunk6.43ms for each; slow-origin response2013.68ms Pingora and
2002.48ms Hyper; eight cancellations420.03ms and412.54ms respectively, with
no net sampled proxy RSS increase. These do not establish saturation, graceful
drain, long-lived stream safety, fairness, revocation or operational readiness.

| Boundary | Pingora retained integration | Hyper assembly | Envoy process/adapters |
| --- | --- | --- | --- |
| Strict original bytes | Required failures before hooks; no supported strict integration proven | CL/TE and fragment originals lost before service | Independently reproduced folded-header/H2 conflict plus501 contract failures |
| Config/tenant identity | Existing ArcSwap integration remains isolated fixture proof | Each request holds snapshot; each route/generation owns client/pool | CDS/RDS/SDS are separate file updates; generation clusters reduce pool confusion but are not a transaction/ACK |
| TLS | Existing maintained TLS stack; warnings unresolved | rustls/ring traffic, OpenSSL date check; resumption disabled | BoringSSL in pinned image, dynamic SDS; resumption disabled |
| Owned obligations | Strict ingress path and maintenance removal still needed | Balancing/health, streaming bounds, upgrade, retry/cancellation, pool identity and shutdown become application responsibilities | Go xDS/SDS/policy adapter, fail-closed filters, resource naming/quotas, ACK/NACK/LKG, certificate authorization and process lifecycle |
| Origin H2 observation | Fixed relay;139 positive bytes; authority denial zero bytes/handlers | Fixed relay;162 positive bytes; authority denial zero bytes/handlers | Fixed relay;248 positive bytes; authority failure56 bytes/one handler |
| Release limits | No accepted Module01 gate | No signed Module03 contract, DNS/dial SSRF, downstream write/H2 idle/drain/saturation proof | No signed Module03 contract, transactional activation, Lua-error fail-closed proof or streaming total-body cap |

Hyper's fixed-loopback resolver and Envoy's fixed127.0.0.1 endpoints are explicit
lab restrictions, not production SSRF exceptions. Hyper's serial health/reload
loop can delay activation at maximum16x8x250ms probes; healthy small-fixture
timings do not prove a production propagation SLO. Its secret-file symlink
check/open sequence is not race-free secret delivery. Envoy fixed-host inventory
and separate CDS/RDS/SDS publication need a threat-reviewed Module03 adapter,
readiness/NACK visibility and bounded old generations. Parsed Lua header checks
cannot recover originals removed by the codec; a Lua runtime error must never
silently allow a mandatory security policy. None has the required signed config,
authentication/authorization, quotas, production observability, HA or complete
release signoff. These scoped proof costs support no architecture substitution.

Envoy independently passes the same functional set except H2 authority/Host
confusion. Its first stream chunk is4.14ms; slow-origin response2008.01ms;
eight observed origin cancellations take411.45ms. The RSS numbers for that
case belong to the adapter, as noted above. H1 origin observations show TLS1.3
for Pingora/Hyper and TLS1.2 for Envoy, all within the configured TLS>=1.2
policy. Envoy H1 request socket observations include both `sni:false` and
`lab-origin.test`; these are retained rather
than relabeled. Configured SNI and explicit SAN verification are source-reviewed,
and wrong-name/expired/untrusted-origin tests pass. H2 handler records omit TLS
details; successful H2 negotiation/assertions do not fill that observation gap.

Threat mapping: original framing/target failures block T07/T16; required
Host/authority rejection blocks T01/T06; corrected H2 accounting closes the
original observation defect. Adapter-only RSS and unproven saturation/drain
still limit T08 claims; dependency maintenance/image provenance
remain T14 concerns. Local origin TLS negatives support the exercised T11
controls only. They do not establish the production DNS/dial, tenancy, config,
secret delivery or release controls required by T03/T05/T13/T17 and the full
quality-gate matrix.

Independent resource comparison uses AMD Ryzen7 4800HS,16 logical CPUs,
24,573,243,392 bytes RAM on the shared Linux host, Node26.13.0, release Rust
builds and pinned Nginx1.30.6 reference. Every row uses100 warmups then5s,
eight closed-loop H1 keepalive clients,90% GET1KiB/10% POST32KiB echo and
verified TLS both hops. Envoy's row is the separate actual-process measurement,
not the shared harness's adapter-only resource numbers.

| Run | Requests/s | p95/p99 ms | CPU one-core % | Sampled peak RSS bytes | Errors/timeouts |
| --- | ---: | --- | ---: | ---: | --- |
| Pingora independent |1861.47|7.715/11.202|53.59|22,306,816|0/0|
| Its Nginx reference |2265.33|6.155/7.825|39.38|20,230,144|0/0|
| Hyper fresh build |1226.47|42.255/44.442|25.01|12,386,304|0/0|
| Its Nginx reference |2671.36|5.613/8.424|39.19|20,303,872|0/0|
| Envoy actual PID3339241 |1521.75|12.623/17.827|69.57|75,866,112|0/0|
| Its Nginx reference |3010.67|5.638/8.379|46.79|20,320,256|0/0|

Envoy adapter PID3338321 is separate:2.80% one-core CPU and62,279,680 bytes
end RSS;49 actual-process resource samples are retained per workload.
Envoy uses one worker, Hyper two Tokio workers, Nginx two workers plus master;
crypto/build/connection behavior differs. Host load, sequential runs, five-second
windows, summed Nginx shared pages and coordinated omission prohibit candidate
ranking, proxy-added latency/SLO, launch capacity or soak/leak conclusions.

Executed from this worktree:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/reproduce.mjs prepare
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/reproduce.mjs pingora
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/verify-published.mjs
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/calibrate-origin.mjs
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/reproduce.mjs image-review
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/reproduce.mjs image-binding
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/reproduce.mjs hyper-build
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/reproduce.mjs hyper
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/reproduce.mjs envoy
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/reproduce.mjs envoy-benchmark
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/reproduce.mjs summary-attempt-01
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/reproduce.mjs summary
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/reproduce.mjs final-check
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint03a-e/inventory.mjs
flock /tmp/aegisgate-sprint02-fixtures.lock sha256sum --check --status evidence/sprint03a-e/SHA256SUMS
```

`review-summary.json` verifies original committed implementation-source hashes
and the separately pinned corrected harness; it lists complete failures,
functional details, actual resource data, audits, image-binding scope and
historical-run hashes. The summary exporter correction and its failed
instrumentation output are retained. `final-check/commands.json` records the
scoped redacted evidence/report scans and staged whitespace result. Both
scoped secrets scans pass with zero findings. The broad staged whitespace
check returns2 for raw HTTP CRLF stderr and unmodified command-output trailing
blank lines; its full output remains committed. Those raw bytes are not
rewritten to make an editorial check pass. The separate source/docs/JSON
whitespace check is recorded in `source-check/`. Final scans after report
finalization are retained separately in `final-check-02/`. Hash
inventory was generated only after capture files finished, and verified before
the original commit. Its report entry binds the historical report at `dbbdf3e`;
the new `FOLLOWUP-SHA256SUMS` binds this amended report and follow-up artifacts.
The follow-up independently reviews root's committed combined check/scan exit0
evidence; it does not claim those executions as reviewer runs or exact-head
hosted CI acceptance. No gate/status/ADR/production file is edited.

## Agent Completion Report

- Module:01 independent architecture/security comparison, isolated proof only.
- Status: complete independent experiment/review; all candidates NO-GO.
- Commits/files changed: report and `evidence/sprint03a-e/`; candidate
  cherry-picks are listed separately above.
- Architecture/ADR decisions: none; retain NO-GO recommendation.
- Contracts changed: none; no production, gate or status mutation.
- Positive/security tests: exact commands/results above and evidence JSON.
- Performance: short shared-host smoke observations only; not launch SLOs,
  capacity, sustained-load, soak or candidate ranking evidence.
- Risks/release blockers: mandatory Pingora failures, dependency maintenance,
  required alternative failures, raw H2 conformance and resource proof limits.
- Human review needed: architecture substitution/security disposition after
  complete evidence; no architecture acceptance authorized by this report.
- Next unblocked modules: unchanged master-plan dependencies; report opens none.
