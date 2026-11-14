# ADR-012 Sprint 04-C decision addendum (PROPOSED)

Status: PROPOSED / human decision PENDING. This addendum does not supersede
ADR012 or activate a new requirement. Baseline `a325b9e`,2026-11-14.

Recommendation: keep Option1 aggregate zero decrypted origin bytes under the
unchanged75 evaluator. Continue maintained Envoy strict-ingress API research.
Option2 request-isolation remains separately proposed and requires complete
observer validation, independent security review and explicit human approval.
The9-byte H2 SETTINGS ACK remains an original-gate FAIL.

Option2 is not universally equivalent or stronger: it permits legitimate
attributed existing-connection controls while demanding causal no-dial/no-stream/
no-HPACK-effects proof absent from a byte-only oracle. Incomplete mapping,
decoder state, partial blocks or capture loss must fail closed. Handler/status
only acceptance is explicitly rejected. Read the full
[decision analysis](reports/sprint04c-a-architecture.md).

| Approval field | Actual value |
| --- | --- |
| Architecture owner/name/role | PENDING; not supplied |
| Security owner/name/role | PENDING; not supplied |
| Selected effective isolation contract | Existing Option1 unchanged |
| Recommended research track | Maintained Envoy strict pre-normalization API |
| Approved runtime/source | PENDING; no eligible runtime |
| Technical/security review | PENDING for any future candidate; F scope recorded separately |
| Formal human decision/approval reference/date | PENDING; none supplied |

Required proof: supported released capability; targeted old failures; unchanged75;
complete TLS/identity/stream/cancel/pool/config/resource/dependency evidence;
independent exact-source reproduction; full local and exact-head/merge hosted
gates. Any requirement revision needs its own versioned approval and validated
suite; retain original inputs/expected/evaluator and all failed history.

Sprint completion, delegated engineering choices, an upstream reply, CI green
or75/75 alone cannot record GO. Module01 NO-GO;04-12 LOCKED; production BLOCKED.
