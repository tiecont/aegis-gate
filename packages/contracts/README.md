# Foundation contracts

`openapi.json` is the source of truth for the **current management health/error API**, not the future tenant API or signed edge snapshot. It defines `GET /healthz`, unready `GET /readyz`, bounded structured errors and server-generated UUIDv4 correlation IDs. Unknown fields are forbidden in error shapes. This foundation has no tenant CRUD, customer authentication or signed config activation.

## Generation and compatibility

From the repository root:

```sh
make contracts-generate
make lint
make unit
```

`scripts/contracts.mjs --write` validates OpenAPI with Swagger Parser and generates:

- `internal/contracts/api.gen.go` with the pinned `go tool oapi-codegen` generator;
- `packages/contracts/generated/api.ts` with pinned `openapi-typescript`;
- `packages/contracts/generated/error.schema.json` from the OpenAPI components for cross-language/negative validation.

`--check` regenerates into memory/temporary output and fails on drift instead of modifying checked-in files. AJV validates the shared fixture with strict schemas/formats. `scripts/contracts.test.mjs` exercises invalid and compatibility vectors; `scripts/contract-integration.mjs` checks the Go producer against JSON Schema and invokes the Rust bounded consumer. The module report must state whether the same generated output was consumed end to end. Keep the schema, producers, Rust validators, generated bindings and tests aligned.

`baseline.openapi.json` is a compatibility guard. Existing component schemas and operation definitions must remain byte-structure-equivalent under JSON serialization; additive component/operation names are permitted. The comparison is deliberately conservative, so harmless reorderings may also fail. Do not update the baseline merely to hide a breaking change: make an explicit version/ADR decision and review downstream consumers.

Canonical request IDs use lower-case RFC UUIDv4 with the variant bits validated. Generation helpers use positive integers at most `2^53-1`, advance strictly and reject overflow; this allows consistent integer representation in Go/Rust/JavaScript. The helpers alone do not establish persistence, authorization or replay defense.

## Snapshot boundary

`examples/gateway-snapshot.json` is an **illustrative, non-deployable blueprint** with placeholder signing material. Module 00 does not adopt it as a signed snapshot schema or implement a publisher/verifier. Module 03 must define canonical signed bytes and the complete versioned envelope/payload schema, hashes/signatures, trust bootstrap/rotation, timestamp/bounds validation, tenant references, monotonic replay defense, authenticated propagation and LKG. Never place raw private keys, API-key plaintext or bearer tokens into ordinary config contracts.

Contract validity is not proof of tenant isolation, authenticated configuration, TLS verification or production readiness. See `docs/CONFIG_PROTOCOL.md` and the module gates before extending this package.
