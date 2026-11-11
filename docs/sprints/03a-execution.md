# Sprint 03-A: executable architecture comparison

Baseline: `668b8d998d8a39f3a554a9e42ad6a1a270049d27`.
Scope: isolated feasibility proofs only; no production edge replacement.

## Shared contract

- Read repository agent rules, module01 task, threat model, quality gates,
  ADR011 and Sprint02 raw evidence. Preserve all65 existing tests and fixtures.
- Root/D owns `spikes/edge-comparison/`, immutable corpus/manifest, independent
  reruns, integration, status/risk/ADR updates and final gate disposition.
- A owns `spikes/pingora/` research additions and `docs/reports/sprint03a-a-*`.
- B owns `spikes/envoy/` and `docs/reports/sprint03a-b-*`.
- C owns `spikes/hyper/` and `docs/reports/sprint03a-c-*`.
- Work only in assigned isolated worktree; never edit another agent's tree.
- Every fixture/Compose/lab/integration/full-check/scan invocation holds
  `/tmp/aegisgate-sprint02-fixtures.lock` using flock for its entire duration.
- All listeners bind owned loopback only. No live DNS/payments/public tests,
  production changes, insecure TLS, custom raw HTTP parser, audit suppression,
  hidden patches or weakened tests. Never commit fixture private keys.
- Git branch/commit/push/PR/merge autonomy is authorized, after independent
  review and required quality gates. Architecture substitution needs human
  approval. Module01 stays closed; Module04 stays locked.

## Candidate adapter contract

The shared harness launches an executable with arguments `manifest-path port`.
The JSON manifest and loopback fixture semantics are those of the unchanged
`spikes/pingora/lab.mjs`: generation, CA path, per-host certificate/key paths,
origin name/port, HTTP2 flag and optional weighted backends. Candidate adapters
must implement their own maintained proxy integration, never alter test inputs
or expected results. Reloads use the same atomically replaced manifest.
SIGTERM must stop all child processes. Write runtime logs to stdout/stderr.
Root will supply `AEGIS_CANDIDATE_COMMAND` (absolute executable path),
`AEGIS_CANDIDATE_ARGS` (JSON argument prefix, optional),
`AEGIS_CANDIDATE_NAME` and `AEGIS_CANDIDATE_ROOT` to the common lab.
No test exclusions are supported. Unsupported capability is a failure, not skip.

## Outputs

A: freshly reproduce eight failures; inspect maintained releases/parser APIs,
supported strict ingress integration, both Rust warnings. Execute a PoC only
if maintainable; otherwise precise NO-GO without private dependency patch.

B: pinned supported Envoy image digest, executable loopback launcher/config,
whole shared corpus plus TLS/SNI, rotation, H1/H2/WS/gRPC, cancellation,
timeouts, pools, isolation and identical workload. Document xDS/SDS/Module03
adapters, migration and security limitations. Never infer safety from defaults.

C: pinned maintained Hyper/Tokio/TLS PoC, whole shared corpus and functional
suite, bounded bodies/timeouts/cancellation, dependency scan and ownership/gap
matrix. Parser success alone cannot grant GO.

Every agent records exact commands, actual results and immutable hashes in
its report/evidence, commits reviewable source and sends root the commit.
Root/E independently reruns candidates, checks exclusions and critical/high
findings, integrates safe PoCs/evidence after checks and prepares proposed ADR.
Any required property failure means NO-GO. Human decision follows evidence;
it does not turn an incomplete proof into an affirmative gate.
