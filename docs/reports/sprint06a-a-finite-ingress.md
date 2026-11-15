# Sprint06A A Finite Ingress Hardening

Status: executable source prepared; measurements pending. Module01 remains
NO-GO, Modules04-12 LOCKED, production BLOCKED. No contract or ADR activation.

`run-01` at source `eb4cfe4` is retained FAIL before traffic: the mounted host
OpenSSL binary could not read `/etc/ssl/openssl.cnf` in the image. Container
removal and protected-file checks completed. The next source adds a read-only
mount of that public configuration; no TLS verification policy changes.

`run-02` at `de7b60a` is retained FAIL before container creation: the prior
empty tmpfs mountpoint remained and exclusive mkdir rejected it. The collector
now permits only an existing empty0700 directory; no fixtures were active.

`run-03` at `b1a0e37` is retained FAIL before traffic: this OpenSSL rejects
negative x509 `-days`. Expired fixtures now use the established bounded CA
start/end-date mechanism from the unchanged wire fixture helper.

## Declared Experiment

| Field | Declaration before execution |
| --- | --- |
| Failure |05D finite staging did not measure actual cgroup caps, real ENOSPC or live link/write/key fault coverage.|
| Hypothesis |Complete validation and authenticated bounded staging can reject these faults before origin effects within an actual resource-limited container.|
| Mechanism |Unchanged released llhttp9.4.4/05C binding, Node AES-256-GCM/FileHandle, new06A spool, Docker cgroupv2 and bounded tmpfs.|
| Minimum |Original folded input, identical CL10/abc and chunk prefixes followed by EOF/fold, quota/write/ENOSPC/link/cancel/key/SIGKILL/restart tests.|
| Positive |Complete valid requests exactly once with verified TLS, exact targets/pipeline wire hashes, healthy after kernel throttling/PID/OOM/disk failures.|
| Stop |Pre-completion streaming positive executes and must remain FAIL. No full gateway, signed config/auth/SSRF, H2/WS/gRPC or production custody claim.|

## Executable Plan

1. Commit only new06a-prefixed sources and this report before execution.
2. Run `scripts/sprint06a-a-container.mjs` under the full-lifecycle shared flock.
   Its container runs the real finite TLS ingress, clients and verified origins
   on127.0.0.1 in `--network=none`, without published ports. Source and host
   toolchain are mounted read-only; private build/PKI/TMPDIR use worktree.local.
3. Enforce384MiB memory/no swap,0.75 CPU,64 tasks and8MiB dedicated staging
   tmpfs. Prove actual CPU throttling, PID refusal, memory-hog OOM kill and
   disk ENOSPC; require healthy exact-once ingress after each.
4. Preserve raw streams, exact committed source/tree, all tool/build/container
   argv, exits, hashes and cleanup; retain failed captures. Check all11 pinned
   protected files and73/75,19/23 historical references before and after.
5. Report exact measured controls and limits. Independent F review is separate.

## Boundaries

The new runtime preserves the05D finite interface and parser/TLS logic;05D
sources remain unchanged. Only its new spool adds full bounded startup inventory
validation before deletion, file descriptor/path identity checks before admission,
positive-progress partial-write handling, and explicit key/IV/tag buffer wiping.
Optional `spoolOptions.write` is a test-only I/O injection API. B may retain the
reviewed05D boundary; no signed-policy hook or unified boundary is claimed here.

The container uses the host PID namespace solely to verify the live outer shared
flock through `/proc/locks`; its network, mount and cgroup namespaces remain
separate. It runs as current UID, without capabilities, with no-new-privileges
and a read-only root. This is a lab resource harness, not hardened production
process isolation. Same-UID concurrent hostile modification, OS/OpenSSL/GC key
copies, secure physical erasure, swap/provider snapshots and production key
custody remain unproved. Normal cleanup unlinks ciphertext and zeroes reachable
JS key/IV/tag buffers; crash recovery discards bounded ciphertext orphans and
never resumes requests because ephemeral keys were never persisted.

## Agent Completion Report

- Module:01, Sprint06A A.
- Status:partial, tests pending.
- Commits/files:new `spikes/envoy/sprint06a-a-*`, `scripts/sprint06a-a-*`, this report and own evidence only.
- Architecture/ADR decisions:none.
- Contracts changed:none.
- Positive tests executed:pending.
- Security negative tests executed:pending.
- Performance data:not a throughput, capacity or soak benchmark.
- Known risks/release blockers:streaming/full gateway and production custody remain unproved; independent review required.
- Human review needed:existing architecture/security owners and exact-source independent review.
- Next unblocked modules:none; existing Module01 gate remains closed.
