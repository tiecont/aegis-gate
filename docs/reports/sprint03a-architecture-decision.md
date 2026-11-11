# Sprint03-A Architecture Decision Package

Status: proposed; no architecture acceptance or production activation.
Baseline: `668b8d998d8a39f3a554a9e42ad6a1a270049d27`.

## Decision Requested

Retain `M0-PROXY-GO-NOGO` **NO-GO**. No tested candidate currently satisfies
every mandatory security property. Authorize a focused maintained-parser
resolution and another equivalent proof before selecting a replacement.
Approving this report or merging isolated PoCs does not approve a data plane.

Security correctness is a prerequisite, not a score that performance or a
larger passing-test count can offset. A human cannot turn these failed proofs
into an affirmative gate merely by choosing a preferred technology.

## Common Executable Proof

`spikes/edge-comparison/manifest.json` binds all original65 case IDs,32 raw
negative requests, six encoded-target controls and the eight original failures
to baseline Git objects. Nine new header/framing/pipeline negatives and one
valid encoded pipeline control produce the common75-case inventory.
`extract-baseline.mjs --check` verifies that binding. `evaluate.mjs` rejects
changed inputs, missing/duplicate/skipped cases, inconsistent summaries,
forwarded decrypted bytes, origin dispatch, parser errors and deadline expiry.
All candidates receive the same certificates, origin servers, snapshots,
authority vectors, TLS trust changes and functional protocol expectations.

The root separately reproduced the original **57/65** result before extending
the suite. `evidence/sprint03a-d/pingora-baseline.json` retains the eight failures.
The corrected shared run is `evidence/sprint03a-d/pingora-corrected.json`.
An earlier TLS observation bug counted Node TLS alerts as HTTP parser errors;
that invalid run is retained and explicitly excluded as decision evidence.
The correction still requires zero origin handlers and decrypted HTTP bytes.
Transport and HTTP parser errors are recorded separately.

Independent review also calibrated native Node H2 and found that its frame
consumption can bypass TLSSocket `data` events. Final reruns use the common
bounded TLS observer relay for H2/gRPC before native parsing, with verified TLS
on both relay hops. Its calibration counts a24-byte preface with zero handlers
and preserves valid encoded-target frames. Root Pingora final rerun remains
63/75; H2 and gRPC positive controls now observe139 and292 decrypted bytes.
Earlier H2 zero counts alone are incomplete evidence and are retained as such.
Root's observer-enabled Envoy rerun also retains69/75. The authority-confusion
case now records one handler and56 decrypted H2 bytes, rather than the earlier
incomplete zero-byte observation; exact result is
`evidence/sprint03a-d/envoy-h2-observed.json`. Hyper's unchanged runtime rerun
retains70/75, with observed H2/gRPC positives and zero-byte authority denial
in `evidence/sprint03a-c/shared-run-03.json`.

## Candidate Matrix

Final independent review `ed8d48d` reproduces these results without candidate
changes, skipped cases or exclusions. They are failed feasibility proofs, not
accepted module gates. See `sprint03a-e-observer-followup.md` for the final
source hashes, origin counters and raw H2 conformance/resource limitations.

| Candidate | Full corpus | Mandatory blockers | Disposition |
| --- | --- | --- | --- |
| Pingora0.9.1 / OpenSSL |63/75; original baseline57/65 | Original eight target/framing failures persist; three new negative failures; valid pipeline control fails | NO-GO |
| Envoy1.40.2, pinned distroless image |69/75 | obs-fold reaches origin; H2 Host/authority confusion; four TE cases return501 instead of the required4xx/close | NO-GO |
| Hyper1.12.0 / Tokio1.54.1 / rustls0.23.46 |70/75 | CL/TE and TE/CL, their pipelined variants, and fragment target reach origin after normalization | NO-GO |
| Maintained strict ingress before Pingora | No supported complete adapter proven | Framing on every request, streaming/upgrades, identity propagation, bounded resources and parser differentials require proof | Not eligible |

The executable comparison and independent review are complete with no eligible
candidate. Root combined quality and supply-chain checks pass; PR9 must also
pass both hosted jobs on its exact final head before evidence-only integration.
These repository checks do not approve a failed architecture proof.

Pingora's relative target returns502 with zero handlers but sends190 decrypted
bytes and triggers two origin parser errors in this ordering. It is a failure,
not an ingress denial. Envoy's501 cases have zero origin bytes and handlers:
these are rejection-contract failures, distinguished from its actual forwarding
and authority failures. Neither observation establishes a new upstream exploit
or a demonstrated cross-tenant compromise.

All six individual valid encoded-target controls pass for all candidates.
Existing TLS SNI selection/denial, certificate rotation, verified upstream TLS,
H1/H2, WebSocket, gRPC/trailers/cancellation, route/trust pool partitioning,
bounded timeout and snapshot cases execute in the same corpus. Passing these
local cases does not prove a production tenant/config/certificate lifecycle.

## Security and Maintenance

| Area | Actual evidence and remaining obligation |
| --- | --- |
| Pingora parsing | Maintained0.9.1 normalizes raw targets before proxy filters. A hidden custom-session surface supplies no maintained strict engine. Upstream main was inspected, not silently patched or adopted. |
| Pingora dependencies | Exact-lock audit: zero known vulnerabilities, two unmaintained advisories, `derivative` and `unsafe-libyaml`. Neither is ignored or accepted. The latter executes fixed internal YAML at startup; lack of untrusted YAML limits this lab's exposure but does not remove risk. |
| Envoy parsing/identity | Current strict settings and semantic Lua policy do not recover syntax or a Host field already normalized by the maintained codecs. Any supported header-validator/runtime alternative requires an executable rerun, not an assumption about defaults. |
| Envoy image | Immutable digest, restrictive container settings, loopback listener, no admin listener, exact-image scan and SBOM. A clean image scan cannot compensate for failed security properties. |
| Hyper assembly | Maintained HTTP/TLS libraries own parsing and cryptography. Post-parse semantic checks cannot recover removed CL/TE ambiguity or fragments. Four local unit tests passing does not prove wire-level rejection. |
| Hyper dependencies | Isolated exact lock and published archive/source checksum checks; audit and linked OpenSSL metadata recorded separately. OpenSSL is used for certificate validity metadata; traffic TLS is rustls. |
| Fixture boundaries | Fresh owner-only directories, verified owned-loopback TLS, no public load/security tests, no private keys in tracked evidence, serialized fixture lock. These exceptions never authorize loopback public-SaaS origins. |

## Integration and Ownership Cost

Estimates below identify work categories, not measured delivery commitments.
No migration changes the production edge, APIs or signed config contract here.

| Option | Integration/migration cost | Operations and long-term ownership |
| --- | --- | --- |
| Maintained Pingora strict mode | Lowest retained-architecture migration if upstream supplies all required rejection behavior; availability and schedule unproven | Existing Rust hooks remain; parser/release provenance, two maintenance warnings and every protocol regression still need closure |
| Strict ingress plus Pingora | High: additional parser/TLS or stream boundary; every-request validation, SNI/client identity, health/drain, policy generations and upgrade lifecycle | Two patch streams and differential tests; no supported complete adapter currently established |
| Envoy | High: Go publisher to xDS/SDS, authenticated node identity, tenant-scoped resources, ACK/NACK/LKG, validation, secret delivery, drain and generation/pool boundaries | Mature proxy capabilities reduce owned proxy code; separate C++ image/extension/API patch stream and operational expertise required. File-based PoC is not transactional xDS acceptance. |
| Hyper/Tokio | High: retain Rust but own routing, load balancing/health, pools, limits, cancellation, upgrades, retry safety and config consistency | Small executable proof is not a mature proxy. Production ownership includes fairness, bounded snapshot retirement, safe retry/drain and operational diagnostics. |

Module03 must preserve a candidate-independent authenticated signed snapshot
contract. A future adapter verifies the envelope and tenant references before
mapping accepted generations to engine resources. Raw TLS keys remain outside
general snapshots. xDS transport availability alone is not snapshot authenticity
or tenant isolation. Module04 requires both an approved affirmative feasibility
gate and Module03 PASS.

## Performance Evidence Limits

Each shared proof executes the same100-warmup/five-second/concurrency8 workload,
90% GET/1KiB and10% POST/32KiB, verified TLS on both hops, against the same pinned
Nginx reference. Actual p95/p99, throughput, errors, timeouts and resources are
in candidate JSON. Shared-host scheduling, sequential runs, differing crypto
and worker counts, and closed-loop coordinated omission prohibit a production
capacity or architecture ranking. Envoy launcher PID CPU/RSS is not Envoy
resource usage; only separately identified actual container process samples
may be used. Failed measurement attempts remain failed evidence.

## Smallest Next Resolution

1. Assign a human architecture owner and choose a maintained upstream resolution
   track, with explicit cost/schedule acceptance. No candidate qualifies for
   adoption today. Retain Pingora as the documented pending design meanwhile.
2. Obtain a supported release/configuration that preserves enough original
   framing and target information to reject CL/TE, fragments, raw controls and
   obs-fold before any forwarding. Prove H2 Host/authority/SNI binding before
   codec normalization; do not add a raw byte scanner or private parser fork.
3. Rerun all75 unchanged cases plus targeted resource/identity regressions from
   clean fixtures, with exact artifact hashes and independent review. Resolve
   every required failure and applicable critical/high dependency finding;
   disposition maintenance warnings without suppression.
4. Only after that proof, present a specific architecture substitution and
   migration design for human approval. Update design/gates after approval,
   implement Module03 through its own gate, then consider Module04.

Module03 is independently eligible under its documented00/02 prerequisites
and01 findings. This sprint starts no downstream implementation. Modules04-12
and all production release gates remain locked/closed as documented.
