# Sprint05A F final integration review

Scoped independent review complete. ACCEPT the exact B/C/E research and
regression additions, corrected D collector, and static gate-helper reuse below.
ACCEPT the specific A/D assertions preserved by the combined candidate.
REJECT complete ingress/runtime eligibility and C's H2 repair. Module01 remains
NO-GO; Modules04-12 LOCKED; production BLOCKED. Root local/security gates,
exact-head/main hosted CI and affirmative human architecture/security decisions
remain separate and pending for the final integration.

## Exact inspected sources

Only `/tmp/aegisgate-05a-final-review`, branch `review/sprint05a-final`, was
modified. Starting root assembly was `c07979f451b62c2085d51ac52163ec631be5b8f0`.
The following exact hashes were merged into this review branch for inspection
only; no main/root branch, original evidence, production file or other worktree
was edited. No workers, external publication or push were used.

| Component | Exact reviewed commit |
| --- | --- |
| A, already staged by root | `9391ba922bc8daa2c68c86bb5e770d8685b6a4d7` |
| B strict parser | `133d3eae70fa6dfe6b27ee0b4ca0ce08b8d44dcf` |
| C H2 experiments | `d4fc4b1460d846142c05beb854697efe89a10352` |
| E regressions | `a0012829bc3cd3196a69efd21c53a9605e7569f6` |
| D corrected cleanup | `c698a4af61195aad5a8a80d2b8d0d090f0f1d068` |
| Combined A/D candidate | `8d293c8ad7ab5c2deaac868462913243852adde7` |
| Gate-helper parameterization | `47f0cd558c88d1eac0883527cbb86edd259ad9cc` |
| Immutable independent F evidence | `acec5e67c46cd703145ee8ed13ee731b8db57a0d` |

Inspection merges produced `2e387add587123dd79c84cea767bca8579d2ba5b`.
Review source was committed before verification: initial `51cfbb4`, corrected
`a1b17c9c09818add4cefc685f559366cd5f25246`, tree
`9b33fd6b0e03f0a64a1e3b18383c3e47844dbdc0`. The later F worker's changing
worktree was not used as an evidence authority: reused F runtime bytes were read
directly from immutable `acec5e6` Git objects. Its later report does not change
this independent review's scope.

## Findings and dispositions

| Component or repair | Exact observed result | Verdict |
| --- | --- | --- |
| A invalid TE, repeated chunked, chunked not final, repeated TE fields | Four original assertions PASS; retained independent full75/focused proof and combined proof agree | ACCEPT these four repairs |
| A obsolete folded header | Combined: 1 origin handler, 263 decrypted bytes | REJECT repair |
| C H2 authority/Host/SNI aggregate-zero assertion | C69/75 and combined73/75 retain 9 bytes, 0 handlers, 0 parser errors | REJECT repair |
| B released llhttp folding rejection | 22 wire observations, 10/10 folding rejections, 24 direct parser controls; two exact original requests reject | ACCEPT narrow research capability |
| B complete maintained ingress/runtime | Whole-message buffered Node/subprocess adapter; mandatory breadth unproved | REJECT complete-runtime claim |
| C failed strategies and lifecycle diagnostics | Original failure retained; 7/7 independent lifecycle controls | ACCEPT failed experiment/report |
| D uppercase and connection-specific H2 headers | Original23 PASS, peer RST_STREAM1 PROTOCOL_ERROR; five origin counters zero | ACCEPT two repairs |
| D paused-reader/cancellation | Selected original assertion PASS; bounded producers plateau at196608 bytes and cancel upstream | ACCEPT bounded behavior; REJECT deterministic baseline-failure claim |
| D two userinfo cases | Original operation deadlines remain failures | REJECT repairs |
| D HEADERS stream0 and zero WINDOW_UPDATE | No required peer error-frame evidence | REJECT repairs |
| D corrected collector | Mount-only ownership inspection and removal wait; corrected attempt03 completes17 observations and cleanup | ACCEPT isolated collector correction |
| E actual00/02/03 local regressions | 64 commands,128 raw slices;11 Go packages,88 top-level tests,151 subtests,0 skips | ACCEPT local regression proof |
| Root helper | Exact four-hunk sprint/project parameterization | ACCEPT static reuse only |
| Combined | Independent and root73/75,19/23,17 observation controls | ACCEPT preservation of scoped A/D improvements; REJECT eligibility |

No new blocking integration defect was found in the requested exact B/C/E or
cleanup changes. Root may integrate these scoped research/report changes and
continue its separate gates. The remaining mandatory failures cannot be waived
by this review. Findings were written while reviewing to
`/tmp/aegisgate-05a-review-findings.md` for root's immediate use.

## Parser provenance and limits

B pins released llhttp9.4.4, official release revision
`816485216511b86459b2e6478190e14c38c14891`, generated C SHA256
`f3ef756529b7444630717fa5540d4a1c9a1256874bda823c49c5a99c37f89429`,
header SHA256 `52a7011f979b31f761403c1a333bf7fc26dc70f5745d8488eed1609c92097100`.
The independent verifier rehashes the cached official files against all22
retained download pins. Upstream sources are unpatched; the C driver uses
released callbacks, error positions and message-complete pause/resume APIs.
Strict header syntax remains enabled, including tests with the separate relaxed
header-value API. Folding-token errors occur immediately after original CRLF,
before the continuation byte; callback spans stop before that byte.

The two exact original folded requests are checked against the protected
manifest. The delayed malformed trailer has zero bytes/connections/handlers
before its final fragment. Mixed valid/invalid pipelining retains52 actual valid
origin bytes and ordered200/400; this is not an aggregate-zero interval.
Observer calibration, peer closure and all-byte counters are retained.

The adapter waits for complete messages and trailers, forwards unchanged byte
slices, caps pending input at32KiB and reparses buffered fragments through a
subprocess. This proves the tested admission boundary only. That pending-input
cap does not establish bounds on all admitted queued messages, connections or
fragmentation CPU cost. Streaming bodies, cancellation, WS/gRPC/H2, tenant/SNI
policy, complete TLS negatives, sustained resources and performance remain
unproved. It is test-only and is not accepted as a production parser assembly.

Envoy1.40.2/Balsa's retained continuation setting still accepts folding;
Nginx1.30.6 rejects folded headers but discards malformed trailers, and fails the
unchanged valid encoded-NUL control. The unsupported Envoy validator extension
start and other failed attempts remain visible. Released pins demonstrate
provenance and maintenance activity, not exhaustive advisory approval.

## H2, cleanup and unchanged contracts

C's passive capture in the exact original interval is
`000000040100000000`, SETTINGS ACK, SHA256
`a9fd441cc14ae4b467f3ea0a0ed70de71bb5834db34815eca9cceb70017adfd6`.
It remains a failure. No counter subtraction, settling delay, protocol downgrade
or acceptance change is allowed. C's diagnostic warm reuse/generation/trust
controls do not replace the original test timing or signed Module03 integration.

D's exact cleanup diff replaces full Docker-object reads with
`inspect --format {{json .Mounts}}`, filters ownership by this worktree's
absolute `.local/` prefix, records IDs, and waits up to5s for removal. Setup,
capture, cleanup and hashing remain locked. Corrected source SHA256 is
`3880a6574ae6f55df3d17ce6c19ac9b4ea68071f922baffbbc4e22be0f096560`.
Attempt03 uses exactc698a4a, completes17 controls, records cleanup/collection
completion and keeps `semantic_security_pass=false`. It had no fallback owned
containers to stop; asynchronous fallback removal is inspected code, not a
fresh fault-injection result. The earlier broad collector remains rejected.

The helper's four changes select04C/05A evidence paths, Compose project and both
project-label filters. Cleanup steps and security gates are otherwise unchanged.
SHA256 `2759773257053d1c811b3778e09a9db0a4a3eccd645df296f721c453bb5ebc05`.

All4003 baseline objects were compared against immutable main
`541d1d915ce6a3b679dc3fed3ea0a98f908ce001`, tree
`89eff9430f2bb7044683eaf9e62e6657a7295a86`. Only the explicitly reviewed helper
differs;4002 objects are identical. All original75/23 sources, requests,
deadlines, evaluator, observers, historical evidence, threat model and policy
remain identical. Protected inventory SHA256 is
`4fb93b05f5fcd796bedafcc8a7bb5154e9ab7b2f2c4f046a878e83a934483662`.
`extract-baseline.mjs --check` and7 original contract/evaluator/TLS-observer tests
pass with0 skips. No duplicate full75 was executed in this review.

## E regression and dependency evidence

E source `e325d80f45147f3125ebb9ac9428420cdba348c1`, tree
`ea1b2be6aacdc38e35fa763c5ec5c8ec53fcd1b4`, precedes committed runtime proof.
The independent verifier reads exacta001282 objects, rehashes14 manifest
entries, checks contiguous offsets/lengths/SHA256 for all128 slices and all64
exits/signals, recounts Go tests from raw output, and verifies57 immutable
baseline references. It also binds all three E collector scripts to runtime
source and checks current owned container/network/volume inventories are empty.

The actual fixture, PostgreSQL/tenant isolation, NATS mTLS and signed publication/
fetch/ACK/rollback/recovery tests run with integration enabled and the race
detector. Dashboard's five commands, contract/golden checks, edge tests and
eight dependency gate operations pass. Fresh/stale-volume credential controls,
loopback/image identity, cleanup and retained secret scans are real receipts.
This review independently verifies those receipts; it does not claim a fresh
rerun of the whole E integration suite.

Strict TS7 resolution fails withERESOLVE and the released peer range
`>=4.8.4 <6.1.0`; no forced upgrade or dependency bypass occurs. The structured
Pingora audit has no ignored advisories and retains derivative2.2.0
RUSTSEC-2024-0388 and unsafe-libyaml0.2.11 RUSTSEC-2024-0449 as unmaintained
warnings. Historical image/SBOM references are not fresh advisory clearance.
No dependency, TLS or authorization setting was weakened.

## Commands and immutable receipts

All commands below were run from this worktree with the pinned Node26.13.0.
Its SHA256 is `0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`.
E receipts identify Go1.27.4 at the supplied toolchain; no Go runtime was needed
for this receipt review. Full safe argv, UTC timing, source/tree, exits, raw
outputs and hashes are in the verifier receipt. The global fixture lock covers
every local observer/scanner lifecycle, evidence capture, cleanup and hashing.

```sh
flock -w 60 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint05a-f-final-verify.mjs evidence/sprint05a-f-final/verify-01
flock -w 60 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint05a-f-final-verify.mjs evidence/sprint05a-f-final/verify-02
```

Verify01 exits1: my checker searched the dependency summary stream for warnings
stored in separate audit JSON. That failed receipt is preserved. Corrected
verify02 exits0 and reads the hash-verified structured audit. No original input,
candidate source or old evidence was altered to pass verification.

| Immutable artifact | SHA256 |
| --- | --- |
| F acec5e6 `extended-01/receipt.json` | `60f8041ddf2a3aa85e18a7df31563efd0b6bf1bbf4860ff722cced23b1eb74a7` |
| F acec5e6 `extended-01/SHA256SUMS` (194 files) | `e5452e5d7b2221f45250ce77c9dffdeac34249ae6d8b546a9fe72742e912a940` |
| Root combined `candidate-02/commands.json` | `572ad993fe7f38b58c62c0b66de81a333006b3c6ed5a332478e38f60838d273a` |
| D corrected `attempt-03/commands.json` | `06de48499ede83771f285ef2d454c301632bdf7055f747481cfbcfcb77a76933` |
| E a001282 `attempt-01/commands.json` | `c198e795572e5a36430928be892f77ee3a0c13e653b25bc29d9f0df66fff713b` |
| Final `verify-02/receipt.json` | `e74c514295a1a0d25a95fe2789a0a039b9247c0b6f8302a03aeec1edfed7bf5b` |
| Final `verify-02/SHA256SUMS` | `bbcaf325766b82ded954e60bf454d60cf28629ee81886f325541b1cf58314a72` |

Root/D attempt directories were read in place and not changed or duplicated;
their verified hashes above bind this review even before root commits those
receipts. A/D prior independent proof is reused from immutableacec5e6, including
the17/23 fresh baseline versus historical16/23 variation. The initial F full75
and subsequent exact B/C/combined reproductions are not rerun here.

A subsequent separately committed scan receipt binds this report and the new
review files to their exact report commit using offline digest-pinned Gitleaks;
its exact command, output, cleanup and hashes are delivered in
`evidence/sprint05a-f-final/HANDOFF.json`. No full root security/CI claim follows
from that scoped scan.

## Agent Completion Report

- Module/status: F independent Sprint05A final source/receipt review complete;
  scoped research/regression ACCEPTs above; runtime eligibility REJECT/NO-GO.
- Commits/files: additive owned verifier, scan runner, plan, receipts and report;
  exact component merges are review-only. Production/evidence originals untouched.
- Architecture/ADR/contracts: unchanged; no human approval supplied or inferred.
- Positive/security tests: fresh7 original tests and manifest check; independent
  receipt/source/raw-byte verification as above; full runtime receipts reused.
- Performance: bounded retained observations only; no capacity/SLO claim.
- Risks/blockers: folding, nine-byte H2, userinfo deadlines, missing H2 frames,
  complete maintained ingress assembly, sustained resources, root gates and
  affirmative architecture/security decision remain unresolved.
- Human review needed: later architecture/security and release approvals.
- Next runnable action: root integrate the scoped exact accepted changes, run
  locked full local/security gates and exact final-head/main hosted checks.
