# Config Contract and Publication Protocol

Module03 version **1.0**, frozen for Sprint03-B. This is an engine-independent
configuration read-model. It implements no customer-facing proxy and does not
open Module01 or Module04. The authoritative schema is
[`internal/configsnapshot/schema-v1.json`](../internal/configsnapshot/schema-v1.json),
embedded and enforced by the shared Go signing/verifying library. The older
`examples/gateway-snapshot.json` is an illustrative blueprint, not a version1.0
wire artifact. Public golden canonical payload, complete signing-input hex and public-key hex
are retained beside `testdata/verify-vector.mjs`, which independently verifies
Ed25519/context/envelope binding/SHA256/tamper with Node/OpenSSL. No private key
is stored; the Go test derives a deliberately public fixture identity.
A valid public golden artifact is
[`snapshot-v1.json`](../internal/configsnapshot/testdata/snapshot-v1.json).

## Envelope and exact signed bytes

All properties are required; unknown properties, including unsupported policy
operators, are rejected at every object level. Duplicate JSON keys (including
escaped aliases), invalid UTF-8, lone UTF-16 surrogates, excess nesting and
malformed JSON fail before activation. RFC8785 JCS is implemented by the pinned
[Cyberphone Go canonicalizer](https://github.com/cyberphone/json-canonicalization/tree/master/go),
an implementation listed in [RFC8785 Appendix G](https://www.rfc-editor.org/rfc/rfc8785.html#appendix-G).
No project-specific canonical encoding or cryptographic primitive is used.

| Property | Meaning |
| --- | --- |
| `schema_version` | Exactly `1.0`; no downgrade or unknown version. |
| `context` | Exactly `AEGISGATE_CONFIG_V1`; also used as the signature prefix. |
| `generation` | Integer 1 through 9007199254740991, strictly newer than the consumer's durable high-water mark. |
| `deployment_id` | Pinned deployment namespace, opaque case-sensitive ASCII identifier. Production control planes should allocate collision-resistant UUIDs. A consumer never changes its namespace from a notification. |
| `created_at` | Signed creation time. |
| `valid_from` | Activation not before this time; must be at or after creation. |
| `expires_at` | Hard fail-closed time, after `valid_from`, at most24h after creation. |
| `content_sha256` | Lowercase hex SHA256 of UTF-8 JCS of the complete `payload` object. |
| `signing_key_id` | Identifier selected only from separately authenticated trust. |
| `payload` | Complete immutable tenant read-model below. |
| `signature` | Standard padded Base64 Ed25519 signature, 64 decoded bytes. |

All three envelope timestamps and domain `verified_until` use the exact lexical
form `YYYY-MM-DDTHH:MM:SSZ`, UTC and whole seconds. There is no clock-skew bypass.
`created_at <= valid_from <= now < expires_at` must hold. Domain ownership must
remain unexpired at verification/readiness. A stale control plane cannot extend
these bounds. Consumer policy may impose an earlier maximum staleness.

The signature input is the concatenation of ASCII `AEGISGATE_CONFIG_V1`, one
NUL byte, and UTF-8 JCS of the **whole envelope with the `signature` property
removed**. This includes the context, version, deployment, generation, every
time, signing key ID, content digest and full payload. The signature is ordinary
Ed25519, without an added prehash. Maintained Go standard-library Ed25519 and
SHA256 perform the cryptography. Signers implement `configsnapshot.Signer` so a
production secret service can sign these exact bytes without exposing its key.
`LocalSigner` generates disposable random keys in process memory only.

Equivalent whitespace, property order and JCS numeric spelling may be accepted.
Verification returns a normalized typed envelope. Consumers must use that
verified value for compilation; interpreting the original JSON independently
can disagree on numeric spelling. Artifact transport SHA256 is over the exact
stored artifact bytes, separately from `content_sha256`. Both are checked.
`VerifyCheckpoint` may authenticate an expired artifact solely to recover its
durable generation floor, validating its semantics at signed `valid_from` while
requiring its key and trust bundle still be trusted now. It grants no readiness
or activation; these always need ordinary `Verify` at current time.
JCS preserves array order; publishers sort all tenant/resource lists and methods
when compiling a revision, and retain its exact signed artifact for retries.

## Payload and policy semantics

`payload.tenants` contains at most128 tenants. Empty/null tenant lists are an
explicit complete empty configuration, allowing total revocation. Every tenant
has `id`, `domains`, `origin_pools`, `policies` and `routes`; resource arrays may
be empty/null. Every resource has an identifier and explicit `tenant_id`, which
must equal its enclosing tenant. Every pool, endpoint, policy and route carries
an immutable resource `generation`. Identifiers match
`[A-Za-z0-9][A-Za-z0-9_.-]{0,127}`. There is no lookup across tenant boundaries.

A domain has `id`, `tenant_id`, canonical lowercase ASCII/IDNA `hostname` and
`verified_until`. Hostnames are globally unique across the whole snapshot;
IP literals, localhost/internal/test suffixes and malformed authorities fail.
The publisher derives ownership and active state from approved Module02 data;
the snapshot cannot authorize ownership merely by asserting a tenant ID.

An origin pool has `id`, `tenant_id`, `generation`, and1–64 endpoints. Each
endpoint has `id`, `tenant_id`, `generation` and an HTTPS `url`. Only external
hostname syntax, default/443 port, empty or `/` path, no credentials, query,
fragment or encoded path is supported. The compiler maps an approved legacy
single-origin revision to a singleton pool. DNS lookup is deliberately absent
from verification: concrete IP validation at dial time is a mandatory future
Module04 invariant, not something a signed URL replaces.

A policy has `id`, `tenant_id`, `generation`, `auth_required`, `jwt_issuer` and
`jwt_audience`. `auth_required` must be explicitly **true**. An issuer is an
HTTPS URL with a canonical external hostname and no userinfo, query or fragment;
the audience is1–256 characters without controls. Anonymous mode and additional
policy operators are unsupported. Missing or invalid policies reject the whole
candidate; no implicit anonymous fallback exists. This distribution module
preserves declarative authentication requirements; token enforcement remains
Module06 work behind its prerequisites.

A route has `id`, `tenant_id`, `generation`, `domain_id`, `origin_pool_id`,
`policy_id`, `path`, and `methods`. All three references must exist in the same
tenant. Paths are literal exact paths, not regular expressions or prefix/wildcard
operators. A `*` character, if present, is literal. Paths must start with `/`,
contain no controls, `%`, `?`, `#`, backslash, repeated slash or dot segments,
and be at most1024 bytes. Methods are a unique nonempty subset of GET, HEAD,
POST, PUT, PATCH, DELETE, OPTIONS. Duplicate domain/path/method matches reject
the whole snapshot. Routing always captures route, policy and pool from one
complete generation; no mutable individual-table updates are permitted.

A tenant has at most1024 domains,1024 pools,1024 policies and4096 routes. The
whole snapshot has at most8192 resources including endpoints. Artifacts are at
most4MiB and JSON nesting at most24. Downloads, retries, retained generations,
request leases and encrypted disk data need their own bounded consumer limits.

## Authenticated bootstrap and key rotation

Trust never comes from snapshot payloads or JetStream. Installation pins an
Ed25519 root public key and environment identifier through an authenticated,
access-restricted operator channel. The root private key belongs in a separate
secret service, not the publisher artifact store. Use unique signing/root
material per environment. The library's `Bootstrap(root, environment, bundle,
now)` validates a root-signed trust bundle; `WithBundle` returns a new immutable
trust store for rotation. `NewTrustStore` is only for already authenticated
out-of-band configuration injection, including disposable local tests.

A trust bundle requires `context=AEGISGATE_TRUST_V1`, `environment`, `version`,
`issued_at`, `expires_at`, `keys` and `signature`. Its signature input is ASCII
`AEGISGATE_TRUST_V1`, NUL, and JCS of the entire bundle excluding `signature`.
The independently pinned root verifies it. Its version is strictly increasing,
environment exact, validity at most24h, and size at most32KiB. Duplicate/unknown
fields and missing fields fail. A bundle grants at most two keys, each carrying
`id`, Base64 `public_key`, `not_before`, `not_after`, and `retired_at` (zero time
means no scheduled retirement). A key lives at most30 days; the overlap of two
key validity intervals is at most24h. A root-signed bundle may explicitly retire
a key earlier. Omitting an old key retires its ID; later bundles cannot resurrect
that ID. Key IDs cannot change public material or validity bounds, and a
scheduled retirement cannot be extended. Root-key replacement itself requires
a new authenticated installation ceremony and is not authorized by NATS.

Verification checks that creation and current time are within the signing key's
validity, and current time precedes retirement and authenticated bundle expiry.
Retiring a key invalidates its LKG as well as newly received artifacts. Consumers
must recheck trust and hard expiry when checking readiness/capturing requests,
and replace immutable trust atomically. A healthy replacement signed under the
new key must reach consumers during overlap before retiring the old key.
Clock rollback or deletion/rollback of all local high-water state requires an
operator recovery ceremony; signatures do not provide a hardware monotonic clock.

## Publication and consumption lifecycle

1. An authorized operator receives deterministic preview and validation errors.
2. One DB transaction records the approved immutable revision, new deployment
   generation and durable outbox event. Unapproved mutable state is not compiled.
3. A bounded lease worker compiles the whole snapshot, validates all references,
   signs it, verifies the result, and retains one immutable artifact per revision.
4. Restricted local storage writes the immutable artifact. The authenticated
   JetStream notification contains only `deployment_id`, `generation`, artifact
   SHA256 digest and an artifact location authorized by the consumer's pinned
   authenticated fetch endpoint. An arbitrary notification never authorizes data.
5. The consumer uses mTLS identity and verified HTTPS server identity, enforces
   download bounds, and checks notification binding plus the complete signed
   contract with one shared implementation. It fully compiles staging first.
6. Encrypted restricted LKG and monotonic metadata are committed before the
   whole immutable generation becomes visible. A request captures the complete
   generation for its lifetime. Interrupted staging cannot partially activate.
7. Structured safe ACK/NACK codes bind deployment, generation and artifact digest.
   Rejection retains the previous valid LKG. Canary NACK pauses expansion; only
   authenticated, expected consumers and health/quorum observations count.
8. Rollback republishes previously approved content as a **new** signed monotonic
   generation with audit history. Neither rollback nor worker recovery lowers
   the generation high-water mark. Retry does not change immutable artifact bytes.

## Disconnection, emergency revocation and acceptance scope

Boot without a valid authenticated snapshot is not ready. Control-plane,
PostgreSQL, messaging or storage outage preserves a still-valid LKG without
removing its auth/routing policy. Hard snapshot expiry, ownership expiry,
retired keys, expired trust and earlier consumer staleness policy all fail closed.
No outage extends any signed deadline. Outages may delay revocation until the
earliest such deadline, at most24h for a newly created artifact and trust bundle;
this is a hazard bound, not an achieved propagation SLO. An emergency channel
must be separately authenticated; until such a production channel is reviewed,
operators remove affected traffic at the independently controlled upstream LB.
No unsigned emergency edits or network trust downgrade are allowed.

Local tests must prove byte tamper, wrong digest/signature/context/key,
retirement/overlap, downgrade/replay, duplicate host, cross-tenant references,
invalid/missing auth, malformed/oversized/deep/Unicode artifacts, request
atomicity, crash/restart/LKG, canary pause and newer-generation rollback. Actual
integration, scanner and independent-review evidence determine the Module03
local gate. Production secrets, deployment, signed runtime images, exhaustive
operational recovery and human release/security signoff remain later gates.
