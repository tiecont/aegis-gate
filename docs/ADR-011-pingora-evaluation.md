# ADR-011: Pingora feasibility evaluation

- Status: **proposed**; **No-Go at the current proof state**. Common immutable75: Pingora63/75, Envoy69/75, Hyper70/75. Sprint04-A independently reproduces Envoy69/75 and establishes a scoped upstream-dependent stop; no architecture replacement is accepted.
- Date: 2026-11-13 (original evaluation2026-11-11).
- Scope: module 01, `M0-PROXY-GO-NOGO`; isolated `spikes/pingora` workspace only.
- Supersedes: no accepted decision. Supplies evidence for pending ADR-002 in `docs/DECISIONS.md`.
- Implementation owner: module 01 implementation agent. Responsible human owner/reviewer: **not assigned**. Approval link/date: **none**.

## Sprint04-B Proposed Amendment

[ADR012](ADR-012-strict-ingress-decision-proposed.md) and
[the human decision package](reports/sprint04b-a-architecture.md) propose a
bounded maintained Envoy API research track and analyze H2 origin-isolation
properties separately. Released-source refresh finds no new complete maintained
capability. The existing zero-byte contract and all original failures remain
effective; no architecture/security owner or affirmative GO is recorded.
The [completion report](reports/sprint04b-completion.md) binds current evidence,
independent review and integration gates. This pointer does not supersede the
historical receipts or accept the proposed amendment.

## Sprint04-A decision boundary

Released Envoy1.40.2 accepts obsolete folding in its Balsa adapter and removes
CR/LF before public parsed-map validation. The inspected supported APIs expose
no pre-normalization strict rejection hook. Pingora0.9.1 still rewrites invalid
targets; Hyper1.12.0 still removes CL/TE ambiguity and fragment provenance before
service policy. A/C pin current release/source/API evidence in their Sprint04-A
reports. No new complete candidate was technically credible, so no broad rebuild
or private parser modification was attempted.

B reproduces the same six Envoy failures and classifies the nine H2 origin bytes
as a SETTINGS ACK on a reused valid connection. Zero handler dispatch does not
waive the zero-origin-byte contract. Seven additional bounded probes fail and
remain limitations. TE response mapping and Host retention alone cannot resolve
the primary codec blocker. The unchanged75 and mandatory positive protocols
remain eligibility prerequisites, alongside resource/configuration safety,
maintained dependencies, independent review and explicit human approval.

`reports/sprint04a-architecture-decision.md` gives bounded upstream tracks and
unpublished escalation requirements. `reports/sprint04a-completion.md` binds
the final review, gate and integration receipts. Research completion or safe
evidence integration does not grant GO. Modules04-12 remain locked; production
remains blocked. The original evaluation below is retained as historical evidence.

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

The original `cargo-audit` run reports zero known vulnerability findings and two unmaintained
dependency warnings: `derivative` 2.2.0 (RUSTSEC-2024-0388, proc macro) and
`unsafe-libyaml` 0.2.11 (RUSTSEC-2024-0449, via deprecated `serde_yaml` in
Pingora core). The lab never accepts a YAML file or Pingora CLI config: its
trusted fixture manifest is bounded JSON. Source review during sprint02 confirms
`Server::new(None)` reaches `ServerConf::new()`, which parses the fixed internal
literal `---\nversion: 1` through `serde_yaml`. Thus YAML executes at startup;
there is no operator/client-controlled YAML input in this proof. This limits
this proof's YAML exposure; it does not remove the dependency or
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

## Sprint02 strict-ingress investigation (proposed)

Agent B reproduced the unchanged release baseline **34/35**, exit1, in its
isolated worktree under `/tmp/aegisgate-sprint02-fixtures.lock`. The expanded
run and exact observations are in `spikes/pingora/evidence/sprint02-runs.json`;
the completion report is `docs/reports/sprint02-b-pingora.md`. This supplements
the earlier evidence and does not grant gate acceptance. Negative assertions
remain enabled, including no origin dispatch. Encoded-path controls require
exact target preservation, including `/bad%20target` and encoded control bytes.

Final expanded release result: **57/65 pass,8 fail**, exit1. Raw space, tab,
SOH and NUL targets are escaped and dispatched (HTTP200). Unsupported `ftp`
scheme, fragment target and repeated `chunked` also return200 with one origin
handler invocation each. The relative target returns502 and invokes no origin
handler, but **192 decrypted bytes reach the origin and two origin parser errors
occur**. It is not an ingress rejection. Negative evidence now records exact
fixture request/response, handler count, decrypted inbound bytes, parser-error
count and actual peer close; a client-side deadline is not treated as rejection.
The24 passing negative vectors have zero handler dispatch, inbound bytes and
parser errors. All6 encoded-target positive controls pass unchanged. These are
bounded project-policy failures; no exploit, cross-tenant compromise or new
Pingora vulnerability is established by this evidence.

Read-only upstream evidence at `spikes/pingora/evidence/sprint02-upstream.json`
records URLs, fetch times, hashes and excerpts. Latest stable remains0.9.1;
inspected upstream main is `3f87e92c982ee27c714506e16ae362776faea4aa`
(2026-11-09). Published crate SHA256 and parser-source archive comparisons
confirm the local parser/proxy sources inspected are unmodified published0.9.1.
Main was source-reviewed only; it was not built or tested as a replacement.

- `HttpServerOptions` in0.9.1 controls h2c, CONNECT, a hidden custom-session
  selector, keepalive request count and H2 idle timeout. Inspected main adds an
  H1 header-count limit but retains request-line escaping. No strict
  request-line/no-normalization switch was found in these sources. Open
  [PR1000](https://github.com/cloudflare/pingora/pull/1000) concerns admission
  size/count, not strict request-target rejection. Search results are scoped
  evidence, not proof that no future or private implementation exists.
- `early_request_filter` also runs after `handle_new_request`/`read_request`.
  Moving the existing `httparse` check there cannot recover replaced bytes.
  `patched_http1` is a parser fast-path feature, not a strict-mode option.
- Public `ServerApp::process_new(Stream)` and the documented
  `HttpProxy::new`/`http_proxy` + `HttpServerApp::process_new_http` integration
  support a custom accept loop. Their normal H1 session still invokes the same
  parser. The hidden `force_custom` field selects custom session processing;
  it supplies no strict HTTP parser. `ConnectionFilter` sees a peer address,
  not decrypted request bytes. TLS certificate callbacks do not inspect HTTP.
- A maintained ingress validator before Pingora normalization is conceivable,
  but no supported drop-in strict validator was identified. It would need a
  bounded maintained parser, correct framing on **every** keepalive/pipelined
  request, no byte loss/rewrite, backpressure/timeouts, H2 ALPN, upgrades, and
  preserved TLS/SNI digest and client identity. Checking only the first header
  or scanning bytes for spaces is insufficient. This investigation implements
  none of that integration and makes no safety/capability claim for it.
- Inspected main additionally has generic `HttpProxy<SV,C,DS>` and a public but
  `doc(hidden)` `custom::server::Session` trait, with a custom builder handler.
  That offers a future integration surface for a maintained engine, not a
  shipped strict ingress adapter. Its implementer owns body/trailer I/O,
  cancellation-safe reads/writes, timeouts, shutdown/abandon, digest/address
  propagation, upgrade and retry-buffer behavior. No Hyper adapter was found or
  tested; this unreleased/internal-facing contract increases integration and
  API-change cost. It does not change the0.9.1 result.

### Maintenance disposition proposal

Fresh exact-lock audit still has zero known vulnerabilities and two
unmaintained warnings. No ignore, exception or acceptance is added.

| Warning | Actual path/exposure | Removal and review cost |
| --- | --- | --- |
| derivative2.2.0 / RUSTSEC-2024-0388 | Build-time proc macro used for `PeerOptions` debug and load-balancer backend traits in `pingora-core`/`pingora-load-balancing`. Generated code ships; the macro is not a runtime network parser. | Upstream [issue889](https://github.com/cloudflare/pingora/issues/889) is open. Removal needs maintained derive/manual trait implementations preserving ignored fields, backend equality/hash/order and debug redaction. Feature reduction cannot remove the core dependency. Require upstream released fix, lock/tree recheck, regression review and fresh audit. |
| unsafe-libyaml0.2.11 / RUSTSEC-2024-0449 | Runtime through deprecated `serde_yaml` in core; fixed default YAML is parsed at startup. User YAML remains outside this spike's input surface. Archived unsafe C translation means future bugs may remain unfixed. | [Issue1058](https://github.com/cloudflare/pingora/issues/1058), [issue779](https://github.com/cloudflare/pingora/issues/779), and [PR1117](https://github.com/cloudflare/pingora/pull/1117) are open. PR1117 proposes safe-Rust `serde-saphyr` and an upstream MSRV increase from 1.85 to 1.89. Its author's test claims are not our results; it is unmerged/unreleased and not adopted. Need released removal, config compatibility review, all TLS/protocol checks, tree/audit proof. Simply choosing `serde_yaml_ng` does not necessarily remove unsafe-libyaml. |

Both advisories have no patched version listed. Absence of known vulnerability
findings is not a maintenance waiver. The isolated lab may continue collecting
evidence; expansion to untrusted YAML or production needs explicit security
review. A tracked upstream release/fix is preferred over owning a private fork.

### Alternatives for human review

These are qualitative engineering estimates; Envoy/Hyper/extra ingress were
not implemented or benchmarked. The previous Nginx smoke comparison is not
evidence of either alternative's correctness or cost.

| Candidate | Complexity and security boundary | Migration cost | Ongoing maintenance / proof required |
| --- | --- | --- | --- |
| Wait for maintained Pingora strict option and dependency removal | Smallest local code change if upstream exposes strict rejection and fixes all observed invalid cases. Current release fails. | Low retained architecture cost; schedule/upstream uncertainty. Rebuild every mandatory proof, preserve encoded controls. | Track release/patch provenance, both warnings, framing and authority corpus, TLS/streaming/pool regressions. No GO merely for a merged PR. |
| Maintained strict ingress before Pingora | Adds another HTTP/TLS/identity boundary or stream adapter. Must reject originals before normalization on every request; validate parser differential, authority and resource handling. | Medium/high: deployment, client-IP/SNI trust, cert ownership, health/drain, config and telemetry integration. L4 passthrough alone cannot validate encrypted HTTP. | Two stacks and patch streams; equivalent mandatory proof plus ingress/backend desync and identity-spoof negatives. No ready supported adapter proven here. |
| Envoy data plane with xDS/SDS | Mature separate process; policy/config/cert adapters and failure behavior remain substantial. Strict parser settings and defaults must be proven against this corpus. | High: replace Rust proxy hooks with Envoy filters/APIs, snapshot to xDS/SDS mapping, tenant isolation, ACK/NACK/LKG and operator tooling. | Envoy/C++ image and API compatibility, extension ownership, parser/security releases; repeat SNI rotation, H2/WS/gRPC, cancellation, verified origin TLS, isolation and controlled workload evidence. |
| Hyper/Tokio + maintained TLS | Retains Rust; lower-level maintained HTTP engine supplies parsing. We would own proxy assembly, balancing/health, pools, upgrades, H2/gRPC, cancellation, limits and retry semantics. | High: replace Pingora integration and prove TLS dynamic selection/hot reload, route/trust pool identity and bounded streaming. | Wider owned integration/test surface and library compatibility; no assumption that parser defaults meet strict policy. Equivalent full proof and independent review required. |

Recommendation to root: retain **NO-GO** at this proof state. Prefer a reviewed,
maintained upstream strict-mode/removal path if one becomes executable. A human
must choose and authorize a material architecture replacement after reviewing
these costs and equivalent proof requirements. No implementation-status or
release gate file is changed by Agent B.

If a mandatory proof regresses or dependency risk is judged unacceptable, keep
`M0-PROXY-GO-NOGO` closed, retain this evidence and reproduce the failure. A
responsible human must decide a material architecture replacement after an
equivalent alternatives proof. Removing this isolated workspace has no effect
on production because no production edge/contracts were changed.

## Sprint02 independent review

Root rebuilt the unchanged reviewed release source and reproduced **57/65**,
eight failures, exit1, on2026-11-11. Raw evidence:
`evidence/sprint02-d/pingora-results.json`; binary SHA256
`416358486ea4221c8b0141b7d6895b81f61d42d05f65d56d5aaf6184865c0152`.
Relative target again sends192 decrypted bytes and causes two origin parser
errors despite502/no handler dispatch. All six valid encoded-target controls
pass. `reports/sprint02-d-security-review.md` accepts the evidence and NO-GO
recommendation only. PR5 is evidence-only; its merge does not approve Pingora,
an alternative architecture, a maintenance exception or production activation.

## Gate disposition

### Sprint03-A proposed disposition

The research-only alternatives comparison above is historical. Sprint03-A
adds isolated executable Envoy and Hyper/Tokio PoCs and a candidate-neutral
75-case corpus. The root preserved and independently reproduced the original
57/65 Pingora baseline, including all eight failures. Corrected expanded
implementation runs are Pingora63/75, Envoy69/75 and Hyper70/75. Every candidate
fails mandatory properties; none is eligible for GO. Independent review
`ed8d48d` reproduces those same results with the bounded H2/gRPC byte observer.
The original H2 accounting defect is fixed within the exercised corpus; raw
H2 parser conformance remains unproven. Root combined check/scan exit0 and
reviewed-head hosted run42992622282 passes both jobs. Evidence-only integration
requires final-head hosted checks; PR9 records the final checks and merge.

`docs/reports/sprint03a-architecture-decision.md` is the proposed decision
package, including exact blocker classes, maintained strict-ingress options,
integration/maintenance costs and the smallest next proof. Candidate reports
retain earlier failed/interrupted and invalid-instrumentation runs explicitly.
`docs/reports/sprint03a-e-observer-followup.md` records the independent final
reruns, exact hashes, origin counter semantics and remaining observation limits.
The immutable manifest and evaluator preserve every original negative and
valid encoded-target control; no criterion, production implementation or
architecture selection is changed. Human architecture ownership and approval
remain unassigned. Merging these isolated proofs grants no feasibility gate.

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

### Sprint03-B focused resolution (proposed, not approved)

One maintained Envoy1.40.2 runtime Host-retention experiment executes the
unchanged75 corpus from committed source:69/75, same six failed IDs. H2 now
returns expected4xx with zero handlers but nine observed origin bytes, so the
mandatory zero-byte assertion still fails. Obs-fold still forwards263 bytes
and one handler. Four TE501 rejection-contract failures persist. Three raw H2
frame-error probes and a32-connection bounded drain probe pass locally; they
do not establish exhaustive conformance or change the failed gate. No second
credible supported track was found. Fresh release metadata remains Pingora0.9.1,
Envoy1.40.2 and Hyper1.12.0; Pingora derivative issue889 and YAML replacement
PR1117 remain unresolved/unreleased. The exact evidence, failure classification,
remaining stop condition and commands are in
`reports/sprint03b-e-parser-resolution.md`. No parser expectations, architecture
approval, production code or downstream gate changes. Module01 stays NO-GO.
