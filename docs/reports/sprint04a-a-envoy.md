# Sprint04-A Agent A - Envoy strict ingress

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
sources (`upstream-03/<name>.stdout`, losslessly gzip-compressed after scanning).
The corresponding GitHub source is pinned to the commit above.

| Surface | Evidence and implication |
| --- | --- |
| H1 parser construction | `h1-codec`:520-527 constructs `BalsaParser` directly. A deprecated hidden `use_balsa_parser` field remains in `protocol-api`:508-514, but this constructor does not select a legacy parser. Merely setting it is not a credible strict candidate. |
| Pre-normalization policy | `balsa-parser`:180-193 sets `disallow_header_continuation_lines=false` before passing the policy to the framer. Its constructor has no strict-fold argument (`balsa-parser-header`:22-23). `strict_chunk_parsing` controls stray chunk data, not header folding. |
| Raw callback | `balsa-parser`:304-305 defines no-op `OnHeaderInput`/`OnTrailerInput`; these overrides and the framer are private (`balsa-parser-header`:39-45,75-76). The internal callback is not an exposed extension hook. |
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
exits0, with all25 nested commands successful. It uses corrected released
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
