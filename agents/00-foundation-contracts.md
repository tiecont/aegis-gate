# AGENT 00 — Foundation, Contracts, CI

**Dependency:** none. **Output:** buildable monorepo + agreed contracts. **Gate:** `M0-FOUNDATION`.

## Tasks

1. Inspect repository before modifying; create root AGENTS.md linking architecture, threat model, conventions, no-live-testing rules.
2. Bootstrap workspace:
   - `apps/control-api` Go application, `apps/config-publisher` Go worker.
   - `apps/edge` Rust Cargo workspace with `edge-server`, `config-agent`, `policy-engine`, `edge-types` crates.
   - `apps/dashboard` Next.js TypeScript app.
   - `packages/contracts` OpenAPI/proto/JSON schema; `packages/test-fixtures` isolated demo origins.
   - `infra/compose`, `infra/k8s`, `scripts`, `docs`.
3. Add reproducible local Compose: Postgres, Redis, NATS JetStream, demo origin, optional OTEL; prevent public binding by default.
4. Add `Makefile`/task runner for `fmt`, `lint`, `unit`, `integration`, `security-negative`, `build`, `dev-up`, `dev-down`.
5. Choose compatible pinned toolchain (Go, Rust, Node versions) from supported releases; commit lockfiles, Renovate/Dependabot policy, `.editorconfig`, formatting and conventional commits.
6. Define API contract generation and backwards compatibility checks; establish UUID generation, monotonic revisions, error envelope, correlation ID.
7. Build local PKI test fixtures (not production) and safe dummy JWT test issuer.
8. Define baseline CI matrix for Go/Rust/TS and Docker integration; add secret scanning, vulnerability scanning and SBOM job.
9. Establish ADR workflow, CODEOWNERS, branch protection guidance and review gates; provide issue templates and risk register.

## Acceptance

- Clone -> one command starts local demo dependencies, one command tests all placeholders legitimately.
- Go, Rust and dashboard build; no fake passing security checks.
- CI catches known intentionally broken format/lint/schema test and resumes once restored.
- Demo private keys are visibly marked unsafe and ignored from git; no real credentials.
- Document commands and sample logs in PR report.

## Security focus

Never expose dev database/NATS/Redis to `0.0.0.0` by default. Strict dependency versions, no curl-pipe shell scripts without review, no production secrets in `.env.example`.

## Agent deliverables

Project layout, CI workflow, developer README, contracts scaffolding, ADR-001..010 review notes, implementation report.
