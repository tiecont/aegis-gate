# Sprint02: Stabilization and gate recovery

User-authorized parallel isolated worktrees and independent root review.
Fetched origin/main is exactly9e734e31bf1544bd1158a5bf8d29047c2adb72f8;
no baseline reconciliation changes. Prior evidence hashes verified. Actions
run42957348129: foundation-quality succeeded, supply-chain-security failed.
Historical local success does not supersede failing hosted CI evidence.

## Shared execution contract

- Read AGENTS.md, MASTER_AGENT_PLAN.md, IMPLEMENTATION_STATUS.md, operating
  rules, QUALITY_GATES, THREAT_MODEL, RISK_REGISTER, module01/02 tasks, ADR011
  and existing reports/evidence before changing code.
- Each agent writes ONLY its assigned worktree. Root owns integration tree,
  status/gate verdicts and final independent review. Do not edit another tree.
- Preserve every negative case and documented decision. No custom HTTP parser,
  insecure TLS, auth bypass, advisory ignore, production operation, live DNS,
  billing, public listener or third-party security/load test.
- Local secret fixtures may be copied into ignored owner-only .local dirs;
  never print or commit credentials/keys. Never symlink the whole .local tree.
- Compose uses fixed ports/project. Every local make check/integration/dev-up,
  DB integration test, fixture-container test and dev-down MUST hold
  /tmp/aegisgate-sprint02-fixtures.lock with flock for its whole duration.
  Use identical copied disposable lab credentials; do not rotate shared
  fixture passwords/keys or remove volumes without root coordination.
- Shared toolchain/dependency download caches may be reused read-only. Build
  output, reports, generated bindings and .local writes stay in own tree.
- Commit scoped changes, push assigned branch and prepare a draft PR into main
  when reviewable. The user authorizes all agents to manage branches,
  worktrees, commits, pushes, rebases, PRs, merges and cleanup, including the
  final root push to `main`. This does not authorize quality-gate bypasses,
  architecture substitution, production deployment, live DNS/billing or
  release approval. Root retains independent review, integration status and
  gate verdicts.
- Run real checks, retain exact redacted evidence and report failures honestly.
  Record tool/network/environment blockers; do not report unexecuted acceptance.

## AgentA: fix/ci-image-identity

Own scripts/image_identity.py, its tests, build-fixture-images.py,
security-scan.sh and necessary CI files. Investigate run42957348129
image1/image3 identity KeyError digest. Distinguish Docker config, OCI manifest,
index and descriptor types. Verify SHA256/platform/expected identity/scan
binding for classic and OCI archives; malformed metadata, substitution and
platform mismatch fail closed. Add real regressions for both archive formats.
Review Dependabot dashboard audit failure separately. No scanner bypass.
Required local make check/security-scan and hosted foundation/supply-chain
PASS on exact fix commit. Report root cause, security impact, commands,
artifacts, commit, PR and CI URLs in docs/reports/sprint02-a-ci.md.

## AgentB: research/pingora-strict-ingress

Own isolated spikes/pingora, proposed ADR011 update and sprint02-b report.
Reproduce34/35 including raw GET /bad target HTTP/1.1. Investigate maintained
upstream strict-parser options/supported pre-normalization ingress integration.
No ad-hoc parser, silent patch, weakened test or architecture substitution.
Preserve valid percent-encoded paths. Expand target/Host/authority/smuggling
vectors and assert no origin dispatch for malformed cases. Assess both
maintenance warnings. GO candidate requires all mandatory proofs plus review;
otherwise explicit NO-GO with reproducible current evidence and Envoy/Hyper
alternatives matrix covering complexity/security/migration/maintenance costs.
Module01 remains CLOSED until root acceptance; human architecture review for
replacement. Report in docs/reports/sprint02-b-pingora.md.

## AgentC: feat/module02-acceptance

Own Go control plane, additive migrations, OpenAPI/generated bindings, related
integration harness and docs/reports/sprint02-c-module02.md. Complete full
agents/02 requirements, not just compilation or current checkpoint.

C1: explicit OriginPool/Endpoint lifecycle, immutable revisions/ETags/approval
and tenant binding, registration-time public-origin validation; separate
migration owner and least-privilege runtime roles and prove actual permissions.
C2: OIDC rotation/refresh/backoff/outage/callback-negative integration, denied
org/member audit, privileged publish/security permission with step-up/MFA,
bounded quotas/cleanup/retention.
C3: DNS pending/verified/active/failed/expired/reverification, owned local DNS
transport, worker crash/concurrency, explicit route revision diff/preview and
conflicting approvals/retirement semantics.

Required real PostgreSQL and HTTPS OIDC/DNS tests: two tenants/three mixed-role
users; list/item/mutation/jobs BOLA/IDOR; CSRF/revocation/IdP failure/malformed
inputs/permission denials; scoped audit and OpenAPI consistency. Required
make check/security-scan with no mandatory skip. Root independently reviews
security before any gate acceptance. Coordinate shared harness changes against
AgentA through root; do not edit AgentA tree or scripts it owns.

## AgentD: root integration

Review A/B/C outputs independently only when ready. Merge approved branches
sequentially, resolve contract conflicts and rerun full current checks and
security review. Update status/risk/ADR/evidence with exact results. Keep01
closed without accepted feasibility,02 closed with missing requirements,03
locked until all documented dependencies,04 requires affirmative01 and03PASS;
05–12 LOCKED. Task03 explicitly requires00/02 and uses01 findings; once those
are accepted it may be prepared as the next wave without representing03 PASS
or granting04 eligibility. Final report covers summary, per-agent work, files/commits/PRs,
commands/results/evidence, blockers/causes, security decisions, gate matrix and
next wave. No production-readiness claim.
