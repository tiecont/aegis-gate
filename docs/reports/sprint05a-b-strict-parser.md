# Sprint05A B: executed released strict-parser proof

Status: **COMPLETE for targeted research; Module01 remains NO-GO**. A released,
maintained parser capability is now proved: unmodified llhttp9.4.4 rejects
obsolete folding in both request headers and chunked trailers before consuming
the continuation byte. The bounded local admission PoC proves400, actual peer
closure and zero origin activity for those requests. This is not a complete
maintained front end, production substitution, or original75/23 gate pass.

## Exact handoff and scope

Branch `feat/sprint05a-strict-parser`, worktree `/tmp/aegisgate-05a-b`.
Evidence component head before this report:
`fa062873d96531dfbebca3c51089de0d48d51587`. Runtime source commits/trees are in
each receipt; the report commit is the subsequent Git log entry, avoiding a
self-referential commit ID. All changes are additive owned `sprint05a-b*`,
`evidence/sprint05a-b/` and this report. All4,003 tracked baseline objects from
`541d1d915ce6a3b679dc3fed3ea0a98f908ce001` retain identical mode/type/blob ID.
Inherited Sprint05A root additions were not edited.

The user explicitly authorized isolated alternative PoCs, superseding04C's
conditional implementation stop for that local scope. Production boundaries,
architecture, acceptance policy and human approval fields remain unchanged.
No push, merge, worker, public listener, public protocol test or maintainer
message was used. Source research used official HTTPS endpoints only.

## Released sources and inspected semantics

| Released component | Exact pin | Finding |
| --- | --- | --- |
| Envoy1.40.2 | `b2d89e0ae53916f28770771fbdd49c5c99c5c5a2`; image `envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded` | Balsa constructor sets `disallow_header_continuation_lines=false`; private `OnHeaderInput`/`OnTrailerInput` are no-ops; map processing removes CR/LF. Released strict chunk handling is unrelated to continuation rejection. |
| llhttp9.4.4 | official `release/v9.4.4`, published2026-11-13; `816485216511b86459b2e6478190e14c38c14891` | Released generated `header_value_lws` checks lenient headers, otherwise sets `HPE_INVALID_HEADER_TOKEN`, reason `Unexpected whitespace after header value`. Empty-value continuation has the same strict rejection. Trailer parsing reuses field states after `F_TRAILING`. |
| Nginx1.30.6 | `fb0e979c6dd63c018958b41eeb844947c5c21264`; image `nginx@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311` | Header-start parser rejects whitespace; request body calls `ngx_http_parse_chunked(...,0)`, whose trailer states discard field lines without header-name validation. |

Official release metadata, source URLs, complete per-file hashes, API/source
excerpts and licenses are pinned in `source-01/sources.json` and its receipt.
llhttp generated C SHA256:
`f3ef756529b7444630717fa5540d4a1c9a1256874bda823c49c5a99c37f89429`;
public header SHA256:
`52a7011f979b31f761403c1a333bf7fc26dc70f5745d8488eed1609c92097100`.
Generated C remains outside Git and is reproducibly fetched by immutable URL
and verified before build; no upstream source patch or private fork exists.
Release activity establishes a maintained upstream candidate, not an exhaustive
advisory/dependency approval. HAProxy, Pingora and Hyper were not rerun because
04C established no new supported capability for their disproved paths.

## Measured results

| Targeted assertion/control | Envoy supported Balsa options (`envoy-02`) | llhttp (`llhttp-03`) | Nginx (`nginx-02`) |
| --- | --- | --- | --- |
| SP/HTAB folded header, fresh/reused; fragmented header | All200;197 origin bytes | All400/peer end;zero origin bytes/dials/handlers/errors | All400/peer end;zero origin activity |
| SP/HTAB folded trailer, fresh/reused; delayed trailer | All200;236 origin bytes | All400/peer end;zero origin bytes/dials/handlers/errors | All200;96 origin bytes;trailers discarded |
| Valid unfolded header/trailer | Both200;197/236 bytes | Both200;100/139 bytes; trailer `X-Folded: first second` retained | Both200;100/96 bytes;trailer discarded |
| Six unchanged encoded targets |6/6 exact targets,200 |6/6 exact targets,200 |5/6;`/bad%00target` returns400,zero origin bytes |
| Valid ordered pipeline |200/200,correct URL order |200/200,correct URL order |200/200,correct URL order |
| Valid then folded-header pipeline |200/200;both requests forwarded |200/400;exact52 bytes of first valid request only |200/400;71 bytes for valid request |

There are20 wire observations in each main runtime attempt,22 in llhttp03
including the two exact original manifest inputs. The ten fold assertions
change from Envoy0/10 to llhttp10/10; Nginx5/10. These are PoC counts, not a
replacement evaluator or a revised original75 score. Original75 remains
Pingora63/75, Envoy69/75, Hyper70/75 by immutable historical evidence.

The exact `malformed-HTTP-obsolete-folded-header` and
`strict-ingress-TE-obsolete-fold` request strings were imported from the
unchanged manifest, sent without substitutions and independently checked for
byte equality. Both return400, actual peer end, no timeout and zero origin
bytes/new connections/handlers/parser errors/transport errors.

On llhttp,16 direct malformed cases (two fields x four feed sizes1/2/7/65536 x
strict/relaxed-value modes) reject at the same original SP/HTAB offset with
zero completed messages. Eight valid-trailer controls complete normally. Raw
callback spans never contain the continuation `second`; error position is
immediately after original CRLF. This establishes rejection before unfolding,
including the released `llhttp_set_lenient_header_value_relaxed` API without
enabling lenient header syntax. Raw callback/error receipts are retained.

The mixed pipeline is **not an aggregate zero-byte observation**:52 valid
origin bytes remain in its interval. The receipt retains all bytes and exactly
one valid handler; no invalid request bytes are forwarded. No byte subtraction,
timing shift or acceptance-contract change is proposed.

## Adapter and observer limits

The C driver only initializes upstream APIs, accumulates callback URL/spans,
pauses at `on_message_complete`, and reports upstream offsets/keepalive state.
The Node test adapter admits original byte slices only after that callback;
it never scans raw framing, repairs syntax or reconstructs normalized HTTP.
It buffers at most32KiB pending input and reparses that bounded pending input
with the maintained parser on fragments. It uses a subprocess test driver,
not a production parser/runtime implementation. No production files changed.

Waiting through trailers before admission is essential for this zero-byte
proof. Streaming a request upstream after headers could leak valid prefix
bytes before the parser detects a later malformed trailer. The delayed-trailer
case records zero bytes/connections/handlers before the final fragment under
llhttp; Envoy streams prefix bytes, and Nginx buffers but still accepts the
malformed trailer. No claim is made for unbounded bodies, WS/gRPC/H2, tenant
identity/SNI policy, snapshot integration, general resource safety, throughput,
cancellation, TLS negative matrix or pool isolation.

All client, relay and origin listeners bind127.0.0.1. Client/front, front/relay
and relay/native-origin TLS verify the disposable CA and exact DNS identity.
The relay records plaintext before the native HTTP parser. Its positive
control captures76/76 exact bytes, then each probe snapshots bytes/connections/
handlers/errors. Fresh/reused downstream intervals retain warmup separately.
Clients never send FIN; peer closure is observed. Each attempt holds the shared
flock through PKI creation, runtime, capture, cleanup and SHA256 finalization.
PKI was removed and every owned container is absent, including failed starts.
Bounds and exact argv are in receipts; Node26.13.0 at the user-specified path,
GCC16.2.1, OpenSSL4.1.0; Docker/image versions are retained.

## Reproduction and retained failures

Run from this worktree with a fresh output suffix; never overwrite old evidence:

```sh
NODE=/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node
"$NODE" spikes/envoy/sprint05a-b-restore.mjs
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-b-run.mjs envoy evidence/sprint05a-b/envoy-03
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-b-run.mjs llhttp evidence/sprint05a-b/llhttp-04
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-b-run.mjs nginx evidence/sprint05a-b/nginx-03
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-b-verify.mjs evidence/sprint05a-b/verify-04
```

For the explicit extension attempt, use `envoy` with final argument `uhv`.
The unchanged source collector was executed as `source.mjs
evidence/sprint05a-b/source-01` (full filename has prefix `sprint05a-b-`).
Official downloads are read-only research; fixture execution needs cached
digest-pinned images. `restore.mjs` requires official HTTPS source access and
checks every downloaded hash. Runtime runner refuses dirty tracked source.

| Attempt | Exact source commit | Exit/result |
| --- | --- | --- |
| source01 | `1839087c3923feb37dc3068c506458e28192975b` |0;official source/release pins |
| envoy01 | `b97da1668d68e783d2311000394a1205acd0ee51` |0 observations;securityFAIL;obsolete parser-selection guard logged |
| llhttp01 | `865d98ced7211ccab4ab718b06b10232fd8e9c6c` |1;generated upstream unused parameters under `-Wextra -Werror`;no runtime claim |
| llhttp02 | `4513c9600196a26d7c75c955e0529e70ca5f356e` |0;20 wire +24 direct controls |
| nginx01 | `816d742ea9d8944322a9559a55b445e8216e5665` |1;read-only default FastCGI temp path;no requests |
| nginx02 | `a64cd6aa94e4a9429f8eb6d172940c7b71a94f45` |1;20 observations retained;unchanged valid encoded-NUL assertion fails |
| validator01 | `e984eb6d9b1bf3bd3dac8b58a6e58dfd3fd8b83c` |1;shipped image says `does not support header validator extensions`;no requests |
| envoy02 | `8ddd6cf8d25407dd9b35ae8f9290db081c168585` |0 observations;securityFAIL;supported strict-chunk setting,obsolete selector removed |
| llhttp03 | `5e685457f5c0c4e4071be4224fbef30e38dd6f16` |0;22 wire +24 direct controls;source tree `6dfe4b5b358c7998a053606c1659be3aa3211dfe` |
| verify01 | `76b6e03` (full ID in receipt) |1;raw retained upstream/tool whitespace;all preceding parser and baseline-object assertions passed |
| verify02 | `fa062873d96531dfbebca3c51089de0d48d51587` |0;hashes/source bindings/narrow assertions,4003 baseline objects,manifest,authored whitespace,owned secret scan |
| verify03 | `133d3eae70fa6dfe6b27ee0b4ca0ce08b8d44dcf` |0;same checks after report commit `76ec22a`;report included in owned secret scan |

No failed attempt was edited or removed. Raw-output whitespace is retained
verbatim; authored source/plan/report whitespace is checked separately. The
test driver passes `-Wall -Wextra -Werror`; unmodified generated upstream C
passes `-Wall -Werror`. No parser/TLS/authorization setting was weakened.

## Agent Completion Report

- Module:01, Sprint05A Agent B targeted strict-parser research.
- Status:complete research;partial capability only;runtime release gate NO-GO.
- Commits/files:source precedes runtime as above;owned PoCs, receipts and report
  only. Final report/evidence commits follow the exact component handoff head.
- Architecture/ADR decisions:none accepted;new-boundary review still required.
- Contracts changed:none;original75/23,baseline tests,threat model preserved.
- Positive/security tests:exact commands and observed outcomes above;verifier
  checks raw request equality,callback errors,all-byte counters and provenance.
- Performance:no benchmark or resource-completeness claim;llhttp03 lifecycle
 21,410ms,not a latency/throughput measurement.
- Known risks/release blockers:no complete maintained ingress assembly proved;
  bounded buffering/subprocess adapter is test-only;full75/full23,mandatory
  protocol/identity/TLS/config/resource gates remain;no `make check`,
  `make security-scan` or hosted pipeline claim for this component.
- Human review needed:F independently reproduce exact sources and issue a
  scoped verdict;architecture/security approval remains PENDING.
- Next runnable action:F reproduce llhttp narrow proof and Envoy/Nginx failures;
  root assess a maintained complete integration path before any candidate
  expansion. Modules04-12 stay LOCKED;production BLOCKED.
