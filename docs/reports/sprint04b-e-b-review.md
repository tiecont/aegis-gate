# Sprint04-B E B Independent Review

Verdict: **ACCEPT upstream NO-GO research and explicitly unsuccessful standalone
evidence** at exact B head `5de81795963d07486d0621822131d4e1554ccadc`, tree
`5b578bc92c0937f09209a988a86a31e962cd7ccc`. No new merge blocker in that scope.
Report/source checkpoint `b87dac0b63cc76c04bff0d78d8df689b91b6f39f` is identical;
the final head adds only verification receipts and the owned checksum manifest.
No eligible candidate, parser replacement, contract waiver or GO is accepted.

## Upstream Capability Review

E independently retrieved official latest-release metadata and resolved tags:

| Project | Release | Exact revision |
| --- | --- | --- |
| Envoy |v1.40.2 |`b2d89e0ae53916f28770771fbdd49c5c99c5c5a2` |
| Pingora |0.9.1 |`f86ffda5d3ae5c3baf5125682138b33b26c01b08` |
| Hyper |v1.12.0 |`7f67699ce32d717081deb7018b4da7d679277ac0` |

Eight independently fetched immutable official source files match B's retained
hashes: Envoy Balsa implementation/header, public validator, H1/H2 codecs and
local-reply implementation; Pingora H1 server; Hyper H1 role. All19 retained
released file hashes verify. Read-only metadata/source retrieval is not runtime
proof, publication or security testing of upstream endpoints.

Source inspection supports the bounded findings: Balsa accepts continuation,
has private no-op raw callbacks and strips CR/LF before parsed-map policy;
trailers share the inspected processing path. H2 Host retention and local
response mapping exist as partial released hooks. They are not absent APIs,
nor proven complete identity/egress or4xx-close solutions. Pingora target retry/
CL removal and Hyper incoming Uri/framing normalization remain scoped missing
strict-policy boundaries. Unreleased default-branch snapshots are separately
labelled source research. No exhaustive all-extension/version claim is made.

The unpublished drafts expose the late-trailer streaming problem: a parser
cannot recall headers/body already forwarded. Whole-message buffering or a new
contract would need separate design/security approval. A draft's close-only
suggestion does not alter the current evaluator's4xx/actual-close requirement.
Nothing in this acceptance adopts a weaker rejection oracle or publishes a draft.

## Standalone Evidence Review

All228 changed files are B-owned report/evidence/four additive modules. Seven
manifests verify (227 owned entries plus25/25/27 reproduction,39/79 upstream
and18 verifier entries); every source-object and command-stream hash verifies.
The anonymous upstream fetch failure stays failed; authenticated refresh and
the final syntax/integrity/scoped scan finish with zero command exits.

- Repro01:29 observations preserve eight failed DPE-AND501 mapper cases,
  actual501 peer endings and handler/encoded/pipeline observations. All origin
  byte counts are zero even on valid controls and are explicitly invalid.
  They are ineligible to establish zero-byte protection or trailer delivery.
- Repro02: valid76/76 direct relay byte control, no Envoy probes, startup
  failure and delayed-create/cleanup race.116,476ms exceeds intended90s and
  remains a failed lifecycle. The separate recovery note identifies exact
  owned cleanup; final absence/key-removal/lock records do not erase failure.
- Repro03: exact76-byte direct control; unfolded/folded headers each200,
 177 decrypted bytes/one handler and normalized `first second`. Trailers each
 200/214 bytes/one handler but empty handler trailer maps. Assertion failure
  stops after four probes. Trailer normalization/delivery and subsequent TE/
  status-only mapper/encoded/pipeline controls are unexecuted or unproven.
  Origin byte hex lengths and parser/transport zero counters verify separately.

All three retain container absence, ephemeral fixture removal and complete
fixture lock lifetime. Corrected source creates the container before attaching
startup, fixes byte-observer provenance and bounds the attached CLI wait. The
latest cleanup change is syntax/integrity checked only, as B explicitly states;
E does not claim it was runtime-proven or a successful bounded full experiment.
No further runtime attempt is needed to accept this research NO-GO.

The new standalone diagnostic is distinct from original75: historical
63/69/70 counts, six Envoy failures and nine SETTINGS ACK bytes remain mandatory
failures. Invalid early byte observations and partial hooks cannot raise a score.
No TLS verification, auth, dependency gate, production runtime or75 input/
expectation changed. Existing C23/seven failures remain outside B's claims.

## Independent Proof

Committed verifier `7fe3724`, clean exact B detached source:

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04b-e/b-review.mjs /home/tiecont/Projects/aegis-gate-04b-e-b-final evidence/sprint04b-e/b-02
```

Exit0,2026-11-13T17:27:08.138Z-17:27:18.444Z. Seventeen recorded commands
cover official metadata/eight source fetches, immutable75 extractor, authored
whitespace and a pinned offline scoped Gitleaks scan under complete fixture
flock. All exit0. No new traffic experiment, full candidate, capacity result or
full integration scan is claimed. The first E audit used the newer mapper
label for historical repro01 and stopped before external commands; `b-01`
remains failed. The corrected verifier uses original `DPE-501-to-400` exactly.

`evidence/sprint04b-e/b-02/verification.json` SHA256:
`235a0552d2fb5f115f7c80dcf7d7988671eabb74d42fc2d26efa2456797ecb19`.

## Root Helper Pre-Gate Review

Read-only snapshot `a75e82be208c34fb6da1faf6079d0c0071c44e0d`, tree
`43cb39fbeea6caac683ff60377c4b7a4f6646ebd`, contains accepted A/C/D and
pre-B shared documentation. Authored root changes preserve PENDING owners,
NO-GO/LOCKED/BLOCKED and honest pending final gates. B remains pending there.

**ACCEPT helper for its documented locked invocation**, Git blob
`890a930461899958b45f7682c9d68c2f74dc1da1`, `scripts/sprint04b-gates.mjs`.
It checks actual ancestor-held fixture flock before/after operations, requires
committed tracked source, uses dedicated04b-root Compose identity, preserves
check/scan failures, runs teardown/volume cleanup, records remaining project
containers and hashes command/source/tool/stream provenance. Scanner evidence
copy excludes rendered Compose and archive extensions. Ignored caches and
untracked evidence are not a hermetic build; incomplete/abrupt receipts remain
ineligible. This is helper/source review, not executed-gate acceptance.

`evidence/sprint04b-e/root-helper-pre-01/` records the exact reviewed root file
blob identities with command/stream hashes. E did not edit root or execute its
gates. Recheck after B integration and inspect actual locked gate/cleanup/scan
receipts and exact final-head hosted jobs before final integrated acceptance.

## Agent Completion Report

- Module/status: Sprint04-B E B research review complete; exact head ACCEPT.
- Changes: E-only verifier/report/proof; B/root untouched, no publication.
- Decisions/contracts: no change; formal owner/architecture/security approval
  PENDING, Module01 NO-GO,04-12 LOCKED, production BLOCKED.
- Checks: source/manifest/log/upstream comparisons, immutable75 and offline
  scan exit0. No new runtime or performance result claimed.
- Remaining: exact post-B integration equality, root full local/hosted gates
  and preserved technical/security/human release prerequisites.
