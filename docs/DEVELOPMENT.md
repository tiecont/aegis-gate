# Local development

This repository starts from the module 00 foundation. Module02 now includes a partial PostgreSQL/OIDC management checkpoint with explicit local HTTPS opt-in. The default listener remains foundation health only. Customer traffic, signed configuration publication and production operation remain unavailable. Check `../IMPLEMENTATION_STATUS.md` for authoritative gate state and evidence.

## Local management checkpoint

The sprint02 candidate lifecycle and role provisioning are documented in
[MANAGEMENT_ACCEPTANCE.md](MANAGEMENT_ACCEPTANCE.md). Root owns gate acceptance.
Run its owned-fixture integration suite with `make integration`, which now sets
`AEGIS_TENANCY_INTEGRATION=1` explicitly. The tests provision disposable database
schemas and a verified HTTPS IdP, exercise actual authorization-code/PKCE and
HTTP isolation, then tear down their own resources. The sprint02 HTTP lab uses
actual owned UDP DNS transport; it does not contact public DNS or prove
production ownership operations.

The control-api executable accepts `--management-config .local/management.json`
with `--listen 127.0.0.1:8443`. Offline `--migrate --runtime-role NAME
--maintenance-role NAME` applies embedded migrations/grants with a separate
schema-owner configuration, then exits. Serving requires a checked runtime login.
The configuration must be an owner-only regular file, no symlink,
at most16KiB, with these operator-owned fields:

| Field | Required value |
| --- | --- |
| `origin` | Exact HTTPS literal-loopback origin used by the browser, without a path. |
| `database_dsn` | Operator-supplied PostgreSQL DSN; full TLS hostname/CA verification except literal loopback fixtures. |
| `oidc_issuer`, `oidc_client_id` | Explicit trusted HTTPS IdP and registered public PKCE client; callback is `origin` + `/v1/callback`. |
| `oidc_ca_bundle` | Optional trusted CA bundle path for a private IdP; verification stays enabled. |
| `tls_certificate`, `tls_private_key` | Matching certificate/key paths; key is bounded and owner-only, certificate must match the browser origin. |
| `dns_resolver` | Operator-selected literal resolver IP and port; no tenant-selected resolver or hidden default. |

The browser login begins at `/v1/login`. Administrative mutations require the
session-bound CSRF cookie value in `X-CSRF-Token`, plus exact `Origin`.
Create-draft operations require `Idempotency-Key`; revision/approval operations
require a quoted generation in `If-Match`. OpenAPI describes the current local
surface. The current implementation has no serving config publisher and remains
partial; mandatory remaining scope is in `reports/02-management-checkpoint.md`.
Never place configuration credentials or private-key contents in source, logs
or config bus messages. This opt-in does not authorize a public listener or
production release.

## Prerequisites and versions

Use Go **1.27.4**, Rust **1.99.1**, Node **26.13.0**, Python 3.11+ and a working Docker Engine with Compose v2. Versions are pinned in `go.mod`, `apps/edge/rust-toolchain.toml` and `.node-version`. Go may download its declared toolchain through the standard Go toolchain mechanism. Rustup must provide the pinned toolchain and rustfmt/clippy components. Lockfiles pin dependency resolutions; a pin is not evidence of vulnerability clearance.

On supported Linux x64/arm64 hosts, `make bootstrap` downloads Node 26.13.0 into ignored `.local/toolchains/node` and verifies its archive against the official Node SHA256 manifest over HTTPS. Other platforms must install that exact release. `AEGIS_NODE_BIN=/absolute/path/to/node` selects an existing pinned binary through `scripts/node-path.sh`; an unsupported version is rejected. Do not replace the user's global toolchain or run an unreviewed curl-pipe-shell installer.

## Commands

Run from the repository root. The task runner provides:

| Command                   | Purpose                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `make bootstrap`          | Prepare the pinned local Node/tooling dependencies required by the checks.                                                         |
| `make contracts-generate` | Regenerate Go types, TypeScript types and the error JSON Schema from OpenAPI.                                                      |
| `make fmt`                | Apply source formatting. Review the resulting diff.                                                                                |
| `make fmt-check`          | Check formatting without changing source.                                                                                          |
| `make lint`               | Run static analysis/type checks and generated contract drift checks.                                                               |
| `make unit`               | Run actual Go, Rust, dashboard and contract unit tests.                                                                            |
| `make dev-up`             | Generate ignored local secrets/PKI and start the isolated Compose dependencies.                                                    |
| `make integration`        | Exercise the owned local services, cross-language contracts and built dashboard. Docker must be available; run `make build` first. |
| `make security-negative`  | Execute the implemented foundation deny/invalid-input/TLS cases; no future security claim is implied.                              |
| `make build`              | Build Go executables, Rust crates and the Next.js application.                                                                     |
| `make check`              | Run the foundation verification sequence. A failed prerequisite or missing tool must fail visibly.                                 |
| `make security-scan`      | Run configured secret/dependency/image scans and SBOM checks; record actual output and unresolved findings.                        |
| `make dev-down`           | Stop the Compose stack. Data volumes are not a substitute for tested backups.                                                      |

See the Makefile for precise target prerequisites. Checks can require internet access for package/advisory databases and registry images. Never treat a network failure or unavailable scanner as a successful scan. Security-negative tests target loopback fixtures and local artifacts only.

`make fixture-images` builds local PostgreSQL/HTTPS fixtures from immutable bases,
with exact package repairs. Generated `.local/fixture-images.env` and lock JSON
bind Compose to immutable local manifest IDs and source hashes; do not hand-edit
them. The scanner exports these artifacts and verifies their OCI hash chain.
Cached local builds disable timestamp-varying automatic provenance; production
signed images and build provenance remain modules10–12 requirements.

## Local services and readiness

The control API listens only on literal loopback addresses. `GET /healthz` reports process liveness; `GET /readyz` returns 503 because the control plane is not configured. Other routes return a bounded generic 404 error with a server-generated correlation UUID. A caller-supplied tenant header or request identifier is not trusted.

The config publisher is an offline shell: `--check` emits an unready transport-contract example, while a normal start fails. The Rust edge opens no network sockets, reports `ready:false` with `--check`, and refuses service startup. The config-agent checker validates a bounded management error envelope only; it cannot activate a snapshot. The dashboard is a static public local status page without tenant sessions or customer data. See `../apps/edge/README.md` and `../apps/dashboard/README.md`.

Compose uses an dedicated bridge lab network with ordinary outbound connectivity and publishes only these loopback ports:

| Dependency        | Host address      | Local fixture behavior                                                                        |
| ----------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| PostgreSQL        | `127.0.0.1:54329` | Password from ignored local secret file.                                                      |
| Redis             | `127.0.0.1:56379` | Password required; bounded lab storage.                                                       |
| NATS JetStream    | `127.0.0.1:54222` | Token required; monitoring stays inside the lab network.                                      |
| Demo HTTPS origin | `127.0.0.1:18443` | Disposable certificate for `origin-a.test`; the test client trusts only the generated lab CA. |

The local Redis and demo-origin containers use the invoking host UID/GID, read mode-0600 local fixture files, drop capabilities and disable privilege escalation. The demo origin filesystem is read-only; Redis uses a bounded 64MiB tmpfs and does not promise durable local counters. This is an explicit development limitation, not an approved production workload identity or key custody model.

## Contracts and security boundaries

`packages/contracts/openapi.json` is the management API source. Regenerate bindings and run compatibility/drift tests together. The immutable baseline currently allows additive schemas/operations and rejects modification/removal of existing ones; a contract version decision is needed for breaking changes. UUIDv4 error envelopes have cross-language checks. Rust generation helpers enforce positive safe-integer bounds and monotonicity for the future snapshot contract. A valid error envelope is not authenticated tenant data or a signed edge snapshot.

Read `packages/contracts/README.md`, `packages/test-fixtures/README.md`, `docs/THREAT_MODEL.md`, `docs/SECURITY_COVERAGE.md` and `docs/RISK_REGISTER.md` before extending ingress or secret handling. Do not enable customer traffic before the Pingora Go/No-Go and the applicable dependent gates. Tenant isolation, dial-time SSRF/TLS checks and production release evidence remain mandatory.

## Contribution and evidence

Use small scoped changes with code, contracts, tests and docs together. Follow Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). Do not commit generated fixture secrets, `.local`, build output or dependency directories. Record exact commands, actual exit status and limits in the module completion report; update `IMPLEMENTATION_STATUS.md` only after independent gate review.

No production deployment, live DNS, paid cloud resource, public abuse/load test or real billing operation is authorized by local development commands. Production activation requires the explicit human release signoffs in `docs/QUALITY_GATES.md`.
