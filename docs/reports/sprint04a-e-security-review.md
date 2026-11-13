# Sprint04-A Independent Security Review

2026-11-13 UTC. Branch `review/sprint04a-security`, baseline
`3e03940848c81751c87bbcec131238abb7d28e1b`.

Verdict: **ACCEPT A/B/C/D investigation evidence and F local recovery changes**
at the exact heads below. Final receipt verification passes. No new blocking
defect was found in these scoped changes. This accepts research/test evidence
and engine-independent local Module03 work, not a passing Module01 candidate,
TypeScript7 update, release decision or architecture approval. Module01 stays
**NO-GO**, Modules04-12 stay locked and production stays **BLOCKED**. No merge,
waiver, other agent, production action or external publication was performed.

## Exact Reviewed Heads

| Owner / branch | Reviewed clean head | Disposition |
| --- | --- | --- |
| A `fix/module01-envoy-codec-boundary` | `8d83ece166290b7c81e757281e5b1778e83dede4` | Accept scoped upstream stop/evidence |
| B `test/module01-origin-boundary` | `93dc1223ae09d2562a9b4c5b307b173f960b9ea4` | Accept failed-candidate wire investigation |
| C `research/module01-upstream-capability` | `6acbe0f55d50334a14b95c4d3e9888f5d1aebecf` | Accept released/proposed/missing API matrix |
| D `fix/dashboard-dependency-resolution` | `b42bae1e9ffa63b4dfd4c94c9a6376f7129077ce` | Accept supported tree and upstream-blocker evidence |
| F `hardening/module03-local-recovery` | `bf5785eb8bd6449fc34915b7c2f392bd1d46350f` | Accept local source and scoped recovery proof |

F executable source was committed as
`99e41a2438d42c9588620d7766d2b03ebc557a14`; E independently ran that clean
source. Final F head adds only its report/evidence. Final seal checks exact
source equality, all five branch heads/owner cleanliness and original F hashes.
Every reviewed owner retains its own worktree untouched by E. Detached copies
under E's ignored `.local/review/` supplied clean committed source for proofs.

## Findings And Remaining Blockers

1. **Module01 mandatory failure, retained:** independent unchanged75 and
   diagnostic75 both reproduce69/75. Obs-fold reaches the origin:263 decrypted
   bytes, one handler, zero parser/transport errors. H2 denial emits nine
   decrypted bytes with zero handlers/parser/transport errors. Four TE cases
   return501 with zero origin bytes/handlers, violating the required4xx/close
   response contract. No failure is relabeled as success or an upstream exploit.
2. **H2 zero-byte failure, classified:** immediate warm valid-then-Host-denial
   emits exactly `000000040100000000`, SETTINGS type4/ACK flag1/length0/stream0.
   SHA256 `a9fd441cc14ae4b467f3ea0a0ed70de71bb5834db34815eca9cceb70017adfd6`.
   This is a connection-control frame on the reused origin connection, not a
   TLS record or dispatched request. Rejection is421; interval has nine bytes,
   zero new connections/handlers/errors and no HEADERS/DATA. **Zero-byte FAIL**
   remains binding; no control-frame subtraction or settling sleep is introduced.
3. **Additional bounded probe failures, retained:**23 probes complete,16 pass,
   seven fail identically to B. Combined/individual userinfo tests hit their
   explicit deadline; four malformed-frame probes receive no error frame
   before peer close; paused native reader permits all8MiB producer output.
   Zero handlers or client cancellation is not proof of peer-sent rejection.
   Successful raw-window cancellation/caps/partial-header drain do not establish
   exhaustive H2/HPACK, memory bounds, fairness or production stream drain.
4. **Maintained parser prerequisite still absent:** Envoy1.40.2 Balsa sets
   continuation rejection false, exposes private no-op raw callbacks and strips
   CR/LF before public parsed-map validation. A post-normalization validator
   cannot reconstruct lost folding. Pingora0.9.1 rewrites invalid targets and
   retains maintenance dependencies; Hyper1.12.0 removes CL/TE ambiguity and
   fragment provenance before service policy. No complete released eligible
   path was established in inspected APIs. Local TE remapping, pipeline and
   programmatic-startup APIs are partial prospects, not absent or complete fixes.
5. **TypeScript7 update remains blocked:** strict unforced resolution of7.0.2
   fails1/ERESOLVE against typescript-eslint8.72.2's `>=4.8.4 <6.1.0` peer range.
   The existing TypeScript6.0.3 tree installs/checks normally. No manifest,
   minimatch11.0.7 override, peer bypass or scanner ignore changes. D is accepted
   as a truthful upstream blocker investigation, not repaired TypeScript7 support.

Same immutable six failed IDs in both E75 runs:

```text
malformed-HTTP-invalid-transfer-encoding
malformed-HTTP-obsolete-folded-header
strict-ingress-TE-repeated-chunked
strict-ingress-TE-not-final-chunked
supplemental-repeated-transfer-encoding-fields
HTTP2-authority-Host-and-SNI-confusion-rejected
```

## Independent Review And Executions

Mandatory operating/master/architecture/threat/config/quality/risk/ADR and prior
Sprint03-A/B reviews/completion plus current execution contract were read.
Executable plan/recorder `review.mjs` was committed before proof at109f56a.
Node26.13.0 executable SHA256 is
`0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`;
npm12.2.0, Go1.27.4 and pinned Envoy1.40.2 image are recorded in raw receipts.
The image pin remains
`sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`.

All commands below use the pinned main-worktree Node executable. Exact nested
argv/cwd/environment/times/exits/signals/source and stream SHA256 are retained
in each attempt's `commands.json`; failed tests are preserved losslessly.

| Command from E worktree | Actual result / UTC interval |
| --- | --- |
| `node evidence/sprint04a-e/review.mjs b 01` | Recorder0; clean B head, strict fixture install0, outer locked wire runner1; both lab/evaluators1,69/75;23 probes16/7;10:04:44.677-10:07:21.840 |
| `node evidence/sprint04a-e/review.mjs d 01` | Recorder0; unsupported explicit update1, normal strict install/tree/lint/typecheck/test/build/integration/audit/update0;10:08:31.858-10:09:16.808 |
| `node evidence/sprint04a-e/review.mjs ac 01` | Recorder0; A boundary verifier, C original/current manifests and verifier0;10:09:54.113-10:10:02.653 |
| `node evidence/sprint04a-e/review.mjs f 01 99e41a2438d42c9588620d7766d2b03ebc557a14` | Recorder0; E-owned locked integration/vet/golden/source checks/cleanup0;10:11:44.505-10:12:25.611 |

B's three observer focused tests independently pass. Direct/observed synthetic
37843-byte streams and native H2 authority/SNI/encoded targets/reuse match;
wrong-SAN/expired/untrusted origins fail after application bytes are attempted,
with zero decrypted bytes and transport errors. Both TLS hops retain certificate
verification. The relay reterminates TLS: no peer-IP, mTLS, timing, packet,
cipher/session/resumption transparency is claimed. Diagnostic retention is
bounded and distinguishes omitted samples from scalar byte counters.

E verifies immutable baseline hashes for lab, corpus, expected/evaluator and TLS
observer; A's checker verifies all12 protected files against3e039408/e5adeb4.
Manifest SHA256 stays
`8dd056bb69f53e0a41bf6445c7054f2345ce969d3c22784a7567268e0733f141`.
All75 inputs/expectations, raw bytes, zero-byte assertions, encoded-target and
pipeline positives remain intact. A/C current raw source was inspected directly:
Balsa constructor/private callbacks/value normalization, parsed-map validator;
Pingora/Hyper parser paths and dependency exposure corroborate their scoped stop.
C verifier checks139 historical entries,96 prior receipt files,137 fresh
collection files and7 published archives/382 source files without mismatches.
Original manifests are checked before any verifier-generated replacement.
No new release/API retrieval or external probe/publication was needed by E.
A's disclosed lost historical attempt stays ineligible; retained failures remain.

F's independent command is `env AEGIS_TENANCY_INTEGRATION=1 go test -race -v
./apps/control-api/internal/persistence ./apps/control-api/internal/transport
./internal/configreview ./internal/configconsumer ./internal/configsnapshot
./internal/configrollout ./internal/configpublish -count=1`, from E's clean
detached F source. **76 top-level tests, seven packages, zero skips/failures**.
This includes actual restricted PostgreSQL/mTLS JetStream/HTTPS signed artifact
publication to canary ACK/rollback/outage and all six added recovery tests.

Review confirms independent provisioning floor rejects old encrypted full-state
rollback, equal-floor restore works, diagnosed cache/key startup remains sticky,
and lost-disk recovery requires a newer signed generation. Worker signer outage
uses test doubles; exact staged bytes retry without re-signing and retired keys
deny. Captured generation grace remains coherent, admission/activation stops
and deadline denies later accesses. Durable prune holds SHARE/NOWAIT locks
through filesystem deletion/fsync, conservatively retaining outbox/rollout/audit
and coordinated external reservations; missing tables/writer conflict deny.
Actual archive rows restore/validate before restricted cleanup and restart.
Frozen v1 schema, signing/golden vector, ACK vocabulary and trust/TLS unchanged.

All E shared fixtures/containers, including B observer tests and D integration,
hold `/tmp/aegisgate-sprint02-fixtures.lock` for their complete lifetime. B
records zero remaining containers and removes all fresh fixture directories.
F uses E project `aegisgate-04a-e-review`, tears down its containers and volumes,
verifies no remaining owned container and deletes fixture PKI/env files before
lock release. No owner worktree or production/public endpoint was modified.

## Evidence And Integration Limits

Selected E SHA256 values; attempt manifests bind all retained files:

```text
209ae0a11997230fd638281817fc9f78bc805f01e80e86ad0c075f26f33c78d9  b-01/wire/unchanged75-results.json
b1ca76a604549f534d73a3d27be2d36dd078420b035dcd5a81e6b7f925f886f5  b-01/wire/diagnostic75-results.json
49249572971972b1d4a569bd6d4480c6d875901af3fb8f65c2b8ef1d8b1c9349  b-01/wire/diagnostic-wire.json
fd3f82fbe6f9d99a0e951e989221e6e6bf458e430bf3ef79c0dc751397dc0aba  b-01/wire/probes.json
45a402cbfca5690d217a757abf832b72993ba02ee463e96f5df4f011191064d2  d-01/dashboard/commands.json
c24b77ae076eccc8b0fd09b5f3f350d4ea948048d4d0852de49553bb213504a6  ac-01/commands.json
88e330cac67232aefbbf8e5bca16ad9809d158661426a43f9f33603d7a1d27af  f-01/recovery/module03-race-integration.stdout
f1315c5fa18aab4562521c6b7cfa9f5e55031c488afedc4bec9a1b1d1864afe1  f-01/recovery/commands.json
```

Final seal command: `node evidence/sprint04a-e/seal.mjs seal-01
bf5785eb8bd6449fc34915b7c2f392bd1d46350f` exits0 at02753c7. All recorded
proof checksums/command expectations and five current clean heads verify;
F final source matches the independently tested source. Scoped pinned offline
Gitleaks8.30.1 scans1.82MB of actual E evidence/report with no leaks. Receipt
SHA256 `4518e49132b26802f8b2dcefa67c7766f1edff114f885fc3e7b3ec1dae234906`;
manifest `5c03da8d911e8fd32ee6bf2d61c04d259df9a6ef1b676576bfcdda8840c47bce`.
The identical command with fresh output `seal-02` binds this completed report
after commit and writes the whole E `SHA256SUMS`; its receipt records actual
source/time/outcome. A/C scoped scans also pass independently; none substitutes
for root's full scanner. Root can verify from E's directory with
`sha256sum --check evidence/sprint04a-e/SHA256SUMS --quiet`.

Only preflight errors outside proof were reading nonexistent Node VERSION and
F report before its creation, and a search naming nonexistent store.go. They
exit1/1/2 and supply no evidence. Four E proof recorders complete without
unexpected command failures; expected B security/update failures remain above.
Raw logs may contain trailing whitespace; source-only whitespace is checked
without rewriting evidence. Restart interrupted final writing, not a proof;
all committed raw proof bytes remained present and will be checksum-verified.

Root owns sequential integration, locked full `make check`/`make security-scan`
and hosted foundation-quality/supply-chain-security on the exact integration
head. These have not been executed or claimed by E. Evidence-only acceptance
does not repair the six ingress failures, maintenance warnings or TypeScript7
peer range. Obtain maintained released strict APIs, prove unchanged75 plus
mandatory protocol/security/resource positives, then seek explicit human
architecture approval. No GO or waiver is supplied here.

F limits remain material: authenticated external floor/clock/trust provisioning
is not an external monotonic service; drain cannot recall copies or cancel
engine/LB I/O; archive custody/coverage and external reference coordination stay
operator responsibilities. No automatic history GC, production custody, HA,
network emergency transport or active H2/WS/gRPC drain is implemented/claimed.

## Agent Completion Report

- Module: Sprint04-A E independent review; scoped01/03/dependency maintenance.
- Status: complete scoped independent review; final seal passes, root integration separate.
- Commits/files changed: only E report and `evidence/sprint04a-e/`; source and
  attempt commits109f56a,56653bc,fb139f4,d754a0a,989b971,0caa7f3 precede closeout.
- Architecture/ADR decisions/contracts changed: none; no merge or gate edits.
- Positive/security-negative tests: exact commands/exits/hashes above; failures
  explicitly retained, F race integration76 top-level tests/seven packages0.
- Performance: bounded local observations only; no production SLO/capacity claim.
- Known risks/release blockers: six ingress failures, seven supplemental probe
  failures, maintenance warnings, upstream TypeScript peer support and release
  custody/drain/operational obligations remain.
- Human review needed: required architecture/security/release owners; root
  accepts only reviewed changes after its exact-head checks.
- Next unblocked work: root sequential integration and independent00/02/03
  maintenance; focused upstream remediation, no dependent module opening.
