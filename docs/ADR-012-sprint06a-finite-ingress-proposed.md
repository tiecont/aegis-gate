# ADR-012 Consolidated Finite Ingress Direction (PROPOSED)

Status: PROPOSED, NOT EFFECTIVE. This consolidates the05D v2 recommendation for
Sprint06A review. It accepts no architecture, modifies no snapshot v1 wire
contract, replaces no original75/23 oracle, and opens no module. Accountable
human architecture owner, security owner, approval reference and date: PENDING.
The effective ingress contract remains the original aggregate zero-origin-byte
contract, with complete mandatory streaming/protocol controls and human signoff.

## One Preferred Implementation Path

Continue one isolated **strict finite-message H1 admission component** using
unchanged maintained llhttp9.4.4 incremental parsing, complete framing/trailer
validation, private bounded AES-256-GCM staging, full authentication before any
origin admission, verified origin TLS and one captured signed tenant/route/
generation. Future production integration must put those decisions inside one
reviewed TLS/config/identity boundary. This prototype does not yet provide that
unified boundary. Streaming, WebSocket and gRPC stay disabled in this limited
component; no buffered or alternate proxy fallback may enable them silently.

The proposed research profile is `strict_finite`; unknown/missing/streaming or
unsigned/downgraded profiles fail closed. The06A signed-admission experiment
uses existing Module03 signed snapshots/consumer/trust and a separately signed
domain-separated sidecar bound to the exact artifact digest and resource
generations. Its verification hook and adapter are excluded from ordinary builds
by `aegisgate_sprint06a_feasibility`. Snapshot v1 remains byte-compatible. This
is a compatibility experiment, not approval to add a production policy contract.

The actual signed fixture currently has separate finite TLS staging, Go signed
consumer/JWT admission, and verified origin TLS hops. Capture starts at Go
admission after finite staging. A collection of these tested hops is not a
complete unified gateway, signed pre-staging capture, unrestricted SSRF-safe
origin dialer or H2/WS/gRPC implementation. Existing snapshots' auth-required
semantics remain mandatory; client X-Tenant-ID/forwarding metadata are not trust.

## Effective, Proved And Proposed

| Assertion | Status and authority |
| --- | --- |
| Original75 and original23 inputs/evaluators/windows | Effective, unchanged; retained accepted candidate73/75 and19/23 |
| Every origin decrypted byte in original denial interval counts | Effective; nine SETTINGS ACK bytes still FAIL |
| Full H1/H2/WS/gRPC/streaming/TLS/tenant/config proof and human approval before Module01 GO | Effective; incomplete and NO-GO |
| Maintained parser rejects folds; finite staging withholds tested late-invalid/EOF input | Executed finite research proof, not complete gateway |
| Actual container caps and finite fault/restart controls | Scoped06A A evidence and independent F verdict; no capacity/SLO claim |
| Signed experimental profile/tenant/generation integration | Build-tag-only06A B evidence; multi-hop fixture, no accepted wire revision |
| Post-capture H2 correlation/adversarial transcript consistency | Research only; completeness remains INCOMPLETE |
| Finite admission as a product-supported route class | Proposed, requires contract/architecture/security review and full integration |
| Request-attributed H2 isolation with unrelated controls separately attributed | Proposed, requires authoritative runtime APIs and formal approval; never active implicitly |

The machine-readable proposed suite is
`docs/contracts/sprint06a-finite-admission-research-v1.json`. It is additive and
inactive. Passing it cannot relabel an original failure or grant Module01 GO.

## Operational And Security Consequences

| Concern | Finite design and measured scope | Required before broader eligibility |
| --- | --- | --- |
| Upload limits/latency | Entire finite request must finish before origin sees a byte; current1.5MiB wire limit and2500ms absolute deadline | Product limits/latency budgets and explicit retry behavior; no indefinite streaming promise |
| Encryption/key custody | Maintained Node/OpenSSL AES-GCM, ephemeral per-message key/IV/tag; authenticate complete stage before replay | Reviewed secret custody, OS memory/swap/core protections and auditable key lifecycle; buffer wiping is not proof of hardware erasure |
| Disk availability/exhaustion | Global2MiB ciphertext/3 files; container bounded tmpfs and actual ENOSPC tested | Per-tenant reservations/fairness, filesystem budget, alerts; no unlimited fallback or plaintext spill |
| Crash/recovery | Crash loses keys; validated orphan ciphertext is discarded before readiness, not resumed | Ownership/single-instance guarantees and bounded safe inventory validation; no request durability promise |
| Resource reservation | Bounded clients/origin slots/waiters/deadlines plus measured cgroups | Independent load/soak/overload and tenant fairness proof; hard caps do not establish availability/SLO |
| Retry/idempotency | No automatic retry after uncertain origin effects | Origin/application idempotency policy; a lost response after accepted replay must not trigger blind replay |
| Cross-tenant isolation | Signed snapshot digest/resource generation and verified SNI/Host binding; global spool quotas | Unified admission, tenant quota ownership, trust epoch/pool partitioning and cross-tenant crash/rotation tests |
| Streaming incompatibility | Common CL10/abc prefix can later be valid or EOF-invalid; trailer validity can be decided late | A distinct formally reviewed irreversible-effect contract, or streaming remains disabled |
| Temporary-file attacks | Exclusive/no-follow/permission/link/identity checks and corruption/fault tests | Host/same-UID attacker boundary, race-resistant custody and separate production filesystem review |
| Deployment isolation |06A container is a loopback network-none laboratory; host PID visibility checks enclosing flock | Separate production namespace/seccomp/cgroup/custody design; lab cgroups are not production platform acceptance |

## Two Origin Isolation Properties

| Threat/effect | Effective aggregate zero-byte | Proposed request-attributed isolation |
| --- | --- | --- |
| Malformed request HEADERS/DATA/partial blocks without handler | Any captured byte fails, independent of handler dispatch | Must detect every attempted dial/stream/header/DATA/HPACK effect with authoritative request identity |
| Independent SETTINGS ACK on reused valid connection | Fails whenever bytes overlap original interval | Could be separately classified only with complete control trigger/ACK/connection mapping; raw bytes still retained |
| Origin dial without HTTP bytes | Byte counter alone may not expose it; existing connection/transport controls also matter | Must explicitly bind every attempted/created dial, including failures |
| Truncated/lost capture or omitted/forged mapping | Cannot establish a valid zero-byte proof | INCOMPLETE, never PASS; signatures over observer-selected records do not prove coverage |
| HPACK-only mutation or partial CONTINUATION | Bytes fail if captured in interval | Must cover complete/partial header blocks and exact encoder/decoder state mutations, including no handler |
| Late malformed/truncated H1 after early body dispatch | Fails: irreversible origin effects already exist | Still fails strict late-invalidity isolation; an H2 control exception cannot excuse H1 body forwarding |
| Concurrent valid request traffic | Aggregate interval can fail on independent valid/control activity | Needs complete authenticated per-request attribution plus all-byte reconciliation; no quiet-window substitution |
| Compromised/trusted observer omission | Incomplete capture is not authoritative evidence | Unsolved by a signer-controlled transcript; requires independently reconciled runtime effect ledger |

D's public Transport/httptrace/Framer/HPACK APIs do not supply complete pre-wire
dispatch, signed generation or exact HPACK mutation authority. New bounded
consistency checks and real ACK captures cannot manufacture it. The proposed
causal property stays research. No current test subtracts control bytes, shifts
an interval, counts local CANCEL as peer rejection or replaces400/421 with reset.

## Rejected Alternatives

1. Forward common body prefixes then retract on late invalidity: executed CL10/
   abc/EOF and late-folded trailer counterexamples leave irreversible origin
   bytes. Staging avoids this by failing early-origin streaming positives.
2. Hide whole-message buffering behind a streaming label or tune buffer size:
   finite capacity cannot establish indefinite pre-completion progress with
   strict late-invalidity zero effects for the same request type.
3. Enable alternate oghttp2 because two errors pass: historical20/23 regresses
   unexpected CONTINUATION. The accepted19/23 baseline is not replaced.
4. Map nonexistent H2 local replies or use hidden codec/test internals: reset
   occurs before supported response hooks; a network flush cannot submit absent
   adapter frames. No supported released repair was found in the refreshed pins.
5. Declare causal H2 success from zero handlers or nonce correlation: independent
   attacks expose omitted/aliased header coverage; runtime completeness is false.
6. Encode profiles into unrelated signed snapshot v1 fields or trust unsigned
   sidecars: a second unsigned trust model/downgrade is prohibited.06A tag-only
   proof uses the existing immutable trust lifecycle without changing v1.

## Executable Dependencies And Formal Decisions

Autonomous work may harden finite resource/cancellation/filesystem behavior,
challenge signed sidecar/generation/tenant integration, specify supported API
requests, and independently validate additive tests. It may not enable the
profile, revise effective security guarantees or open downstream modules.

Priority dependencies for a complete gateway:

1. One maintained complete H1/H2 TLS/tenant/signed-config ingress boundary with
   strict wire rejection and consistent request lease capture before effects.
2. Supported pre-reset invalid-authority400/421 and non-regressing connection
   error-frame serialization-before-close. Exact historical negatives first,
   then valid reuse/streaming/gRPC/WS/cancellation and unchanged75/23.
3. Authoritative pre-wire dial/stream/header/DATA/HPACK instrumentation before
   considering a causal H2 exception. Missing coverage must fail incomplete.
4. Formal finite-profile/wire version and limits/custody/availability approval,
   and a separate streaming late-invalidity disposition. Actual named owners,
   approval reference/date and exact reviewed versions remain PENDING.

## Migration And Rollback

No migration is active. Retain original snapshots and oracle history; version
any future profile contract separately. Require explicit opt-in, authenticated
profile digest/generation, schema compatibility, monotonic floors and a tested
atomic consumer before activation. Capture one immutable lease per admitted
request. Canary and rollback use existing approved newer-generation publication,
not replay of old generations. Missing/stale/mismatched profile denies or retains
previous still-valid authenticated LKG under the effective contract; never falls
back to streaming or weaker auth. Revocation/trust expiry fail closed. Crash
discards incomplete stages and never automatically replays an uncertain request.

Architecture/security owner selection and affirmative approval are PENDING.
Module01 NO-GO; Modules04-12 LOCKED; production BLOCKED. A successful limited
profile proof alone does not satisfy the complete gateway gate. Start no further
equivalent feasibility comparison without a specific new maintained mechanism
or separately approved coherent architecture/contract path.
