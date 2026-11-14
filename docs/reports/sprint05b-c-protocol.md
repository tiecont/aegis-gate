# Sprint05-B C Supplemental Protocol Disposition

Status: partial, no executable protocol repair accepted. Native follow-up below
completes the bounded setting measurements and peer attribution. Module01 remains
NO-GO and Modules04-12 remain locked. Root integrates; nothing pushed or merged.

## Scope And Evidence

Baseline is main `8758b1c84b4186449cd79fabae461ca53ee05100` and its separate
combined05A compiler. The first operation executing protocol probes was the
unchanged original23 suite, with a passive diagnostic import. Attempt01 binds
clean source `215dd359d13bc316ce04a128b0f6de8898b30522`, its tree and every
relevant source SHA256. It reproduces **19/23**, raw child exit1. The collector's
exit0 means collection completed, never that the security contract passed.

Pinned runtime: Node26.13.0, binary SHA256
`0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`;
Envoy1.40.2 release source `b2d89e0ae53916f28770771fbdd49c5c99c5c5a2`, image
`envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`;
Docker29.9.3; OpenSSL4.1.0. Image ID/digests, actual Envoy version, argv,
environment, raw stdout/stderr, exact exits/signals, bootstrap hashes and
SHA256SUMS are in each attempt. No request payload, deadline, observation
interval, expected result, evaluator or original observer was edited.

## Supported Hypotheses

The additive compiler always retains combined05A's upstream H2 receive windows
65535/65535 and downstream stream-level invalid-message rejection. Config
selection redirects only the recovery launcher's compiler import. The original
23-case file runs directly, with its unchanged assertions.

| Attempts | Hypothesis | Actual Result | Disposition |
| --- | --- | --- | --- |
| 01 | combined05A baseline | 19/23, original four failures | Retained failure |
| 02,03,07 | untapped baseline repeat | 0 cases; original listener readiness failed | No protocol evidence |
| 04,08 | delayed_close_timeout=0s might flush errors immediately | 0 cases; original listener readiness failed | Not evaluated |
| 05 | delayed_close_timeout=1s might allow pending errors to flush | 0 cases; original listener readiness failed | No protocol evidence |
| 06 | request_headers_timeout=500ms might terminate incomplete header state | 18/23; original four plus termination drain deadline | Rejected |
| 09 | delayed_close_timeout=1s repeat | 18/23; original four plus termination drain deadline | Rejected |

The extra drain failures occurred amid slow Docker shutdown and do not establish
that the changed setting caused the failure. Neither completed variant preserves
all repaired19 assertions in these executions, and neither repairs an owned
failure. The zero-delay variant has no executable verdict. Repeated Docker
starts were stopped at root's direction after09; root's separate native-image
extraction is outside these measurements. Docker version preflight itself took
approximately28-46s in several attempts; failed readiness remains a setup
failure, not an assertion waiver or a reason to extend any original deadline.

## Four Scoped Stops

| Probe | Observed Behavior | Contract Disposition |
| --- | --- | --- |
| settled-reuse-identity-and-three-authority-negatives | Native client reports rst_code1 for user@edge-b.test; no400/421 | FAIL retained |
| individual-settled-userinfo-denial | rst_code1; origin bytes/handlers0 | FAIL retained |
| raw-H2-HEADERS-stream-zero | Peer closes; received_frames=[]; origin bytes/handlers0 | FAIL retained, required peer PROTOCOL_ERROR missing |
| raw-H2-zero-WINDOW_UPDATE | Peer closes; received_frames=[]; origin bytes/handlers0 | FAIL retained, required peer PROTOCOL_ERROR missing |

On the pinned current Node, the two historically deadline-labelled probes fail
with ERR_HTTP2_STREAM_ERROR/NGHTTP2_PROTOCOL_ERROR, rather than a successful
400/421. This change in symptom does not change either assertion or verdict.
The compound probe's126 origin bytes and two handlers are its preceding valid
requests; the individual userinfo interval has zero origin traffic.

The additive tap records both raw TLS frame directions and native HTTP2 stream
events. For the raw frame failures it captures the exact sent HEADERS0 and
WINDOW_UPDATE0 and no incoming error frame before peer close. Their sent
hex also remains in the authoritative original result. No client HTTP2 CANCEL
is injected by the tap. For native userinfo, Node bypasses JS socket data/write;
the tap cannot independently retain the peer's raw RST bytes. It records
rst_code1 already set when Node internally calls destroy, followed by
ERR_HTTP2_STREAM_ERROR, and no explicit client close(CANCEL8) call. This is
native-session evidence, not a raw peer-frame attribution claim. That remaining
instrumentation limit is an exact scoped stop; no client-generated cancellation
is counted as an Envoy rejection.

Pinned upstream sources are retained once in `evidence/sprint05b-c/source-01`.
In codec_impl.cc:1092-1136, dispatch returns early on callback status or
ProcessBytes failure, before the terminal sendPendingFrames call. At1432-1475,
fatal frame categories return ERR_CALLBACK_FAILURE, while stream messaging
errors can retain stream-local handling. HCM conn_manager_impl.cc:562-571 closes
with FlushWriteAndDelay and assumes H2 GOAWAY was already sent. These paths
support a pending-frame explanation for HEADERS0/WINDOW_UPDATE0, but the
measurements do not prove an internal queued GOAWAY existed. A close-delay knob
does not by itself establish that a missing frame was generated.

The published HCM proto explicitly labels typed_header_validation_config
hidden/unimplemented; its validator extension is also hidden. The codec
selection field is likewise hidden. They were excluded as unsupported repair
paths. No parser/codec fork, permissive validation flag, custom ingress parser,
production integration or architecture reversal was introduced.

## Cleanup And Collision Correction

Every fixture runner holds `/tmp/aegisgate-sprint02-fixtures.lock` through setup,
capture, cleanup and evidence hashing. Root reported duplicate C orchestration
and stopped the other writer; this worktree then continued with a sole writer.
Existing work was preserved. The verifier binds captured source hashes back to
the recorded committed objects, and protected files match baseline. Earlier
concurrency remains a limitation: these runs are not independent reproduction.

Original cleanup in attempts02-05 missed four Docker containers that completed
Create after launcher shutdown. Their historical cleanup_complete flags are
**superseded**, not retroactively fixed. Locked cleanup01 at source0cd8011
records mount-only ownership proof for all four, exact docker rm --force exits0,
absence checks and six subsequent observation rounds. Attempts08/09 use this
correction and remove their own late Created containers. No unrelated container
was removed. The new collector names its version container, polls for late
creates, and scopes all removal to that name or mounts under this worktree's
`.local`. It cannot promise against an indefinitely delayed Docker operation
beyond its recorded observation interval. At the final handoff, a fresh scoped
Docker inventory found no aegis-envoy container, all C children had exited and
this worktree's `.local` was empty. No more C fixture starts are queued.

## Reproduction

From this worktree, use a fresh attempt number and the pinned main Node:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint05b-c-run.mjs evidence/sprint05b-c/attempt-NN baseline
```

Modes: untapped, flush-zero, flush-long, header-timeout. Docker startup is
currently unreliable; root requested that further starts wait for its native
fixture. The report does not authorize deadline changes. Offline verification:

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint05b-c-verify.mjs evidence/sprint05b-c/verify-NN
```

## Native Follow-Up And Ownership Provenance

Root initially reported that another CLI worker owned C and instructed STOP.
This writer stopped without reverting. Root then explicitly corrected that
instruction, designated this writer sole C owner and stated duplicate CLI
C2083269 was interrupted. On resumption, `git status --porcelain=v1
--untracked-files=all` was empty at e3473c5; there was no duplicate untracked
source to adopt. Existing commits/evidence were preserved. Earlier reference
to session01a1db3c-7e26-7383-8684-bf216011dacf reflects root's superseded ownership
message, not independent process attribution. Root's newest ownership direction
governed subsequent work. No other writer changes were observed in this tree.

Root's extraction receipt at
`/home/tiecont/Projects/aegis-gate/evidence/sprint05b-root/native-extract-01/receipt.json`
records sourcef0e9792, image identity, Docker create/cp, actual native version,
dynamic libraries and removed extraction container. The extracted Envoy binary
SHA256 is `1d64506e25c1844f146162ddb2ece7010fa4e784faddb40a079021491f1f03cc`.
C verifies the extraction receipt, expected image and actual binary hash before
each native run. Each receipt binds the extraction receipt SHA256/source,
binary path/hash, current source/tree, runtime libraries and argv. The owned
launcher matches root's reviewed mechanism: prlimit core0/nofile1024/cpu180,
one Envoy worker, same pinned compiler and TLS validation, no cgroup isolation.
It is test-only and cannot establish container memory/PID or production resource
eligibility. No Docker containers are started by these native runs.

Clean sourcebb9820f executes the unchanged suite directly; the resolver replaces
only recovery-launcher's entry point. Attempt10 is untapped. The original
payloads/deadlines/assertions and upstream observer remain unchanged throughout.

| Native Attempt | Mode | Actual Result | Verdict |
| --- | --- | --- | --- |
| 10 | untapped combined05A | 19/23, same four failures | Baseline reproduced |
| 11 | delayed_close_timeout=0s | 19/23, same four failures | No repair |
| 12 | delayed_close_timeout=1s | 19/23, same four failures | No repair |
| 13 | request_headers_timeout=500ms | 19/23, same four failures | No repair |
| 14 | baseline plus verified downstream TLS relay | 19/23, same four failures | Additional attribution only |

All five raw suite exits are1; collectors exit0. Native11-13 preserve repaired19,
including uppercase/connection-specific header RST1, backpressure/cancellation,
pooling/identity, stream/connection caps and termination drain. This resolves
the earlier setup obstruction without discarding the Docker18/23 evidence or
attributing its extra drain failure to a particular setting.

Attempt14's additive relay forwards plaintext bytes unchanged between two
verified TLS endpoints, retaining bounded frame metadata in both directions.
It changes the downstream diagnostic transport and is not baseline timing or
resource acceptance evidence. The upstream origin observer and suite assertions
remain authoritative. Both userinfo failures have actual Envoy-to-client
RST_STREAM1 bytes `00000403000000000100000001` (relay connections6 and9).
The relay's upstream certificate is authorized, SNI=edge-b.test and ALPN=h2.
No client RST precedes those peer frames; the native client subsequently sends
GOAWAY0. Separately, response/upload cancellation controls emit client-to-Envoy
RST_STREAM8 bytes `00000403000000000100000008` on connections11/12. This closes
the earlier native raw attribution limitation for this separate diagnostic;
peer RST1 is still not the original required400/421, so both userinfo assertions
remain FAIL. No CANCEL is credited as a peer rejection.

The same run's raw HEADERS0 and zero WINDOW_UPDATE sockets are direct: original
received_frames=[] and peer_closed=true, with zero origin bytes/handlers. Thus
all four exact scoped stops remain. No unsupported codec/UHV field was enabled.
After14, all C launchers and native children exited, the worktree's `.local`
was empty, and the global fixture lock was released. No further retries are
needed for these three bounded hypotheses.

Native reproduction uses a fresh attempt directory and an existing verified
root extraction (same pinned main Node as above):

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint05b-c-run.mjs evidence/sprint05b-c/attempt-NN untapped native
```

For the separate frame diagnostic use `baseline native relay`. That diagnostic
must not replace the untapped baseline or justify any assertion exemption.

## Agent Completion Report

- Module/status:01/C, partial; four supplemental failures unresolved.
- Files/commits: owned sprint05b-c source/evidence and this report only; source
  checkpoints215dd35,5d377ef,f84ecc2,32bd18b,0cd8011,8b98df6.
- Architecture/contract changes: none; no gate opened.
- Positive/security tests: Docker baseline19/23; two Docker variants18/23;
  six setup failures0 cases; native baseline and three variants19/23 plus separate
  relay19/23. Exact commands/raw exits retained in receipts.
- Offline verifier at clean source787ad0f exits0:155 evidence checksums and873
  captured-source hashes match their committed objects; owned script syntax,
  protected corpus equality and retained window/stream-error invariants pass.
  Receipt `evidence/sprint05b-c/verify-01/receipt.json` explicitly keeps
  semantic_security_pass=false. A scoped private-key PEM marker search found
  no matches; this is not a replacement for independent security review.
- Performance: no throughput, production memory, fairness or load claim.
- Risks/blockers: four failures, original75 issues outside C, diagnostic relay
  transport limitations, Docker setup/shutdown and earlier collision.
- Human review: root/F must assess bounded evidence; no security/architecture
  approval requested or fabricated.
- Next action: root/F independently review native source/evidence and retain
  all four failures; no supported repair among these bounded settings.
