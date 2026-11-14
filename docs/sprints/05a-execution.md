# Sprint05-A execution contract

Immutable refreshed main: `541d1d915ce6a3b679dc3fed3ea0a98f908ce001`, tree
`89eff9430f2bb7044683eaf9e62e6657a7295a86`. Engineering and isolated PoCs are
authorized. Runtime architecture/security approval remains separate and pending.

## Ownership

| Agent | Worktree | Branch | Exclusive additions |
| --- | --- | --- | --- |
| Root | /tmp/aegisgate-05a-root | sprint/05a-integration | integration, gates, status/risk/completion |
| A | /tmp/aegisgate-05a-a | fix/sprint05a-envoy-te-rejection | sprint05a-a/TE candidate, runner and report |
| B | /tmp/aegisgate-05a-b | feat/sprint05a-strict-parser | sprint05a-b/strict parser PoCs and report |
| C | /tmp/aegisgate-05a-c | fix/sprint05a-h2-identity | sprint05a-c/H2 policy candidate and report |
| D | /tmp/aegisgate-05a-d | fix/sprint05a-protocol-limits | sprint05a-d/supplemental candidate and report |
| E | /tmp/aegisgate-05a-e | test/sprint05a-regressions | sprint05a-e/regression receipt and report |
| F | /tmp/aegisgate-05a-f | review/sprint05a-security | independent reproduction and verdict |

Read the user Sprint05-A task in full plus repository operating rules, required
module/security/architecture documents and prior04C implementation/proof before
editing. Use additive filenames owned by the agent. Preserve all baseline
source/evidence and original tests. Commit source before collecting runtime
proof; commit compact receipts separately. Never put private keys/tokens or
fetched website HTML into evidence. Do not push or merge component branches;
root integrates independently accepted commits. File-based handoff includes
exact component head, commands, results and unresolved findings in each report.

Three active workers maximum alongside root. A/B/C have first priority; D/E/F
run as capacity becomes available. Runtime fixtures necessarily serialize under
`/tmp/aegisgate-sprint02-fixtures.lock`; the lock covers setup, test, capture,
evidence hashing and cleanup. Use unique Compose/container/project names,
dynamic network discovery and loopback listeners only. No nested lock deadlock.

## Protected test inventory

All baseline tracked objects are protected unless a reviewed change is scoped
explicitly. In particular, do not edit `spikes/edge-comparison/`,
`spikes/pingora/lab.mjs`, `spikes/envoy/{config.mjs,recovery-config.mjs,
recovery-launcher.mjs,wire-probes.mjs,wire-fixtures.mjs}`, historical evidence,
threat model or acceptance policy. Candidate wrappers may import these sources.
`extract-baseline.mjs --check` and baseline object/hash equality are mandatory.
Root records the protected inventory/hash before runtime changes.

Original75: previous Pingora63/75, Envoy69/75, Hyper70/75. A must run the
unchanged evaluator using a separately named TE candidate. Target four TE
failures, exact input/expected assertions, real peer close, cold/reused cases,
upstream501 and encoded/pipeline controls. Do not assume73/75 until measured.

B targets actual pre-normalization folding/trailer rejection using released
maintained APIs, at most two new credible runtimes concurrently. No private
production parser/fork, raw framing scanner or normalization repair. Run targeted
proof before full candidate expansion. C preserves the original H2 nine-byte
negative, timing and all-byte counters. Supported pool/policy changes must retain
valid reuse/resource controls; a SETTINGS ACK is still a failing origin byte.
D reruns original23 expectations (previous16/23), classifies each old failure
and only calls a repair when that original assertion passes. E tests actual
00/02/03 integration, isolation, recovery and supported dependency policy.

## Acceptance and integration

F independently reproduces every repaired claim from clean exact sources,
checks75/23 immutability, real origin/transport/parser evidence and dependency/
secret policy, and emits scoped ACCEPT/REJECT. Root integrates sequentially,
runs complete locked `make check`, `make security-scan` and lifecycle cleanup,
then verifies both hosted jobs on exact final PR head and merge commit.

Evidence identifies source commit/tree, tool versions, argv/environment where
safe, timestamps, exit codes, raw results/failures and SHA256. Reuse baseline
evidence by immutable references rather than copying large duplicate packages.
Retain unsuccessful attempts with explanations; incomplete capture is never
security PASS. Small receipt harnesses may be added; gates cannot be waived.

Module01 remains NO-GO until unchanged75 plus all mandatory protocol/resource/
identity/TLS/config proof, maintenance and independent review, local/hosted
gates and actual affirmative human architecture/security decision. Modules04-12
remain LOCKED; production BLOCKED. No external publication/public listener/DNS/
billing or production implementation. Completion must report measured before/
after failures, exact sources, reviewer decisions, gates and next runnable action.
