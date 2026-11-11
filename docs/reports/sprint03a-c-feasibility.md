# Sprint03-A Agent C: Hyper/Tokio feasibility

## Agent Completion Report

- Module: isolated Sprint03-A candidate C; no production module implementation.
- Status: **complete experiment; NO-GO recommendation**, pending root review.
- Commits/files changed: this branch's review commit contains only
  `spikes/hyper/`, `evidence/sprint03a-c/`, `docs/reports/sprint03a-c-*`.
- Architecture/ADR decisions: none accepted or changed. Hyper is an isolated
  alternative proof; Module01/Module04 and global gate/status files unchanged.
- Contracts changed: none. Binary adapter accepts `manifest-path port` and
  consumes the same atomic fixture JSON as every shared candidate.
- Positive tests: final full shared run **70/75**; all functional cases pass.
  Additional limit probes **6/6**; Rust unit tests **4/4**, zero exclusions.
  Fmt, all-target clippy with warnings denied and locked release build pass.
- Security negatives: all75 shared cases execute, **five mandatory failures**
  remain; exact-lock audit with warnings denied passes, zero known advisory
  findings/warnings/ignores. Source/archive checks pass for all86 registry
  packages,5422 files, plus the local package.
- Performance: short shared-host reference smoke measurement only, below.
- Known risks/release blockers: strict original framing and fragment rejection
  fail; operational, config, resource, TLS lifecycle and security gaps below.
- Human review needed: root independently reruns this exact binary/source;
  architecture replacement and security/release acceptance remain human-owned.
- Next unblocked module(s): none opened by this report. Evidence review only.

## Results And Reproduction

Worktree `/home/tiecont/Projects/aegis-gate-sprint03-c`, branch
`spike/hyper-tokio-feasibility`, base `159a2d40493be5caac34e45f5c79d9c3dca4a1f9`.
Full commands are in `evidence/sprint03a-c/commands.json`; executable instructions
are in `spikes/hyper/README.md`. Every lab, scan and checksum inspection used
`flock /tmp/aegisgate-sprint02-fixtures.lock` for the invocation's lifetime.
The absolute root Node/runtime/runner are used, with the candidate command
pointing to this worktree's release binary and `AEGIS_CANDIDATE_NAME=hyper`.
Final fixture output is confined to `AEGIS_RUN_ROOT` in this worktree's `.local`.

| Evidence | Actual result |
| --- | --- |
| `shared-run-01.json` / log | Preserved initial failure:57/71 executed,14 failed, fatal snapshot deadline, exit1. Old root TLS `clientError` classification counted verification alerts as HTTP parse errors and prevented fixture restoration; candidate also returned400 instead of required421 on SNI/Host mismatch. It is an incomplete failed run, not75-case evidence. |
| `shared-run-02.json` / log | Corrected root classification, candidate421 response, all75 present once,70 pass/five fail, no fatal/pending/skipped cases, exit1. |
| `limits-01.json` / log | Preserved5/6 run; test mistakenly passed HTTPS `path` to `tls.connect`, causing `EACCES /` before the header probe connected. |
| `limits.json` / log | Corrected probe6/6, exit0; binary identical to final shared run. |
| `fmt.log`, `clippy.log`, `test.log`, `release.log` | Exit0;4/4 Rust tests, all-target clippy `-D warnings`, locked optimized release. |
| `audit-final.json` / stderr | Exit0 with `--deny warnings`;87 packages,0 vulnerabilities,0 warnings, empty ignore list. |
| `registry-source-checks.json` |86 `.crate` SHA256 values match lock;5422 source files match archive bytes, zero extras/modifications. |
| `provenance.json`, `dependencies.json`, `direct-release-metadata.json` | Exact source/binary/tool/harness hashes, full license/repository inventory, published release dates/checksums. |

Final binary SHA256:
`8fb900bae4fb992ba4296cff0c5975f5e2e14bf8fc0378841af1e5fc7ff828e7`.
Cargo.lock SHA256:
`3d7e17a5b973919e522edc4cebb8b5035ddb29850d18c4676cdd06b207f72c77`.
Shared test manifest SHA256:
`8dd056bb69f53e0a41bf6445c7054f2345ce969d3c22784a7567268e0733f141`.
Final lab SHA256:
`ef8f113ffe33a24cf490f73b7039fdafadebfa786ef5081971419a7379ae12dc`.
Supplemental SHA256:
`606047f95e3fca51c0a94a7b6b31594dcf5248a42053c4be110b901428a13ecf`.
Remaining file hashes are in `SHA256SUMS` and provenance. Root has not yet
independently rerun or accepted this candidate.

## Strict Ingress Failures

| Required negative | Origin handlers | Decrypted bytes | Observed origin target |
| --- | ---: | ---: | --- |
| `malformed-HTTP-CL-TE` |1|122|`/` POST |
| `malformed-HTTP-TE-CL` |1|122|`/` POST |
| `strict-ingress-CL-TE-pipelined` |1|126|`/echo` POST |
| `strict-ingress-TE-CL-pipelined` |1|126|`/echo` POST |
| `strict-ingress-target-fragment` |1|92|`/path` GET, original `/path#fragment` |

Every failure violates the unchanged zero-origin-dispatch/bytes contract.
Origin parse errors are zero in these cases; a valid downstream response or
upstream parse success does not satisfy rejection. Exact client bytes,
responses, close behavior and origin observations are retained in
`shared-run-02.json`'s `ingress_observations` and per-test records.

Published Hyper1.12.0 `src/proto/h1/role.rs`, request parse loop around275-315,
removes CL when TE follows and ignores CL when TE already exists. This happens
before `service_fn`; a parsed-header CL+TE check cannot recover the original.
Published `http`1.5.0 `src/uri/path.rs`, `PathAndQuery::from_shared` around22-30,
truncates bytes at a raw fragment. Hyper constructs `Uri` using
`Uri::from_maybe_shared`; the service sees only the truncated URI. These files
were byte-compared with the published locked archives. No dependency was
patched, and no raw framing/parser adapter or insecure fallback was added.

Raw spaces/tab/SOH/NUL targets, duplicate/malformed Host, authority confusion,
unsupported schemes/CONNECT/relative targets, folded headers, repeated TE,
invalid CL, trusted-header nomination and supplemental pipelined negatives
pass their zero-origin requirements. All six percent-encoded positive targets
are preserved exactly; valid pipelining produces both responses and targets.
Typed-request unit checks exercise exposed-header policy only; they do not
countermand the observed original-byte normalization failures.

## TLS And Protocol Proof

Hyper1.12.0, Tokio1.54.1, rustls0.23.46, tokio-rustls0.26.6,
hyper-rustls0.27.10 and hyper-util0.1.21 are exact stable pins. Registry metadata
and licenses are recorded. `ring`0.17.14 supplies rustls cryptography.
OpenSSL0.10.82 is used for certificate date validation only, with the host's
OpenSSL3.6.5 dynamically linked; `ldd.log` and shared-library hashes record this
separate native artifact. Origin and downstream TLS traffic use rustls.

- Exact dynamic SNI lookup chooses two distinct certificates; unknown/missing/
  port-bearing SNI and unapproved loopback source fail before HTTP.
- New handshakes see rotated certificates; an established streaming response
  remains on generation1 while generation2 activates, body and response header
  remain consistent. Requests capture one immutable snapshot. Malformed,
  replayed, wrong-SAN/key, duplicate-host and publicly readable key configs retain
  the previous generation. This fixture manifest is not the signed Module03
  contract and confers no authority to ship a production config path.
- Origin wrong-name/expired/untrusted certificates fail closed with no handler
  calls or HTTP bytes. A CA swap on an existing keepalive client cannot reuse
  the old trusted origin connection. Each route/generation owns a separate
  Hyper client, demonstrated by different origin connection IDs for two routes
  at the same origin. Six sequential requests reuse one origin connection.
- H1/H2 body echo and H2 upstream negotiation pass; first response chunk is
  observed at7.04ms for the lab stream, well before its400ms completion.
- WS bidirectional echo and1000 close pass; preread bytes are not tunneled
  before an origin101. A non101 upgrade response closes H1 downstream reuse.
- gRPC emits replies before client half-close, preserves trailers and relays
  client cancellation to the origin.
- Verified HTTPS health probes yield exact30:10 weighted distribution across40
  requests, failover/recovery, exclusion of a high-weight invalid-TLS backend,
  and503 when all are unhealthy. The selection and health scheduler are owned
  lab integration code, not functionality supplied by Hyper.

## Resource Evidence And Limits

Decoded request bodies are capped at1MiB and responses at8MiB without full-body
collection. A declared oversized body returns413 before origin dispatch.
Additional chunked-upload proof forwards exactly1048576 bytes, then cancels the
origin. The oversized response delivers exactly8388608 bytes and closes rather
than reporting a complete body. An over-limit streaming body cannot reliably
be converted to413 once headers have already been sent; reset/close is the
bounded behavior proved here. Request and response frames preserve trailers.

Eight upload disconnects cancel at the origin in418.98ms total; sampled RSS is
11505664 bytes before and after. Additional probes show stalled upload
cancellation at2011.64ms, stalled response close at2009.75ms, incomplete header
close at2007.16ms without origin dispatch and incomplete TLS close at2003.74ms.
The full harness slow-origin response is bounded at2003.09ms. These are smoke
bounds, not leak/soak, flood, scheduler fairness or global memory proofs.

The source also bounds connections64, active request permits128, H2 streams32
per connection, headers/buffers and pool idles; full values are in the README.
The body wrappers carry the permit and captured snapshot through completion.
WS copies two16KiB buffers with30s total lifetime. Active connection/request
cap saturation, slow downstream writes, H2 idle/ping/reset abuse, generation
churn, long WS behavior and whole-process RSS under sustained overload are not
proved. There is no dedicated downstream write timeout or graceful drain.
The health/reload loop serially probes at most16x8 backends at250ms per probe,
so reload propagation can be much slower than the two-backend demonstration.

## Ownership And Gaps Matrix

Owners below describe required engineering boundaries, not assigned human
reviewers or approval. Hyper/Tokio supplies protocol primitives; adoption means
owning and maintaining the proxy assembly and its regressions.

| Area / proposed owner | Local evidence | Gap / adoption cost |
| --- | --- | --- |
| Original parsing / upstream libraries + Module04 ingress owner | Raw-space/control rejects, encoded controls pass | **Required failure:** four CL/TE cases and fragment normalize before service. Need maintained strict API/upstream release or separately reviewed ingress engine, then repeat75+functional proof. |
| SNI/tenant binding / Module04+05 | Exact SNI, Host/authority binding,421, distinct certs | Full hostname/IDNA/listener/domain-ownership policy, revoked domain and cross-listener identity remain unimplemented. |
| TLS lifecycle / Module05 | Atomic cert rotation, SAN/key/date checks, verified origin | Session resumption disabled; no chain rotation/revocation/ACME/secrets delivery/HSM/expiry monitoring. File checks are local fixture handling, not a hardened race-free secret loader. |
| Config / Module03 | ArcSwap, monotonic generation, LKG, consistent active stream | Signed schema/trust bootstrap/publisher verification/ACK-NACK/persistence/max staleness not integrated. Need compiler/adaptor from signed Module03 snapshot and cert refs into staged clients/routes. |
| Pools/egress / Module04 | Trust/route/generation partition, reuse, fixed-loopback resolver | No production DNS/address validation/rebinding/SSRF/redirect policy; dynamic trust churn and pool lifecycle need design. Fixed loopback is lab-only. |
| WS/H2/gRPC / Module04 | Echo/close, frames/trailers, cancellation and preread guard | Extended CONNECT/H2 WS, long streams, graceful drain and protocol compatibility matrix absent. Absolute30s tunnel lifetime unsuitable as general WS policy. |
| Limits/timeouts / Module04+07 | Streaming caps, disconnects, idle/TLS/header deadlines | No saturation/fairness/slow-reader/global memory/long soak proof; no downstream write deadline, H2 idle deadline, per-IP/tenant budget or abuse response policy. |
| Balancing/health / Module04 | Owned smooth RR and verified probes pass lab | No circuit breaker, passive health, jitter/backoff, production scheduler, robust drain, metrics or maximum reload SLO; serial probes delay updates. |
| Filters / Module06+07+08 | `service_fn` before dispatch; body wrapper; sanitized headers | JWT/API keys, route authorization, distributed quotas/trusted proxy identity, audit/metering and observability are not implemented. Must map reviewed policy order onto explicit hooks. |
| Shutdown / Module04+10 | No child processes; harness SIGTERM cleanup | Tasks abort, no graceful rolling-drain proof for H2/WS/gRPC. Runtime task cancellation/pool behavior becomes owned code. |
| Supply chain / security owner | Exact pins, zero-warning audit, published archive comparisons | Cargo audit does not scan host OpenSSL/system packages or certify absence of unknown defects. Pin/build/provenance native artifacts before distribution; legal review of recorded SPDX alternatives remains. |
| Performance / validation owner | Identical bounded H1 workload and actual proxy PID sampled | Single short sequential shared-host run, no open-loop/soak/overload/SLO or ranking inference. |

## Controlled Reference Measurement

AMD Ryzen7 4800HS,16 logical CPUs,24573243392 bytes RAM; Linux7.2.9-2-cachyos,
rustc/cargo1.99.1, root Node26.13.0, release build with two Tokio workers. The
shared harness uses100 warmups then5s at eight closed-loop clients,90% GET1KiB
and10% POST32KiB echo, verified TLS on both hops, H1 keepalive. Nginx1.30.6 is
pinned to digest `583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311`.

| Candidate | Requests / s | p50 / p95 / p99 ms | CPU, one-core % | Peak sampled RSS | Errors / timeouts |
| --- | ---: | --- | ---: | ---: | --- |
| Hyper |1033.76|0.989 /43.116 /48.186|26.38|12423168 bytes,1 PID|0 /0|
| Nginx reference |3042.28|2.351 /4.586 /6.940|40.20|20606976 bytes,3 PIDs|0 /0|

This is one local smoke run with coordinated omission, shared host load,
sequential runs, different crypto/build defaults and summed Nginx shared pages.
No performance advantage, launch SLO or production capacity is asserted.

## Dependency Disposition And Recommendation

Final cargo-audit0.23.0 database commit
`31cf5a8673e10d3a4d7d829ad5095f47ed419049`,1453 advisories, records0 known
vulnerabilities/0 warnings across87 packages with no ignore or target filter.
The earlier scan is retained in `audit.json` (older DB commit), also zero.
`derivative`/`unsafe-libyaml`/Pingora are absent from this isolated lock.
Direct stable release metadata, SPDX expressions and repository URLs are
retained for all packages; no legal approval is implied. The older
hyper-timeout0.5.2/tower-service0.3.3 releases have no audit warning, which is
not a guarantee of future maintenance. No private key, certificate fixture,
real credential or user body is committed or written to runtime logs. Raw
synthetic HTTP protocol inputs are intentionally retained as test evidence.

Recommend **NO-GO for this candidate at this proof state**. A smaller parser
failure count cannot grant acceptance. Options for review are a maintained
upstream strict-ingress/URI path preserving original semantics, or a separate
maintained ingress/proxy alternative with equivalent proof. Neither is silently
adopted here. Root's independent exact-candidate rerun and human architecture
decision remain outstanding; this commit changes no gate and performs no merge.
