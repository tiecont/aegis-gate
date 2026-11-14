# Sprint05B F independent review plan

Baseline: 8758b1c84b4186449cd79fabae461ca53ee05100. Only F tooling,
evidence and docs/reports/sprint05b-f-security-review.md are owned here.

1. Pin source/tree and immutable75/23 parser, observer, evaluator and fixture
   bytes before each clean local clone executes. Never edit other writers.
2. Rebuild A's released llhttp in process and reproduce its native and verified
   TLS wire proof after the current additive harness bug is corrected.
3. Independently reproduce D's six late-trailer/cancellation scenarios and
   check complete transport teardown before attributing the next interval.
4. Reproduce B's unchanged75/23 and decode the exact nine-byte ACK; independently
   trigger a peer SETTINGS update without a downstream request.
5. Reproduce C's original23 untapped and separate verified TLS frame relay.
   Preserve failures for userinfo status and missing raw H2 error frames.
6. Reproduce E regressions, audit root native launcher/resource and cleanup
   sources, validate hashes, secrets and exact production scope.
7. Commit per-failure ACCEPT/REJECT verdicts. ACCEPT applies only to narrow
   testing/evidence changes; Module01 remains NO-GO,04-12 locked, no production.

All fixture runs hold /tmp/aegisgate-sprint02-fixtures.lock through setup,
capture, hashing and teardown. Raw child failures remain failures even when
an outer collection succeeds. No public protocol testing, pushes or merges.
