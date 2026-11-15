# Sprint06A A Finite Ingress Hardening

Status: scoped finite container proof complete,67 controls; independent review
pending. Mandatory pre-completion streaming positive is **FAIL**. Module01 remains
NO-GO, Modules04-12 LOCKED, production BLOCKED. No contract or ADR activation.

## Measured Result

`run-07` executes clean source `5ca4e3a2de94425f766312bc8d1741a80cf515a6`,
tree `fb27874eb105cf511c22bf0345f0689e3a5932c7`. The source commit precedes
all retained execution. Collector and ingress exit0;67 controls complete, all
cleanup counters zero, private PKI/build fixture removed and container absent.
The locked lifecycle is2026-11-15T11:28:25Z through11:28:43Z for the ingress;
collector setup/hash/cleanup surrounds that interval. `run-06` independently
retains the earlier66-control container pass; no original75/23 rerun is claimed.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
 /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
 scripts/sprint06a-a-container.mjs evidence/sprint06a-a/run-07
```

Use a fresh suffix from clean committed source on the assigned branch. The
collector takes no public endpoint, publishes no port and executes all ingress,
client and origin traffic on127.0.0.1 inside the network-none container. Exact
argv, exits, stdout/stderr, image metadata, commands and per-executable hashes
are retained in `collector.json` and `receipt.json`; artifact hashes are in
`SHA256SUMS`. Node26.13.0 SHA256 is
`0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`.
All five llhttp release-file pins are verified before unchanged05C binding
compilation. All11 protected inputs/evaluators/windows match immutable8758b1c;
inventory remains85de42e7d2ac54b0f199bcced46760bec41b7687dd7c7016dd580ea4a300c1fa.

| Executed control | Observed result |
| --- | --- |
| CL10/abc shared prefix |No dial/bytes/connection/handler/parser/TLS effects before completion; seven bytes then200 exactly once, EOF400 with zero effects.|
| Chunked common prefix |Valid declared trailer200 exactly once; EOF and late folded trailer400 with zero effects.|
| Original folded header/TE, CL-TE, undeclared trailer |400,zero origin effects; original inputs unchanged.|
| Exact targets and pipeline |Encoded targets unchanged; ordered200/200,valid-invalid200/400 and invalid-valid400 preserve exact expected origin wire hashes.|
| Complete request plus write EOF |200 exactly once; no half-close regression.|
|512KiB CL/chunk uploads |Complete matching body/raw SHA256,one origin handler each.|
| Exact spool quotas |1572864 wire bytes/message,2097152 aggregate bytes,3 files; next byte/file refused; all accounting released.|
| FileHandle faults |Repeated actual7-byte partial writes complete200; injected zero-progress and EIO reject503 before origin; no file/quota leak.|
| Corrupt/truncated ciphertext |Authentication/size failure503 before any dial; normal cleanup.|
| Live hardlink, symlink replacement and unsafe mode |502 before dial, zero origin effects; owned stage path unlinked, reachable key/IV buffers zeroed. Same-UID attack limits below remain.|
| Startup/recovery |12 unsafe root/session/file/name/permission/link/size/enumeration cases refuse listener creation and preserve outside canary; SIGKILL ciphertext orphan is discarded before restart; healthy200 follows.|
| Staging cancellation |Zero origin effects, key/IV buffer wiping, ciphertext path absent, quotas released.|
| Observed hard TCP reset while queued |Two occupied origin slots remain held; server observes queue0/contexts2/files0 before release, cancelled request has zero dials and key/IV/tag buffers zeroed. Two valid held requests remain visible in raw effects.|
| Ambiguous TLS FIN |Three eventual dials are retained; no zero-dispatch cancellation claim. FIN can mean valid write EOF and is separately tested from reset.|
| Application bounds |Six live TCP connections, excess connection closed; two active origins and one queued observed; idle408 and absolute408 around2500ms; held origin504 around1800ms. Configured queue ceiling2 is not a measured two-waiter positive.|
| Verified origin TLS |Wrong name,expired and untrusted cert return502 with zero decrypted request bytes; required TLS dial is not hidden. Host/SNI421 has zero origin effects; unknown SNI handshake denied.|
| Kernel CPU cap |cpu.max=75000/100000,actual nr_throttled increase; healthy exact200 afterward.|
| Kernel task cap |pids.max64,pids.current reaches64,spawn EAGAIN and pids.events.max increase; healthy200 afterward.|
| Kernel memory cap |memory.max402653184,swap.max0,peak exactly cap,oom_kill increases1; targeted memory child SIGKILL,ingress survives and serves exact healthy200. Docker OOMKilled=true is intentionally retained.|
| Real bounded disk failure |8MiB tmpfs mount flags retained;8388608-byte filler hits actual ENOSPC; actual ingress503 and zero origin effects,healthy200 after filler removal.|
| Required streaming positive |Client waits for origin before completing chunk syntax:408 and no progress; **FAIL**, never a streaming acceptance.|

Run07 receipt SHA256:
`eaeca4930bbc002935f8c53f06122388ba31777ad3c6033312688d3955e5e66b`.
Collector SHA256:
`972980e88729788c371cc73810902f221b631ead091bf47740ba83b878cbe593`.
Artifact manifest SHA256:
`0fffc39d552fe409fdafcaffee9048e3bc2cc091a255fe66459a3511bfe0c6a2`.

## Offline Integrity And Secret Check

Verifier source `5ca4e3a` executes from clean report/evidence commit
`492a5f943004e6fe9ed22512495034a6a192b4d3`; verify01 exits0. It checks25 raw
artifact hashes across retained runs01-07,39 committed-source bindings,67
unique controls, exact positive wire hashes, zero pre-admission effects,
cgroup CPU/PID/OOM events, tmpfs ENOSPC, raw collector streams, empty cleanup
and all11 protected pins. Nine new MJS syntax checks, pinned Prettier3.9.10,
whitespace and pinned offline Gitleaks8.30.1 all exit0. The secret report is[];
private audit staging is removed under the shared lock. This is owner integrity
verification, not independent F acceptance or complete-runtime validation.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
 /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
 scripts/sprint06a-a-verify.mjs evidence/sprint06a-a/run-07 \
 evidence/sprint06a-a/verify-01
```

Verify01 receipt SHA256:
`30bb314d5b13b763433e55310a189ae0f28d407bad98a1d3646e0ea332d80b47`.
No executable source changes follow run07/verify01. Final additions only record
verification/report/evidence. No push, merge, shared source, dependency, TLS,
authorization, snapshot v1 wire, original corpus or evaluator change occurs.

## Retained Failures

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

`run-04` at `479db12` retains33 completed controls and then an EXDEV fixture
failure: the live hardlink target was on disk while its source was on tmpfs.
The attack target now stays on the same tmpfs. All cleanup counters were zero;
the stopped container was removed. No failed capture is overwritten.

`run-05` at `817d59a` completed66 controls with child/ingress exit0 and all
cleanup counters zero, but the collector retains FAIL because it incorrectly
required Docker State.OOMKilled=false. Docker correctly reports true for the
deliberately OOM-killed child even though the ingress survived and completed.
The next collector requires that true flag, the child's SIGKILL, the healthy
post-OOM request, ingress exit0 and the cgroup event deltas together.

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
- Status:complete scoped engineering proof; independent F verdict pending.
- Commits/files:initial source `eb4cfe4`; final executable source `5ca4e3a`; measured report/evidence `492a5f9`; new `spikes/envoy/sprint06a-a-*`, `scripts/sprint06a-a-*`, this report and own evidence only.
- Architecture/ADR decisions:none.
- Contracts changed:none.
- Positive tests executed:locked run07 command above,collector0/ingress0,67 controls,verified finite/exact target/pipeline/restart/resource recovery positives. Earlier run06 passes66 controls; verify01 integrity/format/syntax/secret checks0.
- Security negative tests executed:EOF/fold/trailer/tamper/truncate/quotas/write/links/startup/cancel/hardRST/TLS/CPU/PID/OOM/ENOSPC controls above; mandatory streaming positive FAIL. Failures01-05 retained.
- Performance data:not a throughput, capacity or soak benchmark.
- Known risks/release blockers:streaming/full gateway and production custody remain unproved; independent review required.
- Human review needed:existing architecture/security owners and exact-source independent review.
- Next unblocked modules:none; existing Module01 gate remains closed.
