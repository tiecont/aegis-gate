# Sprint04-B Security-Contract Clarification

Status: analysis/proposal only; **existing all-byte contract retained**.
Architecture/security owner and formal requirement revision remain PENDING.
This memo does not change the75-case manifest, evaluator, assertion, timing,
origin counter or historical FAIL. Threats: T01,T07,T08,T11,T16,T17.

## Four Distinct Properties

| Property | What it establishes | What it does not establish under H2 reuse |
| --- | --- | --- |
| No forbidden request forwarding | Rejected request never admitted to the origin application, if measured below parsing/dispatch | Zero handlers alone misses partial headers, invalid framing, parser errors and metadata disclosure. A zero-handler result is insufficient. |
| No new origin connection | Rejection creates no new transport/handshake/dial, with complete connection attribution | A reused connection can receive full HEADERS/DATA for the forbidden request. Existing health or valid-request dials also require separate attribution. |
| No origin HTTP request HEADERS/DATA | No rejected request's HEADERS/CONTINUATION/DATA or stream-open/HPACK mutation reaches origin, with complete frame/stream mapping | Existing connection SETTINGS/PING/window/cancellation traffic may still arrive. Complete byte accounting and stateful decoding are necessary; a header count or selected frame filter is insufficient. |
| No decrypted bytes of any type on any existing origin connection during the original interval | Strong aggregate quiescence, including protocol/control side effects, in the stated measurement interval | Does not by itself authenticate tenant identity or prove correct valid requests, deadlines or resource bounds. Concurrent legitimate connection control/application activity can violate it even when request isolation holds. |

These properties are not interchangeable or a simple universal implication chain.
Connection creation can send no decrypted HTTP bytes, and existing-connection
traffic can occur without a new dial. The last property is the current tested
contract and remains binding; provenance/classification cannot change its result.

## Actual Observation

Sprint04-A B and independent E observe9 decrypted origin bytes,0 handlers,
0 parser errors and0 transport errors for the H2 negative. Warm-valid-then-deny
traces identify the complete control frame on an existing previously valid
connection; no new origin connection or request HEADERS/DATA is observed:

```text
000000040100000000
length=0 type=SETTINGS(4) flags=ACK(1) stream=0 bytes=9
SHA256 a9fd441cc14ae4b467f3ea0a0ed70de71bb5834db34815eca9cceb70017adfd6
```

This supports a bounded control-frame classification. It is not proof of every
possible concurrent H2 stream or a complete absence-of-forwarding theorem.
The existing test still FAILS. Do not subtract9, suppress control events, delay
the interval until the connection is quiet or change expected bytes to9.

H2 connections have asynchronous SETTINGS acknowledgment, PING, flow-control,
drain and stream-cancellation lifecycles. A byte can be causally associated with
a preceding valid request yet arrive inside a later denial interval. Conversely,
attributing all traffic to old work without stream evidence could conceal a leak.
Serialized application requests do not serialize all transport control activity.
Closing or disabling pools can change this behavior but would require complete
valid-reuse/performance/resource proof; it is not a permitted hidden test tweak.

## Consequences Of The Choices

Retaining aggregate zero-byte quiescence supplies a simple strict oracle and
rejects every observed origin interaction in the measurement interval. An engine
must meet it under the unchanged harness; protocol reuse/control scheduling may
make the engineering requirement more restrictive than application isolation.
That is a design tradeoff to expose, not grounds for an agent waiver.

A possible future request-isolation contract would require no forbidden stream,
header block, data, parser error, application dispatch or rejection-caused new
connection, while separately retaining and attributing all existing-connection
control bytes. It better separates request leakage from connection maintenance
but requires a much stronger observer and formal security review. HPACK state,
CONTINUATION, partial frames, multiplexing and bidirectional traffic must be
accounted for; merely checking frame types would weaken protection.

Changing only to zero handlers or zero new connections is not recommended: both
permit forbidden bytes on an existing connection and can conceal parser abuse.
Any revised contract must retain strict original H1 rejection before origin
bytes, TE4xx/close, raw target preservation, SNI/authority/Host binding, verified
TLS, tenant/pool isolation, cancellation and resource bounds.

## Reviewable Proposal And Decision Record

The preferred current action is retain aggregate zero-byte acceptance and
continue maintained upstream research. If the human owner seeks a semantic
revision, review [ADR012](../ADR-012-strict-ingress-decision-proposed.md) and the
[separate alternative test design](sprint04b-alternative-test-design.md).
Require named architecture AND security approval for a numbered contract
version, independent adversarial observer validation and a separate new corpus.
Never overwrite the original75 history. Report old-contract and proposed
contract outcomes separately; neither automatically establishes Module01 GO.

Required approval record: human owner/name/role, exact ADR revision, selected
property, threat rationale, concurrent-control treatment, independent review,
approval reference/date and migration/deprecation policy for the original gate.
None is supplied by this memo. Session delegation authorizes research choices,
not an implicit origin-byte waiver or unproved architecture GO.
