# Sprint05C F Independent Security Review

Review in progress. Module01 remains NO-GO, Modules04-12 LOCKED, production
BLOCKED. No blanket acceptance is granted. A/C final source is still pending.

## Reproduced Observer Findings

**REJECT bounded observer security PASS at D8494aa2/codeb58e7bb.** The existing
D Go race suite exits0 from a fresh clean clone; independent F Go overlay
tests exit1 with three false PASS results and one passing forbidden-DATA control.
The overlay changes no D file. Evidence:
`evidence/sprint05c-f/d-independent-02/`.

1. **Final rejection can be overwritten.** `main.go` decision handling replaces
   the previous decision without checking whether it was already final. A
   signed final rejection followed by signed final allow erases the rejection
   of the request that caused earlier origin dial/HEADERS. Both complete and
   bounded research PASS become true. F test
   `TestSprint05CFFinalDecisionCannotBeRewritten` fails.
2. **Request IDs can alias a downstream stream.** Request registration does not
   reserve the `(downstream_connection, downstream_stream)` identity; only
   upstream bind checks do. A rejected request and an allowed alias share that
   tuple; binding the alias attributes its HEADERS and handler to allow and
   produces research PASS. F test
   `TestSprint05CFMultipleRequestsCannotAliasDownstreamStream` fails.
3. **Handler dispatch does not require captured HEADERS.** A complete signed
   ledger with request, bind and handler, but no corresponding upstream
   HEADERS, is accepted as complete/research PASS. The independent contradiction
   between handler dispatch and captured transport history is not checked.
   F test `TestSprint05CFHandlerRequiresObservedHEADERS` fails.

These are consistency failures inside the trusted-signer boundary, rather than
an assertion that a compromised signer can always be detected. A signer can
produce internally inconsistent associations while passing the implementation's
current checks. The existing documented absence of production dispatch binding
and exact dynamic-table tracing remains an additional limitation.

The ordinary forbidden HEADERS/DATA control remains rejected. Integrity,
bounded captures, live verified TLS proof and negative fixtures are useful
tooling, but their passing tests cannot establish fail-closed completeness.

## B Reproduction

Fresh clean source04440235a68c82e2e76f3919453adbb25bf4eb9a/tree
7a9c4b097a72767bb89aae18671bf163d0848c4e independently reproduces **56/75,
17/23,11/12**. Original75, unchanged evaluator, original23 and additive matrix
each exit1. Collector and consistency verifier exit0. Original H2 still fails
with NGHTTP2_PROTOCOL_ERROR and zero observed origin bytes/handlers. Both
independent SETTINGS and SETTINGS-overlapping421 produce the unchanged exact
nine-byte ACK `000000040100000000`. Scope: ACCEPT B's executable scoped stop
and finite positive evidence; REJECT original H2 repair, full H1/H2 runtime,
resource eligibility and production GO. Evidence:
`evidence/sprint05c-f/b-independent-01/`.

## Execution Limits

F tooling commits9d5e520 and50a64eb precede execution. Full shared fixture lock
covers checkout, tests, capture and hashes. Both complete runs verify all11
protected files before and after and every tracked source hash after execution.
Exact source/tree, Node/Go binary hashes, argv, exits, raw streams and artifact
hashes are retained. Semantic security PASS remains false in every F receipt.

Initial D checkout attempt01 hit ENOSPC on the full12GiB `/tmp` filesystem
before any observer tests. Its partial receipt/raw failure remain retained;
its empty SHA256SUMS is incomplete, not valid evidence. Only the owned partial
checkout was removed. Subsequent clean checkouts use disk-backed
`/home/tiecont/.cache/aegisgate-sprint05c-f/`.

## Agent Completion Report

- Module/status: Sprint05C F independent security review, partial/in progress.
- Commits/files: F-owned runner, overlay tests, report and evidence only.
- Architecture/ADR decisions: none.
- Contracts changed: none; original75/23 remain immutable.
- Positive tests: clean D race suite exit0; B collector/verifier exit0.
- Security negatives: three D false PASS defects reproduced; B original failures retained.
- Performance: no capacity/resource/production claim.
- Known blockers: D false PASS findings, original H2/userinfo failures, final A/C review and E reproduction pending.
- Human review: root may integrate only subsequently accepted safe scope; no push/merge by F.
- Next actions: finish independent A/C/E checks and final owned scanner/cleanup verification.
