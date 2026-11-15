# Sprint06A F Independent Security Review

Status: scoped independent A/B/C/D/E component review complete, all final tracks
ACCEPT within the limits below. Full exact integration gates remain pending.
Module01 NO-GO; Modules04-12 LOCKED; production BLOCKED. RuntimeComplete and
RuntimePass remain false. These component verdicts issue no architecture signoff.

| Track | Exact Executable / Final Source  | Final Verdict                                            |
| ----- | -------------------------------- | -------------------------------------------------------- |
| A     | 73d8f41 /20e4d29                 | ACCEPT finite67 + F29; streaming FAIL                    |
| B     | 260dc7f /e18922a                 | ACCEPT tagged signed multi-hop experiment                |
| C     | 2788cd6,4d3b6fa,45c1a7b /0bce723 | ACCEPT scoped official API stop/local package            |
| D     | 69a3be8 /716780c                 | ACCEPT corrected bounded correlation; runtime INCOMPLETE |
| E     | 27cdf2c /6a8280e                 | ACCEPT inactive proposed decision; approval PENDING      |

## Executable Plan

F owns only new06a-f scripts, this report and evidence/sprint06a-f. All writes
and disposable clean clones remain in the designated F worktree. Fixture setup,
test execution, capture, artifact hashes and full cleanup hold the shared flock.
Sources are committed before evidence; TMPDIR is disk-backed under F .local.

1. Clean replay D source406d560/finalba54e45, including unchanged05C/05D and F
   regression overlays. Independently challenge omitted dispatch/request,
   stream aliases, nonce binding, incomplete HPACK, final response, capture loss,
   MAC tamper, orphan DATA and coherent trusted-signer rewriting. Verify the
   actual no-request and denial-overlap nine-byte SETTINGS ACK from raw bytes.
2. Offline audit C source2788cd6 and official metadata881af7d, exact source,
   receipt/raw hashes, historical references and generated package. Distinguish
   unexecuted diagnostic code from actual maintainer-ready protocol evidence.
3. Review A/B final clean sources once available, preserving encrypted-stage,
   TLS, tenant/generation/auth boundaries and snapshot v1. Independently replay
   relevant positives and security negatives. No unreviewed profile activation.
4. Review E proposed decision and final root integration evidence, including
   actual locked Module00/02/03 gates when supplied. No gate claims in advance.

| Failure                    | Hypothesis                                                                                  | Mechanism                                                 | Minimum                                                                                    | Positive                                     | Stop                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------- | ---------------------------------------------------- |
| False correlation          | Unmapped effects and aliased identities cannot pass bounded consistency                     | Public maintained Framer/HPACK and independent Go overlay | Missing dispatch, orphan request, same-block alias, nonce/HPACK/response/capture mutations | Honest transcript, prior suites, real TLS421 | Preserve failed mutations and runtime incompleteness |
| Unsupported upstream claim | Official release metadata and retained source support only their exact API scope            | Offline structured receipt/hash/code audit                | Raw API response and vector/rejection-contract binding                                     | Exact immutable historical references        | Unexecuted replay is not executable evidence         |
| Unsafe finite admission    | Complete validation and authenticated immutable generation prevent rejected-message effects | Clean A/B source and existing maintained APIs             | Fault/resource/identity/generation attacks                                                 | Valid complete request exactly once          | Streaming remains FAIL; no runtime GO                |

## Current Verdicts

**D REJECT** exact executable source `406d560`, final report/evidence `ba54e45`:
the new bounded consistency check still accepts four independently forged
coverage/identity transcripts. RuntimeComplete/RuntimePass/Module01Pass remain
false, so these are research consistency defects, not a demonstrated active
gateway bypass.

Clean reviewer source `7694b61` runs D's exact proof unchanged: exit0. Its
original05C/05D tests and both historical F overlays pass. F independently
compiles a fresh race-enabled binary using an overlay and runs all suites:
exit1 solely for four new negative subtests. Capture
`evidence/sprint06a-f/d-independent-01` preserves every raw stream, binary hash,
source/tree/argv/exits, both11-pin inventories and cleanup. All tracked bytes
match after execution; the disposable source/build stage is removed under lock.

| F challenge                                                            | Actual bounded consistency | Expected |
| ---------------------------------------------------------------------- | -------------------------- | -------- |
| Extra untagged complete upstream HEADERS on stream99                   | true                       | false    |
| Extra untagged complete downstream HEADERS on stream99                 | true                       | false    |
| Both accepted probe/nonce identities inside one upstream HEADERS block | true                       | false    |
| Both accepted probe identities inside one downstream HEADERS block     | true                       | false    |

The field-to-stream maps count identities, while the wrapper checks repeated
HEADERS stream IDs. Neither checks that every request block carries exactly one
appropriate identity or that each identity occupies its own distinct stream.
The alias cases retain unrelated completed responses to satisfy cardinality.
This reproduces the class of false bijection that the new wrapper aims to close.
Suggested repair belongs to D: require exact per-block correlation field counts,
account for every decoded request block, and verify a bijection between unique
request stream IDs, events and completed response stream IDs. Keep general
protocol and authoritative runtime claims explicitly out of scope.

F's16 cases include honest and coherent trusted-signer rewrite positives;
omitted dispatch/request, old repeated-HEADERS alias, nonce swap, incomplete
HPACK, forged final response, capture loss, orphan DATA, duplicate capture and
MAC tamper reject correctly. Old assessRuntime still returns true for the
historical alias/orphan-DATA cases, as expected; the06A wrapper rejects those.

Both fresh actual ACK observations retain hex `000000040100000000` at offset79,
zero origin request HEADERS,88 total client-to-origin bytes and24 reverse bytes.
Downstream request counts are0 and1 respectively; the latter completes a real
421 denial. Capture loss is false, readers join, aggregate verdict stays FAIL.
These observations and the precise public API stop are supportable separately
from the rejected bounded consistency claims. No original75/23 rerun occurs.

Exact command (from the F worktree):

```sh
env TMPDIR=/home/tiecont/.cache/aegisgate-06a/f/.local/tmp GOAMD64=v1 GOTOOLCHAIN=local flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint06a-f-review.mjs 406d560 evidence/sprint06a-f/d-independent-01
```

**C ACCEPT**, exact source `2788cd6`, offline verifier `4d3b6fa` and reviewed
tree `45c1a7b`, for the bounded official release/API stop and vector packaging.
F clean capture `c-independent-01` (reviewer source `60b398d`) exits0: both
official audits independently verify40 artifact hashes and40 raw child streams,
source/tree bindings and metadata for Envoy1.40.2 and llhttp9.4.4. Their official
release tag references match the already reviewed source commits. Both raw
captures explicitly say no fresh runtime, full75/23 or qualifying repair.
The writer's unchanged offline verifier also exits0 and materializes five exact
vectors. F audits all immutable reference hashes and original H1 wire bytes/
rejection contract. All11 protected pins and all tracked bytes match afterward;
the private clean stage is removed under lock. No network/protocol replay occurs.

The optional replay is source-reviewed only: it requires an explicit synthetic
fixture on127.0.0.1, verified TLS and bounded byte/time limits. Its result keeps
security_pass=false, original_evaluator_executed=false and
origin_capture_complete=false. The userinfo branch reports maintained-session
status/reset but does not capture complete bidirectional wire. Deadline/capture
flags must be read; exit0 alone is not acceptance. This is a diagnostic helper,
not a full maintainer-ready end-to-end proof or repaired acceptance oracle.
Later Go/x-net official metadata and final C report remain subject to review.

Exact command:

```sh
env TMPDIR=/home/tiecont/.cache/aegisgate-06a/f/.local/tmp flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint06a-f-review.mjs 45c1a7b evidence/sprint06a-f/c-independent-01 c
```

**D ACCEPT** corrected source `69a3be8`, final `716780c`, for bounded research
consistency/API-stop tooling only. The earlier `406d560` rejection is preserved
above. F `d-independent-02`, reviewer source `3137cc3`, clean-replays the exact D
proof and all independently overlaid suites: both exit0. All four new F cases
now reject. The fix requires one probe/nonce per request block, accounts for
every block/event, and binds unique request and completed response streams.
The unchanged05C/05D and F regressions remain passing; old historical map gaps
remain demonstrated unchanged. Honest and coherent signer rewrite stay merely
consistent with RuntimeComplete/RuntimePass/Module01Pass=false. Both actual
nine-byte ACK observations still report aggregate FAIL. No new runtime authority
or H2 security acceptance is claimed. Source bytes/11 pins and cleanup verify.

A first clean replay `a-independent-01` (source `5ca4e3a`, reviewer `ee6b8eb`)
retains a pre-traffic container harness failure: record.lockPID=process.ppid
points at the reviewer wrapper, while the enclosing actual flock is its
ancestor. No lock assertion was bypassed. Container removal and source/11-pin
postchecks pass. All29 separate F attacks pass: malformed/partial/failed/cancelled
writes; exact quotas; truncate/tamper/inode/link/mode seal rejection; startup
inventory validation before any deletion; symlink/hardlink/enumeration limits;
actual ingress ENOSPC503, CL10EOF400, late-fold400, Host/SNI421 with zero origin
dials/bytes; healthy exact-wire controls before and after. Reachable JS key/
IV/tag buffers zero and accounting releases. Same-UID races remain excluded.
A is not yet independently accepted pending a supported exact container replay.

B source `260dc7f` clean replay `b-independent-01` (reviewer `e6f9b77`) exits0:
all6 top-level/42 tagged subtests and46 top-level/90 unchanged Module03 race
subtests pass with real isolated fixtures, no skips. Its single tag-only hook,
fixed signature context, shared canonicalizer/trust.key and standard Ed25519
preserve ordinary API/wire bytes. Source review confirms JWT/auth-required,
signed digest/tenant/resource binding, floor, rotation and LKG boundaries.
Multi-hop SNI/capture, internal admission bytes and fixture allowlist limits in
the final B report are accurate; these do not establish a unified ingress or
production SSRF/JWKS support. Independent same-generation sidecar challenges
are pending. `b-independent-02` retains an F harness assumption failure: an
identical second Adapter.Apply is denied rather than accepted idempotently.
This is not a B security defect; the test is corrected to challenge conflicting
activation while allowing the existing duplicate-notification semantics.

**B ACCEPT**, executable `260dc7f`, evidence `ce5e803`, final report `e18922a`,
for the explicitly limited build-tagged signed/JWT/TLS multi-hop experiment.
F `b-independent-03`, reviewer source `b563568`, independently rejects a
conflicting authenticated sidecar at the same snapshot generation, retaining
the original admitted tenant binding. Mismatched notice digest/deployment/
generation also reject and preserve captured generation7. Both top-level tests
and three subtests pass under the race detector. The preceding failed F test
does not demonstrate sidecar policy rollback. Its duplicate-activation premise
was invalid, as recorded above. Exact clean full replay and independent attacks
both preserve all11 pins, all tracked bytes, and remove private clone fixtures.

**C ACCEPT** final `0bce723` for the reviewed bounded release/API stop and local
package. Final Go/x-net metadata provenance is being mechanically bound below;
no missing runtime repair or unexecuted diagnostic is relabeled as a PASS.

**E ACCEPT** proposed source `27cdf2c`, final report `6a8280e`, as an inactive
decision package only. The ADR and research manifest preserve the original
aggregate contract/75/23 authority, separate effective/proved/proposed claims,
and leave ownership/reference/date PENDING. Streaming/WS/gRPC, production SSRF,
key custody, unified signed pre-stage capture and authoritative H2 coverage stay
unproved/disabled. Migration/rollback requires explicit authenticated versioning
and newer generations, with no fallback to weaker auth or streaming. The
operational/threat matrices expose finite latency/quota/custody/retry and
multi-hop costs; no implicit security downgrade, contract activation, human
signoff or gateway GO is present. E's summary of other tracks remains subject
to the exact component verdicts in this report.

**A ACCEPT**, exact executable `73d8f41`, final report/evidence `20e4d29`, for
the finite admission and lab resource proof only. Clean F `a-independent-03`
(reviewer source `e398740`) executes the exact unchanged owner collector0,
container ingress0 and all67 controls. F's29 independent spool/admission
attacks also exit0. The clone has its own Git object database, five released
llhttp sources are privately copied with pin verification, and no symlink or
external Git mount is added to make container tests pass.

The replay independently validates actual384MiB/no-swap memory,0.75 CPU and64
task limits, kernel throttling/PID/OOM event increments and8MiB tmpfs ENOSPC.
Ingress survives the deliberately killed memory child and serves healthy
exact-wire requests. Hard-RST cancellation is observed before origin slot
release, with zero cancelled-request dials and wiped stage buffers; the
separate ambiguous FIN case retains its eventual dispatch rather than claiming
zero. All67 unique probes, streamingPositive.pass=false, resource settings,
raw stdout/stderr and artifact manifest match the retained receipt. Cleanup
counters are zero, private fixture/stage absent, container removed, all tracked
bytes and11 protected pins unchanged after execution under the same flock.

Second F failure `a-independent-02` is preserved: the corrected lock ancestry
works, but the reviewer's shared Git object alternate is outside container
mounts and HEAD cannot be read before traffic. It is an F clone-isolation setup
failure. `a-independent-03` dissociates the clone's object database; it does
not alter A's runtime, parser, collector, lock assertions or container settings.
Both failed captures keep their actual failures and successful cleanup.

No active hostile same-UID race resistance, physical key erasure, production
process custody, tenant fairness, availability/SLO, H2/JWT/SSRF or complete
gateway claim follows. The host PID namespace remains a lab lock-verification
choice. Mandatory pre-completion streaming is actually executed and FAIL.

Exact successful A command:

```sh
env TMPDIR=/home/tiecont/.cache/aegisgate-06a/f/.local/tmp flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint06a-f-review.mjs 73d8f41 evidence/sprint06a-f/a-independent-03 a
```

Final mechanical `final-audit-01` (reviewer `de831d1`) independently binds
B155/C58/D52 retained manifest artifacts, component scope and all11 pins. C's
Go1.27.4/x-net0.62.0 official raw metadata, exact HTTPS arguments, collector
SHA256 and source/tree match. E's JSON inactive/PENDING/disabled flags verify.
Pinned offline Gitleaks scans F files and reviewed changed component sources:
empty findings. Private audit stage is removed under lock. Later A/final gate
sources and integration receipts are audited separately.

Full exact integration gates remain pending. F's new
`scripts/sprint06a-f-gates.mjs` records source/tree, binary identities, raw
SHA256/exit evidence, scanner semantic results, private cleanup, all tracked
source hashes and unchanged oracle pins. No local full-gate PASS is asserted
before actual execution on the root-supplied reviewed integration candidate.
