# Sprint03-B E — focused maintained-parser resolution

2026-11-11; branch `research/module01-maintained-parser-resolution`.
Result: **Module01 remains NO-GO**. One executable Envoy runtime experiment
was tested from committed sources; it does not qualify. No architecture or
production approval is claimed. Root owns independent review and integration.

## Executed track and concrete result

The smallest evidence-backed change was to retain the original H2 Host header
instead of discarding it before the existing semantic authority check.
`spikes/envoy/recovery-config.mjs` adds the maintained runtime feature value
`envoy.reloadable_features.http2_discard_host_header=false` to the otherwise
unchanged configuration. This is an isolated diagnostic configuration, not a
production security recommendation. It changes no parser source, TLS option,
corpus expectation, header-validation requirement or original candidate.
The copied recovery launcher imports only that diagnostic compiler. The normal
launcher/configuration remain unchanged.

Source commit `ea23ecdc8052a48b7ce3a0761119d6f94012867e` was clean for tracked
files before execution. The runner records hashes of every candidate adapter
and shared harness input. Image remains Envoy1.40.2 at digest
`09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`.

All unchanged75 cases execute: **69 pass, six fail**, lab exit1/evaluator exit1.
The exact failed IDs equal the prior Envoy inventory:

- `malformed-HTTP-invalid-transfer-encoding`
- `malformed-HTTP-obsolete-folded-header`
- `strict-ingress-TE-repeated-chunked`
- `strict-ingress-TE-not-final-chunked`
- `supplemental-repeated-transfer-encoding-fields`
- `HTTP2-authority-Host-and-SNI-confusion-rejected`

Obs-fold still returns200 and sends263 decrypted origin bytes/one handler.
The H2 case now passes the expected400/421 status assertion and records zero
handlers, but observes **nine decrypted origin bytes**, violating the unchanged
zero-byte requirement. The source assertion stops the case at that failure, so
later authority variants in its loop are not established by this run. Those
nine bytes have not been classified as request frames or background protocol
traffic. They remain a failure; no adjustment of observer or criterion is made.
The historical default run observed56 bytes/one handler/200. Thus retaining
Host changes the observed behavior but does not prove a complete remediation.
Four TE cases reject with501/close and zero origin bytes/handlers; these are
project rejection-contract failures, distinct from origin forwarding.

All other69 mandatory cases pass, including the exercised TLS/certificate
rotation, H1/H2, WS/gRPC/cancellation, pooling, generation and encoded-target
controls. These are local functional proofs, not complete production safety.

## Failure classification from original immutable evidence

`historical-failure-classification-inputs.json` binds original result hashes,
exact failed IDs, diagnostics and decrypted-origin observations. No historical
candidate was rebuilt or rerun unchanged.

| Candidate | Failure class | Exact scope |
| --- | --- | --- |
| Pingora | Target normalization | Raw space/tab/SOH/NUL and the two space/tab pipeline negatives are normalized before filters. Unsupported-scheme, relative-form and fragment targets fail the strict target contract. |
| Pingora | Pre-parser/framing rejection | Repeated-chunked and repeated-TE-fields negatives are not fully denied under the required contract; no custom production scanner is proposed. |
| Pingora | Valid pipelining regression | `valid-HTTP1-pipelining-preserves-boundaries-and-encoded-targets` fails. A strict-mode fix must preserve this positive control. |
| Envoy | Header normalization | Obsolete folding is accepted/normalized and dispatched. Post-codec Lua cannot recover the original folding. |
| Envoy | H2 Host/authority/SNI binding | Default codec discards Host; runtime retention is insufficient under the mandatory zero-byte criterion, as executed above. |
| Envoy | Project rejection contract | Four TE cases return501 instead of4xx/close although no bytes/handlers reach the origin. |
| Hyper | Pre-parser invalid framing | CL/TE, TE/CL and both pipeline variants lose ambiguity before application policy; four failures. |
| Hyper | Target normalization | Fragment target is removed before application policy; one failure. |

No additional header-normalization or H2-binding failures are inferred for
candidates whose mandatory cases passed. Pingora's relative-target502 still
counts as failure because its original evidence shows decrypted bytes/origin
parser errors; a5xx with zero handlers is insufficient.

## Upstream and maintenance review

Fresh official release API records in `evidence/sprint03b-e/` identify
[Pingora0.9.1](https://github.com/cloudflare/pingora/releases/tag/0.9.1),
[Envoy1.40.2](https://github.com/envoyproxy/envoy/releases/tag/v1.40.2), and
[Hyper1.12.0](https://github.com/hyperium/hyper/releases/tag/v1.12.0) as latest
releases at retrieval. Envoy's retained release policy describes its supported
stable series. No newer release was available from these endpoints to execute
as a supported strict-mode fix. The crates.io Hyper metadata attempt returned
HTTP403; official GitHub API/release documentation supplied the fallback.
Sandbox DNS failures were retried with authorized read-only network access.

Pinned Envoy Balsa source sets `disallow_header_continuation_lines=false`
(line181), then strips CR/LF while assembling values (lines451–461).
The retained H2 source shows the runtime-controlled Host discard path
(lines2585–2607), while its codec configuration permits differing Host and
:authority. The [versioned default header-validator contract](https://www.envoyproxy.io/docs/envoy/v1.40.2/api-v3/extensions/http/header_validators/envoy_default/v3/header_validator.proto)
describes validation of parsed maps and path transformations; it supplies no
exercised pre-normalization folding-rejection fix here. No claim is made that
all possible Envoy builds/extensions have been exhausted. Retained source is
upstream Apache-2.0 code, unmodified, with URL/hash provenance.

Hyper1.12.0 source locally confirms request parsing removes Content-Length
when chunked Transfer-Encoding is present (`proto/h1/role.rs`, lines280–286).
Its latest release includes outgoing framing sanitation, not a proved incoming
reject-both option. No technically credible second executable track was found,
so three broad PoCs were not rebuilt.

Two actual offline locked `cargo tree` runs still resolve `derivative2.2.0`
through Pingora core/load-balancing and `unsafe-libyaml0.2.11` through deprecated
`serde_yaml` in core. These are maintenance warnings, not newly claimed known
vulnerabilities. The original exact-lock audit is historical; no fresh audit or
scanner pass is claimed here. [Upstream issue889](https://github.com/cloudflare/pingora/issues/889)
is still open; [YAML replacement PR1117](https://github.com/cloudflare/pingora/pull/1117)
is open/unmerged in the freshly retained API record. Build-time derivative
replacement must preserve debug redaction and backend equality/hash/order.
The YAML library executes for fixed default startup configuration even without
untrusted YAML. Limited local exposure does not waive runtime maintenance risk.
Require a released upstream removal, unchanged input compatibility, lock/tree
proof and fresh independent audit/regression review; no ignore or private fork.

## Extra raw H2 and admission/drain proof

Source commit `1cb6d00` adds a test-only frame generator/response observer,
`spikes/envoy/recovery-raw-h2.mjs`; this is not a production framing parser.
Using the same authenticated loopback fixture and pinned image:

| Probe | Actual result |
| --- | --- |
| SETTINGS ACK carrying six bytes | GOAWAY FRAME_SIZE_ERROR(6), zero origin connections |
| PING carrying seven bytes | GOAWAY FRAME_SIZE_ERROR(6), zero origin connections |
| DATA on stream0 | GOAWAY PROTOCOL_ERROR(1), zero origin connections |
|32 admitted TLS H1 partial-header connections, SIGTERM | All32 close within685ms; zero origin connections |

The raw-probe command exits0. These four bounded probes do not establish all
H2 frame/HPACK conformance, max-stream fairness, saturation at the256-connection
cap, graceful completion of active WS/gRPC streams, or production drain SLOs.
They supplement the unchanged75; they cannot convert six failures into GO.

## Commands and immutable evidence

From `/tmp/aegisgate-03b-e`, holding the lock for the entire fixture lifetime:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/recovery-run.mjs
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/recovery-raw-h2.mjs /tmp/aegisgate-03b-e/.local/recovery-host-retention/edge-proof-run-EOinmu/manifest.json /tmp/aegisgate-03b-e/evidence/sprint03b-e/raw-h2-drain.json
cargo +1.99.1 tree --locked --offline --manifest-path spikes/pingora/Cargo.toml -i derivative
cargo +1.99.1 tree --locked --offline --manifest-path spikes/pingora/Cargo.toml -i unsafe-libyaml
```

The recording wrapper exits0 because it successfully records the failed proof;
its nested manifest check exits0, lab/evaluator exit1. Both tree commands exit0.
`runtime-host-retention/commands.json` contains exact argv, time, exit status
and source/log hashes; results include unchanged raw inputs and origin counters.
`provenance.json` records official sources and the extra probe command/exit.
Syntax checks for all four new modules and `git diff --check` exit0. The pinned
offline Gitleaks scan examines414176 bytes of the new evidence, exits0 and finds
no leaks; this is not a full repository/history scanner result.
`SHA256SUMS` binds all new evidence except itself. No fixture key is retained in
Git. The raw probe reuses disposable files from the failed run; clean reproduction
first runs the recording wrapper, then uses the emitted fixture path.

## Stop condition and next owner action

The architecture owner must obtain a maintained released codec/strict option
that rejects obs-fold before irreversible normalization and validates H2
Host/:authority/SNI before any origin bytes, plus a supported rejection mapping
that satisfies the unchanged four TE cases. Alternatively obtain a maintained
Pingora strict path preserving invalid targets/framing distinctions and valid
pipelining, with both maintenance warnings independently dispositioned. No
human architecture owner or approval is invented. Root/F must independently
review/reproduce this evidence. Only an all75-plus-relevant-new-tests proof and
required human architecture approval can open Module01. Module04 and production
remain blocked; independent Module03 work can complete through its own gate.

## Agent Completion Report

- Module:01, focused isolated parser recovery.
- Status: completed investigation; no qualifying implementation; NO-GO retained.
- Commits/files: diagnostic compiler/launcher, immutable run recorder, raw-H2/drain probe, this report, proposed ADR addendum and hashed evidence.
- Architecture/contracts: no accepted change; shared75 manifest/input/expectations unchanged.
- Positive/negative tests: exact commands and actual exits above;69/75 plus four supplemental probes; no exclusions.
- Performance: no new ranking or capacity claim; embedded common short benchmark remains a lab observation.
- Risks: obs-fold forwarding, H2 zero-byte failure, TE contract, strict-mode gaps and two unresolved Pingora maintenance warnings.
- Human review: architecture owner/replacement decision remains unassigned/pending.
- Next unblocked work: Module03 independent acceptance; no downstream proxy implementation.
