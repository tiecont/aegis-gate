# Sprint04-A D - Dashboard Dependency Resolution

Baseline `3e03940848c81751c87bbcec131238abb7d28e1b`; PR11 is already merged.
Branch `fix/dashboard-dependency-resolution`, worktree `/tmp/aegisgate-04a-d`.
Result: existing pinned tree is compatible and passes dashboard acceptance.
**TypeScript7 update remains blocked by a current upstream peer range**; no
supported TypeScript7/typescript-eslint combination was found. No manifest,
lockfile, minimatch override, Dependabot setting or advisory ignore is changed
to hide that conflict. Independent E review and root integration gates remain.

## Actual Conflict and Supported Versions

Hosted run43100142886 targets TypeScript7.0.2 from6.0.3. Its retained log reports
`dependency_file_not_resolvable`, "Error while updating peer dependency". The
hosted updater itself attempted `--force`; this is historical output, not a
command used for local resolution. It also reports Node24.22.3 against the
repository's26.13 minimum; local reproduction uses supported Node26.13.0/npm12.2.0.

Fresh `npm view ... version peerDependencies --json` records remain in
`evidence/sprint04a-d/reproduce/metadata-*.stdout.txt`. Current versions:

| Package | Version | Relevant peer requirement / disposition |
| --- | --- | --- |
| TypeScript | latest7.0.2; pinned6.0.3 |7.0.2 is outside the lint parser's supported range |
| typescript-eslint |8.72.2 | TypeScript `>=4.8.4 <6.1.0`; ESLint `^8.57.0 || ^9.0.0 || ^10.0.0` |
| @typescript-eslint parser/plugin/typescript-estree |8.72.2 | Same TypeScript range; complete `npm ls` has no invalid/duplicate TS versions |
| ESLint |10.14.0 | Within typescript-eslint's declared ESLint range |
| Next / @next/eslint-plugin-next |16.4.6 | Current released metadata retained; Next's React19 peer range accepts19.3.1 |
| React / react-dom |19.3.1 | Existing pins unchanged |
| minimatch override |11.0.7 | Preserved; no removal proposed |

A copied temporary package/lock pair reproduces `npm install typescript@7.0.2
--package-lock-only --dry-run --ignore-scripts --strict-peer-deps`: **exit1
ERESOLVE**, explicitly naming the incompatible TypeScript range. No force or
legacy-peer-deps is executed. This is a failed update proof, not an npm install
success. Need a maintained typescript-eslint release explicitly supporting7
(plus corresponding parser/plugin packages), followed by normal resolution and
all dashboard/security checks. A version-range override cannot supply support.

## Executed Commands and Outcomes

`evidence/sprint04a-d/record.mjs` binds committed source/tree, exact argv/cwd,
UTC times, actual exit/signal and stdout/stderr SHA256. The nested reproduction
records exact versions, npm metadata, temporary resolution, lock install and
each dashboard command. Source was committed before execution.

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04a-d/record.mjs evidence/sprint04a-d/reproduce-wrapper /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04a-d/dashboard-reproduce.mjs evidence/sprint04a-d/reproduce
```

Recorder and script exit0 because the unsupported-update failure is required
and explicitly asserted. Nested update exit1; all other nested commands exit0:
normal `npm ci --ignore-scripts --strict-peer-deps`, `npm ls ... --all`, lint,
typecheck, unit tests, build, integration and `npm audit --audit-level=high
--json`. The audit finds0 vulnerabilities across175 reported dependency entries.
The app test serves only an owned ephemeral127.0.0.1 port and denies tenant
paths; no shared Compose/database/proxy is used.

Recorded followups also exit0 (pinned toolchain directory prepended to PATH):

```sh
npm --prefix apps/dashboard update --package-lock-only --ignore-scripts --strict-peer-deps --dry-run
flock /tmp/aegisgate-sprint02-fixtures.lock npm --prefix apps/dashboard run integration
```

The normal update path reports up to date under the existing compatible pins.
It does **not** prove that Dependabot's explicit TypeScript7 update succeeds.
Dashboard manifests/locks remain byte-identical to baseline. No PR11 upgrade
or separate go-jose acceptance is claimed; it was merged before this sprint.
Root will run full repository check/security-scan and exact-head hosted jobs.

## Retained Failed Attempt and Limits

An initial outer recorder created `evidence/sprint04a-d/dashboard/`, colliding
with the inner script's immutable-output preflight. It exited1 before dependency
work; the logs/receipt are retained there. It also selected system Node26.9.0,
below the repo minimum. The corrected script takes an explicit fresh output
and the corrected invocation selects the pinned26.13.0 binary for both levels.
No earlier output was deleted or treated as an eligible test pass.

The hosted logs are retained verbatim with GitHub's own redactions. No token or
private key was requested or copied. Metadata collection and npm package reads
are read-only public-source operations, not security traffic. No external
maintainer message or Dependabot reconfiguration was published.

## Agent Completion Report

- Module: dependency maintenance; branch `fix/dashboard-dependency-resolution`.
- Status: compatible existing tree verified; major-version update blocked by
  exact upstream peer conflict, no manufactured repair.
- Files: owned evidence scripts/receipts and this report; no dependency changes.
- Tests: all dashboard commands and strict compatible update path pass; TS7
  strict update fails as required; failed preflight retained.
- Risks: Dependabot's TypeScript7 job remains unresolved until maintained peer
  support ships. Full security/gate acceptance belongs to root/E.
- Required followup: track explicit TypeScript7 parser support, then update the
  compatible group together and repeat normal strict install/lint/type/test/
  integration/build/audit. Do not remove minimatch11.0.7 without separate proof.
