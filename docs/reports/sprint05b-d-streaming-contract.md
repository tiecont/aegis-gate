# Sprint 05-B D Streaming And Admission Proof

Status: bounded executable counterexample complete; independent F review pending.
No complete ingress runtime or repaired original failure is claimed. Module 01
remains NO-GO, Modules 04-12 LOCKED and production BLOCKED.

## Source And Reproduction

Worktree `/tmp/aegisgate-05b-d`, branch `test/sprint05b-streaming-safety`.
Runner source `eba8445`; exact commit/tree, Node binary hash, compiler commands,
unchanged llhttp source hashes and parser addon hash are recorded in
`evidence/sprint05b-d/attempt-04/receipt.json` and SHA256SUMS. The independently
imported A builder/addon source is verified byte-for-byte against A commit
`dbb21538888de1b72ec24e29ae6a00ff7feb1255` before compilation. No A runner or
admission adapter is used. All framing decisions come from unchanged llhttp
9.4.4 through its maintained incremental C API.

Executed command, exit 0:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint05b-d-streaming.mjs /tmp/aegisgate-05b-a \
  evidence/sprint05b-d/attempt-04
```

Each scenario creates a fresh parser and verified TLS origin connection when
admitted. A separate TLS relay counts decrypted origin bytes before the native
HTTP handler. All listeners bind loopback. Known generated fixture boundaries
label header/body/trailer times; they are not a replacement framing parser.
Events retain monotonic times, parser consumption/error state, origin counters
and raw trailer hex. The counter covers the full scenario until all tracked
transports close; a rejected or cancelled streamed upload must also produce an
origin abort before the next scenario starts. Missing closure fails the proof.

## Measured Matrix

Body size 1 MiB, input feed 16 KiB, stage cap 2 MiB and full experiment watchdog
30 seconds. The origin pauses each read for 2 ms. Stream mode forwards accepted
prefix pieces; stage mode replays only after complete framing/trailer validation.

| Mode / input | Origin bytes | Dials / handlers | Body before completion | Outcome |
| --- | ---: | ---: | --- | --- |
| Stream valid | 1,049,229 | 1 / 1 | Yes | Full 1,048,576-byte body received |
| Stream late folded trailer | 1,049,201 | 1 / 1 | Yes | llhttp rejects; earlier origin effects remain |
| Stream cancellation | 32,897 | 1 / 1 | Yes | Origin upload abort observed |
| Stage valid | 1,049,229 | 1 / 1 | No | Full body forwarded only after completion |
| Stage late folded trailer | 0 | 0 / 0 | No | Strict rejection before admission |
| Stage cancellation | 0 | 0 / 0 | No | Private stage discarded before admission |

The malformed trailer is `0\r\nX-Proof: first\r\n second\r\n\r\n` and rejects
with `HPE_INVALID_HEADER_TOKEN`. The streamed prefix has already reached the
origin. This demonstrates an incompatibility for this specific admission design:
origin progress before final trailers cannot also guarantee zero origin bytes
for a subsequently malformed trailer. It is not a universal impossibility claim
for all protocols or architectures, and does not revise the current contract.

Stage replay holds at most a 16 KiB read chunk plus bounded TLS queue, copies
each reusable read buffer before asynchronous TLS writes, and waits for drain.
The maximum stage file is 1,049,229 bytes in these cases; configured cap is 2 MiB.
Sampled whole observer-process RSS peaks at 72,564,736 bytes. This includes TLS,
native servers and runtime; it is neither an isolated parser RSS measurement nor
a hard process memory limit. No capacity/soak claim follows. Native parser state
is 344 bytes; no body is retained there. Six scenarios finish with zero active
parsers and no private fixture/stage material, under the shared lock.

## Retained Failed And Superseded Attempts

- Attempt 01: strict compilation fails on A's nonexistent version macro; no wire
  result. The upstream header is unchanged; A fixes its wrapper to use released
  numeric version macros.
- Attempt 02: three stream scenarios run, stage replay resets because a reused
  read buffer was overwritten while TLS writes still referenced it. Exit 1;
  retained. The correction copies each bounded chunk before asynchronous write.
- Attempt 03: all six execute, but late bytes from an aborted preceding scenario
  contaminate the next scenario's counters. Its apparent completion is not
  reliable attribution. Attempt 04 supersedes it by requiring abort and complete
  tracked transport closure between scenarios. No old evidence is rewritten.

## Gate Implications

This is an additive test-only H1 ordering experiment. It does not change the
original 75/23 inputs, evaluators, expectations or measurement windows. It does
not implement H2, WebSocket, gRPC, tenant authorization, signed generations,
production spooling, crash recovery or a new accepted trust boundary. A's finite
admission staging needs its own exact-input wire reproduction and F review.
B's H2 original observer/causal timeline and C's original probes remain separate
evidence; no H2 ACK is ignored or subtracted here.

The next action is to review a maintained ingress integration that specifies
how late-invalid requests and valid indefinite streaming are admitted. Any finite
staging design must expose its size/deadline/disk policy and prove required valid
controls rather than silently treating staging as complete streaming support.

## Agent Completion Report

- Module/status: Module 01 feasibility, bounded counterexample complete.
- Code: additive six-scenario runner; no production implementation.
- Contracts/ADR: unchanged, no human approval recorded.
- Positive tests: valid staged/streamed body and cancellation controls execute.
- Negative tests: strict folded trailer rejection measured before/after admission.
- Risks: streaming versus zero-byte late-rejection conflict in the tested design;
  full H2/identity/stream/resource proof still required.
- Human review: no production or architecture acceptance implied.
