# ADR-011: Pingora feasibility evaluation

- Status: **proposed**; **No-Go at the current proof state**. One required strict malformed-request rejection test fails. This is not a general claim of Pingora insecurity or a permanent framework rejection.
- Date: 2026-11-11.
- Scope: module 01, `M0-PROXY-GO-NOGO`; isolated `spikes/pingora` workspace only.
- Supersedes: no accepted decision. Supplies evidence for pending ADR-002 in `docs/DECISIONS.md`.
- Implementation owner: module 01 implementation agent. Responsible human owner/reviewer: **not assigned**. Approval link/date: **none**.

## Context and decision

The SaaS edge needs safe per-host dynamic certificates, consistent policy
snapshots, bidirectional streaming and verified origin TLS. Compilation and
advertised features are insufficient. The isolated executable and owned-loopback
harness exercise the selected APIs without opening the production edge.

Select Pingora **0.9.1**, with default features disabled and explicit `proxy`,
`openssl`, `connection_filter`, `lb`. GitHub's current stable release and
crates.io metadata were fetched on 2026-11-11; release 0.9.1 was published
2026-11-03. It fixes the Tokio >=1.54 buffered-reader panic and constrains the
patched zstd dependency family. All Pingora crates resolve to 0.9.1 in the
separate lockfile. Tokio is pinned to 1.54.1. No dependency ignores or upstream
source patches were introduced.

OpenSSL is selected because Pingora exposes dynamic certificate and
handshake-complete callbacks for this backend. The same callback interface is
not established by this proof for Rustls or s2n; no equivalent capability is
claimed. `pingora-openssl` enables vendored OpenSSL: Rust `openssl` 0.10.82,
`openssl-sys` 0.9.118, `openssl-src` 300.6.1+3.6.3. The host OpenSSL CLI is
3.6.5 and is used only to generate lab certificates. These are separate crypto
artifacts. CMake 4.1.3 resolves the initial `libz-ng-sys` prerequisite failure;
that environment failure was not a Pingora No-Go.

## Required integration code

1. `TlsAccept::certificate_callback` loads an immutable `ArcSwap` snapshot and
   selects an exact canonical SNI certificate. There is no default certificate.
   A completed handshake carries its SNI in the TLS digest for request binding.
2. `request_filter` captures the current snapshot after headers arrive, verifies
   Host/authority against SNI and the exact route table, and retains this one
   snapshot through upstream selection, streaming and response filtering.
   Capturing only in `new_ctx` is insufficient: it runs before an idle keepalive
   connection receives the next request.
3. Upstream `HttpPeer` pins TLS hostname and lab CA, keeps both verification
   flags true, and uses finite connect/read/write/idle timeouts. Loopback is
   hardcoded only in this isolated executable; it is not an exception to public
   SaaS SSRF policy.
4. Pool identity must include tenant/route and trust-policy epoch. Pingora's
   default reuse hash does not include a custom CA. The proof assigns disjoint
   `group_key` values to bounded route/generation pairs, including overflow
   validation. The trust-store-swap test exercises an existing keepalive client.
   Production pool ownership and generation retention must be designed in 04.
5. Pingora deliberately removes Content-Length when Transfer-Encoding exists
   and closes that downstream connection. Our stricter project policy requires
   rejecting both. The wrapper reuses maintained `httparse` 1.10.1 on Pingora's
   preserved original H1 header bytes before origin dispatch. An error rejects
   the request. A normalized-header-only check demonstrably failed and was
   replaced; no custom HTTP parser was implemented.
6. `ProxyHttp` request/body/upstream/response hooks are callable for future
   authentication, custom headers and quotas. The proof strips untrusted
   forwarded/tenant headers and exercises the pre-TLS `ConnectionFilter` with
   its feature explicitly enabled. JWT, distributed limits and trusted proxy
   CIDR policy are not implemented by this module.
7. Pingora's maintained weighted round-robin and HTTPS health checks perform
   selection, active failover and recovery with certificate/hostname validation.
   The lab bounds route/backend counts and uses finite probe I/O timeouts.

## Evidence and consequences

The final release run executed 35 integration/security/benchmark cases:
**34 passed, 1 failed**, exit 1. The failing case is
`malformed-HTTP-invalid-request-target`. The exact request line
`GET /bad target HTTP/1.1` reaches the owned origin and returns 200 instead of
the required 4xx/closed connection. Pingora 0.9.1's
`protocols/http/v1/server.rs` retries `httparse` errors through
`escape_illegal_request_line` (lines 436-455), percent-encodes the space
(lines 1757-1791), and replaces its header buffer. Consequently
`get_headers_raw_bytes` exposes the rewritten header, not the pre-rewrite
request line. The CL/TE wrapper cannot detect this transformation. Review of
the public `HttpServerOptions` found no option disabling this compatibility
path. No exploit or authorization bypass is claimed; this is a reproducible
failure of the project's strict negative-test criterion.

Do not suppress the test or silently reject every encoded-space URI to hide
the distinction. A maintained strict parser option/upstream change or a
reviewed ingress integration needs its own executable proof. Module 04/05
remain blocked by this failed feasibility gate. This discovery supersedes
earlier, smaller passing local test runs; all results are retained.

The completion report and machine-readable local results record the executed
unit, integration, negative and benchmark outcomes. Proof covers distinct SNI
certificates; unknown/missing SNI denial; hot rotation while an old response
stream retains its generation; HTTP1/HTTP2 request/response bodies; WebSocket
echo/close; gRPC responses before request half-close, trailers and cancellation;
origin TLS wrong-name/expired/untrusted denial; timeout; pooling; weighted
health failover/recovery; invalid/replayed snapshots; and malformed H1 rejection.

The benchmark is a short local comparison against maintained Nginx 1.30.6,
digest `sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311`.
It records CPU, sampled RSS, p95/p99, payload mix, errors and timeouts. Its shared
host, closed-loop traffic and short duration cannot establish launch SLOs,
capacity, overload resilience or a performance advantage. Production requires
the workload, open-loop/soak/failure drills and review in `QUALITY_GATES.md`.

`cargo-audit` reports zero known vulnerability findings and two unmaintained
dependency warnings: `derivative` 2.2.0 (RUSTSEC-2024-0388, proc macro) and
`unsafe-libyaml` 0.2.11 (RUSTSEC-2024-0449, via deprecated `serde_yaml` in
Pingora core). The lab never accepts a YAML file or Pingora CLI config: its
trusted fixture manifest is bounded JSON and `Server::new(None)` uses defaults.
This limits this proof's YAML exposure; it does not remove the dependency or
waive maintenance risk. Security review must disposition both warnings and
track upstream removal before widening the input surface. No ignore is accepted
here. NPM lab dependencies have zero audit findings. License metadata is present
for all locked Rust/Node packages; Pingora/OpenSSL/grpc-js are Apache-2.0 and
ws/httparse are MIT. Full expressions, including alternative-license choices,
remain in the generated license inventory for legal/distribution review.

Lab private keys are mode 0600 in an ignored 0700 directory. CA signing material
is removed after generation. Keys are never included in config messages or
logs. This establishes fixture handling, not production secrets delivery.
Downstream session tickets/resumption are disabled so new connections always
exercise current certificate selection. Intermediate chain rotation,
resumption, ACME lifecycle, emergency revocation and production cert/key
distribution remain module 05/release work.

## Alternatives and rollback

| Option | Evidence and tradeoff |
| --- | --- |
| Pingora + OpenSSL | The required local protocol/TLS hooks execute successfully with the wrapper requirements above. Retains Rust data-plane design. Dependency maintenance and runtime integration remain owned work. |
| Envoy | Maintained proxy with xDS/SDS and mature HTTP2/gRPC support; would move policy/config integration to a different process/API and require its own isolation, cert rotation and workload proof. Not benchmarked here; no superiority claim. |
| Hyper/Tokio + maintained TLS library | Gives direct Rust control but requires assembling pooling, health, WebSocket and H2 policy consistently. No executable comparison was made; larger owned integration surface, not a permitted silent replacement. |

If a mandatory proof regresses or dependency risk is judged unacceptable, keep
`M0-PROXY-GO-NOGO` closed, retain this evidence and reproduce the failure. A
responsible human must decide a material architecture replacement after an
equivalent alternatives proof. Removing this isolated workspace has no effect
on production because no production edge/contracts were changed.

## Gate disposition

`M0-PROXY-GO-NOGO` must remain **closed**. The orchestrator must review the
invalid-target reproduction, strict-ingress alternatives and the two dependency
warning dispositions. A responsible human owns any architecture substitution or
material acceptance-criterion change; there is no approval link or assigned
human owner here. An upstream strict option or safe maintained wrapper can be
evaluated without claiming that this failed proof passed. Module 04 also requires
module 03. Independent control-plane/config work may proceed only through its
own dependency gates. Every production release gate remains closed until its
own prerequisites, tests and approvals pass. No production deployment, live DNS,
paid cloud or live billing was performed.
