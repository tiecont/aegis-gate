# Sprint04-C B — Maintained ingress dependency and focused reproductions

Status: **upstream-dependent NO-GO; no eligible runtime candidate**. The
released strict-fold/provenance blocker is unchanged. A supported local-reply
mapper now has executable partial TE proof, but it does not repair folding,
prove the full engine or change the original69/75 result. Modules04–12 remain
LOCKED; production BLOCKED. Architecture/security owner and approval PENDING.

## Scope and exact provenance

Branch `research/sprint04c-envoy-upstream`, isolated worktree
`/tmp/aegisgate-04c-b`, base `a325b9ecc086e09467f61b49f17da241bf8e43ea`.
B owns this report, `evidence/sprint04c-b/` and additive `sprint04c-upstream*` /
`sprint04c-repro*` sources only. No original source/corpus/evaluator is modified.

Source precedes proof:9885a86 adds the collector/H1 source;685a354 records the
official refresh and H2 source;4983886 adds drafts and owned cleanup;deb34bd
retains H1/first H2 receipts and fixes H2 completion observation. Later report
and verifier commits are identified by Git, not a self-referential hash.
Every collector records exact source commit/tree, tracked-clean status,
argv/cwd, UTC times, Node executable/version/hash, source hashes, child commands,
exits and raw stream hashes. `commands.json` plus `SHA256SUMS` bind each attempt.
Unchanged fetched source stdout references the retained04-B raw file and exact
hash, avoiding another copy; fresh HTTPS fetch argv/time/exit are still recorded.
Source retrieval is metadata/source research, never external protocol probing.

## Released capability refresh

Fresh collection `upstream-01` executes successfully at9885a86. Official
GitHub latest stable/tag metadata and immutable raw HTTPS source are retained
or hash-bound. None of the19 inspected released files differs from04-B.

| Project | Official stable release / released revision | Current finding |
| --- | --- | --- |
| Envoy | v1.40.2 / `b2d89e0ae53916f28770771fbdd49c5c99c5c5a2` |13 released files identical; no new released strict-fold hook established |
| Pingora |0.9.1 / `f86ffda5d3ae5c3baf5125682138b33b26c01b08` |4 released files identical; original-target retry and framing policy gaps remain |
| Hyper |v1.12.0 / `7f67699ce32d717081deb7018b4da7d679277ac0` |2 released files identical; incoming CL/TE and URI provenance gaps remain |

Official release pages: [Envoy](https://github.com/envoyproxy/envoy/releases/tag/v1.40.2),
[Pingora](https://github.com/cloudflare/pingora/releases/tag/0.9.1),
[Hyper](https://github.com/hyperium/hyper/releases/tag/v1.12.0).
Fresh default snapshots are **unreleased research**: Envoy
`cacf8e230c8b8ed021feedd53fa9209aecbe13d8`, Pingora
`3f87e92c982ee27c714506e16ae362776faea4aa`, Hyper
`b1e7eabff4683a4fa6a9f97479736a325437bae6`. Envoy/Hyper heads advanced, but all
five inspected default-branch parser files are byte-identical to04-B too.
A version or default-head change is not itself a runtime rebuild trigger.

| Capability | Exact source/API evidence | Disposition |
| --- | --- | --- |
| H1 obsolete continuation rejection | Envoy `source/common/http/http1/balsa_parser.cc:181` sets continuation disallow=false;304–305 raw-header/trailer callbacks are no-ops;428–464 common processing removes CR/LF. `balsa_parser.h:39` starts private callbacks. | No supported public pre-normalization strict-fold rejection hook proved in this inspected release. Folded-header normalization executes below; trailer delivery remains unproven. |
| Parsed header/trailer validator | `envoy/http/header_validator.h:54,69,96,104` operates on parsed maps. | Supported extension point, insufficient to reconstruct removed syntax. No private callback or codec fork is proposed. |
| H2 identity | `source/common/http/http2/codec_impl.cc:2188,2523–2524,2585–2607` and retained runtime feature expose original Host retention. | Supported partial hook; full verified-SNI/authority/tenant binding before all origin effects remains project integration/proof. |
| TE local reply | H1 `codec_impl.cc:917–925` selects501 for unsupported TE. HCM proto/local-reply implementation support status mapping. | Supported partial API, now executed: status-only local501→400 mapper succeeds for four vectors; origin501 preserved. Default contract failure remains. |
| Valid target/order | Existing `normalize_path=false`, `merge_slashes=false`, `KEEP_UNCHANGED` and normal keepalive. | Six encoded targets and two-request pipeline execute unchanged in the focused H1 fixture. No whole-candidate acceptance. |
| Pingora incoming strictness | `pingora-core/src/protocols/http/v1/server.rs:400–455` removes CL with TE and retries illegal targets through escaping; `apps/mod.rs:64–96` exposes no inspected no-retry strict policy. | Missing released original-target/framing path; low-level pipeline APIs do not prove ProxyHttp integration. No new Pingora runtime. |
| Hyper incoming strictness | `src/proto/h1/role.rs:225–230,275–300,359–361` constructs URI/removes or skips CL and disables keepalive when CL+TE coexist. | Bounds/keepalive/pipeline builders are partial controls, not incoming reject-both/raw-target hooks. No new Hyper runtime. |

Paths above resolve to `evidence/sprint04b-b/upstream-02/<project>/released/`
and are freshly hash-revalidated by the04-C collector. These are scoped public
source findings, not proof about every older branch, third-party extension or
future release. Maintenance ownership remains upstream for public parser/API
behavior, AegisGate for supported integration, pinning, policy and full proof.

## Focused H1 runtime evidence

Existing released image only: `envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`.
No image/candidate rebuild. `reproh-01` source
`4983886399e0fbb6a01d16313f37b305ea8de050`, tree
`76af4fbda921f0be2a20ffc1f3107e1d831edfc9`,2026-11-14T08:58:22.524Z to
08:58:42.308Z; collector exit0,29 completed observations. This exit means the
expected observations completed; folded traffic remains a security failure.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint04c-repro-h1.mjs evidence/sprint04c-b/reproh-01
```

Fresh output is required; use a new suffix when reproducing. Original receipt
argv captures the actual invocation, rather than silently reusing a result.

| Input/control | Actual observed outcome |
| --- | --- |
| Unfolded versus folded `X-Folded` header | Both200,177 decrypted origin bytes,one handler; both deliver `first second`. Raw downstream syntax differs while parsed field is indistinguishable. |
| Unfolded versus folded trailer | Both200,214 origin bytes,one handler; both native handler trailer maps empty. Trailer forwarding/normalization is **not proved** by this result. |
| Four historical TE vectors, default listener, fresh/reused downstream | All eight return501 and actual peer end; zero request-interval origin bytes,new connections,handlers,parser/transport errors. Warmup effects are separately retained. |
| Same vectors, supported status-only local-reply mapper | All eight return400 and actual peer end; same zero origin counters. This supplies newly executed partial mapping proof, not a passing original corpus. |
| Actual upstream501 on both listeners | Remains501, with actual origin bytes/handler. Local mapper does not remap this control. |
| Six valid encoded targets; ordered pipeline | Six200 with exact target at handler; pipeline200/200 and expected URL order. |

The four vectors are invalid TE, repeated chunked, nonfinal chunked and repeated
TE fields. The first three come from the immutable manifest; duplicate fields
use the retained supplemental vector. Diagnostic fresh/reuse cases replace the
Connection header with keep-alive to prove actual peer closure. Original75
raw inputs, expectations and evaluator are untouched. This does not demonstrate
every possible501 reason, future codec behavior or production mapper safety.

The direct verified-TLS observer positive control captures exactly76/76 request
bytes. The relay taps decrypted bytes before native HTTP parsing; counts are
not the invalid native-socket tap from04-B repro01. All requests/responses and
origin bytes are retained as hex. Both TLS hops verify the disposable CA/exact
DNS SAN/SNI; no verification bypass. Container is one CPU/256MiB/64PIDs; at most
40 requests,32KiB per response,2.5s per observation,90s intended wall bound.
Actual measured fixture lifecycle19,561ms; container absent and PKI removed.

## Minimal H2 identity/side-effect evidence

`reprot-02` source `deb34bd17344856b426924238d85013069f07429`,2026-11-14
09:00:13.739Z to09:00:17.099Z, collector exit0. It uses the existing isolated
recovery configuration and Lua identity policy plus Host-retention runtime
control; it is **project integration behavior**, not a bare upstream default.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/sprint04c-repro-h2.mjs evidence/sprint04c-b/reprot-02
```

Five bounded raw requests retain exact downstream preface/SETTINGS/HEADERS hex,
TLS identity, received frame bytes, all origin raw bytes/connection/frame/handler
and parser/transport counters. Valid warmup reaches one origin handler257
bytes; final valid reuse reaches one handler47 bytes with no new native
connection. Both responses reach END_STREAM before the3.5s deadline.

Host mismatch and authority mismatch return HEADERS+GOAWAY; userinfo closes
without response frames. All three diagnostic negative intervals observe zero
origin bytes,new native connections,request HEADERS/DATA and handlers. HTTP
status/HPACK is **not decoded** by this B frame-envelope observer. No full
request/HPACK attribution or conformance/security acceptance is claimed.

This harness does not reproduce the original nine-byte interval: its valid
warmup includes the SETTINGS ACK. It does not modify original observation timing
or expectations and cannot replace that failed assertion. The original H2
failure remains9 bytes/zero handlers, hex `000000040100000000`; it still FAILS.
Raw control traffic is retained, never subtracted. D/F own stronger attribution
and adversarial observer proof. Raw capture is capped32KiB and marked incomplete
on overflow; all five requests fit the bound. Native origin sessions, loopback
relay, launcher/container, generated launcher files and PKI clean up under lock.

Retained `reprot-01` is an **ineligible response-completion measurement**:
its frame summary intentionally omits DATA events, but the collector wrongly
looked there for DATA END_STREAM; the two valid controls therefore waited to
deadline. Collector exit0 was receipt completion, not valid protocol acceptance.
The corrected source separately observes all frame envelopes, ACKs SETTINGS,
requires both valid response completions, and reruns in02.01 is not rewritten.

## Actionable upstream dependency and stop

[The maintainer drafts](../../evidence/sprint04c-b/upstream-requests.md) are
**NOT PUBLISHED**. They specify version/reproducer/actual behavior, distinguish
product behavior from requested project policy, and request a supported strict
header/trailer rejection policy before irreversible normalization. They also
ask for stable codec-reason mapping and pre-origin identity ordering semantics.
No unsupported vulnerability, exploit or maintainer commitment is asserted.

Stop: no maintained released API addresses the strict-fold provenance blocker.
Do not rebuild the complete known-failing proxy or create a private production
parser/codec fork. The supported mapper reduces uncertainty in one partial path;
it does not supply the missing capability and does not trigger a full run.

Resume only after an exact released supported strict-fold/header/trailer and
original identity/framing capability demonstrably changes the historical failing
behavior. Prove old failures first, then unchanged75, all mandatory H1/H2,
verified TLS/SNI/hot certs,WS/gRPC,cancellation,encoded targets/pipelines,pools,
signed generations and resource negatives; review dependencies; obtain independent
F reproduction and recorded affirmative human architecture/security approval.

Historical counts are retained, **not rerun by B**: Pingora63/75,Envoy69/75,
Hyper70/75 and supplemental16/23. All six original Envoy failures and seven
supplemental failures remain open.75/75 alone would not grant GO.

## Agent Completion Report

- Module:01 maintained upstream dependency; status: scoped research/reproducer
  package COMPLETE, runtime candidate NO-GO.
- Commits/files: B-owned additive sources,drafts,compact raw receipts,this report.
- Architecture/ADR decisions: none; human owner/decision PENDING.
- Contracts changed: none; original75/23 and aggregate zero-byte remain binding.
- Tests: official refresh and focused H1/second H2 collectors exit0 as scoped
  above; first H2 completion measurement retained ineligible. Verifier `checks-01` at sourcec15776f exits0: source/stream hashes and four attempt manifests verify; immutable/protected-baseline, five syntax checks and authored whitespace all0.
- Performance: bounded correctness only; no capacity/fairness/SLO claim.
- Blockers: strict provenance API, full runtime/resource proof and formal human
  decision; no production/Module04 implementation authorized.
- Human review: publication remains unauthorized; root/F exact-source review
  required. Next unblocked work is maintained API enablement/decision handoff.
