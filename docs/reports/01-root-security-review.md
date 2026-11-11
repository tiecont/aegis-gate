# Module 01 root security review

Decision: **No-Go at this proof state; gate CLOSED**. No production signoff.

The root independently reran the owned-loopback release lab. The run at
`.local/pingora-run-0cI2Oi/results.json` returned exit1: 34 pass, one failure
among 35 cases. Safe exported results are
`evidence/orchestration/01-root-local-results.json`; terminal evidence is
`01-root-reproduction.log`. These are real protocol/TLS/benchmark tests, not
advertised capability claims. Later scan remediation changed only encoding of
the public RFC6455 example nonce in the harness; the final repeat is recorded
in `01-root-final-reproduction.log` and its referenced results directory.
The final repeat also returned exit1 with the same 34/35 result. Its safe
export is `evidence/orchestration/01-root-final-local-results.json`.

## Blocking finding P01-01

`malformed-HTTP-invalid-request-target` sends the raw request line
`GET /bad target HTTP/1.1` and receives HTTP200 from the owned origin. The
required assertion is a 4xx or closed connection with no origin dispatch.
Source review confirms Pingora0.9.1
`pingora-core/src/protocols/http/v1/server.rs` retries Token/Version parse
errors through `escape_illegal_request_line`, replacing the original bytes.
The request filter therefore cannot distinguish this normalization from an
originally encoded request using its preserved-header API. No exploit or
general claim of Pingora insecurity is asserted. This is a failed mandatory
project criterion. Suppressing the test or rejecting every encoded URI would
not establish correct original-request handling.

## Scoped positive evidence

The lab exercises dynamic SNI and Host binding, active-stream certificate
rotation, captured immutable generations, H1/H2 streaming, WS and gRPC bidi,
trailers/cancellation, verified wrong-name/expired/untrusted origin rejection,
trust-store pool separation, health/weighted failover, bounded timeout/upload
cancellation and malformed framing. The short local reference benchmark is not
a launch SLO or superiority claim. The spike remains isolated from `apps/edge`.

## Maintenance disposition

Exact Rust audit reports zero known vulnerabilities but two unmaintained
warnings: RUSTSEC-2024-0388 (`derivative`) and RUSTSEC-2024-0449
(`unsafe-libyaml`). Neither is ignored or risk-accepted. No untrusted YAML is
accepted by the spike, but runtime dependency/maintenance ownership still
requires review. Licenses, exact pins, hashes and limitations are in ADR-011
and the agent completion report.

## Required decision

`prompts/ORCHESTRATOR_PROMPT.md`, execution policy9, requires stopping at
"Pingora architecture decision if No-Go". ADR-011 is the concrete proposed
decision with Envoy and Hyper/Tokio alternatives. A responsible human must
review a maintained strict-mode fix or authorize an alternative proof before a
material architecture change. No replacement, weaker parser criterion, public
traffic or production deployment was performed. Modules03–12 remain locked
under the project's full prerequisite policy.
