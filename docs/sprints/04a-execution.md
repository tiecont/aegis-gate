# Sprint 04-A Execution Contract

Baseline: `e5adeb4c3ea163d0028c9f29bed07b1128fb1065`.
Authorized scope: isolated Module01 maintained-parser resolution, independent
wire/security review, dependency maintenance and local Module03 operational
preparation. Modules00/02/03 retain local PASS;01 remains NO-GO pending complete
technical proof and explicit human architecture approval;04-12 remain locked;
production remains blocked. Git branches, commits, pushes, PRs and merges are
authorized after applicable independent review and passing checks.

## Mandatory Rules

Read AGENTS.md, README.md, MASTER_AGENT_PLAN.md,
prompts/AGENT_OPERATING_RULES.md, IMPLEMENTATION_STATUS.md,
docs/QUALITY_GATES.md, docs/THREAT_MODEL.md, docs/RISK_REGISTER.md,
docs/ADR-011-pingora-evaluation.md and reports sprint03a-architecture-decision,
sprint03b-e-parser-resolution, sprint03b-f-security-review and
sprint03b-completion before implementation. Use repository contracts as truth.

Preserve all75 immutable cases, raw inputs, expected outputs, zero-byte origin
assertions and valid encoded/pipeline controls. No custom production HTTP
framing parser, private bypass fork, disabled TLS, scanner ignore, real secret
logging/commit, public listener, production/DNS/billing action or third-party
abuse test. Draft upstream requests locally; never publish them externally.
Shared fixture operations must hold `/tmp/aegisgate-sprint02-fixtures.lock`
for their entire lifetime, including cleanup. Do not alter another worktree.
Evidence binds committed clean sources, exact argv, versions, times, exits,
origin bytes/handlers/parser/transport observations and SHA256. Retain failed
and incomplete attempts explicitly. No passed proof from zero handlers alone.

## Assignments and Ownership

All agent worktrees start from this contract commit. Root owns shared gate,
risk, ADR and final completion documents; component owners write their own
reports/evidence. No agent merges another branch or changes architecture gates.

| Agent | Branch / worktree | Tasks and report |
| --- | --- | --- |
| A | `fix/module01-envoy-strict-ingress`, `/tmp/aegisgate-04a-a` | Inspect newest supported Envoy release, validator and codec APIs; seek pre-normalization obs-fold rejection, H2 Host/authority/SNI binding and unchanged TE4xx/close contract. Implement pinned bounded isolated candidate only for a supported maintainable path. Execute unchanged75 and relevant H2/resource probes when credible. Stop with precise missing API otherwise. Own new `spikes/envoy/strict-*` files and `docs/reports/sprint04a-a-envoy.md`. |
| B | `test/module01-wire-boundary`, `/tmp/aegisgate-04a-b` | Validate corpus/source hashes; independently reproduce current pinned Host-retention H2 failure and classify its nine decrypted bytes using bounded test-only observation. Separate frame/request, connection setup, TLS events, handlers and parser errors. Verify observer byte/identity/TLS transparency. Add H2 invalid frames/header/reuse and bounded slow-reader, partial-header, cancellation, cap and drain tests. Do not relabel failures. Own additive wire test/observer files and `docs/reports/sprint04a-b-wire-review.md`. |
| C | `research/module01-upstream-resolution`, `/tmp/aegisgate-04a-c` | Versioned current upstream release/API/source matrix for Envoy/Pingora/Hyper. Focus normalization/framing/identity/pipelining and Pingora derivative/unsafe-libyaml. Demonstrate supported released capabilities or exact missing API; prepare local upstream repro/request drafts. Advance alternative only after A stop and credible path. Own research evidence and `docs/reports/sprint04a-c-upstream.md`. |
| D | `chore/sprint04a-dependencies`, `/tmp/aegisgate-04a-d` | Review PR11 go-jose4.1.9 exact head with OIDC/rotation/token negatives and scanner. Reproduce dashboard Dependabot TypeScript peer failure; determine supported resolvable versions, no force/legacy peer bypass. Test dashboard and full repository. Own dependency manifests/locks and `docs/reports/sprint04a-d-dependencies.md`. Root performs this role until a slot frees. |
| F | `hardening/module03-config-operations`, `/tmp/aegisgate-04a-f` | Only after P0 shared-resource constraints clear. Local signer/trust/key outage/rotation/recovery contracts; durable monotonic anchor/full-state rollback limits; safe archival validation against durable references; bounded captured-generation drain/retirement; DR/emergency runbooks. Preserve snapshot protocol and no Module10 claim. Own focused tests/operations additions and `docs/reports/sprint04a-f-config-ops.md`. |
| E | `review/sprint04a-security`, `/tmp/aegisgate-04a-e` | Independently inspect committed A/B/C/D/F code and evidence, reproduce critical new proofs and any proposed GO candidate all75-plus-tests, dependency/maintenance and origin observations. Return findings before root sequential integration; `docs/reports/sprint04a-e-security-review.md`. |

Concurrency: root plus at most three active agents. Start A/B/C; root handles
D read-only review and coordination. Start F and E as slots become available.
Communicate exact commits and concrete upstream discoveries through root.

## Integration and Completion

Root integration branch/worktree: `sprint/04a-integration`,
`/tmp/aegisgate-04a-root`. Integrate independently accepted changes sequentially.
Run locked `make check` and `make security-scan` with meaningful inputs; preserve
Module00/02/03 regressions and all01 expectations. Verify hosted
`foundation-quality` and `supply-chain-security` on the exact integration head.

Final `docs/reports/sprint04a-completion.md` records all agent work, exact
commits/branches/PRs/merge status, candidate counts/failure IDs, origin
observations, commands/exits/versions/hashes, local/hosted gates, dependency
findings, independent verdict, outstanding human decision, module matrix and
precise next upstream work. No eligible candidate is acceptable only with a
specific evidenced upstream/technical stop condition. No score, green CI or
successful compilation is architecture approval.
