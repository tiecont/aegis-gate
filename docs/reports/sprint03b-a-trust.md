# Sprint03-B Agent A: snapshot contract, cryptography and trust

Module03 shared snapshot/trust implementation is complete for local integration;
this report does not grant the overall Module03 gate or production signoff.
Branch: `feat/module03-snapshot-trust`. Core source commits:
`42bd907125bab7a9afc07c78a9f502c22a8b90fb` and
`84df9d8b17808f6c6177337814bd3b735fd51f1b`.

The frozen Go package `internal/configsnapshot` owns the one envelope, RFC8785
JCS payload/envelope bytes, domain-separated Ed25519 signatures, strict embedded
JSON Schema1.0, bounded tenant-scoped reference validation and authenticated
immutable trust bootstrap/rotation. `docs/CONFIG_PROTOCOL.md` defines all fields,
operators, timestamps, exact literal routing semantics, expiry and retirement.
Publisher and consumer agents received the shared API before integration.

Go standard-library Ed25519/SHA256 perform cryptography. The pinned canonicalizer
`github.com/cyberphone/json-canonicalization` commit32a48195b9b2 is listed among
RFC8785 implementations. Its source rejects duplicate property names, malformed
UTF-8 and lone surrogates; project tests exercise those behaviors. The wrapper
bounds bytes and nesting before its recursive transform. Snapshot generation
integers are limited to JavaScript's exact range. There is no custom cryptographic
algorithm, trust inferred from notifications, private key in a wire artifact,
or production HTTP parser.

Root-key authenticated installation pins environment and public key. Root-signed
bundle rotation is version-monotonic and time/size bounded, allows at most two
signers with <=24h overlap, and rejects retired-key resurrection or key-ID reuse.
Trust stores defensively copy public material and schema bytes; rotation returns
a separate immutable store. Disposable `LocalSigner` keys exist only in process
memory. `Signer` permits a production audited secret service implementation,
which remains a future production requirement.

An expired but authentic LKG can retain its replay generation through the
explicit `VerifyCheckpoint` API. That API validates signature/schema/tenant
semantics at signed activation time and current signing-key trust; it never
grants readiness. Ordinary `Verify` continues to enforce current hard expiry,
current domain ownership and current key retirement. Consumer code must keep the
recovered floor even when it cannot activate the snapshot.

## Actual verification

Commands executed at source84df9d8 are bound in
`evidence/sprint03b-a/commands.json`; adjacent logs record `RESULT_EXIT=0`.
No DB/Compose fixture was touched by these pure library tests.

| Command | Exit | Evidence SHA256 |
| --- | --- | --- |
| `GOTOOLCHAIN=go1.27.4 go test -race -v ./internal/configsnapshot -count=1` |0| `9f0adc8ea16568a3b741e706064bcec6b077ff57d782489fe1cf8f13e265c405` |
| `GOTOOLCHAIN=go1.27.4 go vet ./internal/configsnapshot` |0| `29efc5990e1e67e7b0a5e7570e81a46c04e2a97b27e6fc269ad22000ba0c4693` |
| `node internal/configsnapshot/testdata/verify-vector.mjs` |0| `b70231f4426915989e6bc8f80a43fe385089b11e94afcca540a6192cb9595d9a` |
| `git diff --check` (committed source) |0| `29efc5990e1e67e7b0a5e7570e81a46c04e2a97b27e6fc269ad22000ba0c4693` |

Golden signing input, payload, artifact and public key are stable artifacts.
The deliberately public test signing identity is derived from an obvious public
fixture label; no private key file is retained. Independent Node/OpenSSL checks
Ed25519, explicit context, all envelope fields against the published signing
input, canonical-payload SHA256 and single-byte tamper. This is cross-language
cryptographic vector consumption, not a claim that Node implements a second
production verifier or independently canonicalizes arbitrary JSON.

Negative suites cover byte tamper, wrong digest/signature/context/key, schema
downgrade, generation replay, wrong deployment, malformed/oversized/deep/Unicode
JSON, duplicate keys including escaped aliases, unknown fields/operators, duplicate
host, cross-tenant resource/reference, invalid/missing authentication, unsafe
origins, expiry, unsupported resource bounds, duplicate route, signed unsafe
payload, root/environment confusion, trust replay, trust expiry, key overlap,
retirement, omission, retirement reversal and key material mutation. Positive
suites cover canonical roundtrip, RFC8785 example, scheduled activation,
immutable trust rotation, public vectors and expired authenticated checkpoint
floor recovery. All tests execute; none are skipped or suppressed.

## Acceptance boundaries and handoff

Agent F must independently review/reproduce the signed contract and trust checks,
then root must run the integrated publication/fetch/activation/LKG/rollout suites,
full repository checks, meaningful scans and exact-head hosted CI. A passing
library suite alone does not prove those paths. No performance/SLO claim is made.

Signing key material must be unique per environment. Trusted clock and protected
local high-water state remain assumptions; restoring/deleting the entire disk
state or rolling back system time requires authenticated operator recovery.
After retirement, a cached artifact no longer grants activation/readiness even if
its own expiry is later. A root-signed trust bundle expires within24h; outages do
not extend trust. Module01 remains NO-GO,04–12 remain locked, production blocked.

## Agent Completion Report

- Module:03, shared snapshot contract/cryptography/trust (Agent A).
- Status: complete implementation/local library proof, integration review pending.
- Commits/files:42bd907 and84df9d8; `internal/configsnapshot`, `go.mod`, `go.sum`,
  `docs/CONFIG_PROTOCOL.md`; this report/evidence in a following commit.
- Architecture/ADR decisions: implements accepted signed-pull design; no proxy
  engine substitution or release approval.
- Contracts changed: frozen schema1.0 and exact signed/trust bytes.
- Positive/security-negative tests: exact commands, exits and hashes above.
- Performance: not measured or claimed.
- Known risks/release blockers: integrated independent review, full checks,
  hosted CI, production secret-service provisioning and operational clock/state.
- Human review: no architecture approval invented; production security/release
  signoff remains required by repository policy.
- Next work: integrate B/C/D and independently reproduce Module03 acceptance;
  no dependent proxy implementation is opened by this report.
