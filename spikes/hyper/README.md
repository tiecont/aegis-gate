# Hyper/Tokio local feasibility proof

Isolated reverse-proxy assembly, not a production edge. **NO-GO**: the complete
shared corpus executes **70/75**, with five required strict-ingress failures.
See [Agent C report](../../docs/reports/sprint03a-c-feasibility.md) and
[raw results](../../evidence/sprint03a-c/shared-run-02.json).

The executable accepts exactly `manifest-path port`. It binds `127.0.0.1`,
permits only `127.0.0.1` peers and dials only `127.0.0.1` through a fixed DNS
resolver. The origin TLS name is still the configured DNS name, verified with
the manifest CA by rustls; there is no insecure mode. Loopback is a fixture
constraint, not an exception for public SaaS origins.

## Reproduce

Run from this worktree. Keep Cargo caches and targets local; root's existing
tools/harness are read-only inputs. Requires Cargo/Rust 1.99.1, pkg-config,
system OpenSSL development libraries, Python3 (provenance only), and root's
prepared Node fixture dependencies/reference Nginx image.

```sh
export CARGO_HOME="$PWD/.local/cargo-home"
cargo +1.99.1 fmt --check --manifest-path spikes/hyper/Cargo.toml
cargo +1.99.1 clippy --locked --manifest-path spikes/hyper/Cargo.toml --all-targets -- -D warnings
cargo +1.99.1 test --locked --manifest-path spikes/hyper/Cargo.toml
cargo +1.99.1 build --locked --release --manifest-path spikes/hyper/Cargo.toml
flock /tmp/aegisgate-sprint02-fixtures.lock env \
  PINGORA_SPIKE_PROFILE=release AEGIS_CANDIDATE_NAME=hyper \
  AEGIS_CANDIDATE_COMMAND="$PWD/spikes/hyper/target/release/aegisgate-hyper-feasibility" \
  AEGIS_CANDIDATE_ROOT="$PWD" AEGIS_RUN_ROOT="$PWD/.local" \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  /home/tiecont/Projects/aegis-gate/spikes/edge-comparison/run.mjs
```

The shared runner is expected to exit1. It must list every one of the75 tests;
no exclusion variable or expected-result adjustment is used. It prints a
results path. Retain that JSON and runtime log in the owned evidence directory.
Additional limit probes consume that JSON to locate the owned ephemeral PKI:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/hyper/limits.mjs evidence/sprint03a-c/shared-run-02.json
flock /tmp/aegisgate-sprint02-fixtures.lock env CARGO_HOME="$PWD/.local/cargo-home" \
  /home/tiecont/Projects/aegis-gate/.local/tools/bin/cargo-audit audit \
  --file spikes/hyper/Cargo.lock --db .local/rustsec-db --deny warnings --json
cargo +1.99.1 fetch --locked --manifest-path spikes/hyper/Cargo.toml
flock /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/hyper/collect.mjs /home/tiecont/Projects/aegis-gate
```

The final command writes license, release metadata, lock/archive/source
integrity and binary/tool/harness provenance. It reads published package
metadata, not public target traffic. No fixture keys are committed. The
additional probes do not replace or change the shared75.

## Assembly And Bounds

- Hyper1.12.0 parses HTTP and handles framing; `http`1.5.0 parses authorities
  and URIs. There is no raw framing parser or upstream patch.
- Tokio1.54.1 runs two workers. rustls0.23.46 / tokio-rustls0.26.6 / ring0.17.14
  provide TLS1.2/1.3. OpenSSL0.10.82 is used only for certificate validity dates,
  linked to system OpenSSL3.6.5; TLS traffic uses rustls.
- Exact SNI cert lookup has no default certificate. Session resumption/tickets
  are disabled. Atomic `ArcSwap` reload validates bounded JSON, keys, SAN,
  validity dates, file permissions, duplicate routes and increasing generation.
  The request captures one snapshot; key material stays in private files/memory.
- Each route in each generation owns a distinct Hyper client. Trust-policy
  changes cannot reuse a previous-generation pool; routes cannot share pools.
- Limits:64 accepted connections/handshakes,128 requests,32 H2 streams per
  downstream connection,64 H1 headers/32KiB headers and read buffer,32KiB H2
  header lists,64KiB H2 send buffers,1MiB request/8MiB response decoded bytes.
  H2 ingress windows are65535 bytes per stream/1MiB per connection. Streaming
  passes Hyper frames/trailers on demand with no whole-body collection/queue.
- Deadlines:2s TLS handshake/header read/body-frame idle/origin read/write,
  1s origin TCP+TLS connect,2s response headers; WS tunnels have a30s absolute
  lifetime and two16KiB copy buffers. Two idle upstream connections per host,
  2s idle pool retention. There are no application retries.
- Optional weighted backends use a small owned smooth weighted round robin,
  HTTPS health probes and503 if all fail. Maximum16 routes/eight backends per
  route/weight16. Health probes run serially with250ms deadlines; this is lab
  code, not an operationally complete load balancer.
- SIGTERM closes the listener and aborts tasks; the binary has no child
  processes. Graceful drain is not implemented.

## Required Failure

Hyper normalizes CL/TE before the service, and `http::Uri` truncates raw
fragments. A service-level check of exposed CL/TE or `#` cannot recover those
originals. Four CL/TE inputs dispatch once; `/path#fragment` arrives as `/path`.
Encoded targets, raw-space/control denial and valid pipelining pass. Rejecting
valid encoded targets or every chunked request would hide the problem and is
not done. An upstream supported strict mode or separately reviewed maintained
ingress integration would require a new complete proof.
