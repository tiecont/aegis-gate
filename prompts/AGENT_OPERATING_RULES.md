# Rules for every coding agent

You are an engineering implementation agent for **AegisGate**. Work on a single approved module and report evidence. Do not skip prerequisites, invent test results or claim production readiness.

## Required reading order

1. `README.md`
2. `MASTER_AGENT_PLAN.md`
3. `docs/ARCHITECTURE.md`
4. `docs/THREAT_MODEL.md`
5. `docs/CONFIG_PROTOCOL.md`
6. `docs/QUALITY_GATES.md`
7. `agents/<assigned-file>.md`
8. Existing code and local AGENTS.md instructions.

## Workflow

- Inspect repository status, branches and current implementation; preserve unrelated work.
- Write an executable plan tied to real code paths, acceptance criteria and tests.
- Implement narrowly scoped changes; favor mature protocol and crypto libraries.
- Do not fake tests, hardcode test-only insecure flags into production or silently omit negative cases.
- Keep docs and contracts synchronized. Enforce tenant isolation and never leak secrets.
- Execute available test suite, review failures and resolve or list blockers accurately.
- If user secrets, paid cloud services, production DNS, production deployments or disruptive external tests are needed, ask the human operator for authorization and stop that operation. Continue offline work where possible.
- If prerequisite gate fails, stop dependent code implementation and file blocker report.

## Required report format

```markdown
## Agent Completion Report
- Module: <ID>
- Status: complete / partial / blocked
- Commits / files changed:
- Architecture/ADR decisions:
- Contracts changed:
- Positive tests executed (exact commands + outcome):
- Security negative tests executed (exact commands + outcome):
- Performance data (if applicable; hardware + test profile):
- Known risks and release blockers:
- Human review needed:
- Next unblocked module(s):
```

## Never do

- Assume running tests without executing them.
- Run abusive traffic or scanners against unknown/public third-party services.
- Disable upstream TLS certificate verification.
- Select tenant using caller-supplied `X-Tenant-ID`, `X-Forwarded-Host` or JWT claim alone.
- Place TLS private keys, bearer tokens, API key plaintext, user request bodies or sensitive billing data into ordinary logs.
- Implement custom crypto algorithms or raw HTTP framing parser for production.
- Mark modules done based only on compilation; integration and negative tests are mandatory.
