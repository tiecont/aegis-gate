# Isolated Pingora feasibility lab

This workspace evaluates protocol/TLS API feasibility. It is not the production
edge implementation and does not accept customer configuration. Both proxy
listeners and upstream dials are hard limited to loopback. The pre-TLS fixture
filter accepts only source `127.0.0.1`.

Current gate: **blocked**. The final release run passes 34/35 cases, but Pingora
normalizes an invalid request-target containing a raw space and returns 200.
The harness deliberately exits 1; ADR-011 records the reproduction and review
required before dependent runtime implementation.

## Prerequisites and reproduction

Linux, Rust `1.99.1`, Node `26.13.0`, OpenSSL development headers/CLI,
`pkg-config`, a C compiler, CMake, and an existing local Docker daemon are
required. `libz-ng-sys` requires CMake. This session used CMake `4.1.3`, installed
with `uv tool install cmake==4.1.3`; no upstream source was patched.

From the repository root:

```sh
cargo +1.99.1 fmt --check --manifest-path spikes/pingora/Cargo.toml
cargo +1.99.1 clippy --locked --manifest-path spikes/pingora/Cargo.toml -- -D warnings
cargo +1.99.1 test --locked --manifest-path spikes/pingora/Cargo.toml
cargo +1.99.1 build --release --locked --manifest-path spikes/pingora/Cargo.toml
env PATH="$PWD/.local/toolchains/node/bin:$PATH" npm ci --prefix spikes/pingora --ignore-scripts --no-audit --no-fund
docker pull nginx@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311
.local/toolchains/node/bin/node --check spikes/pingora/lab.mjs
env PINGORA_SPIKE_PROFILE=release .local/toolchains/node/bin/node spikes/pingora/lab.mjs
.local/toolchains/node/bin/node --check spikes/pingora/evidence.mjs
.local/toolchains/node/bin/node spikes/pingora/evidence.mjs
```

`evidence.mjs` requires the foundation's pinned
`.local/tools/bin/cargo-audit` (`0.23.0`). It fetches public release/crate metadata
and vulnerability databases; it does not send test traffic to public services.

The lab creates a new mode-0700 `.local/pingora-run-*` directory, mode-0600
manifest/keys/results/logs, a private two-day CA and one-day leaf certificates.
The CA signing key is removed after fixture generation. The harness prints only
test names and evidence paths. It tears down only its own child process,
reference container, clients and loopback origins. Private fixture files remain
ignored by Git; do not commit that directory.

The maintained Nginx reference is fixed by digest, runs as the current UID,
without capabilities, with a read-only root and a small tmpfs. Linux host
networking is used to reach loopback-only origins; its configuration explicitly
binds `127.0.0.1`. Every origin proxy/probe and every test client verifies CA and
hostname. The fixture CA override is separate from the OS trust store.

## Evidence interpretation

`lab.mjs` emits `results.json` with exact test outcomes, environment and a bounded
closed-loop smoke benchmark. The script exits nonzero on a test failure. These
results establish only this local proof; they are not a production security,
capacity, availability or SLO claim. See ADR-011 and the module completion report
for review requirements and remaining production work.

The manifest is a local trusted fixture format, not `ConfigEnvelope`. It cannot
publish signed configs, authorize domains, manage tenants or distribute keys.
Certificate chains with intermediates, session resumption, production secrets,
CIDR proxy trust, distributed config, quotas, drain/HA and a full malformed/fuzz
corpus belong to the later modules and release gates.
