# Sprint02 Agent B: Strict-ingress research

## Agent Completion Report

- Module:01 Pingora feasibility, assigned research branch `research/pingora-strict-ingress`.
- Status: research delivered; **NO-GO recommendation / module blocked**. Root owns gate/status acceptance. No gate or implementation-status file changed.
- Worktree: `/home/tiecont/Projects/aegis-gate-sprint02-b` only. Starting revision `2425c2c`, based on main `9e734e3`.
- Commits / publication: this report, ADR011 proposal, isolated spike harness/unit test/research/export scripts and two evidence JSON files. Published commit/PR are recorded in the branch history and draft PR.
- Architecture/ADR decisions: proposed evidence update only; no replacement, upstream patch, custom HTTP parser, weaker rejection criterion or TLS bypass.
- Contracts changed: none. Production edge and management implementation untouched.
- Human review needed: root independent reproduction/security review, strict-ingress choice, both maintenance warnings; human architecture review before material replacement. No risk exception accepted.
- Next unblocked modules: only independent work allowed by root's existing dependency policy. This report opens no module.

## Actual Results

Unchanged35-case release baseline under the sprint fixture lock: **34 pass,1 fail**, exit1. Raw `GET /bad target HTTP/1.1` returns200. Baseline evidence is `.local/pingora-run-1CqgAK/results.json`, exported with SHA256. That reproduction used the copied pre-existing release binary; its pre-copy provenance is not newly established. The final expanded run uses a freshly rebuilt local release binary with exported hash.

Final expanded release run: **57 pass,8 fail /65**, exit1,2026-11-11 UTC. Raw evidence `.local/pingora-run-2ahN01/results.json`; safe results and hashes: [`spikes/pingora/evidence/sprint02-runs.json`](../../spikes/pingora/evidence/sprint02-runs.json). Exact timestamps, hardware, environment, commands, source/binary and audit artifact hashes are in that JSON. The negative tests remain enabled and cause failure.

| Failing input | Client result | Actual owned-origin observation |
| --- | --- | --- |
| Raw space `/bad target` |200 |1 handler dispatch; origin target `/bad%20target` |
| Raw tab `/bad\ttarget` |200 |1 handler; target `/bad%09target` |
| Raw SOH `/bad\x01target` |200 |1 handler; target `/bad%01target` |
| Raw NUL `/bad\x00target` |200 |1 handler; target `/bad%00target` |
| Unsupported scheme `ftp://edge-a.test/` |200 |1 handler; target `ftp://lab-origin.test/`; project unsupported-scheme policy failure |
| Fragment `/path#fragment` |200 |1 handler; target `/path` |
| `Transfer-Encoding: chunked, chunked` |200 |1 handler; invalid repeated transfer coding not rejected |
| Relative target `relative` |502 |**0 handler invocations,192 plaintext bytes received,2 origin parser errors**. This is not ingress rejection. |

Every failing input is closed by the peer without the harness deadline. Handler count alone initially masked the relative-target origin attempt; the final harness additionally counts decrypted origin socket bytes and `clientError` events, without parsing or logging raw origin traffic. Exact responses and counters are retained. No exploit, authorization bypass, cross-tenant compromise or newly assigned vulnerability is claimed.

The24 passing negative vectors have **0 origin handler dispatches,0 inbound bytes,0 parser errors**: conflicting/comma CL; CL/TE both orders and pipelined second requests; invalid/non-final/folded TE; duplicate different/identical Host; missing/empty/list/userinfo/invalid-port/whitespace Host; SNI/absolute authority/Host conflicts and userinfo; absolute target without Host; disabled CONNECT; obsolete folded fields; trusted-header Connection nomination. All six positive encoded controls return200, invoke exactly one handler and preserve the target byte-for-byte: `%20`, `%09`, `%01`, `%00`, encoded slash/double encoding, encoded UTF-8/query space. Positive byte counts validate instrumentation. A client deadline cannot satisfy the closed-connection assertion.

Existing SNI selection/denial, active-stream cert rotation, H1/H2, WS, gRPC bidi/trailers/cancellation, wrong/expired/untrusted origin TLS, trust-store pool isolation, health/weighted failover, immutable snapshots/LKG, body bounds, cancellation and log-sentinel proofs continue to pass. They remain isolated local proofs.

## Root Cause and Maintained Options

Pingora0.9.1 retries `httparse` Token/Version failures through `escape_illegal_request_line`, replaces the buffer, then exposes the repaired header via `get_headers_raw_bytes`. The existing maintained-httparse CL/TE check therefore sees encoded input. A new unit test proves httparse itself rejects the four raw inputs and accepts their encoded counterparts. Rejecting encoded spaces would break valid requests and cannot identify their original form.

Read-only upstream metadata/source evidence: [`spikes/pingora/evidence/sprint02-upstream.json`](../../spikes/pingora/evidence/sprint02-upstream.json). Latest stable is0.9.1. Inspected main `3f87e92c982ee27c714506e16ae362776faea4aa` retains escaping and has no strict request-line switch in inspected server options. Scoped searches and public sources are not an exhaustive guarantee about all upstream work. Published crate archive SHA256 matches registry metadata; selected local parser/options/proxy files match the archive exactly. No shared cache source was modified.

`early_request_filter` is already after parsing. `ConnectionFilter` sees an address; TLS cert callbacks see TLS, not HTTP. Documented custom accept/`HttpServerApp::process_new_http` APIs still parse the normal H1 session. Hidden `force_custom` is a dispatch selector, not a parser. Main has a hidden custom downstream `Session` trait/generic proxy surface, but no proven maintained strict adapter: cancellation-safe bodies/writes, trailers, timeouts, TLS digest/addresses, upgrade, shutdown and retry buffers would become adapter obligations. Main was source-reviewed, not built/tested/adopted. Open PR1000 concerns parser size/count admission, not strict target rejection.

ADR011 contains the full alternatives matrix: waiting for maintained upstream strict mode/removal, maintained ingress before Pingora, Envoy xDS/SDS, or Hyper/Tokio with maintained TLS. It covers complexity, identity/framing boundaries, migration, maintenance and mandatory proof cost. No alternative is implemented or benchmarked. Human architecture review is required for replacement; dependent runtime remains blocked.

## Maintenance Warnings

Fresh exact-lock audit:206 Rust packages,0 known vulnerability findings, **2 unmaintained warnings**; npm0 vulnerabilities. No ignore/exception. Audit database details and warning records are exported.

- `derivative`2.2.0/RUSTSEC-2024-0388: build proc macro in core and load balancing, generates debug/hash/equality/order traits; not a runtime HTTP parser. Upstream issue889 remains open. Removal needs semantic regression review, especially ignored fields/backend identity and debug redaction. Core keeps this dependency even if LB is removed.
- `unsafe-libyaml`0.2.11/RUSTSEC-2024-0449: deprecated `serde_yaml` through core. Correction to prior wording: `Server::new(None)` parses fixed `---\nversion: 1` YAML internally. No operator/client YAML input is accepted, but YAML runs at startup. Issue1058/779 and replacement PR1117 are open; PR proposes safe-Rust serde-saphyr with MSRV1.89. Unmerged PR/author tests do not establish our fix. Forks such as serde_yaml_ng may retain unsafe-libyaml. Need released removal, config/TLS/protocol regression evidence and audit/tree verification.

Neither advisory lists a patched version. Bounded input exposure does not waive maintenance risk or authorize production. Both require root/security disposition and upstream tracking.

## Executed Commands

All commands below ran with workdir `/home/tiecont/Projects/aegis-gate-sprint02-b`.

| Command | Outcome |
| --- | --- |
| `cargo +1.99.1 fmt --check --manifest-path spikes/pingora/Cargo.toml` |PASS |
| `cargo +1.99.1 clippy --locked --manifest-path spikes/pingora/Cargo.toml -- -D warnings` |PASS |
| `cargo +1.99.1 test --locked --manifest-path spikes/pingora/Cargo.toml` |PASS,5 tests |
| `cargo +1.99.1 build --release --locked --manifest-path spikes/pingora/Cargo.toml` |PASS, local rebuilt release |
| `.local/toolchains/node/bin/node --check spikes/pingora/{lab,evidence,research,export-sprint02}.mjs` (each file individually) |PASS; exact argv in export |
| `flock /tmp/aegisgate-sprint02-fixtures.lock env PINGORA_SPIKE_PROFILE=release .local/toolchains/node/bin/node spikes/pingora/lab.mjs` |Baseline exit1,34/35; final exit1,57/65 |
| `env PATH="$PWD/.local/toolchains/node/bin:$PATH" .local/toolchains/node/bin/node spikes/pingora/evidence.mjs` |PASS command; Cargo0 vulnerabilities/2 maintenance warnings, npm0 findings. Scoped dependency evidence only. |
| `cargo +1.99.1 tree --locked --manifest-path spikes/pingora/Cargo.toml -i derivative` and `-i unsafe-libyaml` |PASS; paths confirmed/exported |
| `.local/toolchains/node/bin/node spikes/pingora/research.mjs` |PASS; read-only release/source/issue/PR/advisory retrieval and crate identity checks |
| `.local/toolchains/node/bin/node spikes/pingora/export-sprint02.mjs .local/pingora-run-1CqgAK/results.json .local/pingora-run-2ahN01/results.json` |PASS exporter checks; preserves failing lab outcomes |
| `git diff --check` |PASS |

Initial test/release build attempts returned101 because the copied CMake cache held the old worktree's absolute path. Retry rebuilt local artifacts and passed; no upstream edit or weakened check. Initial unlocked baseline also reproduced34/35; it was an execution-contract mistake and was rerun under flock. Only the locked baseline is selected for final evidence. Interim expanded runs found5 then8 failures; final stronger byte observations supersede them. Full repository `make check`/`make security-scan` and hosted CI were not claimed by Agent B; root/Agent A own those gates, including history-scan correctness.

The bounded reference smoke benchmark still executes and records shared-host CPU/RSS/latency/error observations. It is retained solely to preserve the original mandatory harness. It does not measure alternative implementations, launch capacity, overload, SLO or superiority. Hardware/profile and limitations are in JSON.

## Reproduction and Handoff

Follow `spikes/pingora/README.md` prerequisites, build locally, then execute the locked harness command above. Keep its expected nonzero exit. JSON observations distinguish200 dispatches from relative502/no-handler origin parser failures. Run the scoped audit/research/export commands for fresh provenance. Private PKI/keys stay in ignored owner-only `.local`; exports contain no credentials or keys. Lab teardown executes for owned child processes, clients, origins and reference container.

Recommendation: **retain NO-GO**; no production ingress implementation may depend on this proof. Root must independently review/reproduce before integrating evidence. No public listener, third-party load/security traffic, production deployment, live DNS, payment or paid-cloud operation occurred. Public requests were read-only metadata/source/advisory queries. No upstream issue/comment was submitted.
