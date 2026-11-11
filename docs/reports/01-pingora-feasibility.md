# Module 01 Agent Completion Report

- Module: `01-pingora-feasibility`, gate `M0-PROXY-GO-NOGO`.
- Status: **blocked**. Executable proof implemented; **4 unit tests pass, 34/35 integration/security/benchmark cases pass, 1 strict malformed-target test fails**. Gate is closed; no dependent runtime module is authorized by this report.
- Commits: none. Files changed: isolated `spikes/pingora/{Cargo.toml,Cargo.lock,src/*,package.json,package-lock.json,lab.mjs,evidence.mjs,PLAN.md,README.md,evidence/*}`, this report and `docs/ADR-011-pingora-evaluation.md`.
- Architecture/ADR decisions: ADR-011 proposed with **current No-Go** and alternatives. Existing accepted ADRs were not reversed. OpenSSL backend pinned for dynamic certificate callbacks.
- Contracts changed: none; local fixture JSON is not a production snapshot contract. No edits to `apps/edge`, shared contracts or root implementation status.
- Human review needed: strict malformed-target handling/ingress architecture and dependency-maintenance disposition; human owner/signature not assigned or invented.
- Next unblocked modules: independent 02/03 only as their own gates allow. 04/05 remain blocked by this gate.

## Blocking finding

**P1 / gate blocker:** `GET /bad target HTTP/1.1` with valid lab SNI/Host
returns `HTTP/1.1 200 OK` from the owned origin. The harness requires a 4xx or
closed connection and no origin dispatch. Pingora 0.9.1's H1 parser retries
invalid request lines by percent-encoding illegal URI bytes, replacing the
buffer before `request_filter` can inspect it. The public options inspected do
not expose a strict rejection switch. `get_headers_raw_bytes` retains CL/TE
headers but does not retain the pre-rewrite request line in this path.

Reproduce from root after the prerequisites/build in `spikes/pingora/README.md`:

```sh
env PINGORA_SPIKE_PROFILE=release .local/toolchains/node/bin/node spikes/pingora/lab.mjs
```

Actual final result: **exit 1**, 2026-11-11 03:53:05-03:53:25 UTC,
`.local/pingora-run-KzNELk/results.json` and `proxy.log`. Safe exported evidence,
source hashes and binary hash are in
`spikes/pingora/evidence/local-run-2026-11-11.json`. The failing test remains
enabled. This is a project strict-rejection mismatch; no demonstrated exploit
or new framework vulnerability is asserted. A maintained strict-mode fix or
reviewed ingress integration requires another real proof. Envoy and
Hyper/Tokio alternatives are evaluated qualitatively in ADR-011; neither was
silently substituted or benchmarked as an implementation alternative.

## Implemented proof

The executable binds only `127.0.0.1`; every upstream/probe dial is loopback and
verified HTTPS with pinned lab hostname/CA. This is isolated lab addressing,
never production SSRF allow policy. Config/cert snapshots use ArcSwap and one
captured generation per request, after headers arrive. Unknown SNI has no
default certificate; Host/authority binds to SNI. Exact route/generation pool
keys prevent cross-route/trust-epoch connection reuse. The harness generates
fresh private PKI and destroys the CA signing key after issuing fixtures.

Passing local tests cover two SNI certificates, unknown/missing/port-bearing
SNI denial, pre-TLS source filter, forged forwarded/tenant header stripping,
H1/H2 body streaming, H2 authority/Host/SNI confusion, WebSocket echo/graceful
close, gRPC bidi responses before half-close/trailers/cancellation, certificate
rotation during an active stream, immutable generation, invalid/replayed
snapshot LKG, mismatched key/SAN/duplicate-host/unsafe-key-mode rejection,
wrong-name/expired/untrusted origin TLS, trust-store change on a keepalive
connection, bounded origin timeout, pooling and route pool isolation,
8 cancelled uploads with a bounded RSS check, 3:1 weighted distribution,
health failover/recovery, invalid-TLS backend exclusion and all-unhealthy 503.

The malformed corpus passes conflicting CL, CL/TE in both orders, duplicate
Host, invalid TE, obsolete folded header, trusted-header Connection nomination
and no upgraded-byte forwarding before 101. **Invalid request-target fails.**
The secret sentinel in Authorization/cookie/body is absent from runtime logs.
These are bounded local proofs, not full fuzzing, tenant management isolation,
JWT correctness or production logging coverage.

## Executed Commands

| Exact command | Actual outcome |
| --- | --- |
| `cargo +1.99.1 fetch --manifest-path spikes/pingora/Cargo.toml` | PASS; dependencies fetched and separate lockfile generated. |
| Initial `cargo +1.99.1 check --manifest-path spikes/pingora/Cargo.toml` | Historical FAIL: missing `cmake` in libz-ng-sys build; environment prerequisite, not No-Go evidence. |
| `uv tool install cmake==4.1.3` | PASS; local user tool installed, no upstream patch. |
| `cargo +1.99.1 build --release --locked --manifest-path spikes/pingora/Cargo.toml` | PASS, optimized executable. |
| `cargo +1.99.1 fmt --check --manifest-path spikes/pingora/Cargo.toml` | PASS. |
| `cargo +1.99.1 clippy --locked --manifest-path spikes/pingora/Cargo.toml -- -D warnings` | PASS. |
| `cargo +1.99.1 test --locked --manifest-path spikes/pingora/Cargo.toml` | PASS, 4 tests. |
| `npm install --prefix spikes/pingora --ignore-scripts --no-fund --no-audit` | PASS, lockfile generated; initial host Node26.9.0 engine warning. All actual harness runs used pinned Node26.13.0. |
| `.local/toolchains/node/bin/node --check spikes/pingora/lab.mjs` | PASS. |
| `.local/toolchains/node/bin/node --check spikes/pingora/evidence.mjs` | PASS. |
| `env PINGORA_SPIKE_PROFILE=release .local/toolchains/node/bin/node spikes/pingora/lab.mjs` | **FAIL exit1, 34 pass/1 fail**; exact final outcomes exported above. |
| `.local/toolchains/node/bin/node spikes/pingora/evidence.mjs` | PASS; exact locked metadata/features/licenses, cargo-audit/npm audit and current release/crate evidence captured. |
| `cargo +1.99.1 tree --manifest-path spikes/pingora/Cargo.toml --locked -i derivative` and `-i unsafe-libyaml` | PASS; warning paths confirmed in Pingora core/LB and core YAML dependency. |
| `docker run --rm --entrypoint nginx nginx@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311 -v` | PASS, Nginx1.30.6. |

Initial local runs found two CL/TE acceptance failures, subsequently repaired
by parsing Pingora-preserved header bytes with maintained httparse and covered
by unit and integration tests. Source review found CA absent from Pingora's
default pool hash, repaired with disjoint route/generation keys and a direct
trust-store-swap negative. Capturing in `new_ctx` was moved to policy entry to
avoid stale snapshots while an idle keepalive awaits headers. Earlier smaller
passing runs do not supersede the final expanded corpus failure. One interim
reference startup failed because Nginx temp directories were on a read-only
root; all temp paths now explicitly use the finite tmpfs. No TLS check was
disabled to resolve any failure.

## Performance Evidence

Hardware: AMD Ryzen7 4800HS, 16 logical CPUs, 24,573,243,392 bytes host RAM,
Linux7.2.9-2-cachyos, Node26.13.0, Rust1.99.1 release. Shared development host.
Both proxies use 2 workers, verified TLS1.2/1.3 on both hops, keepalive, same
loopback Node origin/client. 100 warmup requests then 5s each sequentially,
closed-loop concurrency8; 90% GET with1024B response, 10% POST32768B echo.
CPU is `/proc` user+system delta, HZ100; RSS sampled100ms, summed processes.

| Final run | Requests/s | p95 ms | p99 ms | CPU, % one core | Peak RSS bytes | Errors/timeouts |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Pingora0.9.1 release | 1587.59 | 9.638 | 14.792 | 49.99 | 22,601,728 | 0/0 |
| Nginx1.30.6 pinned digest | 1472.32 | 10.544 | 13.854 | 36.37 | 20,324,352 | 0/0 |

Latency includes origin/client scheduling; handshake is excluded in steady
state. No proxy-only p99 or SLO claim. Short single runs have coordinated
omission/shared-host interference; sequential order and crypto/default build
differences remain confounders. An earlier release run reversed the throughput
ordering (1127.40 vs1724.69 requests/s), demonstrating that no superiority or
launch-capacity inference is defensible. No open-loop/30min steady/2h soak or
production overload/HA proof was performed.

## Security Review and Release Risks

Self-review performed against T01/T06/T07/T08/T11/T13/T14/T17. The failing
strict-target criterion blocks the gate. Independent post-implementation review
is still required; the earlier planning review predates this executable.
`IMPLEMENTATION_STATUS.md` remains the orchestrator's owned gate record.

Exact lockfile scan: 206 Rust packages, zero known vulnerability findings,
**2 unmaintained warnings**: derivative2.2.0/RUSTSEC-2024-0388 (build proc macro)
and unsafe-libyaml0.2.11/RUSTSEC-2024-0449 (deprecated serde_yaml in Pingora).
No advisory ignores. Lab input is bounded JSON and Pingora config defaults;
no untrusted YAML is parsed by this proof. Maintenance risk still requires
review/tracking and no exception is accepted here. NPM scan: zero findings.
All Rust/Node package license metadata present; full inventory and scan hashes
are captured in `.local/evidence/pingora` with safe summary exported at
`spikes/pingora/evidence/dependency-review-2026-11-11.json`. Licenses and
vendored OpenSSL are detailed in ADR-011; distribution/legal review remains.

No production security/authorization/SSRF policy, signed config distribution,
secret manager, cert chain/resumption lifecycle, full slowloris/abuse/fuzz/HA,
managed JWT/rate quotas or release gate is implemented by this spike. The
mode/symlink fixture checks are not a general hostile-filesystem secret store.
Lab resources were torn down; no owned child/proxy/reference container is left
running. No third-party security/load traffic, production deployment, live DNS,
cloud spend or billing operation occurred.
