# Sprint04-C F independent helper repair review

Verdict: **ACCEPT** exact helper repair
`578d78f3465d5a4cbb9587a0e03be975b33cd1c9` for the scoped cleanup-continuation
and failure-receipt requirements under a continuously held fixture lock.
This supersedes the helper rejection in `sprint04c-f-final-review.md` only for
this replacement source. Rejected `cb9c30904e3430793d9847d9b9bf3eec3a8d052f`
remains rejected. No full local gate, hosted CI or runtime candidate is accepted.

## Findings and limits

The prior P1 is repaired: `scripts/sprint04c-gates.mjs:71` guards each cleanup
stage, and line192 guards each removal independently. Docker cleanup/inventory,
evidence-copy and private-validation faults no longer bypass the other private
removal attempts or final failed receipt while the fixture lock is held.
No blocking finding remains within that repair scope.

P3 residual: `scripts/sprint04c-gates.mjs:48` opens stream descriptors before
`spawn`, and line56 closes them only after the awaited child result. A
synchronous mocked spawn exception leaves two descriptors open and omits that
command from `receipt.commands`; the outer error or labeled cleanup error still
records the failure. Four synthetic cases reproduce this bounded process-lifetime
residue. Actual child `error` events close descriptors correctly. This does not
reproduce the private-cleanup bypass and is not an acceptance claim for descriptor
exception safety. No production change was made by F.

Lock-loss boundary: missing lock at entry aborts before creating output or
running commands. Simulated lock loss before cleanup prevents all later fixture
operations and final `assertLock` aborts with no complete receipt/manifest or
success claim; private files remain in that invalid-lifecycle case. The repair
does not promise cleanup after ownership is lost. The real `assertLock` source
was inspected, but this review mocks it. Real shared scanners/fixtures still
require full lifecycle `flock /tmp/aegisgate-sprint02-fixtures.lock`; no actual
flock, scanner, Docker or shared-fixture action was exercised here.

Receipt or manifest storage failures, abrupt termination, real permissions,
Docker daemon behavior, filesystem links and adversarial exception-message
redaction are outside this synthetic verification. Deliberately contaminated
synthetic streams are validated in memory only; the retained proof exports
receipt structure with their hashes removed. Failed validation does not sanitize
already contaminated evidence; such evidence remains ineligible for publication.

## Independent coverage

F extended `evidence/sprint04c-helper/cleanup-test.mjs` without changing helper
source text, original corpus inputs, expected results or evaluator semantics.
The VM links only explicitly allowed synthetic modules, uses an in-memory
filesystem and mocks all helper children. The collector's real children are
only local Git and the specified Node binary. Work was confined to
`/tmp/aegisgate-04c-cleanup-review`; no other worktree was used or coordinated.

| Cases | Observed result |
| --- | --- |
| Clean control (1) | exit0; passed true; all eight paths absent; empty three inventories |
| Fixture-value / key-marker validation failures (2) | exit1; labeled validation errors; cleanup and final receipt complete |
| dev-down / Compose cleanup: synchronous throw, child error event, nonzero exit (6) | exit1; remaining cleanup attempted; error/exit preserved |
| Container / network / volume inventory: exception or nonempty IDs (6) | exit1; unknown inventory is absent, never invented empty; remaining stages complete |
| Evidence directory creation / listing / copy exceptions (3) | exit1; labeled error; all private paths removed |
| Private validation read exception (1) | exit1; labeled error; removal continues |
| Each of eight private-path removals throws (8) | exit1; failed path remains; other seven attempted and removed; failed path named in errors |
| Removal silently leaves PKI present (1) | exit1; exists true in cleanup receipt |
| Primary check nonzero / synchronous throw (2) | exit1 survives later successful cleanup |
| Combined independent failures (1) | exit1; all seven expected error labels retained; other removals attempted |
| Missing entry lock / lock lost before cleanup (2) | expected abort; no falsely finalized success or manifest |

All 31 held-lock cases finalize `commands.json`, `ended_at`, failure/success
status and `SHA256SUMS`. Assertions verify every manifest entry, stream digest,
command result and removal order. Every fixture stage requires a fresh successful
mock guard, including each removal and final receipt; the clean control executes
25 lock assertions. Unrelated sentinels survive. Copy filtering admits only the
three safe synthetic JSON/log/TSV outputs, excluding rendered Compose and other
extensions. No injected fixture value appears in console or receipt.

## Exact provenance and execution

Helper commit: `578d78f3465d5a4cbb9587a0e03be975b33cd1c9`.
Helper tree: `77e863b3e912e496b5b7d02fe0644fe18bd84407`.
Helper blob: `4a5400dfab224f6797a63a25fa2fc0421e2c79b0`.
Helper SHA256:
`052922dd93c87ee9f5aae99d27cd6b283562549cbc65d0a8e628809c57da59bd`.

F committed the verifier before recorded execution at
`9f7eef62903fdbaf82b8fecc6fd4becf6d7fb061`, tree
`04694a2141e01c3fe63654c7ac6e528f4f918c6e`; the worktree was clean at start.
Source hashes for harness, collector and inspected lock implementation are in
[`verification.json`](../../evidence/sprint04c-f/cleanup-01/verification.json).
The checkpoint differs from the repair only in the extended harness and new
collector. Final additions are this report, the README note and new evidence;
the helper and original corpus remain untouched.

Node v26.13.0, OpenSSL3.5.9, V8 14.6.202.34-node.40; Git2.56.1.
Node binary: `/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node`.
Binary SHA256:
`0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`.
Full `process.versions`, exact argv/cwd, UTC times, byte lengths, stream SHA256s
and exits for all eight collected commands are in the receipt. Recorded interval:
2026-11-14T09:40:44.410Z through 2026-11-14T09:40:45.086Z.

At the clean verifier checkpoint, the exact collector command was:

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04c-f/review-cleanup.mjs evidence/sprint04c-f/cleanup-01
```

Exit0. The collector refuses existing evidence or a dirty source tree; its
source-scope assertion binds it to that checkpoint. On the final review commit,
the direct synthetic test remains runnable without regenerating old evidence:

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node --experimental-vm-modules evidence/sprint04c-helper/cleanup-test.mjs
sha256sum --check evidence/sprint04c-f/cleanup-01/SHA256SUMS
```

Both executed with exit0. Syntax checks for helper, harness and collector,
Node/Git version collection, source-scope diff and whitespace check all exit0.
The only recorded test stderr is Node's expected experimental VM Modules warning.
An earlier unrecorded development run exited1 due to comparing object prototypes
across VM realms in the test mock; property assertions corrected that harness
error before the committed verification. It was not a helper regression.

Raw stdout SHA256:
`61bc23d4ba1b4b47347acad64f93e5cf354afa67da1d70170844dec2efc5981c`.
Receipt SHA256:
`a972d0e8201ec2e4c28be25a0e4239c7e673db027f0fe2bf9a90e23cb42ed085`.
[`SHA256SUMS`](../../evidence/sprint04c-f/cleanup-01/SHA256SUMS) covers all17
retained raw/receipt files; all17 verified. Manifest SHA256:
`bd84b255144f12f0c3f77e79090696c496acdb3579e77e053b5768169d5eccee`.

## Agent Completion Report

- Module: Sprint04-C independent security reviewer F; exact helper repair only.
- Status: complete scoped ACCEPT; full integration/hosted acceptance pending.
- Commits/files changed: verifier checkpoint9f7eef6; extended synthetic test, collector, cleanup-01 raw evidence, README note and this report. No push.
- Architecture/ADR decisions: none; no runtime or security-contract approval.
- Contracts changed: none; original corpus/evaluator unchanged.
- Positive tests executed: clean synthetic control, syntax/provenance/manifest checks; exact commands and exit0 receipts above.
- Security negative tests executed: 30 held-lock failure cases plus two expected lock aborts; all assertions pass with harness exit0.
- Performance data: none; synthetic tests establish no performance claim.
- Known risks/release blockers: residual descriptor limitation and scope boundaries above; real local gates/hosted CI remain pending. Module01 NO-GO, Modules04-12 LOCKED, production BLOCKED.
- Human review needed: architecture/security decisions and release signoff remain pending.
- Next unblocked modules: no downstream module opened by this helper review.
