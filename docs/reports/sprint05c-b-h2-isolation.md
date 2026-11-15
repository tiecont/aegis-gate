# Sprint05C B: H2 origin isolation

Execution plan (measurement pending): test one new released mechanism, Go1.27.4
public `net/http.Transport.Protocols` H2-only TLS transport. Its read loop writes
and flushes peer SETTINGS ACK inline before reading later response frames, unlike
the retained Envoy/nghttp2 deferred-send path. The adapter uses maintained
`http.Server` and `httputil.ReverseProxy`, never a custom HTTP parser or codec.

1. Preserve all11 protected files and prior original73/75 and19/23 baseline.
2. Commit source before proof; verify pinned toolchain/archive/source hashes.
3. Execute unchanged original75/evaluator/23 before additive diagnostics. Report
   exact failure status, bytes, raw traces and native resource limitations.
4. Exercise cold/warm/concurrent H2 reuse, tenant/generation/trust pools,
   SETTINGS with no downstream request, gRPC, streaming cancellation and drain.
5. Stop on unsupported/full-runtime gaps. A passing diagnostic never revises
   the original all-byte oracle, counts a RST as400/421 or authorizes production.

All fixtures/scanners hold `/tmp/aegisgate-sprint02-fixtures.lock` for their full
lifecycle. Work is confined to Sprint05C B source/report/evidence on
`feat/sprint05c-h2-isolation`; no push/merge, contract/ADR change or locked module.
