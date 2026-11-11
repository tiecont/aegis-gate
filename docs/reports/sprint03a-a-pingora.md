# Sprint03-A Agent A: Maintained Pingora Strict Ingress

## Agent Completion Report

- Module: 01 feasibility investigation on `research/pingora-blocker-fix`.
- Status: complete (research delivery); **NO-GO**, proxy feasibility blocked.
- Worktree: `/home/tiecont/Projects/aegis-gate-sprint03-a`; starting commit
  `159a2d40493be5caac34e45f5c79d9c3dca4a1f9` (Sprint03-A contract), baseline
  `668b8d998d8a39f3a554a9e42ad6a1a270049d27`.
- Commits / files changed: this reviewable research commit contains three
  executable research/reproduction/check scripts in
  `spikes/pingora/`, `evidence/sprint03a-a/`, this report and execution plan.
- Architecture/ADR decisions: retain NO-GO recommendation. No substitution,
  private dependency patch, custom HTTP parser, accepted risk exception or
  changed rejection criterion.
- Contracts changed: none. Root owns corpus, gate/status files and final disposition.
- Positive tests executed: corrected shared contract3/3 and full corpus63/75;
  six encoded controls and required local protocol/TLS functional cases pass.
  Exact commands and counts are below and in `corrected/run.json`.
- Security negative tests executed: all32 baseline and9 supplemental negatives;
  eight baseline and three supplemental negatives fail. Valid pipeline also
  fails. No exclusions; actual lab exit1 is retained.
- Performance data: actual bounded same-host workload, process CPU/RSS and
  latency in corrected JSON and the limits section below; no launch inference.
- Known risks and release blockers: unrecoverable original request-line bytes
  at proxy filters, twelve mandatory failures, both unmaintained warnings;
  no maintained supported strict ingress was proven.
- Human review needed: independent reproduction/source review and both maintenance
  warning dispositions. Any architecture replacement requires human approval.
- Next unblocked modules: this evidence opens none. Module01 remains closed
  and Module04 remains locked.

## Executable Proof and Provenance

Corrected shared runner: **63/75 pass,12 fail**, exit1, no fatal or missing
cases. Baseline **57/65 pass**, with exactly the original eight failures;
supplemental **6/10 pass**, with four failures. Execution: 2026-11-11
08:32:41.254-08:33:01.220 UTC, followed by owned fixture teardown. Root's three
contract tests pass with no skips. All cases remain enabled.

Final results:
[corrected/results.json](../../evidence/sprint03a-a/corrected/results.json),
SHA256 `c3011dbc37851487629c32426d78710741b6bc1f6e5d9e0bac6e2930fb9d2ac0`.
Commands, exact expected/actual baseline failure sets, source/log hashes and
supplemental outcomes:
[corrected/run.json](../../evidence/sprint03a-a/corrected/run.json).

| Baseline failing input | Client status | Owned origin observation |
| --- | --- | --- |
| Raw space `/bad target` |200 |1 handler,100 decrypted bytes; `/bad%20target` |
| Raw tab `/bad\ttarget` |200 |1 handler,100 bytes; `/bad%09target` |
| Raw SOH `/bad\x01target` |200 |1 handler,100 bytes; `/bad%01target` |
| Raw NUL `/bad\x00target` |200 |1 handler,100 bytes; `/bad%00target` |
| Unsupported scheme `ftp://edge-a.test/` |200 |1 handler,109 bytes; `ftp://lab-origin.test/` |
| Relative target `relative` |502 |0 handlers,**190 decrypted bytes,2 parser errors** |
| Fragment `/path#fragment` |200 |1 handler,92 bytes; `/path` |
| Repeated `chunked, chunked` |200 |1 handler,122 bytes |

All eight peer connections close without client deadline expiry; none satisfy
zero-origin ingress rejection. Supplemental raw space/tab preceding a pipeline
also dispatch once (100 bytes each); repeated TE fields dispatch once (122 bytes).
The valid encoded pipeline control receives one200/one origin invocation rather
than two, so fails preservation/completeness. This executable does not opt into
Pingora's H1 pipelining support; no library-wide inability is inferred. Six
individual encoded-target controls all pass byte-for-byte. The other24 baseline
negatives and six supplemental negatives have zero dispatch/bytes/parser errors.

Existing SNI selection/denial, certificate rotation with active generation,
H1/H2/WS/gRPC, streaming/cancellation, verified origin TLS negatives, trust/pool
isolation, snapshot/LKG, limits, health recovery and log sentinel cases pass in
the corrected run. These remain bounded local proofs, not production claims.

The first run is retained verbatim at `evidence/sprint03a-a/results.json`,
`run.json` and root-level lab/contract logs: **55/75**, baseline49/65, exit1.
It is **polluted/misclassified evidence, not a valid baseline**. Root identified
Node HTTPS `clientError` TLS alerts being counted as HTTP parser failures.
Assertions in the TLS negative cases then prevented normal route restoration,
cascading into other functional cases. Root corrected shared observation to count
`HPE_*`/decrypted `rawPacket` as parser errors and other events as transport
errors. Agent A changed no shared code or rejection expectation. The corrected
source hash differs and is pinned separately; all eight original failures and
four supplemental failures persist. The wrapper correctly rejected the first
run's16 baseline failures instead of labeling it an exact eight-failure match.

The permitted existing root release binary is copied byte-for-byte into this
worktree. Its SHA256 is
`416358486ea4221c8b0141b7d6895b81f61d42d05f65d56d5aaf6184865c0152`.
`verification.json` binds equal own/root `main.rs`, `config.rs`, `Cargo.toml`
and `Cargo.lock` hashes. This is a reused baseline binary, **not a fresh build**
or new binary provenance claim. Upstream crate archive checksums and selected
cached-source equality are separately verified in `upstream.json`.

The absolute root runner and immutable manifest/supplemental corpus are used
directly. Root supplied `AEGIS_RUN_ROOT` during this investigation so all
generated fixtures and results can reside here. Agent A did not edit Root's
source, corpus, fixtures or checkout. `sprint03a-run.mjs` records before/after
shared-source hashes, commands, environment, results/log hashes, baseline IDs
and supplemental outcomes, and preserves the actual failing runner exit.
Private PKI/keys stay in ignored owner-only fixture directories. Only public
fixture request/response observations and nonsecret result metadata are exported.

## Fresh Release and API Review

Read-only retrieval on 2026-11-11: GitHub latest stable and crates.io maximum
stable are both **0.9.1**, published 2026-11-03, not yanked. Inspected upstream
main is `3f87e92c982ee27c714506e16ae362776faea4aa` (2026-11-09).
The source review and scoped searches do not establish the absence of all
possible external adapters or future fixes. Main was not compiled or adopted.

Each retrieval in [upstream.json](../../evidence/sprint03a-a/upstream.json)
includes URL, fetch time, full-response SHA256 and selected numbered excerpts.
Published `pingora-core`, `pingora-proxy` and `pingora-load-balancing` 0.9.1
archives match registry checksums. Selected cached parser/options/custom-session/
proxy/configuration sources match those archives byte-for-byte. No dependency
cache, crate source, lockfile or feature selection was patched.

| Surface | Observed supported behavior | Strict-ingress consequence |
| --- | --- | --- |
| H1 `HttpSession::read_request` | Token/Version errors retry through `escape_illegal_request_line`; replacement buffer becomes the request header | Raw space/tab/SOH/NUL originals are lost before filters. Later `httparse` cannot distinguish them from valid encoded controls. |
| `HttpServerOptions` 0.9.1 | h2c, CONNECT policy, hidden `force_custom`, keepalive request count, H2 idle timeout | No strict/no-normalization switch found. Main adds H1 header-count admission but retains escaping. |
| `early_request_filter` / `request_filter` | `handle_new_request` calls `read_request` before `process_request` invokes filters | Moving the existing check earlier within `ProxyHttp` does not recover original bytes. |
| Documented `HttpProxy::new`, `http_proxy`, `HttpServerApp::process_new_http` | Custom accept loop can construct normal H1 session and invoke proxy | Normal session still runs the same parser. Accept-loop access is not a strict engine. |
| `ConnectionFilter` / TLS callbacks | Address admission / cert selection and TLS digest | Neither is an every-request decrypted HTTP framing hook. |
| Custom downstream session | Stable 0.9.1 already has public `Session::new_custom` and `doc(hidden)` `custom::server::Session`; main adds generic downstream session integration | Hidden trait is not a maintained strict HTTP implementation. No shipped Hyper/strict adapter was identified in inspected sources/searches. |

Correction/clarification to older Sprint02 wording: the custom session trait
itself is present in published stable 0.9.1, not only in unreleased main.
Stable `HttpProxy<SV,C>` holds a non-generic downstream session; main exposes
`HttpProxy<SV,C,DS>` and a builder path for a custom downstream type. These are
source observations, not proof of strict ingress or a tested adapter.

The custom trait requires body/drain I/O, headers/trailers, duplex writes,
timeout accessors, shutdown/abandon/finish semantics, TLS digest and addresses,
retry buffers, custom message reader/writer ownership and upgrade state. Its
optional cancel-safe task methods have panic defaults if enabled without an
implementation. An owned adapter would need to prove these semantics using
the chosen maintained parser on every keepalive/pipelined request. A parser
success alone cannot establish these proxy properties.

[PR1000](https://github.com/cloudflare/pingora/pull/1000) remains open and
proposes request-header size/count limits; it does not supply strict target
rejection. [Issue674](https://github.com/cloudflare/pingora/issues/674) remains
an open upstream framing/strictness request, not an executable fix. No source
patch or unmerged PR was adopted. The released zstd/Tokio fixes in 0.9.1 do not
remove this ingress blocker.

## Supported PoC Disposition

**NO-GO: no safe maintained supported strict-ingress approach was established
for Pingora 0.9.1 under this contract.** The existing executable is reproduced;
no speculative replacement ingress is presented as a supported PoC.

Post-parse scheme/fragment/TE policy checks might repair some observations,
but cannot recover the four normalized raw targets. Rejecting `%20`, `%09`,
`%01` or `%00` would reject positive controls and still would not prove the
original request was malformed. A first-header check fails to cover subsequent
keepalive/pipeline requests. A stream wrapper must track bodies, chunk framing,
trailers, upgrades and queued bytes without desynchronization; hand-building
that state machine would violate the no-custom-parser requirement.

A maintained HTTP ingress terminating before Pingora would introduce another
HTTP/TLS/identity boundary, plus client-IP and SNI trust, cert reload, bounded
streaming, H2/WS/gRPC, cancellation, pool isolation and deployment obligations.
L4 passthrough cannot inspect encrypted HTTP. No supported drop-in integration
meeting this complete contract was found or executed. The parallel Envoy/Hyper
investigations belong to their owners and cannot be claimed as Agent A passes.

## Dependency Maintenance Disposition

Fresh exact-lock `cargo-audit` 0.23.0: **206 dependencies, zero known
vulnerability findings, two unmaintained warnings**; no ignores. Advisory DB
commit `28d73fc95e5972af3403225a217def57dcaba3c4`, last updated 2026-11-10.
These informational warnings do not become accepted risks because the audit
command exits zero. Fresh npm lockfile audit reports zero vulnerabilities.
Both inverse dependency trees and original JSON outputs are committed.

| Warning | Exposure in this executable | Maintained removal path and review cost |
| --- | --- | --- |
| `derivative` 2.2.0 / RUSTSEC-2024-0388 | Build-time proc macro in core `PeerOptions` debug and load-balancing backend Clone/Hash/Eq/Ord/Debug. Generated code ships; macro is not a runtime network parser. Removing LB does not remove core's dependency. | Issue889 remains open; no patched advisory version. Need upstream released replacement/manual traits, review ignored fields, backend identity/order and debug redaction, then fresh tree/audit and behavioral regression proof. No private fork or ignore. |
| `unsafe-libyaml` 0.2.11 / RUSTSEC-2024-0449 | Runtime via mandatory deprecated `serde_yaml` 0.9.34 in core. `Server::new(None)` reaches `ServerConf::new()` parsing fixed `---\nversion: 1`; YAML executes at startup. This lab accepts bounded JSON manifests, no caller/operator YAML. | Issues779/1058 and PR1117 remain open. PR proposes safe-Rust `serde-saphyr` and MSRV1.89 instead of1.85; author checks are not our results. Need maintained released removal, config compatibility review, full protocol/TLS regressions, tree and audit proof. `serde_yaml_ng` can retain unsafe-libyaml. |

Bounded YAML input reduces this proof's exposure; it does not remove the archived
unsafe translation, waive future maintenance or authorize an untrusted YAML
surface. Changing TLS backend/features does not establish removal of these core
dependencies. Neither warning has a patched advisory version. Root/security
review must retain explicit tracking; this report accepts no exception.

## Reproduction Commands

Run from this worktree. `sprint03a-verify.mjs` and `sprint03a-run.mjs` check that
their immediate parent actually holds the fixture `flock` before work begins.
The root Node executable, npm, cargo-audit and baseline binary are read/reused;
all outputs are written in this assigned tree.

```sh
export PATH=/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin:/home/tiecont/.cargo/bin:/home/tiecont/.local/bin:/usr/local/bin:/usr/bin:/bin
node --check spikes/pingora/sprint03a-research.mjs
node --check spikes/pingora/sprint03a-verify.mjs
node --check spikes/pingora/sprint03a-run.mjs
node spikes/pingora/sprint03a-research.mjs
flock /tmp/aegisgate-sprint02-fixtures.lock node spikes/pingora/sprint03a-verify.mjs /home/tiecont/Projects/aegis-gate
flock /tmp/aegisgate-sprint02-fixtures.lock node spikes/pingora/sprint03a-run.mjs /home/tiecont/Projects/aegis-gate corrected
git diff --check
git diff --cached --check -- . ':(exclude)evidence/sprint03a-a/lab.stderr.txt' ':(exclude)evidence/sprint03a-a/corrected/lab.stderr.txt'
```

`verification.json` records exact argv, times, exits and output hashes for
`cargo +1.99.1 fmt --check`, exact-lock audit, both offline inverse trees and
npm audit. The run wrapper records exact absolute shared contract-test/runner
argv and four nonsecret environment overrides. The full repository
`make check`/`make security-scan`, fresh Rust compile/clippy/unit tests and
hosted CI are not claimed here: runtime source/dependencies are unchanged and
the permitted baseline binary is reused. Root owns integration/release checks.
All three new scripts pass Node syntax checks; research retrieval, verification
and corrected full corpus were actually executed. The corrected run wrapper
returns1 deliberately because mandatory cases fail. Initial exploratory shell
inspection had a corrected one-line JavaScript syntax typo; no result was
derived from that failed inspection.
The staged source/document/JSON whitespace check above passes. The unrestricted
staged whitespace check reports only trailing blank lines in the two verbatim
lab stderr assertion transcripts; those raw outputs are intentionally preserved.
JSON parse, exact corrected failure-inventory validation and a scoped private-key
marker check passed under the fixture lock. `artifact-sha256.json` binds the
final source, reports and evidence (excluding the inventory itself).

## Handoff and Limits

Independent review must rerun the same absolute shared runner and all cases,
check source/corpus/binary hashes and review original origin observations.
The failure contract is a 4xx or peer close without deadline expiry and zero
origin dispatch, decrypted bytes and parser errors. A502/no-handler alone is
not an ingress rejection. The short shared-host closed-loop benchmark is
preserved only as a smoke comparison, not launch capacity or an alternatives
ranking. Root's evidence integration does not approve an architecture change.

Benchmark environment: AMD Ryzen7 4800HS,16 logical CPUs,24,573,243,392 bytes
system memory; same-host clients/origins/proxy, verified TLS on both hops,
100 warmup then five seconds each, eight clients,90% GET/1KiB and10%
POST/32KiB echo. Actual candidate process sampled directly (no launcher child).
Pingora:6751 requests,1349.35req/s, p95 13.076ms,p99 33.816ms,
CPU44.57% of one core, peak sampled RSS22,532,096 bytes, zero errors/timeouts.
Pinned Nginx1.30.6 reference:8042 requests,1607.98req/s,
p95 6.597ms,p99 26.284ms, CPU26.39%, summed peak RSS20,631,552 bytes,
three processes sampled, zero errors/timeouts. Sequential short closed-loop
runs with shared host load, coordinated omission, differing builds and summed
shared Nginx pages cannot support a performance ranking or launch SLO.

Two alternatives remain available for human review: wait for a maintained
released strict-mode fix plus warning removal, or evaluate Envoy/Hyper against
the full shared protocol/TLS/security contract. Waiting has upstream schedule
risk; replacement adds configuration/certificate/policy integration and ongoing
ownership. No third-party load/security traffic, live DNS, payments, paid cloud,
public listener, production activation, gate/status edit or merge occurred.
