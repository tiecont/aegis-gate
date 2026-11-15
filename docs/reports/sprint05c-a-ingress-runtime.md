# Sprint05C A: Bounded H1 Ingress Runtime

The isolated loopback H1 proof passes 77 additive wire/resource controls and
653 native split boundaries plus six byte-at-a-time native controls. This is
not the protected original75 suite or complete ingress acceptance. The exact
historical folded requests reject with 400 and zero origin activity. Independent
F evidence also shows known-length streaming returns400 for premature EOF after
89 origin bytes and one handler. The streaming path is not admission-safe under
strict truncation-zero requirements. Chunked uploads remain finite disk-staged;
early chunked streaming conflicts with zero-byte rejection of a subsequently
malformed trailer in this design. Only bounded finite runtime behavior is proven.
Module01 remains NO-GO, Modules04-12 LOCKED and production BLOCKED.

## Source And Reproduction

Worktree `/tmp/aegisgate-05c-a`, branch `feat/sprint05c-strict-ingress`.
Final executable source `1019a602c4d5ecdb719603445f6a8baf66325207`, tree
`e2b783b226ccd8f2973895977c1f28e158424333`. Raw proof:
`evidence/sprint05c-a/run-12/{command.json,receipt.json,SHA256SUMS}`.
Both runner and child exit0. Actual lifecycle is
2026-11-15T05:21:13.702Z through 05:21:34.962Z. The shared flock covers build,
private PKI, listeners, all observations, teardown and evidence hashing.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint05c-a-proof.mjs evidence/sprint05c-a/run-NN
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint05c-a-verify.mjs evidence/sprint05c-a/run-12
```

Use a fresh numeric suffix and clean committed worktree. The verifier exits0,
binds current/source bytes and tree to the receipt, verifies raw artifact hashes,
all11 protected files, historical73/75 and19/23, named controls and cleanup.
Every source and command/tool hash is in the receipt. Node26.13.0 SHA256 remains
`0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`.
Compiler GCC16.2.1 and OpenSSL4.1.0 versions/argv/binary digests are recorded.
Released llhttp9.4.4 revision `816485216511b86459b2e6478190e14c38c14891`
is checked against the five original source pins before compilation, including
generated-parser SHA256
`f3ef756529b7444630717fa5540d4a1c9a1256874bda823c49c5a99c37f89429`.
An existing cache is reused only after hash verification; HTTPS pinned-source
fetch is the fallback. No downloaded parser bytes are modified.

## Runtime Boundary

Only owned `sprint05c-a-*` code is new. The accepted Sprint05B incremental binding
is extended in an owned copy using llhttp header/field/value/message callbacks.
The unchanged library owns framing, body boundaries, completion and trailers.
There is no framing scanner, child parser or parser fork. Native retained state
is22,888 bytes per parser, including bounded metadata/target storage. Request
and response parsers pause at complete messages; request parsing additionally
pauses at complete headers. The wrapper resumes empty post-header transitions
and preserves unconsumed pipeline bytes.

Static test routes bind verified SNI, exactly one canonical Host, tenant,
enabled state and generation before origin dial. Unknown SNI fails TLS;
Host/SNI mismatch returns421; malformed/duplicate/missing Host returns400.
Ports other than443, userinfo and ambiguous authorities are rejected. Absolute
HTTPS targets must match the verified identity. Origin-form and accepted
absolute targets are forwarded byte-for-byte, including percent encodings and
dot segments. Target admission does not normalize the forwarded wire.
`X-Tenant-ID` and `X-Forwarded-Host` cannot choose the identity.

Known-length/no-body H1.1 requests use the experimental streaming path after
complete header validation and body/wire reservation. Payload bytes inside the
declared body cannot introduce trailers, but premature EOF can still invalidate
that framing after admission. F independently demonstrates this exact failure
below. Calling this path stream-admissible does not establish strict admission
safety: it fails the truncation-zero requirement. Already streamed bytes cannot
be recalled when the upstream is aborted. Chunked requests are staged through complete syntax and
declared, allowed trailers; forbidden/undeclared trailers reject before any dial.
Expect, upgrades and CONNECT are explicitly unsupported in this isolated runtime.

Downstream keepalive pipelines execute sequentially and preserve response order.
Only the bounded unconsumed input suffix is held while the preceding request
finishes. Each admitted request gets a fresh verified origin TLS connection;
origin pooling/reuse is not implemented or claimed. Response framing also uses
llhttp. Client write EOF can complete a valid request or reject a truncated
staged request. Abort signals destroy upstream work and release pending slots.
FIN while awaiting an origin response remains bounded by the origin deadline;
this proof does not claim immediate response-wait cancellation for that case.

## Bounds And Observations

| Resource | Configured bound | Final observation |
| --- | --- | --- |
| TCP sockets including handshakes |6, explicit700ms accept/handshake timer |Peak6, next refused |
| Origin work/wait queue |2 active,2 pending |Peak2/2, fifth503/no dial |
| Private stages |3 files,0700 directory/0600 files |Fourth503, all released |
| Aggregate staged wire |2,097,152 bytes |Peak2,091,740; next growth503 |
| Individual staged wire |1,572,864 bytes |Overflow413/no origin effects |
| Decoded request body |4MiB |Oversized declared length413 before dial |
| Wire header/target/fields |24KiB/2048 bytes/128 fields;16KiB metadata |Metadata overflow413 |
| Reader chunk/pending suffix |16KiB |Pending peak4416 bytes |
| Readable-buffer admission ceiling |256KiB |Observed peak114,799 bytes |
| Request/idle/origin deadlines |2500/700/1800ms |408 around2502/702ms;504 around1802ms |
| Requests per client connection |64 |64 ordered200 then503;65th not forwarded |

Native request lifetime also caps wire32MiB, decoded body8MiB,256 messages and
feed calls; runtime limits are stricter. Both socket high-water marks are16KiB,
but the measured writable peak is65,536 bytes, with235 drain waits. These
thresholds are not hard total TLS/process-memory bounds. Sampled whole proof
process RSS peaks121,749,504 bytes, including clients, relay, servers, body
fixtures and runtime. No isolated runtime RSS, cgroup, throughput, soak or
production-capacity claim follows. Files are private temporary plaintext and
removed normally; crash recovery, encrypted disk and crash-orphan reclamation
are not implemented.

## Executed Controls

| Control | Measured outcome |
| --- | --- |
| Exact historical82-byte folded header and111-byte folded TE; byte fragments |400, peer close, zero decrypted bytes/dials/handlers/parser/TLS errors |
| SP/HTAB folded trailers, delayed and following an accepted pipeline request |400; only preceding valid request reaches origin |
| CL/TE conflicts, repeated/list CL, repeated/nonfinal/unsupported TE, smuggled suffix |400/no origin activity |
| Authority spoof, duplicate/missing Host, userinfo, unsupported port, forwarded identity spoof |400/421/no origin activity |
| Seven encoded/absolute target controls |200; handler target and entire request SHA256 unchanged |
| Mixed stream/disk and disk/stream pipelines; one-byte valid CL/chunked |Ordered200 responses; every origin message SHA256 matches its exact wire |
| Valid then invalid, invalid then valid |200/400 forwarding first only;400 forwarding nothing |
| Client write EOF |Complete request200; truncated staged chunk400/zero origin |
|2MiB CL upload to slow reader |200;32,861 origin bytes before client completion;2,097,245 exact wire bytes overall |
|1MiB chunked upload |Zero origin effects before trailer; then200 and1,048,704 exact wire bytes |
| Disk byte/file quotas and cancellation |413/503 as above; no rejected staged bytes/dials; files/quota return to0 |
| Partial streaming upload cancellation |Origin abort;65,622 wire bytes already visible; observed closure26.41ms |
| Staged idle/absolute deadline, client continuously sends incomplete body |408/no origin activity; no pre-completion body progress |
| Origin queue cancellation |Slots/queue return0; fifth503 adds no origin activity |
| Slow4MiB response then downstream cancellation |Backpressure/drain exercised; bounded origin teardown |
| Unknown SNI and origin certificate hostname mismatch |TLS denial /502; no request bytes reach origin; verification enabled |

The relay hashes/counts every decrypted request byte before the HTTPS handler.
It records per-connection SNI/ALPN, handler/body/trailer state and raw-byte
digests. All transports are closed between scenarios. Malformed streamed
cancellation/counterexample traffic deliberately produces an origin parser
error; these are reported and never presented as zero-effect rejection controls.
Cleanup records zero tracked sockets, native parsers, stage bytes/files,
origin slots/waiters, active contexts and listeners, with private fixture absent.

## Technical Stop

Independent F's exact-source EOF counterexample is retained at
`evidence/sprint05c-f/a-independent-03/a-stream-admission.json`; A read that
artifact and references it without copying it or repeating the fixture run.
F sends `Content-Length: 10` with body `abc`, waits until the actual origin
handler receives all3 body bytes, then sends EOF. A returns400 after89 decrypted
origin bytes and one handler; the origin request is incomplete and aborted.
The paired valid `Content-Length: 3`/`abc`/EOF control returns200 with84 exact
origin bytes and a completed handler. F records `security_pass:false` and clean
fixture/socket/parser/listener teardown. This disproves the claim that future
framing cannot invalidate known-length stream admission under strict
truncation-zero requirements. Path A is not fully safe under that contract.

The competing experiment streams a valid65,646-byte chunked prefix to a verified
TLS origin, observes body progress, then feeds exact folded-trailer hex
`300d0a582d456e643a2066697273740d0a207365636f6e640d0a0d0a`.
llhttp returns `HPE_INVALID_HEADER_TOKEN`;65,646 bytes and one handler were
already visible. The origin abort is observed. The staged runtime instead sends
zero bytes for the same late-fold class, but waits for completion and applies
finite1.5MiB/2MiB/2500ms stage/request limits. A client waiting for origin
progress before completing chunked syntax receives408 with zero origin activity.

Thus early progress and zero-origin-byte rejection of a subsequently invalid
trailer do not coexist in this tested H1 chunked admission design. Finite disk
staging is not indefinite end-to-end streaming. Known-length streaming has the
independent premature-EOF failure above as well as failing to remove the
chunked/trailer conflict. The runtime is a bounded finite experiment, not a
complete syntax-before-origin admission boundary. These are scoped executable stops,
not a universal impossibility claim for other protocols or architectures.
No contract change, original-oracle repair or runtime GO is claimed. No further
design expansion is scheduled by A.

## Retained Attempts And Prompt Findings

Required rules, master plan, architecture/threat/config/quality docs, ADR011/012
and prior A/D/F plus B/C/E/completion reports were read. The handoff permits
isolated feasibility research while production Modules04-12 remain locked;
the implementation stays under `spikes/`. Original75/23 sources, assertions,
windows and baseline checker were never edited. Baseline checker verifies11
protected files on every executed wire run. Its73/75 and19/23 values remain
historical: A does not relabel77 additive controls as original repairs.

Runs01-06 retain compile, write-only stage replay, empty post-header transition,
and transport-closure failures. Fixes use new committed sources and fresh run
directories. Runs07/08/09 pass their68/75/75 additive controls respectively.
Run10 refuses uncommitted verifier source before fixtures while queued on the
shared lock. Run11 passes75 controls including both EOF additions, then its
settled transport check fails after the raw-handshake cap. F separately reports
the same class of settled timeout on source01ceb3e in its independent evidence;
that source is superseded for the final claim.

With `allowHalfOpen`, incomplete raw TLS peers could retain accepted transport
state beyond the harness settlement deadline. Source1019a60 adds an explicit
TCP accept timer, clears it only at successful TLS admission, and destroys TLS
error sockets. Final run12 executes77 controls through unknown-SNI denial,
origin hostname verification and the streaming counterexample; complete cleanup
and verifier exit0 establish the corrected local lifecycle. F reports an
independent full-proof PASS at source1019a60, reproducing the bounded controls
and corrected lifecycle. Its separate EOF attack above still has
`security_pass:false`; passing the existing proof does not establish complete
stream admission safety. The earlier failed independent attempt remains retained.

## Agent Completion Report

- Module: Sprint05C A, Module01 bounded H1 feasibility only.
- Status: bounded finite implementation/proof complete; known-length premature
  EOF and chunked late-trailer conflicts are technical stops. Complete stream
  admission and runtime acceptance remain blocked.
- Commits/files: source1019a60 and owned `spikes/envoy/sprint05c-a-*`, A plan,
  receipts and this report only; evidence/report commits follow source.
- Architecture/ADR decisions: none; no runtime selection or human approval.
- Contracts changed: owned test binding only; original75/23 remain immutable.
- Positive tests: exact locked command above exit0;77 additive controls,
  653 split boundaries and six native byte-at-a-time controls; verifier exit0.
- Security negatives: historical folds, trailer/framing/identity/pipeline/TLS,
  quotas, cancellation and deadlines measured as specified above; F's independent
  CL10/abc/EOF counterexample fails strict truncation-zero admission after89
  origin bytes/one handler, with valid CL3/EOF control200/84bytes.
- Performance: bounded observations only, no benchmark/soak/resource eligibility.
- Known risks/blockers: known-length truncation-zero failure, finite staging/stream
  conflict, H2/WS/gRPC, origin pooling,
  production SSRF/policy/auth/signed-config/TLS rotation/crash lifecycle,
  independent F review, root full scanners/quality/hosted gates and human approval.
- Human review needed: disposition of the independently reproduced admission
  failures and architecture/security gates; F full-proof reproduction alone grants no GO.
- Next unblocked work: independent review of this scoped result; no locked module
  or broader runtime work is authorized by its successful local proof.
