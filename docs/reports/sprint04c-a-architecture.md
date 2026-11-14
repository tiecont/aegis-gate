# Sprint 04-C A architecture and security decision

Status: documentation COMPLETE; architecture/security decision PENDING.
Baseline main `a325b9ecc086e09467f61b49f17da241bf8e43ea`.
Module01 NO-GO;04-12 LOCKED; production BLOCKED. No accepted contract changes.

## Decision proposed to the accountable owners

Recommend **Option 1: retain aggregate zero decrypted origin bytes**, and
continue maintained Envoy strict-ingress API research. The human delegates
engineering choices in this session ("làm hết theo plan, bạn tự quyết định nhé");
this permits the recommendation, not an invented named security approval or
runtime GO. No eligible released runtime has been demonstrated.

| Decision field | Actual record |
| --- | --- |
| Accountable architecture owner/name/role | PENDING; not supplied |
| Accountable security owner/name/role | PENDING; not supplied |
| Currently effective isolation contract | Original aggregate zero-byte contract |
| Recommended contract | Option1, unchanged |
| Maintained research track | Envoy strict pre-normalization API research |
| Runtime architecture selection | PENDING; none accepted |
| Required technical proof | Exact released capability, targeted failures, unchanged75, complete mandatory protocol/TLS/identity/resource/config proof, independent reproduction |
| Approval reference/date | PENDING; none supplied |
| Production signoff | BLOCKED, separate release gates |

Root is the engineering coordinator for the prepared handoff, not an appointed
human architecture/security owner. Upstream maintainers have no assigned
obligation until they accept a request; no draft has been published.

## Two contracts and their security consequences

**Option1** requires zero aggregate decrypted origin bytes over measured
connections during the original rejected-request interval. It detects partial
request headers, metadata and control bytes without needing a causal label.
It remains the original75 gate, including original observation timing.
It does not alone rule out a new dial with no HTTP bytes, prove tenant binding,
or prove absence of effects outside the capture interval. Those need separate
negative/control measurements.

**Option2**, proposed only, requires zero denied-request upstream streams,
HEADERS/CONTINUATION, HPACK state changes, DATA, parser errors, application
dispatches and rejection-caused new dials. Existing legitimate H2 control
traffic must be retained and causally attributed. It needs full downstream/
upstream connection+stream correlation, authenticated identity/config capture,
complete maintained frame/HPACK decoding and loss/truncation detection.
Unknown or unattributable state fails closed. Frame type alone cannot exempt
SETTINGS, WINDOW_UPDATE, PING, RST_STREAM or GOAWAY.

Option2 is **not proved equivalent to or universally stronger than Option1**.
It explicitly admits some traffic Option1 forbids; Option1 does not establish
some causal new-dial/HPACK properties Option2 demands. Under the actual threat
model, complete Option2 could more directly measure T01 tenant/authority
isolation, T07 smuggling, T08 parser abuse and T16/T17 connection lifecycle,
but observer incompleteness could hide precisely those leaks. Control traffic
can disclose timing/connection state and consume resources even when request
content never reaches origin. An explicit residual-risk decision is required.
No claim of equal protection can precede that decision and observer proof.

T11 signed-generation capture must bind every admitted request through both
hops. Neither contract replaces verified TLS, tenant isolation, strict H1
rejection, TE4xx/close, resource fairness, cancellation or valid streaming.
Handler-only and response-code-only acceptance are rejected: they miss partial
HEADERS, HPACK mutation, failed parser input, new connections and metadata.
Zero new connections alone permits leaks on a reused connection.

## H2 reused-connection reconciliation

Accepted Sprint04-B observation is9 decrypted bytes,0 handlers, a complete
SETTINGS ACK on a previously valid reused origin connection:
`000000040100000000`, SHA256
`a9fd441cc14ae4b467f3ea0a0ed70de71bb5834db34815eca9cceb70017adfd6`.
This is a bounded frame classification, not a complete request-attribution proof.
The original result remains FAIL. No subtraction, delayed observation, removed
pool reuse or expected-byte edit is authorized. Serial application requests do
not serialize asynchronous transport control. D's additive observer work can
improve evidence without retroactively passing this test.

## Implementation, audit and operational cost

| Work | Option1 retained | Option2 proposed |
| --- | --- | --- |
| Implementation | No evaluator change; candidate must meet original quiescence plus all other requirements. Runtime control scheduling/pooling changes require real positive/negative proof. | New separately versioned suite and complete maintained stateful observer; instrument connection/stream correlation and generation/identity provenance. No project-owned production parser. |
| Audit | Simple unchanged byte oracle; independently verify capture coverage, connection inventories, interval and raw origin data. | Audit every mapping, pending partial frame/block, HPACK state transition, permitted control cause, loss counter and causal dial; deliberately inject leaks without handlers. |
| Operations | Retain raw all-byte evidence and verify reuse/drain/resource properties; no assumption that disabling pools is acceptable. | Two result columns and versioned policy; privacy-safe bounded traces, observer version support, decoder security updates and attribution failure triage. |
| Residual risk | Overrestricts legitimate asynchronous control in denial interval; passing still needs identity/new-dial/resource proof. | Misattribution or missing HPACK visibility can hide leakage; permitted traffic may expose timing/resource side effects. |
| Stop | Any old mandatory failure or unproved lifecycle remains NO-GO. | Incomplete observer, ambiguous causality, missing human approval or any mandatory failure leaves original gate effective. |

## Proof and approval sequence

1. B pins a maintained RELEASED capability that changes strict provenance
   behavior. An unreleased patch, merged issue or new version number is insufficient.
2. Prove the historical failing cases first, then unchanged75, valid encoded
   targets/ordered pipelines and complete TLS/SNI/origin verification, H1/H2,
   WS/gRPC, cancellation, pool/trust partitioning and generation/recovery proof.
3. Resolve relevant resource/conformance failures, maintenance/advisory
   dispositions, complete local gates and exact-head hosted CI.
4. F independently reproduces exact eligible sources and rejects leaks under
   adversarial observer controls. Review is scoped, not human approval.
5. Named human architecture/security owners record selected runtime, contract,
   limits, exact reviewed source/ADR revision, approval reference and UTC date.
   Only an affirmative recorded GO opens Module04. Production requires its
   separate release/signoff matrix.

For Option2 additionally validate the complete observer and separate suite,
obtain explicit formal requirement-revision approval and document the original
corpus migration policy. The original75 remains immutable and its failures stay
visible. The user has expressly prohibited changing it during this sprint.

## Independent review inputs and completion

Read ADR011/012, Sprint04-B security-contract and alternative-test design,
A/D, B, C, Phase0 and final integration independent verdicts. They accept only
proposal/research/diagnostic/local evidence; none activates ADR012. The6 Envoy
and7 supplemental failures remain mandatory. See the proposed
[ADR addendum](../ADR-012-sprint04c-decision-addendum-proposed.md) and
[approval checklist](sprint04c-human-approval-checklist.md).

- Module/status:01 decision documentation complete, approval PENDING.
- Contracts changed: none. No runtime or performance claim.
- Validation: source/doc hashes and unchanged-corpus check are in
  `evidence/sprint04c-a/`; exact source commit precedes those receipts.
- Human review needed: named accountable owners and recorded formal decision.
- Next unblocked work: bounded B/C/D/E work and F review; no Module04.
