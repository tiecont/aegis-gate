# Sprint02 Agent A: CI image identity recovery

## Agent Completion Report

- Module: Sprint02 Agent A / foundation supply-chain gate recovery (T14/R13).
- Status: local full checks/scans and exact-head hosted gates PASS; PR6 merged.
  Root verified run42964002493 onf53e1d2 and repeated the independent
  substitution/history regressions and integrated check/scan. Final evidence:
  sprint02-d-integration.md and sprint02-d-security-review.md.
- Files: `scripts/image_identity.py`, `scripts/image_identity_test.py`,
  `scripts/security-scan.sh`, `scripts/history_scan_evidence.py`,
  `scripts/git_history_preflight_test.py`, the unit target in `Makefile`, and
  this report. No shared gate/status files edited.
- Architecture/ADR decisions: none. Classic Docker config identities and OCI
  manifest/index identities remain supported; SHA256 is mandatory.
- Contracts changed: no application, API, schema, runtime authorization or TLS
  contract change. Image identity validation now binds complete selected layer
  contents as well as scanner/config identity.
- Positive/security-negative tests: 31 image regressions and 4 history regressions PASS; final exact
  commands, full check/scan artifacts, commits, PR and CI will be recorded below.
- Performance data: not applicable; no load/abuse tests run.
- Known risks/release blockers: hosted recovery is not yet proved. Production
  signing/provenance and all existing module/release gates remain separate.
- Human review needed: root independent security/integration review; no release
  signoff claimed.
- Next unblocked modules: root owns dependency/gate decisions.

## Root Cause And Boundary

Run [42957348129](https://github.com/tiecont/aegis-gate/actions/runs/42957348129)
on `9e734e31bf1544bd1158a5bf8d29047c2adb72f8` passed foundation-quality and failed
supply-chain-security. The retained scanner artifact is
[13827408687](https://github.com/tiecont/aegis-gate/actions/runs/42957348129/artifacts/13827408687).
Both `image-1-identity.log` and `image-3-identity.log` show `KeyError: 'digest'`
at `document['config']['digest']`. Actual image configs have a runtime `config`
object holding Env/Cmd/Labels. The validator guessed that any such key denoted
an OCI manifest config descriptor. The old two synthetic tests omitted runtime
config and therefore missed the actual Docker archive shape. Baseline replay
with realistic classic/config-blob fixtures reproduces that exact exception.

The replacement validates document types, schemas and descriptors explicitly,
including valid OCI omission of document mediaType using descriptor/schema
structure while rejecting explicit null, conflicting or unknown types. It
hashes every traversed metadata blob, checks descriptor sizes and exact
architecture/OS/variant, and requires the scanner's container-image config ID
to match the validated artifact. Duplicate JSON/archive members, unsafe paths,
non-regular referenced entries, unsupported digests/types, missing/ambiguous
platforms, excessive nesting and malformed metadata fail closed.

Root review correctly identified that config identity alone does not bind layer
contents: Trivy ImageID may stay unchanged with substituted archived layers.
The validator now checks each OCI compressed layer SHA256/descriptor size and
the ordered uncompressed digest against config `rootfs.diff_ids`. Classic
`Layers` refs require the same count/order and content binding. A mixed
Docker/OCI archive must bind both scanner entry points to the requested config
and ordered layer contents; an OCI archive index wrapper must select the exact
requested immutable identity. The tests retain unchanged config IDs while
altering layer bytes, references, count/order and rehashed descriptors.

Supported layer encodings are uncompressed tar and gzip through the Python
standard library. Unsupported encodings (including zstd), metadata over16MiB,
or a layer over2GiB fail closed. These bounds cover the fixture images and do
not claim support for every OCI extension. Archive metadata/layer hashes are
content binding, not registry signatures or production provenance.

## Dependabot Is Separate

[Dashboard update run42957357439](https://github.com/tiecont/aegis-gate/actions/runs/42957357439)
failed while updating TypeScript, with `dependency_file_not_resolvable` and
npm `ETARGET`: no `@typescript-eslint/eslint-plugin@8.72.2` available before
the updater's `11/8/2026, 4:10:01 AM` publication-date cutoff. It is an updater
resolution failure, not the image-identity exception or an audit finding.
The original supply-chain run's `npm-root-vulnerabilities` and
`npm-dashboard-vulnerabilities` both PASS. No dependency override, advisory
ignore, audit bypass or unrelated dashboard upgrade was introduced here.

## Execution Notes

All command workdirs are `/home/tiecont/Projects/aegis-gate-sprint02-a`.
Two initial direct patch-tool delete calls accidentally used inherited cwd;
the two shared-tree scripts were immediately restored byte-for-byte and
`git -C /home/tiecont/Projects/aegis-gate diff --exit-code -- scripts/image_identity.py scripts/image_identity_test.py`
returned0. Root confirmed the integration tree clean. Subsequent edits use
shell `apply_patch` in the explicit isolated workdir. A later direct patch
invocation also temporarily changed the shared Makefile and added the history
test there; these accidental edits were removed and the shared tracked-file
diff was verified empty before continuing. Root confirmed the tree clean.

Every Compose/DB/full-check operation holds
`flock /tmp/aegisgate-sprint02-fixtures.lock` for its duration. No credentials
were logged/rotated, no volumes deleted, no authorization/TLS gate weakened,
and no production/public-endpoint security operation occurred.

## History Scan Recovery

The first local scan after the hosted incident was not accepted as evidence:
`.local/evidence/sprint02-a/pre-fix-history-secrets.log` records Gitleaks' fatal
worktree-path error followed by `0 commits scanned.` and exit 0. The repaired
scan mounts `git rev-parse --git-common-dir` at `/git-common` read-only and
passes explicit `GIT_DIR=/git-common`, `GIT_WORK_TREE=/repo`; a container
preflight requires a positive `git rev-list --all --count`. The scan log is
then parsed exactly, rejecting `fatal`, `ERR`, `error=`, missing counts, zero,
and malformed or multi-count output. Final history evidence reports
`6 commits available for history scan` and `6 commits scanned.`

Regression command: `PYTHONPATH=scripts python3 scripts/git_history_preflight_test.py -v`
(4 tests PASS), covering actual Gitleaks Docker runs over a full clone and a
linked worktree under `path with
spaces`, 12 commits, inaccessible Git metadata, counts of 10 and 12, zero
counts, and fatal output. The pre-fix false evidence is retained and is not
counted as a pass.

## Final Local Evidence

- `flock /tmp/aegisgate-sprint02-fixtures.lock make check`: PASS after the
  final changes; log `.local/evidence/sprint02-a/final-check.log`.
- `flock /tmp/aegisgate-sprint02-fixtures.lock make security-scan`: PASS after
  history recovery; dependency, secret, SBOM, filesystem, image and identity
  jobs pass. Log `.local/evidence/sprint02-a/final-scan.log`.
- Independent root probe `evidence/sprint02/image-layer-binding-repro.py`: PASS
  for valid classic/OCI controls and rejection of substituted layers.

## Hosted Recovery Iteration

Commit `9796734b52e866c62eb8f8e77041b69ef78fdd46` was published in draft
[PR6](https://github.com/tiecont/aegis-gate/pull/6).
[Run42962601908](https://github.com/tiecont/aegis-gate/actions/runs/42962601908)
passed foundation-quality but failed both local image identity jobs: the
classic Docker store also exports an OCI `index.json` wrapper naming a
manifest whose config is the requested Docker config ID. Requiring that
wrapper's manifest ID equal the requested config ID was incorrect. Its
failure evidence is preserved under `.local/remote-run-42962601908`.

The follow-up validates the wrapper descriptor and the manifest normally,
then binds its config digest to the requested config ID. Explicit requested
index/manifest identities retain their own hash/platform validation. Actual
Docker-save-shape regressions cover all three identity types and malformed
manifest rejection. Raw Gitleaks output is now in `history-gitleaks.log`,
separate from the parsed summary, avoiding overlapping output offsets.

An actual local Docker export was converted losslessly to classic Docker
archive layout and scanned by Trivy0.69.1: valid archive identity PASS;
substituting a valid-tar layer retained Trivy ImageID but the validator
rejected it. Log `.local/evidence/sprint02-a/real-classic-archive.log` and
the two corresponding `actual-classic*-scan.json` reports retain this proof.
