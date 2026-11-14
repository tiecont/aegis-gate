# Sprint 04-C F independent B/D review

Verdict: **ACCEPT B upstream-dependent research and partial proof** at
`12abd255b754b553480544edbf9452b7f65d9a4d`; **ACCEPT D bounded diagnostic
observer and retained failures** at `d9a2004167a178a3a1d4549cc97378fe4b02c360`.
Neither verdict establishes an eligible runtime, an approved Option2 observer,
a requirement waiver, human architecture approval or Module01 GO.

## Independent evidence

Committed verifier `7f8594a` and subsequent receipt/source checkpoint `a267142`
produce `evidence/sprint04c-f/bd-01/`. F verifies exact clean owner heads,
all protected baseline objects, owned file modes/blobs/bytes, manifests,
unchanged corpus and authored whitespace. Independent official release/tag
queries and all19 immutable released source fetches match B's retained hashes:
Envoy1.40.2, Pingora0.9.1 and Hyper1.12.0. No changed released strict-fold
capability is demonstrated. Unreleased snapshots cannot trigger candidate work.

F audits all29 H1 observations, actual TLS identities, raw request/response
hex, origin-byte counts and peer closure. Sixteen TE observations cover four
vectors on default/mapped listeners and fresh/reused downstream connections.
The supported status-only local mapper returns400 with peer close and zero
origin bytes/new connections/handlers/errors; default remains501. Upstream501
and valid target/order controls stay separate. This closes a partial proof gap
without changing the original69/75 result or repairing folded syntax. Folded
headers still normalize/forward. Trailer delivery and B's H2 HPACK/status
attribution remain unproved; first H2 completion failure remains ineligible.

F builds D's maintained decoder from its exact source, independently runs its
race/relay tests, then executes11 separately authored CLI fixtures. Forbidden
HEADERS, state-only HPACK updates, partial HEADERS without handlers, new dials
without handlers, DATA on reused streams, interleaved CONTINUATION, lost capture,
unknown stream mapping and forged tenant mapping all report violation or
incompleteness. Stateful dynamic-index decoding and existing control traffic
decode as scoped controls. Every fixture keeps `semantic_security_pass=false`.
These executions hold the shared fixture lock; no production parser is added.

The decoder's exact HPACK mutation visibility, authenticated dispatch/tenant/
generation mapping and control causality remain incomplete. Real captures with
dropped tails stay incomplete. The observer is useful diagnostic work and is
not a complete Option2 acceptance observer. Original75/23 and all6/7 failures,
including9-byte SETTINGS ACK failure, remain unchanged. Native socket silence,
local reset codes and bounded memory samples do not become security proof.

`receipts-bd-02` independently verifies source/tree and raw command stream
hashes across seven B/D receipt groups. Scoped pinned offline Gitleaks over
all260 changed A/B/C/D files (1,640,819 bytes) exits0 with an empty findings
array and removes its staging tree. This deliberately excludes E while its
separate scanner finding is repaired; it is not a final integration scan.
Raw argv/tools/source/time/exits/outputs and SHA256 are retained. Fresh audit
of both manifests verifies all entries; observer/test/root-helper Node syntax
checks also exit0. No new full runtime reproduction or full75 run is claimed.

## Open integration blockers

Earlier E acceptance in `sprint04c-f-ace-review.md` is **SUPERSEDED for E**:
the subsequent all-owner secret scan finds a JWT-shaped public Netlify RUM
value inside fetched official typescript-eslint HTML. Safe finding metadata
and the failed scan remain in `receipts-01`; no value is published, replayed,
or scanner-suppressed. Corrected E source, sanitized publishable ancestry and
fresh full E proof need independent review. A/C acceptance is unchanged.

Root helper `e747e80` adds owned private-material cleanup, but assertions can
throw before deletion in its current shared try block. F requires removal and
resource inventory to run independently/finally even after an exclusion-check
failure, while preserving failed status and the fixture lock. This helper is
not yet accepted. Source changes must be committed and reviewed before full
gate execution. Full integration/local/hosted review remains pending.

## Agent completion report

- Scope: exact B/D source/research/diagnostic review COMPLETE and ACCEPT.
- Tests: independent19 official source comparisons, maintained decoder build,
  race/relay tests,11 F adversarial fixtures, receipt/manifests and scoped scan
  pass; exact provenance is in `bd-01` and `receipts-bd-02`.
- Contracts/architecture decisions: none; ADR012 remains proposed and named
  human owner/approval remain PENDING.
- Remaining: corrected E proof, root helper repair, final integration source/
  local gates and exact hosted head/merge evidence. Module01 NO-GO;04-12 LOCKED;
  production BLOCKED.
