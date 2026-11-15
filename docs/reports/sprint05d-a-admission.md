# Sprint05D A: Complete-Validation Admission Policy

Finite complete-message staging passes29 additive admission/encryption/lifecycle
controls. The identical CL10/abc prefix reaches zero origin activity before
completion; seven additional bytes produce200, whereas EOF produces400 with
zero origin effects. Chunked valid/EOF/late-fold controls have the same boundary.
The mandatory pre-completion progress positive is **FAIL**: an unfinished request
receives408 with no origin progress. This scoped policy closes the demonstrated
late-invalidity paths by withholding the entire request; it does not meet the
mandatory early/indefinite streaming requirement. Module01 stays NO-GO,
Modules04-12 LOCKED, production BLOCKED. No ADR or original contract is changed.

## Six Hypothesis Fields

| Field | Declaration before execution |
| --- | --- |
| Failure |05C F CL10/abc/EOF produced400 after89 origin bytes/one handler; late folded trailers can invalidate a shared prefix.|
| Hypothesis |Complete validation and finite staging for every request removes those early effects within the declared bounds.|
| API |Unchanged05C binding to released llhttp9.4.4 callbacks; Node AES-256-GCM and bounded private FileHandles.|
| Minimum test |Common unfinished CL/chunk prefixes, valid completion versus EOF/late fold; quotas, cancellation, encryption and actual SIGKILL/restart.|
| Positive |Exact origin wire hashes, completed bodies/trailers, no-body/CL/EOF/encoded/pipeline/512KiB uploads and healthy post-failure/restart requests.|
| Stop |Absence of pre-completion progress is a streaming FAIL. No full resource benchmark, parser repetition, runtime GO or production secret custody claim.|

## Exact Source And Reproduction

Worktree `/home/tiecont/.cache/aegisgate-05d/a`, branch
`feat/sprint05d-admission-policy`, baseline
`aa289da3f48334ec8e2156f66ebd2a8f3cfb3324`.
Runtime proof source `3a709ae2ffc249a0e15d0934848e9473b7e8165b`, tree
`6b69057fa473b203f8b2a20bf8d70d7faa77ed63`, precedes run02 evidence5250200.
Proof lifecycle 2026-11-15T08:31:08.133Z through08:31:17.676Z.
Verifier source `362aa6abeb331ccbc4f99818a04a34451f0e667e` precedes verify02.
Only owned `sprint05d-a-*` sources, A evidence and this report change.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint05d-a-proof.mjs evidence/sprint05d-a/run-NN
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint05d-a-verify.mjs evidence/sprint05d-a/run-02 evidence/sprint05d-a/verify-NN
```

Use clean committed source and fresh suffixes. Executed run02: collector/child0;
verify02:0,29 controls,8 raw artifact hashes and14 source bindings verified.
Both include setup-to-cleanup/hash shared flock checks. Data, build and TMPDIR
are under the worktree's disk-backed `.local`; only the shared lock is in `/tmp`.
Read-only pre-fixture Git metadata commands have no TMPDIR and create no fixtures.
Node26.13.0 SHA256
`0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`,
GCC16.2.1/OpenSSL versions, tool binary hashes, argv, exits and raw streams are
retained. All five released llhttp source pins are checked before compiling;
neither upstream parser bytes nor the05C binding are modified or re-researched.

Run02 receipt SHA256
`25f60e6409a006f92d55600b47450cb6519a32faf29297ad1ed3f4c88b32f45d`.
Verify02 receipt SHA256
`525557e6b510aa3e2d54ed9c8a779f4d023970c87040979eb8f0c663935e380b`.
`SHA256SUMS` binds receipts, command and raw run streams. All11 protected files
match before/after and in the verifier; historical original75=73/75 and23=19/23
are referenced without rerunning or relabeling the29 additive controls.

## Observed Boundary

| Control | Actual result |
| --- | --- |
| CL10/abc shared prefix |100ms synchronized wait after exact staged byte count:0 dials/decrypted bytes/connections/handlers/parser errors/TLS errors.|
| Same prefix plus seven bytes / EOF |200,87 exact wire bytes/one completed handler;400,zero origin effects respectively.|
| Chunked common prefix plus valid trailer / EOF / late SP fold |200,126 exact bytes;400/400,zero effects. All share identical prefix hash.|
| Complete CL3/abc with write EOF; no-body |200,79 exact bytes;200,76 exact bytes. Both staged.|
| Exact historical folded header/TE; CL-TE; undeclared trailer |400,zero origin effects.|
| Encoded targets and CL/chunk pipeline |Byte-exact targets/raw hashes; ordered200/200. Valid/invalid pipeline200/400 forwards preceding65 bytes only; invalid/valid400 forwards nothing.|
|512KiB CL/chunk uploads |200,524369/524415 exact wire bytes; completed524288-byte bodies with matching SHA256.|
| Stage oversize |Declared CL and actual chunked overflow413,zero effects.|
| Three occupied stage files |Fourth503; cancellation releases all files/bytes;zero effects.|
| Aggregate ciphertext quota |Peak2091684 bytes under2097152; next growth503;all quota released;zero effects.|
| Ciphertext tamper before completion |Whole-stage GCM authentication503 before dial;zero effects.|
| Staged CL cancellation |No origin activity;files/bytes return0.|
| Client waits for origin before completing chunk syntax |408 around704ms,zero origin activity;pre-completion progress positive FAIL.|
| Continuous incomplete body input |Absolute408 around2501ms despite continued input;zero effects.|
| Actual child SIGKILL |One private21081-byte ciphertext file remains;no origin effects. New process reclaims exactly that file/size before listening. Healthy request200/83 exact bytes;normal stop removes spool root.|
| Final healthy controls/teardown |200 after failures and restart;0 sockets/children/parsers/stage files/bytes/contexts/slots/waiters/listeners, private fixture removed.|

The verified TLS relay counts every decrypted byte before the real HTTPS parser;
handler body/trailer and connection raw hashes are separate records. No header,
body, error or control byte is subtracted. The restarted child's valid request
has independently counted relay/handler effects; the main-process dial metric
does not include child dials and is not presented as their count.

## Finite Resources And Encryption Scope

Every request, including no-body/Content-Length, stages through llhttp message
completion, allowed trailers and ciphertext authentication before origin slot or
TLS dial. Reads/writes/decryption chunks are at most16KiB; decrypt validation
discards and wipes each output chunk, then replay uses a second decryption pass
and one copied write buffer. It does not retain the entire plaintext message.
Node/OpenSSL/socket buffers and total RSS are not hard process-memory proofs.

Limits remain1.5MiB wire/message,2MiB aggregate ciphertext,3 files,24KiB headers,
4MiB decoded-body ceiling (wire stage is stricter),6 TCP connections,64 messages,
2 active origins/2 waiters,700ms idle/handshake,2500ms request and1800ms origin.
This run reaches4 client connections and1 active origin/0 waiters; unexercised
resource ceilings are configuration, not new capacity results. No throughput,
soak, cgroup, full resource eligibility or original75/23 result is claimed.

Root/session directories are0700 and ciphertext files0600, current-UID owned,
regular/single-link and opened exclusive/no-follow. Startup validates up to16
orphan sessions/3 files each and refuses unknown names/types/permissions rather
than traversing them. One runtime per spool/shared flock is a prerequisite.
AES-256-GCM uses a random32-byte ephemeral key and12-byte IV per request.
Keys/IV/tags stay in process memory and are never logged or persisted; JS key
buffers are zeroed on close. Ciphertext is authenticated completely before dial.
The same opened private descriptor is replayed; hostile same-UID concurrent
mutation, secure RAM/provider erasure, hardware/host compromise, production
custody/KMS/key rotation are UNPROVED. Crash loses decryption keys permanently:
restart discards ciphertext, never resumes uploads. No request persistence or
crash durability promise follows. Disposable local PKI is removed with fixtures.

Run01 retains a build failure: `-Wextra` incorrectly covered generated upstream
unused parameters. The corrected build uses05C's original strict binding-only
syntax check and unchanged upstream compile profile. Verify01 retains a failed
metadata TMPDIR assumption; verify02 distinguishes pre-fixture Git reads. No
failed evidence is relabeled or overwritten.

## Agent Completion Report

- Module: Sprint05D A, isolated Module01 admission-policy research.
- Status: complete scoped finite staging proof; mandatory streaming FAIL.
- Commits/files:30e46c1 initial source;3a709ae corrected build;5250200 passing
  runtime evidence;fdf9305/362aa6a verifier;owned A sources/evidence/report only.
- Architecture/ADR decisions: none. Recommend deciding explicitly whether a
  separately reviewed finite-upload policy is acceptable; it cannot stand in
  for the unchanged mandatory streaming contract. No new feasibility loop.
- Contracts changed: none; immutable75/23 preserved.
- Positive tests: exact commands above, run02/verify02 exit0 and controls above.
- Security negative tests: EOF/folds/framing/trailers/quotas/timeout/cancel/GCM
  tamper/SIGKILL recovery;zero effects on rejected current messages as recorded.
- Performance: bounded observations only, no benchmark/full resource claim.
- Known risks/release blockers: early/indefinite streaming, production custody,
  complete ingress/auth/config/SSRF/H2/WS/gRPC/runtime resource/quality gates.
- Human review needed: root independent F review, architecture/security owner
  disposition;no runtime or production approval implied by local proof.
- Next unblocked work: E/F scoped review and root integration gates;Modules04-12
  remain locked. No push or merge performed by A.
