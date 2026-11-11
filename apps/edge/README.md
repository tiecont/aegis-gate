# Rust foundation

This workspace provides typed error-envelope and generation invariants, an offline
contract checker, and a bootstrap readiness gate. It does not proxy requests,
authenticate snapshots, synchronize config, or open sockets. Pingora feasibility
(module 01) and signed config distribution (module 03) must pass before a runtime
can accept customer traffic.

Run from this directory:

```sh
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
cargo test --workspace --locked negative_
cargo build --workspace --locked
cargo run --locked -p edge-server -- --check
cargo run --locked -p config-agent -- check-error ../../packages/contracts/fixtures/error.json
```

`edge-server --check` returns an offline diagnostic with `ready:false`. Every
attempt to start it as a service exits 78. A successful `config-agent check-error`
validates only the public management API error shape; it cannot load or activate
an edge snapshot. The checker bounds input to 16 KiB and prints fixed diagnostics
without input, filesystem path, or error-envelope content.

Error envelopes reject unknown/duplicate fields, trailing JSON, noncanonical
UUID4 identifiers, empty/oversized codes and messages, and control characters.
Generations are positive integers up to 2^53-1, advance monotonically, and never
wrap. These shared foundation constraints do not replace later authorization,
tenant isolation, snapshot signature verification, or dial-time TLS checks.

Toolchain `1.99.1` was confirmed against the official stable manifest dated
2026-10-15 at <https://static.rust-lang.org/dist/channel-rust-stable.toml>.
Dependency versions were queried from the crates.io registry API:
<https://crates.io/api/v1/crates/serde>,
<https://crates.io/api/v1/crates/serde_json>, and
<https://crates.io/api/v1/crates/uuid>.
Exact direct versions and full transitive resolutions are pinned in Cargo.toml
and Cargo.lock. This does not constitute a vulnerability scan or security signoff.
