# Candidate-neutral edge proof

Isolated loopback experiments only. The production edge is unchanged.

`manifest.json` preserves the exact32 raw negative inputs, six encoded targets,
all65 test IDs and eight failures from baseline668b8d9. Reproduce its source
binding using `node spikes/edge-comparison/extract-baseline.mjs --check`.
The original source is retained in Git at the recorded commit/hash. The shared
runner uses the existing lab fixtures and expectations, now fed by this manifest.
`supplemental.mjs` adds nine header/pipeline negatives and a valid encoded
pipeline control. Every candidate runs all75 cases; there are no exclusions.

```sh
node --test spikes/edge-comparison/contract.test.mjs
flock /tmp/aegisgate-sprint02-fixtures.lock env PINGORA_SPIKE_PROFILE=release \
  .local/toolchains/node/bin/node spikes/edge-comparison/run.mjs
```

For other candidates, set `AEGIS_CANDIDATE_NAME`, an absolute executable in
`AEGIS_CANDIDATE_COMMAND`, and optional JSON array `AEGIS_CANDIDATE_ARGS`.
The executable receives `manifest-path port`; SIGTERM must stop its children.
`AEGIS_RUN_ROOT` sets an existing absolute owner-only output directory for
per-agent fixture isolation. Defaults to the root worktree's ignored `.local`.
`AEGIS_CANDIDATE_ARTIFACTS` optionally names additional absolute files (JSON
array) whose hashes must be included, such as the proxy binary and Cargo lock.
`AEGIS_CANDIDATE_ROOT` changes only the default binary location, not test inputs.
All candidates receive the same atomic manifest updates, CA, origin targets,
certificate files, trust changes, route generations and weighted backends.
Implementations must not inspect the corpus to special-case requests.

The runner records binary/launcher hashes, manifest/source hashes, tool/environment
details, HTTP bytes/status/close behavior, exact origin targets, handler count,
decrypted bytes and parser errors. Zero handlers or a502 cannot conceal forwarding.
Missing or duplicate tests fail inventory validation. A setup fatal is an
incomplete failed proof, never a partial PASS. Existing functional requirements
remain mandatory even if a parser passes every negative.

The baseline reference workload is100 warmup, five seconds, eight concurrent
clients,90% GET/1KiB and10% POST/32KiB, verified TLS on both hops, keepalive.
It is a local smoke comparison, not production sizing. Resource sampling must
include actual proxy processes; adapter-only PID statistics are not valid Envoy
resource evidence. Candidate reports must identify children/container PIDs and
record any measurement gap. No GO or performance ranking follows from incomplete
resource/functional evidence.

Root's first shared-harness reproduction, before supplemental additions, is
`evidence/sprint03a-d/pingora-baseline.json`:57/65, identical eight failures.
Relative-form bytes are190 in this ordering (generation1 rather than19); the
security invariant remains zero bytes and the case fails unchanged.
