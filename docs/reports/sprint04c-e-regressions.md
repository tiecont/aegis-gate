# Sprint04-C E sanitized regression and dependency evidence

Status: fresh corrected local verification COMPLETE; F review PENDING.
Module01 NO-GO,04-12 LOCKED, production BLOCKED. No product, dependency,
snapshotv1, original75/23 input/expectation/evaluator change.

## Repair and publishable ancestry

Independent F scanning rejected the initial evidence because a public
typescript-eslint HTML page included a JWT-shaped Netlify RUM value. No token
privilege was exercised. No scanner ignore or finding suppression is added.
The entire initial stdout is omitted; original commands/hashes, safe stderr,
image lock and dependency outputs remain in attempt01 with REDACTION.md.
Its manifest is deliberately incomplete and the attempt is INELIGIBLE. Earlier
E acceptance of5515913 is superseded pending corrected-source F review.

This branch starts from safe source-only d11ce1c and excludes5515913 from its
ancestry. Old commit IDs in receipts are historical metadata; a minimal clone
of the sanitized branch need not contain that discarded evidence commit.
Root must publish only reconstructed safe ancestry, never merge the old commit.

Corrected source `dc30375a40a70feea40ff13a36fd4c2b3b96068b`, tree
`21ca2e604f3a95863d3a6cedf339c4af2bedc92a`, is committed and clean before
attempt02. The collector resolves official typescript-eslint source revision
and fetches immutable `docs/users/Dependency_Versions.mdx`, avoiding injected
site HTML. Both actual argv and raw revision/Markdown remain in fresh receipts.

## Fresh complete regression proof

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04c-e/record.mjs attempt-02
flock /tmp/aegisgate-sprint02-fixtures.lock python3 evidence/sprint04c-e/verify.py evidence/sprint04c-e/verification-02.json
```

Both exit0. The collector internally holds the shared flock from setup through
execution, scanners, evidence hashing and Compose cleanup.49 commands and98 raw
stream slices have exact UTC times, source/tree, argv/cwd/tool identities,
exits/byte offsets/lengths/SHA256. Only expected competing-lock conflicts and
strict TS7 resolution return1. All required actual commands pass.

Fresh actual PostgreSQL/Redis/NATS/JetStream/mTLS, tenant/RBAC/isolation,
origin TLS/credential negatives, immutable signed publication, canary/rollback,
encrypted LKG, anti-replay, provisioning floor, drain, prune/archive/recovery
controls pass. All11 Go packages,88 top-level tests,151 subtests pass with no
skips. Edge tests, contracts/golden signatures, fixture identity/fresh restart/
stale-volume/dynamic-network controls and all five dashboard checks pass.
No scoped product fix is justified.

Compose project `aegisgate-04c-e` discovers its network from structured config;
all bindings remain loopback. Cleanup container/network/volume inventories are
empty. Verification checks12 manifest entries,98 stream slices and exact source
equality; generated private values/private-key markers match0 in owned evidence.
Owned cached passwords, configs, JWT and PKI are removed under the verification
lock. Rendered Compose, private keys and image archives are never committed.

Tools are official Go1.27.4, Rust1.99.1, Node26.13.0/npm11.20.0,
Docker29.9.3/Compose5.7.1, govulncheck1.9.0/cargo-audit0.23.0. Exact versions,
scanner/Node hashes and command results are retained in attempt02.

## Dependency and scope disposition

Fresh registry peers still exclude TypeScript7 (`>=4.8.4 <6.1.0` for released
typescript-eslint8.72.2); strict TS7.0.2 resolution fails ERESOLVE as expected.
Compatible TS6.0.3 and minimatch11.0.7 override remain unchanged. Eight real
dependency scanner operations pass with no reported vulnerabilities. Pingora's
derivative2.2.0/RUSTSEC-2024-0388 and unsafe-libyaml0.2.11/RUSTSEC-2024-0449
unmaintained warnings remain open. No peer forcing, suppression or waiver.

The external generation floor is a provisioning interface, not implemented
production monotonic storage. Consumer drain cannot cancel engine H2/WS/gRPC
I/O or recall copied data. Archive custody, secret service and operational
production proof remain later gates. No Module10 work or runtime GO.

Original results remain historical/accepted63/75 Pingora,69/75 Envoy,70/75
Hyper and16/23 supplemental; no new candidate benchmark is claimed. All old
failures, including9-byte H2 aggregate-zero, stay mandatory. Human owner and
approval remain PENDING. F must review this corrected source/evidence; root
full local/hosted integration gates are separate.

## Agent completion report

- Module/status:00/02/03 local verification complete; independent F pending.
- Changes: E-only evidence helpers, redaction metadata, fresh proof and report.
- Contracts/architecture/product/dependencies changed: none.
- Tests: actual fresh regression/dependency commands and syntax check pass.
- Known blockers: maintained ingress, protocol/resource proof, dependency
  maintenance, formal human architecture decision and production signoff.
