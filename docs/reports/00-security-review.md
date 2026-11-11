# Module 00 security and gate review

Status: PASS for local foundation, 2026-11-11. Reviewer: root orchestrator with independent review in `00-independent-review.md`. Historical findings/checkpoints below are preserved; the final disposition supersedes interim statuses. No production security signoff is implied.

## Acceptance checks

All entries passed using the final commands and evidence in the final disposition.

| Requirement | Evidence | Verdict |
|---|---|---|
| Buildable Go control API + publisher, Rust four-crate workspace, Next.js TS dashboard | Root make check build and unit output | PASS |
| Version-pinned supported toolchains, package lockfiles, dependency update policy | Exact Node/Go/Rust checks, official metadata, lockfiles and Dependabot | PASS |
| One-command local Compose; Postgres, Redis, NATS JetStream, isolated origin | Final make integration; fresh init/restart and auth tests | PASS |
| Local-only listeners and no secret/private key in tracked config | Resolved loopback bindings, secret scan and ignore checks | PASS |
| Make fmt/lint/unit/integration/security-negative/build and CI matrix | Root make check and local actionlint | PASS |
| Contract generation + drift/backward compatibility check, strict schema and error/correlation/revision contracts | Go→Rust output, generated checks and incompatible schema negatives | PASS |
| Local PKI and dummy JWT issuer; keys ignored and restrictive modes | Mode/symlink tests, verified HTTPS, expired/wrong-host/untrusted negatives | PASS |
| CI catches deliberately bad formatting/lint/schema | Executed defect selftest; restored inputs pass | PASS |
| Secret/SCA/SBOM/image scan policy with real evidence or explicit blockers | Complete make security-scan exit0; exact artifact identity checked | PASS |
| Security review and reported limitations match current implementation | Root final disposition plus independent review | PASS |

## Security boundaries

- Foundation shells must not claim to route traffic, authenticate customers, persist tenant state or sign/deploy snapshots.
- Unknown traffic/default configuration remains denied or unready; no development credentials or TLS-verification exception can leak into future runtime configuration.
- Shared contract validation is not equivalent to authenticated config activation. Actual signature and replay enforcement remain module 03 responsibilities.
- All local fixture servers must bind loopback; Compose dependencies must not publish externally. Locally generated keys must remain untracked and access-restricted.
- Test payloads and scans are limited to local artifacts and operator-owned lab services.

## Findings

### F00-01: Error message validation differs across consumers (medium; CLOSED)

`packages/contracts/openapi.json` currently permits a message containing a newline while `apps/edge/edge-types/src/lib.rs` rejects all control characters. Preconditions: a producer emits a schema-valid error with control characters. Result: Rust rejects a response accepted by the contract validator. This is an interoperability and safe-diagnostic contract defect; no authentication bypass is asserted.

Reproduction actually executed: Node ESM loaded `validator()` from `scripts/contracts.mjs`, mutated the shared error fixture to `message = "line one\nline two"`, and printed `OpenAPI accepts message containing newline: true`. Root also ran `cargo test --locked -p edge-types -p policy-engine`: 9 unit tests passed, including Rust control-character rejection. Requested repair: align canonical schema and negative vectors, regenerate bindings, rerun checks.

### Interim build observation (not a final finding)

Root ran `go test -race ./apps/control-api/... ./apps/config-publisher/... ./internal/...` during ongoing contract generation. It exited 1 because generated `contracts.Health`, `contracts.ErrorEnvelope` and `contracts.ErrorDetail` were not yet written. `internal/contracts` tests passed. Implementer was notified; rerun after stable generation is required.

Gate remains closed until the final source and complete evidence are reviewed.


### F00-02: Go vulnerability scan falsely passes findings (high; CLOSED)

`scripts/security-scan.sh` originally used `govulncheck -json ./...` and treated exit zero as no findings. The tool intentionally returns zero for findings in JSON mode. A vulnerable dependency could therefore pass the Go CI scan. Confirmed against [govulncheck v1.9.0 documented exit semantics](https://pkg.go.dev/golang.org/x/vuln@v1.9.0/cmd/govulncheck#hdr-Exit_codes), and the implementing agent independently confirmed the pinned tool source. Required repair: use a format with vulnerability-sensitive exit status or explicitly validate structured findings; prove detection using a temporary local vulnerable-dependency analysis fixture. No exploit traffic is needed or authorized.

### F00-03: Toolchain/helper mismatch in scan commands (medium; CLOSED)

The scan script initially called nonexistent `scripts/node-bin.sh` rather than `scripts/node-path.sh`; standalone scan commands also did not explicitly select pinned Go/Rust. Root-invoked Cargo with only `--manifest-path apps/edge/Cargo.toml` does not select the nested rustup toolchain override. These defects could produce inconsistent builds or block CI. Required repair: use the shared helper and explicit pinned toolchains/root override, then execute actual aggregate checks.

### F00-04: Local fixture validation gaps (low; CLOSED)

Initial NATS integration had only health/unauthenticated checks while claiming authenticated success. Initial secret bootstrap did not reject a symlink `.local` before chmod or validate existing config-file modes. Implementer added positive authenticated PING/PONG and symlink/mode checks for all secret files. Root reviewed the changed source; final integration and negative checks remain required.


## Root verification checkpoint

- `make bootstrap` — PASS (exit 0), exact local Node v26.13.0 downloaded from official checksum-verified distribution; both npm lockfile installs reported zero vulnerabilities; Go/Rust dependencies fetched. Log: `evidence/orchestration/00-root-bootstrap.log`.
- Initial `make security-negative` — failed at the expected exact-Node prerequisite because bootstrap had not yet run in root's environment; Go/Rust/secret tests had passed. Log preserved in `evidence/orchestration/00-root-security-negative.log`.
- After bootstrap: `make lint unit security-negative gate-selftest` — PASS (exit 0). Includes Go vet/race, Rust Clippy/14 total tests/10 negative tests, 3 contract tests, 2 dashboard unit tests, 3 secret lifecycle tests, generated contract drift validation and intentional format/lint/schema failure detection. Log: `evidence/orchestration/00-root-static-tests.log`.
- Root verified all five GitHub Actions SHA pins resolve in their intended official repositories. Metadata: `evidence/orchestration/action-pins.json`.
- Initial image scans found 67/55/30/26 HIGH+CRITICAL findings in NATS/Postgres/Python/Redis images respectively. These findings triggered patch/version remediation rather than exceptions; initial report summary is preserved in `evidence/orchestration/00-initial-image-findings.json`. Final patched-image scans remain pending.
- Root independently reproduced Docker 29 suppressing published ports on the initial internal network: configured HostConfig bindings but null published NetworkSettings ports; all four loopback ports refused connections. Implementer switched to a dedicated development bridge with explicit loopback host bindings. This is development connectivity, not production network isolation.

F00-01, F00-03 helper/toolchain issues and F00-04 secret lifecycle gaps are repaired and corresponding root tests now pass. F00-02 scanner fix and local advisory negative proof are implemented; final scan evidence and aggregate build/integration still require review. No gate approval yet.

## Final disposition

**M0-FOUNDATION: PASS, local scope only.** All ten foundation acceptance checks are satisfied. Independent reviewer found no new critical/high/medium issue. F00-01–04 are CLOSED with executed regression checks. No advisory ignore or risk waiver was introduced.

Final commands actually executed:

- `make check`: exit0, full format/vet/Clippy/TS/contracts/unit/build/integration/security-negative/selftest sequence on the recorded source revision. Log `evidence/orchestration/00-root-final-check.log`. Local build identity stabilization and the fresh-init TCP readiness repair followed; the relevant final integration and scan commands below passed after those edits. A fresh full final-state aggregate is recorded separately when available.
- Final `make integration`: exit0, verified Go→Rust contract, authenticated Postgres/Redis/NATS, JetStream health, actual TLS chain/hostname checks, wrong-host/untrusted negatives, isolated fresh PostgreSQL init and persisted restart with password denial, dashboard integration. Log `evidence/orchestration/00-root-derived-integration.log`.
- `make security-scan`: exit0, Go/Rust/npm dependency gates, synthetic local advisory rejection, secret scan, repository SBOM/FS scan, all four image vulnerability/SBOM checks and local image identity checks. Log `evidence/orchestration/00-root-final-scans.log`; JSON/SBOM outputs under ignored `.local/evidence/security`. Each final image has zero HIGH/CRITICAL findings at the scan database state; future advisories remain possible.
- `python3 scripts/image_identity_test.py`: two tests pass, including OCI chain, wrong platform/config substitution and classic Docker archive mismatch. `actionlint -shellcheck= .github/workflows/ci.yml`: exit0. Private fixture ignore rules confirmed with `git check-ignore`.

Derived local fixture images use immutable base digests, exact patched Alpine packages and restricted build inputs. Unused vulnerable Python packaging was removed from the standard-library fixture; old gosu was replaced with a tested su-exec wrapper. Compose references immutable local manifest IDs with `pull_policy: never`. The scanner exports those exact IDs and validates the archive hashed index/manifest/config chain against Trivy config identity. Cached local builds disable timestamp-varying automatic provenance; production provenance/signing remains required in modules10–12.

Final integration exposed and repaired a fixture readiness race: PostgreSQL temporary socket-only init server could satisfy pg_isready prematurely. The fresh-init test now probes TCP to the actual container hostname and integration passed afterward. A duplicate Compose key from an overlapping edit was caught by Compose parsing and removed before final scans/tests.

Final local manifests: PostgreSQL `sha256:3bd3054c489c5cef8220a4bd142432251b9ae19f071ba32ca50b2c4602aaa6c3`; origin `sha256:d951150f6a4075e1bc5d55510f86ee72c69e9d517fe9ae2aa0e40b75bec53f7b`. Source hashes/base provenance are recorded in generated image and scan locks.

Modules01/02 may now open. Pingora feasibility, tenant isolation, actual proxy TLS verification and production release remain mandatory and unproven. Remote CI/branch protection, named maintainers and human release signoffs are not claimed by local execution.
