# Sprint05A F Initial A/D Security Review

Initial independent verdict: **ACCEPT A's four specific TE repairs and D's
two malformed-header repairs plus bounded window/cancellation behavior** in
test-only candidates. **REJECT overall protocol acceptance**: A remains73/75,
D remains19/23. This does not accept root integration, production code, a
runtime architecture, or a release. Module01 NO-GO;04-12 LOCKED; production
BLOCKED. B/C/E and final combined integration review remain pending.

## Exact Sources

| Item | Exact commit / tree or scope |
| --- | --- |
| Protected main | `541d1d915ce6a3b679dc3fed3ea0a98f908ce001` / `89eff9430f2bb7044683eaf9e62e6657a7295a86` |
| A reviewed head | `9391ba922bc8daa2c68c86bb5e770d8685b6a4d7` |
| D reviewed head | `d06728676bcf63a0464a665b9447b69c423a27ef` |
| Isolated staged branch | `review/sprint05a-security`; staging99a4665/8ceb2d7 grants no integration verdict |
| F harness sources before proof | `7efba87`, `cf9574c`, corrected layout `9ec2765`; D continuation source `8c6e233` |
| Fresh A runtime source | `9ec2765305aae1e5aa94501ca18b41542f22bf55` / `ffefbb2177e94d464e898c78b69642a9eb7bd661` |
| Fresh D runtime source | `8c6e233f1b39ea370497ca5560c0e774c026c6c7` / `646304bfbe079d2530b31859bcac6b823a976749` |
| Integrity verifier source | `86e861238defd02c62be64bf01bd1362e75a1c0a` / `3717fa0a237f301052d6c4f1e8bf7f47d56b860d` |
| Final report receipt source | `1ba8b5be198afb6c7ec943cbaab74ff11bb7c8c1`; verifier committed earlier as `8d546a7` |

All nine A/D source files match their exact component heads byte-for-byte.
Before/after checks verify all4003 baseline blobs, inventory SHA256
`0006bf530e2c928baf928089d4d709294cd09f3552a7d511bed1fa3a85ba9225`.
Original75, original23, evaluator, requests, deadlines, observer and acceptance
policy remain unchanged. `extract-baseline.mjs --check`, protected evaluator/
contract tests and config equality pass. No production sources were changed.

## A: Per-Failure Verdict

| Original failure | Independent outcome | Verdict on repair |
| --- | --- | --- |
| `malformed-HTTP-invalid-transfer-encoding` | Original full75 PASS; focused501=>400 | ACCEPT |
| `strict-ingress-TE-repeated-chunked` | Original full75 PASS; focused501=>400 | ACCEPT |
| `strict-ingress-TE-not-final-chunked` | Original full75 PASS; focused501=>400 | ACCEPT |
| `supplemental-repeated-transfer-encoding-fields` | Original full75 PASS; focused501=>400 | ACCEPT |
| `malformed-HTTP-obsolete-folded-header` | FAIL:1 origin handler,263 decrypted bytes | REJECT |
| `HTTP2-authority-Host-and-SNI-confusion-rejected` | FAIL:0 handlers,9 decrypted bytes | REJECT |

F freshly executes the full unchanged75 using A's committed runner and named
candidate. It measures73/75; runtime and unchanged evaluator both exit1.
Historical69/75 is an immutable reference; a new complete baseline75 was not
run. The focused baseline/candidate comparison is fresh.

All51 focused probes complete:16 baseline TE failures and16 candidate TE
passes across four original vectors, exact/keep-alive diagnostic inputs and
fresh/reused downstream connections. F verifies each original request byte and
SHA256 against protected sources and executes the original `assertRejected`.
All TE intervals have zero origin decrypted bytes,new dials,handlers,parser
errors and transport errors. Peer end/close is observed before cleanup with no
client FIN,local destroy,error or timeout; maximum observed TE duration including
settle is1052.09ms. Reused sockets first complete a valid warmup with its origin
effects recorded separately. The verified relay calibration captures76/76 bytes.

Actual origin501 remains501 with a handler and bytes. Seven valid methods,
three chunked bodies,six encoded targets and ordered pipelining pass. Both TLS
hops verify identity; the compiled config preserves CA/SAN/SNI checks. A changes
only supported local reply mapping, with config equality after removing that
mapping. Its scope is **all local501 replies**, not a TE parser repair. ACCEPT
is limited to the listed assertions; broader status policy needs later runtime
review. Folding normalization and the9 H2 bytes are not excused or subtracted.

## D: Per-Failure Verdict

| Original failure | Independent selected-policy outcome | Verdict on repair |
| --- | --- | --- |
| `settled-reuse-identity-and-three-authority-negatives` | FAIL: original userinfo operation deadline | REJECT |
| `individual-settled-userinfo-denial` | FAIL: original operation deadline | REJECT |
| `raw-H2-HEADERS-stream-zero` | FAIL: peer closes without required error frame | REJECT |
| `raw-H2-zero-WINDOW_UPDATE` | FAIL: peer closes without required error frame | REJECT |
| `raw-H2-uppercase-header-name` | PASS: peer RST_STREAM1 PROTOCOL_ERROR; all five origin counters0 | ACCEPT |
| `raw-H2-connection-specific-header` | PASS: same peer error frame; all five origin counters0 | ACCEPT |
| `slow-reader-backpressure-and-response-cancellation` | PASS:196608 bytes at200ms,3 pauses,cancel11ms,RST2 | ACCEPT selected assertion/bounded improvement; REJECT deterministic baseline-failure claim |

Fresh original23 results are baseline17/23,windows17/23,stream-errors19/23;
all child suites exit1. A first separate baseline also measured17/23. The
historical D16/23 baseline is retained, but the original200ms slow-reader
assertion passes in both F baseline runs. In the completed matrix baseline
produces7012352 bytes at200ms versus196608 with either window candidate.
Therefore F reproduces19/23 and two fresh failing-to-passing header assertions,
not a deterministic16=>19 transition. No test or expectation was weakened.

Both repaired cases receive exact peer frame `00000403000000000100000001`,
SHA256 `902f528c71b3d55985510ee73256814dee0bdf71ce6320ad21bd0f6531f20185`.
Origin new connections,all decrypted bytes,handlers,parser/transport errors
are0 for each negative. The failed HEADERS0/WINDOW_UPDATE0 cases also have
zero origin effects but lack required rejection frames. Local native code8
after userinfo closure is not evidence of a peer-sent allowed rejection.
The combined identity case includes two valid setup handlers; their bytes
cannot be misreported as a zero-byte malformed interval.

D's resolver redirects only the launcher's config import; it does not rewrite
test source. Supported released settings change upstream windows to65535 and
enable stream-level invalid-message rejection. CA/SAN/SNI validation and actual
pool reuse remain: two valid encoded requests use the same native origin
connection with correct authority,SNI,h2 and TLS identity. The64-stream,
270-connection,header-timeout,upload and32-connection drain assertions pass.

All17 bounded controls complete separately with `semantic_security_pass=false`.
8/32MiB producers plateau at196608 bytes at200/500ms with client window0;
both remain incomplete until cancellation and show actual upstream RST2.
Cancellation takes9.30/1.31ms. Envoy RSS samples reach67716/67772KiB; these
are short samples, not sustained memory/fairness bounds. Partial16384-byte
upload cancellation takes3.67ms. Verified WebSocket echo/close1000, gRPC
two-message echo/trailer and4.44ms cancellation complete. Server-side
`authorized=false` means no client certificate was requested; client/relay
server verification remains enabled. Observer attribution limitations persist.

**REJECT D's original cleanup collector for reuse** pending scoped inspection:
it enumerates generic candidate names then reads full Docker objects before
checking mounts. F does not execute that runner. The committed F runner invokes
the unchanged23 and17-control entrypoints with D's exact resolver/config and
uses name/mount-only ownership inspection. Candidate repair acceptance does
not accept that collector. No broad Docker configuration/environment was captured.

## Redaction And Root Helper

A attempts01/02 are ineligible final proof. F validates four withheld-stream
hash/size records, retained manifests and command hashes, without reconstructing
contents. The four paths do not exist and have no reachable `--all` path history.
Removed blob `7bad0dc7cf80ff73c4f6edc335d1354efbc338ba` is unavailable
(`cat-file` exit1). Retired receipt source
`02b0a6582997aeb8ed7992ae4c6f9af34d6a0d11` is unavailable and cannot be
ancestry (`merge-base` exit128). Fresh attempt03 and F attempt04 use scoped
capture. F accepts the sanitized handoff within this checked local history;
no claim is made about unknown copies outside it. `git fsck --connectivity-only
--no-reflogs` exits0. Pinned offline Gitleaks source/A/D/F evidence scans and
the reviewed branch's541d1d9..86e8612 history scan exit0;15 commits/3.83MB
are actually scanned. No forbidden blob or unsafe ancestry is introduced here.

Root `47f0cd558c88d1eac0883527cbb86edd259ad9cc` is **ACCEPT for static
helper parameterization only**. F proves its entire source differs from the
protected helper only by output sprint selection, Compose project assignment
and both project label filters. A05A invocation selects exclusively
`aegisgate-05a-root`, including cleanup inventories. Independent cleanup steps,
private-material removal and security checks remain intact. Helper SHA256 is
`2759773257053d1c811b3778e09a9db0a4a3eccd645df296f721c453bb5ebc05`.
F does not import it into this branch or claim root gates were run.

## Commands And Receipts

The supplied Node26.13.0 binary is
`/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node`, SHA256
`0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`.
Strict spike lock installation precedes fixture work: same toolchain's
`npm-cli.js ci --prefix spikes/pingora --ignore-scripts --engine-strict
--no-audit --no-fund` exits0; ws8.22.2/grpc-js1.14.7. OpenSSL4.1.0,
Envoy1.40.2/BoringSSL commit b2d89e0 and pinned image09ca6f21 are retained
with complete versions/digest in A's raw tool receipts. No lock/dependency edit.

Every command below uses the supplied Node and a single outer
`flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock`. There is no nested flock.

| Entrypoint and arguments | Collector exit / evidence |
| --- | --- |
| `spikes/envoy/sprint05a-f-review.mjs evidence/sprint05a-f/ad-02 evidence/sprint05a-a/attempt-04` |1 after complete A proof: D baseline17 differed from collector's assumed16 |
| `spikes/envoy/sprint05a-f-review.mjs evidence/sprint05a-f/ad-03 evidence/sprint05a-a/attempt-04 --d-only` |0; reuses immutable A receipt, freshly runs all D modes/controls |
| `spikes/envoy/sprint05a-f-verify.mjs evidence/sprint05a-f/checks-01` |0; exact receipts,original inputs,counters,frames,root diff,secret/history checks |
| `spikes/envoy/sprint05a-f-verify.mjs evidence/sprint05a-f/checks-02 --report-only` |0; final report/evidence scan receipt retained separately |
| `spikes/envoy/sprint05a-f-verify.mjs evidence/sprint05a-f/checks-03 --report-only` | Corrected provenance text scanned and hashed separately |

All fixture lifecycles cover setup,test,capture,hashing and cleanup under the
lock. Candidate inventories are empty and new fixture directories removed;
private PKI is deleted. Listeners are owned loopback fixtures. No public tests,
upstream publication,push,merge or agent spawn. Fad-01 retains the earlier
untracked dependency-symlink clean-tree failure before fixture creation; ad-02
retains the baseline-count collector failure. Neither is silently discarded.

| Principal artifact | SHA256 |
| --- | --- |
| `sprint05a-a/attempt-04/full75.json` | `d0c4247afe6db2c4b863a50ac7601c14685442fee3c850404180e480f4031cab` |
| `sprint05a-a/attempt-04/focused.json` | `3e2f27664f9b0b1030ac718187b12029c757bd11ab818c7850c635d8628aa910` |
| `sprint05a-f/ad-03/commands.json` | `5180348930aa19d782aef4fa3e1fb309b1a70cb493e979641c058f7feeb16779` |
| `sprint05a-f/ad-03/d-stream-errors.json` | `a0fa91a5b7717ce087f1369e1b31220176095535c63d7dd249f66866effa031b` |
| `sprint05a-f/ad-03/d-controls.json` | `7eef8582e38a02f904c8494854c16a277afbda66527c92cb66d62614af628fd5` |
| `sprint05a-f/checks-01/commands.json` | `465480e48a13681e09952a091edeb53b6fd504c79bd18c6a0c0689c64d39cc49` |

Paths above are under `evidence/`. Receipts bind full source/tree,argv,safe
environment,tool identity,timestamps,exit codes,raw failures and stream hashes;
each group has SHA256SUMS. A lifecycle UTC14:29:05.579-14:31:07.774; D
UTC14:33:48.287-14:35:14.128; integrity14:39:05.557-14:39:34.202 on2026-11-14.

## Agent Completion Report

- Module/status:01/Sprint05A F initial A/D review complete; final review pending.
- Commits/files: committed F harness/verifier before their proof; additive F
  plan/report/receipts and independent A attempt04/checks02 only.
- Architecture/contracts: unchanged; no production or architecture approval.
- Positive/negative evidence: A73/75 and51 focused; D17/23 baseline/windows,
  19/23 selected;17 bounded controls; source/hash/secret checks as above.
- Performance: short local samples only; no SLO/capacity or general memory claim.
- Risks/blockers: two A/four D failures,variable baseline timing,D cleanup
  collector,combined75/23 proof,B/C/E,root local/hosted gates and human decision.
- Human review needed: later affirmative architecture/security decision remains
  separate. Nothing in this review opens Modules04-12.
- Next unblocked action: root may assess accepted isolated candidate changes,
  repair D cleanup capture and run combined unchanged75/23 plus controls; final
  integration verdict follows exact final sources and required gate evidence.
