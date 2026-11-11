# Sprint02 Dependency Maintenance

Agent E scope executed by root after Agent A's supply-chain recovery. Each
Dependabot branch was preserved, rebased onto `45ae1c6` in its own worktree,
reviewed independently and pushed with a lease. The existing PRs were reused.

| PR | Pinned action | Reviewed head | Hosted run | Result |
| --- | --- | --- | --- | --- |
| [1](https://github.com/tiecont/aegis-gate/pull/1) | setup-go7.0.0, `b7ad1dad31e06c5925ef5d2fc7ad053ef454303e` | `71f30073e9671283f01f87ee7f45a04a89aa07a3` | [42969991881](https://github.com/tiecont/aegis-gate/actions/runs/42969991881) | Both jobs PASS; merged |
| [2](https://github.com/tiecont/aegis-gate/pull/2) | checkout7.0.1, `3d3c42e5aac5ba805825da76410c181273ba90b1` | `e3fc24fee08f984cb9f9ecccf883d24943f236c8` | [42970066861](https://github.com/tiecont/aegis-gate/actions/runs/42970066861) | Both jobs PASS; merged |
| [3](https://github.com/tiecont/aegis-gate/pull/3) | setup-node7.1.0, `949feb2413d6458794dcd2491c4babbbce0c15c1` | `73c5a0e3df336d602bfd3b6d01dc511b08ea50a0` | [42970103771](https://github.com/tiecont/aegis-gate/actions/runs/42970103771) | Both jobs PASS; merged |
| [4](https://github.com/tiecont/aegis-gate/pull/4) | upload-artifact7.0.2, `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | `41278a8d34a00edfdb06ae081eaf78977354816d` | [42970132109](https://github.com/tiecont/aegis-gate/actions/runs/42970132109) | Both jobs PASS; merged |

## Compatibility And Supply Chain

Read upstream `action.yml` at each exact SHA, release notes for each requested
tag and `git ls-remote` for the corresponding tag. Each tag resolved to the
requested full SHA. All four actions use Node24 and executed on the existing
hosted Ubuntu24.04 runner. No mutable action tag or extra workflow permission
was introduced; toolchain versions and dependency lockfiles are retained.

Setup-go7 migrates to ESM and updates its cache dependency; the retained
`go-version-file`/cache inputs remain supported. Setup-node7.1 supports the
retained version file and explicit npm cache paths. Its ESM/auth changes do
not introduce a registry credential here. Checkout7 retains full history and
defaults to denying unsafe fork checkout from privileged workflow events;
this repository uses `pull_request` and main pushes. Upload-artifact7 retains
directory ZIP upload by default, hidden-report inclusion and14-day retention;
the real scanner evidence upload succeeded in its hosted job.

Each hosted run executed the full `foundation-quality` and
`supply-chain-security` jobs, including bootstrap, actual integrations, scans,
SBOM generation and artifact upload. These results were checked on the exact
heads above before merges. The combined workflow is rechecked in root's final
integration run; individual action successes do not establish release readiness.

The original Dependabot dashboard audit finding is separate from image identity.
The existing patched dependency override remains in place. Current dashboard
audits and foundation lint/build/integration pass without an audit ignore or
scanner relaxation. Future dependency/database state must be scanned again.

Actual merge commits and timestamps: `evidence/sprint02-d/pull-requests.json`.
No obsolete PR was silently discarded, and no production operation occurred.
