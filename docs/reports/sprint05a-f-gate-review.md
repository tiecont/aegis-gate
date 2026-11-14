# Sprint05A F Independent Source and Gate Review

**ACCEPT** exact publishable root
`c117d96a0216de301c2a8033e79edee21a936f4a`, tree
`e47d07a6fcdd88c4d827e725bcd8abd263f648d9`, for the scoped Sprint05A
research/test/documentation delta and completed local gates02. No new blocking
source or gate defect was found. This reuses accepted F component reviews
`dc669e1`/`c5cd051`; no full runtime corpus was rerun. Runtime eligibility stays
**REJECT / Module01 NO-GO**, Modules04-12 LOCKED and production BLOCKED.

## Scope and decisions

| Reviewed item | Independent result | Verdict |
| --- | --- | --- |
| Exact publishable source and delta | Protected75/23, evaluator, observers, policy, architecture, production code and dependencies unchanged | ACCEPT scoped source |
| Formatting-only2993cc0 | All three files have equal parsed ASTs before/after; exact repaired bytes reach root | ACCEPT |
| Receipt helpercda448e | Root bytes identical; safely captures bounded command streams, source/tree, exit/signal/error and hashes | ACCEPT static receipt helper |
| Publishable clone boundary | Exact tree; all402 root ancestors present; no shallow boundary, alternate store or shared object hardlinks | ACCEPT boundary |
| Completed gates02 | Unchanged full check/security and both cleanup commands exit0; safe outputs/manifests verify | ACCEPT local gates |
| Earlier gates01 | Actual check/security/cleanup failures retained; two real historical findings remain | REJECT that attempt |
| Four withheld A streams | Explicit hash/size exceptions; absent and ineligible; no fabricated verification | ACCEPT disclosure only |
| Runtime/architecture release | Original two75/four23 failures and formal approvals still open | REJECT eligibility |

Read the operating/orchestration rules, execution contract, README, master plan,
architecture, threat/config/quality contracts, Module01 instructions, prior F
reviews, status/risk/completion and relevant collector/scanner sources. All edits
are additive F-owned files. Root, gate clone, original evidence and protected
tests were not edited. No public security/load test, publication, push, merge or
delegation occurred.

## Baseline and source integrity

Compared every4003 object in immutable main
`541d1d915ce6a3b679dc3fed3ea0a98f908ce001` against exact root:3999 identical;
the only four reviewed differences are `IMPLEMENTATION_STATUS.md`, `README.md`,
`docs/RISK_REGISTER.md` and `scripts/sprint04c-gates.mjs`. The1460 additions are
confined to Sprint05A reports/evidence, execution contract, scripts and isolated
Envoy research filenames. No production/Module04 implementation, dependency,
workflow, ADR, acceptance, threat-model or authorization/TLS change is present.
Added/modified files contain no binary NUL, private-key block, generated fixture
path, private fixture extension or binary/archive artifact. The independent
worktree Gitleaks scan also passes. This is scoped inspection and scanner proof,
not a claim that arbitrary secret forms are mathematically impossible.

The entire original edge-comparison tree, Pingora lab, Envoy baseline config,
recovery and wire source trees are byte-identical. Baseline object inventory
SHA256 is `b61ba9f93eda71565e3d802f3d546f3a75f918f4c86b8abca24de1204890e4bd`;
the expanded protected path inventory is
`64ea14b98deb42bfdee040d91431c8cdbff5736dace48f3c97d484a51d4cac77`.
`extract-baseline.mjs --check` exits0. No original full75/23 is executed here.

Prettier's pinned Acorn parser ASTs match for all three files in2993cc0:
gate runner, final F scanner and final F verifier. Only lexical/position/comment
metadata is excluded; literal values and executable AST structure remain.
Parser SHA256 is `f1230c52b2387e8ba21b474958b705bf8fff469c16cd3767d6a00a7bf7d6a84f`.
The receipt helper is unchanged since
`cda448eb25cb05f7a69a0a3f8c1482b37cbd35ef`, SHA256
`6cf47d49ce2fd267ccd4b65408bb0563a6501ee2bfde2727e47f16ead7f22de5`.
It records commands; it supplies no implicit fixture lock, redaction, hosted
success or architecture approval. Its raw capture must only receive safe output.
The actual gates use the separately locked full gate helper.

Status, risk, README and completion correctly describe measured73/75 and19/23,
263 folded-header origin bytes, nine H2 bytes, variable17/23 fresh baseline,
llhttp's narrow buffered/subprocess proof and unresolved userinfo/error frames.
Formal architecture/security approval stays PENDING, ADR012 PROPOSED and all
downstream/release locks remain explicit. Historical pending hosted/local fields
are checkpoint text; later closeout must cite actual exact source receipts.

## History and clone boundary

Both rejected04C commits are **not ancestors** of exact root:

- `551591395880ce87863b4e861c05d266c719b91f`: retained only under local
  `hardening/sprint04c-regressions` and `sprint/04c-integration` heads.
- `cd8f4a760239086616809db8b55a651d3cc28d8e`: retained under local
  `review/sprint04c-integration` head.

No locally available `refs/remotes` contains either. Read-only `git ls-remote
origin` returned52 advertised refs, including PR refs. Every advertised tip
exists locally; independent `merge-base --is-ancestor` rejects both bad commits
against every tip. The exact advertisement is retained with the audit. This is
the observed remote state at audit time, not an assertion about hidden refs or
future ref updates. No fetch/ref mutation was needed.

`/tmp/aegisgate-05a-gates` has exactly two refs: local Sprint05A integration and
its origin tracking ref, both atc117d96. `rev-list --all`, `rev-list HEAD` and
root's complete402-commit ancestor set are equal. It is not shallow, has no
alternates and5801 matching object-store files have independent inodes from the
common original repository. The exact root tree and tracked-clean clone agree.
The original old local refs/findings were neither deleted nor suppressed.

Scanner source, history preflight/evidence parser, Gitleaks config, workflows
and all policy bytes match immutable main. In particular, Gitleaks still uses
`--log-opts=--all` and nonzero findings fail the scanner. Gates01 properly failed
on the two original bad commits; raw redacted findings and failed exits remain
manifest-verified. Isolating complete publishable ancestry changes repository
inputs, not the scanner or its acceptance rule.

## Evidence and withheld capture

Verified all67 Sprint05A SHA manifests with1675 entries, including explicit
relocations of F's copied exact-source proof packages. Rechecked1278 recorded
source hashes over915 unique source blobs,46 recoverable source trees,
14 source summaries and1104 retained command streams/slices. All match. The
manifest hashes and detailed checks are retained in audit03.

Exactly four A inspection stdout files from attempts01/02 are deliberately
withheld. Their original sizes/digests match the explicit exceptions and command
records; all four files are absent from the tree and working filesystem. They
are **ineligible**, not successful independent observations. A's retired
attempt02 collection commit `02b0a6582997aeb8ed7992ae4c6f9af34d6a0d11` remains
unavailable as documented in `CAPTURE-CORRECTION.md`; its tree cannot be
reverified. Every recorded implementation source hash for that attempt instead
matches the disclosed unchanged source1626bf4. This does not restore the retired
tree or make its unsafe inspection commands eligible. Fresh corrected A/F
proofs remain the accepted component basis.

## Completed local gates

Read gates02 only after its process finished, then acquired the shared fixture
lock for the entire independent inventory/scanner/hash lifecycle. Root ran the
unchanged `scripts/sprint04c-gates.mjs` against the exact reviewed clone source
from2026-11-14T16:20:08.406Z to16:25:49.006Z.

| Command | Exit |
| --- | --- |
| `make check` | 0 |
| `make security-scan` | 0 |
| `make dev-down` | 0 |
| Project Compose `down --volumes --remove-orphans` | 0 |

The56-file gate manifest and all command streams verify. Worktree/history secret
reports are empty arrays. The preflight sees402 commits; Gitleaks reports336
commits scanned and58.76MB, with no leaks. These are distinct available-history
and actual-scanner counters, not interchangeable totals. Full scan output
contains all expected dependency, secret, SBOM, filesystem, Envoy and four exact
Compose image passes. All six Trivy vulnerability JSON reports contain zero
HIGH/CRITICAL findings. The immutable local image identity gates pass as well.
Pingora's documented unmaintained warnings are not waived or relabeled.

Root reports all owned project containers/networks/volumes empty, zero private
evidence matches and eight private paths removed. Independently checked all
eight paths absent and six Docker inventories empty (three resource kinds times
Compose-project/fixture-owner labels). Offline digest-pinned Gitleaks in this
review worktree exits0 and its named container is absent. No cleanup operation
against root/clone resources was performed by F; these are read-only checks.

| Immutable artifact | SHA256 |
| --- | --- |
| Root gates02 `commands.json` | `c84a12d94da71fa895da03c9df8df535c3798fee4946a09bb12313dd0b52e7b9` |
| Root gates02 `SHA256SUMS` | `b5bfab7f59bf39c5eab6fda6c73be545f2efa9d0d6968aab586e36f45faa9eec` |
| Root gates02 history Gitleaks log | `662d2711d89807a9821095d7205112ad757c7ae4646197d0b638c24579f9b7a6` |
| F audit03 `receipt.json` | `73e018409f1c2c132395bbb290c7bb4dff6d8e7e21f76a2b60ea0b5d871878c7` |
| F audit03 `SHA256SUMS` | `dc061a9092983acecda60a7ee7a5bbc924212dd2957640dbba8fd990768f141e` |

## Review commands and limits

Verifier source was committed before execution (`0ae85e0`, correctedc6cef2a,
then73b9feb). Pinned Node26.13.0 SHA256 is
`0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`.
Commands from the independent review worktree:

```sh
flock -w 60 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint05a-gate-audit.mjs audit evidence/sprint05a-gate-review/audit-01
flock -w 60 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint05a-gate-audit.mjs audit evidence/sprint05a-gate-review/audit-02
flock -w 60 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint05a-gate-audit.mjs audit evidence/sprint05a-gate-review/audit-03
```

Audit01 exits1 on reviewer implementation errors: AST positional metadata and
the deliberately retired A capture head. Audit02 exits1 on reviewer confusion
between aggregate source summaries and per-file hashes. Both failed receipts
remain. Corrected audit03 exits0, all8 checks pass. No candidate, original input,
old evidence or scanner was edited to obtain success. No runtime75/23 or full
root integration corpus was rerun by F.

The final report/source commit is scanned separately with the same harness's
`scan` mode under the fixture lock. Its exact source and hashes are in the
compact `evidence/sprint05a-gate-review/HANDOFF.json`. Subsequent root docs,
receipts, final PR-head hosted jobs and merge/main jobs are outside this exact
source verdict. Those require their own actual checks; no future result is
inferred from this local acceptance.

## Agent Completion Report

- Module/status: F independent Sprint05A exact-source/local-gate review complete;
  scoped source/gates ACCEPT; runtime eligibility REJECT/NO-GO.
- Commits/files: additive audit helper, plan, compact receipts and this report;
  exact source/report/scan commits bound by HANDOFF.json.
- Architecture/ADR/contracts: unchanged; no approval or Module04 unlock.
- Positive tests: source/AST/manifest/ancestry/immutable-manifest verification and
  completed root gate receipts as above; no full runtime rerun.
- Security negatives: preserved gates01 findings; rejected-commit non-ancestry,
  unchanged fail-closed scanner, independent secrets and cleanup checks pass.
- Performance: no new measurements or capacity/SLO claim.
- Risks/blockers: folding, H2 nine bytes, two userinfo deadlines, two missing
  frames, complete maintained streaming ingress, resources and human approvals.
- Human review needed: formal architecture/security and later release decisions.
- Next action: root retain actual local receipts, integrate scoped review and
  separately verify exact final head/merge hosted gates after authorized delivery.
