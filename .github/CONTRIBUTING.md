# Engineering workflow

Use conventional commits: `feat(scope): behavior`, `fix(scope): trigger`,
`test(scope): coverage`, `docs(scope): subject`, or `chore(scope): maintenance`.
Keep code, contracts, negative tests, module report and status changes together.

Run `make bootstrap`, `make check`, and `make security-scan` before review.
Scans write ignored reports under `.local/evidence/security`; publish only the
redacted scanner evidence, never generated local fixture material.

Repository administrators must configure branch protection for `main` with
required checks `foundation-quality` and `supply-chain-security`, at least one
independent reviewer, resolved conversations, no force-push and no bypass except
an audited emergency process. Replace CODEOWNERS examples with actual consenting
maintainers. These remote settings cannot be enforced by checked-in files alone.

Architecture changes require an ADR with context, alternatives, security impact,
acceptance evidence and residual risk. Reversing an accepted material ADR or a
Pingora No-Go requires human review. The orchestrator cannot approve its own
production security signoff or activate production.
