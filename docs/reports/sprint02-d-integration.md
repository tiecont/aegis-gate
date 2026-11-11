# Sprint 02 independent integration review

Status: in progress; no Sprint 02 acceptance gate has passed.
Baseline: `9e734e31bf1544bd1158a5bf8d29047c2adb72f8`.
Integration branch: `sprint/02-integration`.

## Verified starting evidence

- Fetched `origin/main` equals the supplied baseline; no upstream delta.
- Actions run [42957348129](https://github.com/tiecont/aegis-gate/actions/runs/42957348129)
  has a successful `foundation-quality` job and failed `supply-chain-security`
  job. Downloaded hosted artifacts reproduce the identical `KeyError: 'digest'`
  at `document['config']['digest']` for image 1 and image 3. Logs are retained
  under ignored `.local/evidence/ci-42957348129/`.
- The root integration worktree is clean after Agent A restored two files
  accidentally targeted through the inherited working directory. Root
  independently confirmed `git status --short --branch` and scoped diffs.
  Subsequent edits must use absolute paths or an explicit worktree for
  `apply_patch`; implementation trees remain separate.
- Historical local checks are baseline evidence only. They cannot accept the
  fix commit, the expanded feasibility corpus, or module 02 completion.

## Independent review requirements

| Surface | Evidence required before acceptance |
| --- | --- |
| A: image identity | Real Docker classic and OCI exports; distinguish config/index/manifest/descriptor types; SHA-256 and descriptor sizes; platform and scan binding; substituted/malformed content rejected; full local checks/scans; both hosted jobs PASS on the exact fix head. |
| B: ingress | Fresh raw-wire reproduction and origin dispatch counters; valid encoded targets preserved; Host/authority/smuggling vectors; maintained upstream API/source evidence; both dependency warning dispositions; explicit GO candidate or NO-GO with alternatives. |
| C1: persistence | Explicit OriginPool/Endpoint lifecycle and tenant references; immutable revisions/ETags; public-origin registration checks; additive migrations; actual runtime-role HTTP/DB integration and denied DDL/ownership privileges. |
| C2: identity | Real HTTPS IdP rotation/refresh/backoff/outage/callback negatives; verified MFA claims and freshness for privileged actions; use-case and HTTP denial audit; quotas and cleanup/retention evidence. |
| C3: lifecycle | Owned DNS transport; expiry/failure/reverification and stale proof protection; worker crash/concurrency; explicit revision diff; conflicting approvals and retirement. |
| Isolation/contracts | Two tenants/three mixed-role users; list/item/mutation/job isolation; session/CSRF/revocation; tenant-scoped audit; source OpenAPI and generated bindings synchronized. |
| Integrated checks | Exact reviewed commits; formatting/lint/race/unit/integration/security-negative/build/supply-chain evidence; no skipped mandatory integration; no architecture substitution or bypass. |

Implementation agents do not accept their own gates. Review findings and
retests will be recorded here after the relevant branches are ready. Approved
branches will be integrated sequentially, followed by checks on the combined
tree and final status/risk updates.

## Active findings and probes

- A-layer-binding: review identified a config-only binding gap. The agent added
  layer verification before the independent probe executed, so the probe is not
  a reproduced pre-fix failure. On live validator SHA-256
  `1212a938803cb8f33aa9aa41622ded3c2b039e4eddc64bed125d506c5e922df8`,
  root's conventional classic/OCI positive archives pass and substituted layer
  bytes fail. Evidence: `evidence/sprint02/a-layer-substitution-live-review.log`.
  The initial probe rejected its legitimate OCI control with omitted optional
  index media type; retained in `a-layer-substitution-before.log` and referred
  to Agent A. Repeat on an immutable reviewed commit is still required.
- C-public-origin: root's actual negative test fails for `fec0::1`, `3fff::1`,
  `5f00::1`, `100:0:0:1::1` and `192.88.99.1`. These non-public/special-purpose
  destinations pass baseline `PublicAddress`. No destination was contacted.
  Command: `GOTOOLCHAIN=go1.27.4 go test ./apps/control-api/internal/domain
  -run TestNegativeSprint02RootNonPublicOriginPrefixes -count=1 -v` (exit 1).
  Evidence: `evidence/sprint02/c-nonpublic-prefix-before.log`. Agent C must
  assess the address registry/RFC policy, fix registration validation and retain
  positive public-address controls. Future edge dial-time checks remain gated.
- Repository release control: `gh api
  repos/tiecont/aegis-gate/branches/main/protection` returns HTTP 404,
  `Branch not protected`. Required branch protection/reviewer approval from
  `QUALITY_GATES.md` is not proven. No repository setting was changed.

## Current gate disposition

- Module 00: historical local PASS; hosted supply-chain recovery pending.
- Module 01: NO-GO, closed pending fresh evidence and architecture review.
- Module 02: partial, closed pending C1-C3 implementation and independent review.
- Modules 03-12: locked under their existing task prerequisites.
- Production release: blocked. No deployment, live DNS, billing or public
  security/load operation is part of this sprint.
