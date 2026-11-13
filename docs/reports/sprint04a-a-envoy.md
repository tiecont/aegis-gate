# Sprint04-A Agent A - Envoy strict ingress

## Current codec-boundary handoff (2026-11-13)

**Investigation complete; implementation stopped at the same released API
boundary. Module01 remains NO-GO.** Current owned branch is
`fix/module01-envoy-codec-boundary`, worktree `/tmp/aegisgate-04a-a`, rebased onto
fetched `origin/main` **`3e03940848c81751c87bbcec131238abb7d28e1b`**. The original
branch `fix/module01-envoy-strict-ingress` remains at `4d2d0c7`; its evidence,
receipts and checksum manifest are unchanged. The inherited coordinator-document
commit was excluded when rebasing the seven owned historical commits. This
branch changes only `spikes/envoy/strict-*`, `evidence/sprint04a-a/` and this
report. No other worktree, shared gate, corpus, image, TLS or production source
was edited; no other agents were started or branches merged.

Mandatory guidance and the current coordinator execution contract were read.
The executable plan in `codec-boundary-status.json` requires historical-object
verification, fresh official release/source retrieval, immutable-contract checks,
and a precise stop without repeating a failed proxy experiment.

### Fresh supported-release verification

Committed source **`0ce9ada1232a7aecde06318ca17829e6ab8e3d31`** collected official
metadata and all23 previously inspected source files at
`2026-11-13T09:51:25.152Z` through `09:51:37.866Z`, using supported Node26.13.0.
The26 captured commands all exit0. Latest remains **Envoy v1.40.2**, published
`2026-10-27T01:51:56Z`, exact source
`b2d89e0ae53916f28770771fbdd49c5c99c5c5a2`. Every retrieved source file, including
release policy, public protocol/validator APIs, Balsa/H1/H2 implementations and
upstream parser tests, is byte-identical to `upstream-03`. The API/source
citations in the historical report below therefore apply directly to
`upstream-04` at the same line numbers. These are source inspections, not
executed upstream test results.

The exact stop remains: Balsa sets
`disallow_header_continuation_lines=false` (:181), exposes no constructor
strict-fold setting, keeps raw callbacks private/no-op (:304-305; header:39-45),
and removes CR/LF before `onHeaderValue` (:451-464). Public validation receives
a `RequestHeaderMap` (`validator-api`:54), after the distinguishing raw bytes
are gone. No released public strict-fold configuration or maintained adapter
was established in these inspected interfaces. H2 Host retention and supported
local-reply TE status remapping remain separate prospects; neither repairs the
lost H1 folding information or supplies a new complete candidate.

**New candidate count0; new runtime executions0.** The previous failed69/75
Host-retention proof was not repeated. Its six failure IDs,263 obs-fold origin
bytes/one handler, nine H2 bytes/zero handlers and four TE501 responses remain
historical failures under the unchanged contract. B owns fresh wire
classification. This report neither classifies those nine bytes nor waives
the mandatory zero-byte assertion. No protocol/resource/performance or new
origin observation is claimed by this continuation.

### Verification and immutable evidence

From `/tmp/aegisgate-04a-a`:

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/strict-research.mjs evidence/sprint04a-a/upstream-04
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/strict-boundary-check.mjs evidence/sprint04a-a/upstream-04 evidence/sprint04a-a/boundary-checks-01
```

Both exit0. The checker validates157 original manifest entries against original
Git objects, requires every historical evidence file to remain byte-identical,
verifies26 fresh command stream hashes and their launch-time source objects,
compares all23 source responses, and checks all12 protected contract files
against both current baseline3e039408 and original75 baselinee5adeb4. The
baseline extractor confirms the original65 cases plus ten supplemental cases;
raw inputs, expected results, encoded/pipeline positives and zero-byte assertions
are unchanged. All12 nested syntax/baseline/whitespace/version/scoped secret
commands pass. Gitleaks8.30.1 uses its existing immutable image pin and no
network; `flock /tmp/aegisgate-sprint02-fixtures.lock` covers each complete
container lifetime. No HTTP fixture/listener/proxy was started. These scoped
checks are not full repository/image SCA, hosted gates or independent review.

Receipts and hashes:

```text
82e58c1fa69abf4ad36ad8979c4dc0975b660cca23b63cb0dc7b25da3851ccd5  upstream-04/commands.json
15a39eee0b3ef04d74a67b1b00c191bb84a04301559b6282584e586a5e4f621f  boundary-checks-01/commands.json
771847912000a77825f58c1a6e70e9667229cb16f9a6151b4fa5bbb99f0585ee  boundary-checks-01/integrity.json
5393acb5299d044624f6720fdc84c1bc2830e56ce3b858584d21a37a9ff16f39  SHA256SUMS (historical, unchanged)
```

The earlier lost `upstream-01` attempt remains explicitly ineligible; its raw
bytes/times/hashes cannot be recovered. The retained failed404 `upstream-02`
attempt is unchanged. No fresh retrieval/check attempt failed. Updating this
report does not rewrite the historical manifest: its report entry is verified
against the original `4d2d0c7` Git object. Final report-inclusive verification
will be recorded separately as `boundary-checks-02`, including a new checksum
manifest, after this report/source is committed.

### Required independent handoff

Root/E must review the precise stop, historical-object interpretation and
lost-attempt limitation, reproduce the offline verifier with a fresh output
directory and verify the final manifest against its recorded source commit.
**Independent E review is required and pending; no integration acceptance is
claimed.** Preserve the original branch/objects referenced by old receipts.
Root owns full locked check/scan and exact-head hosted gates before integration.
The next upstream prerequisite is a maintained released pre-normalization
fold-rejection API applied on every H1 request/trailer. Only after a credible
complete path exists should the six known failures be tested first, then all75
unchanged plus required protocol/TLS/identity/resource positives and negatives.
Independent review and explicit human architecture approval remain required.
Modules04-12 stay locked and production stays blocked.

## Historical strict-ingress handoff (retained verbatim)

Result: **investigation complete; no eligible executable candidate**. Module01
remains NO-GO. Branch `fix/module01-envoy-strict-ingress`, restored worktree
`/tmp/aegisgate-04a-a`; source review completed 2026-11-13 UTC. Root owns
integration, shared gate/ADR/risk files and architecture review. No other agents
were started, branches merged or upstream requests published.

## Maintained release and precise stop

The official latest-release API still returns **v1.40.2**, published
2026-10-27, resolving to `b2d89e0ae53916f28770771fbdd49c5c99c5c5a2`.
Its retained `RELEASES.md` describes the last-12-month maintenance window.
This is the same release as the existing pinned candidate, not a new strict
codec release. All source URLs, bytes, retrieval times, exits and SHA256 values
are retained in `evidence/sprint04a-a/upstream-03/commands.json`.

**Stop: Envoy's released H1 Balsa adapter supplies no public configuration or
callback to reject obs-fold before its irreversible normalization.** The
underlying QUICHE validation-policy member exists, but Envoy hard-codes it to
false and does not expose it through its public validator API. A private patch,
custom codec/raw scanner or post-codec whitespace heuristic does not satisfy
the authorized maintained-parser requirement.

The following references use line numbers in the retained unmodified upstream
sources (`upstream-03/<name>.stdout`, retained as retrieved).
The corresponding GitHub source is pinned to the commit above.

| Surface | Evidence and implication |
| --- | --- |
| H1 parser construction | `h1-codec`:520-527 constructs `BalsaParser` directly. A deprecated hidden `use_balsa_parser` field remains in `protocol-api`:508-514, but this constructor does not select a legacy parser. Merely setting it is not a credible strict candidate. |
| Pre-normalization policy | `balsa-parser`:180-193 sets `disallow_header_continuation_lines=false` before passing the policy to the framer. Its constructor has no strict-fold argument (`balsa-parser-header`:22-23). `strict_chunk_parsing` controls stray chunk data, not header folding. |
| Raw callback | `balsa-parser`:304-305 defines no-op `OnHeaderInput`/`OnTrailerInput`; these overrides and the framer are private (`balsa-parser-header`:39-45,71-72). The internal callback is not an exposed extension hook. |
| Irreversible normalization | `balsa-parser`:451-464 strips CR/LF before `connection_->onHeaderValue`. A later semantic filter sees a value indistinguishable from an originally unfolded value. |
| Public validator | `validator-api`:48-54 validates a `RequestHeaderMap`; transformation also takes maps (:87-96). `validator-config` exposes path, method, underscore and CL/TE policy, with no raw folding switch. UHV build/runtime selection in `hcm-config`:143-200 does not change Balsa's earlier normalization. |
| Legacy alternative | `legacy-tests`:4944-4971 explicitly expects both http-parser and Balsa to strip folding and decode the normalized request successfully. These are inspected upstream tests, not locally executed tests. `legacy-parser-readme` identifies the vendored historical http-parser source. No maintained strict selector is established. |
| H2 identity | `h2-codec`:2188 permits different Host/:authority; :2523-2524 reads `http2_discard_host_header`; :2584-2607 discards Host when authority exists. Retaining Host can preserve information for semantic checks, but is the already-failed diagnostic track, not proof of zero origin bytes. |
| TE rejection | `h1-codec`:917-925 explicitly chooses501 for unsupported TE. `validator-api`:48-54 documents400 for validator rejection; UHV availability is build/runtime dependent. `h1-codec`:1376-1394 sends codec errors through `sendLocalReply`; `hcm-api`:1004,1208-1213 and `local-reply`:123-126 expose status remapping. These are supported prospects for a later focused TE experiment, not an executed fix or a solution to lost folding. |

No new proxy/codec was built or launched. Candidate count: **0**; new immutable75
runtime executions: **0**. Repeating the broad Host-retention run would not test
a new pre-normalization path. No new H2/resource result, safety score, origin
observation or architecture approval is claimed. This stop is scoped to the
latest released interfaces inspected; it is not a claim to have exhausted
every older supported release, future release or custom extension.

## Preserved Contract and Historical Context

The entire tracked `spikes/edge-comparison/` tree and `spikes/pingora/lab.mjs`
are byte-identical to baseline `e5adeb4`. Their hashes and the pinned original65
manifest extraction are verified offline; all75 cases, raw inputs, expected
outputs, valid encoded/pipeline controls and zero-byte assertions stay intact.
No production source, TLS option, image pin or authorization policy changes.

Historical evidence only: Sprint03-B independent F already reproduced69/75
with six failures. Obs-fold observed263 origin bytes/one handler; H2 authority
confusion observed9 bytes/zero handlers; four TE cases returned501 with zero
bytes/handlers. See `sprint03b-f-security-review.md` and its retained results.
A does not classify those9 bytes or reinterpret zero handlers as successful
denial. B owns independent wire classification; any protocol-background finding
must still preserve the unchanged zero-byte contract.

## Executed Evidence and Failures

Executable research source was committed before collection:

- `70813bde6342b64d247eb779c4a5e1c78490f874`: initial bounded collector and plan.
- `dced287`: corrected upstream paths; adds vendored parser/public API sources.
- `39ea76d`: offline receipt/source-object checker and explicit loss disclosure.

Commands from `/tmp/aegisgate-04a-a`:

```sh
node spikes/envoy/strict-research.mjs evidence/sprint04a-a/upstream-02
node spikes/envoy/strict-research.mjs evidence/sprint04a-a/upstream-03
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/strict-check.mjs evidence/sprint04a-a/checks-01
```

`upstream-02` exits1: the obsolete `bazel/repository_locations.bzl` URL returns
404/curl22. All raw outputs and exact command hashes remain. `upstream-03`
exits0, with all26 nested commands successful. It uses corrected released
`bazel/external/http_parser/` paths. Both collectors ran tracked-clean sources
and record Node26.9.0, exact curl version, bounded HTTPS argv and immutable
upstream/source hashes. That system Node is below the repository's declared
26.13.0 minimum, so collection is not a supported repository-gate run. Offline
verification uses the pinned Node26.13.0 toolchain.

`checks-01` exits0: verifies every retained stdout/stderr digest and every
launch-time source against its historical Git object (including older collector
versions), checks contract files against baseline, runs both syntax checks,
the pinned baseline extractor and source whitespace validation. Pinned offline
Gitleaks8.30.1 scans owned Envoy source, all new raw evidence and the report with
no leaks; all exit0. This is scoped secret evidence, not repository-wide SCA,
image vulnerability scanning, `make check` or hosted quality gates.

`checks-02` independently repeats the same eight commands after the final
investigation report and source evidence are committed at `2625846`; all exit0.
The evidence scan examines1.91MB of actual raw inputs. `checks-03` is the final
receipt after correcting the count/citation above and adding manifest tooling;
its exit0 again verifies the unchanged contracts and scans the completed report.

An earlier `upstream-01` attempt exited1 with the same404 according to the tool
transcript, but the environment restart deleted the entire `/tmp` worktree and
uncommitted raw evidence. `attempt-loss.json` explicitly marks original times
and raw hashes unavailable and that attempt ineligible as proof. The surviving
branch was restored with `git worktree add --force`; no other worktree was
altered. `upstream-02` is a fresh failed attempt, not reconstructed old evidence.
This loss prevents claiming complete original-attempt retention.

The research scripts never create fixtures or listeners. Scanner containers run
offline under `flock /tmp/aegisgate-sprint02-fixtures.lock` for their complete
lifetimes. No HTTP security/load probe was sent to an external endpoint.
Retrieved upstream source remains unmodified Apache-2.0 project material;
the vendored legacy parser retains its own license text.

## Required Root Followups

1. Independently review source lines, command receipts, lost-attempt limitation
   and hashes; run the offline checker at the accepted commit. Keep Module01
   NO-GO, Modules04-12 locked and production blocked. Integrate only after E
   accepts the report/evidence and root's exact-head gates pass.
2. Relay this precise stop to C: an alternative may advance only with its own
   credible maintained pre-normalization path. A network/filter/validator hook
   name alone is insufficient. Upstream work must expose the Balsa continuation
   rejection policy or an equivalent released strict API before value callbacks;
   apply it to every H1 request/trailer without breaking encoded/pipeline controls.
3. After that prerequisite exists, pin its released source/image and prove all75
   unchanged cases, H2 Host/:authority/SNI binding before **any** origin bytes,
   narrow TE4xx/close mapping, and relevant H2/admission/backpressure/drain probes
   from clean committed sources under the fixture lock. Retain every failure;
   B's wire findings and E's independent reproduction remain necessary.
4. Only complete technical proof plus explicit human architecture approval can
   open Module01. No supported API speculation, successful collector, scanner
   result or evidence-only integration grants approval.

## Agent Completion Report

- Module:01 maintained Envoy strict-ingress investigation; status: complete
  investigation, implementation blocked at the public pre-normalization API.
- Files: additive `spikes/envoy/strict-*.mjs`, `evidence/sprint04a-a/`, this report.
- Contracts/ADR: unchanged; root owns shared decisions. No production parser,
  fork, TLS weakening, candidate substitution or external publication.
- Tests: offline integrity/baseline/syntax/whitespace and scoped secret scans
  pass; one retained research attempt fails404; one earlier attempt lost raw
  evidence during restart. No new runtime security/performance proof.
- Human review: architecture owner only after eligible technical proof; root/E
  must review this research handoff and its explicit retention limitation.
- Next unblocked work: C's credible maintained alternative/upstream research;
  root's independent Module00/02/03 work, no dependent proxy implementation.
