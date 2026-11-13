# Agent D executable plan

Baseline: PR12 merge `cbb5f71db84b9489bf4a6260696bbba29ab4a561`.
Scope: local Modules00/02/03 reliability and dashboard dependency compatibility.

1. Commit this recorder/probe before collecting proof. Preserve each attempt.
2. Acquire `/tmp/aegisgate-sprint02-fixtures.lock` for the entire recorder,
   including dependency installation, private fixture generation/image build,
   Compose startup, regression, failure handling and cleanup. Independently
   check that a competing lock acquisition fails at lifecycle boundaries.
3. Use `aegisgate-04b-d` Compose project and derive its network from Compose
   configuration. Check running container image/network identity and loopback
   publication. Run actual credential positive/negative and TLS tests, fresh
   PostgreSQL persisted restart, and changed-secret/stale-volume rejection.
4. Run formatting, Go vet and all Go packages with race detection and integration
   enabled, edge workspace clippy/tests/build, contracts checks/tests/integration,
   dashboard strict installation/lint/type/unit/build/integration/audit, and
   existing gate selftests. Recheck the independent Node/OpenSSL golden vector.
5. Refresh npm released metadata. Test TypeScript7 strict resolution in an
   isolated package copy; do not force it or modify manifests/minimatch/scanners.
6. Report named recovery/prune/archive/drain/floor coverage and limitations with
   exact commit/tree, versions, argv/cwd, UTC times, raw logs/exits and SHA256.
   Root owns separate full final gates and independent review remains required.

Only reproduced runtime defects justify fixes. No Module10 implementation,
architecture/gate changes, shared documentation edits, public listeners, external
abuse traffic, secret output or upstream messages are authorized here.
