# Sprint03-A Agent C execution plan

- Worktree `/home/tiecont/Projects/aegis-gate-sprint03-c`, branch
  `spike/hyper-tokio-feasibility`; own `spikes/hyper`,
  `evidence/sprint03a-c`, and `docs/reports/sprint03a-c-*` only.
- Build an isolated exact-version Hyper 1.12 / Tokio 1.54.1 / rustls 0.23
  executable accepting `manifest-path port`, with loopback-only ingress/egress,
  dynamic SNI, atomic validated manifest reload, route/generation-specific
  clients, bounded streaming and I/O, upgrades and verified origin TLS.
- Use maintained HTTP/TLS parsers. Hyper's original framing normalization is
  a suspected strict-policy gap; never hide it with a private patch, custom
  framing parser, encoded-target denylist, test exclusions or TLS bypass.
- Build/test/fmt/clippy the isolated workspace, run the absolute root Node
  shared harness with all75 tests under the fixture flock, audit the exact
  lock under the same flock, and retain commands/results/hashes.
- Report capability evidence, ownership/migration costs and all gaps. Any
  required failure or missing proof means NO-GO. Commit source/lock/tests/
  evidence/report for independent root review; do not merge or open Module04.
