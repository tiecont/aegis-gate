# Sprint06A B: Authenticated Finite Admission Feasibility

Status: scoped implementation and local evidence complete; independent F/root
review remains required. Actual signed `strict_finite` requests for tenants A/B
return200 through unchanged05D finite staging, Module03 captured configuration,
maintained JWT verification and a certificate-verified HTTPS origin. This is a
multi-hop loopback experiment, not one production ingress trust boundary.
Module01 remains NO-GO, Modules04-12 LOCKED, production BLOCKED. Original75=73/75
and23=19/23 remain historical authoritative results; no new original-suite run.

## Exact Source And Evidence

Worktree `/home/tiecont/.cache/aegisgate-06a/b`, branch
`test/sprint06a-signed-admission`, baseline
`8929adfd10f245ec0dac70b5304f1a2b445e7357`.
First executable source `00d5f617ca41c198002d76baa6117381aee6c1f1` preceded all
tests. Collector correction `702324a` retains failed attempt01. Final executable
source `260dc7fc141f6908627eb1a17a2c1535f2f7e960`, tree
`be0ce6f81bf3d5d2249c36277b24794a2e402b7c`, precedes attempt03. Evidence commit
`ce5e803145229a10e41b4dc5b7953914ca3f63bc` changes no executable source.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
 /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
 scripts/sprint06a-b-run.mjs evidence/sprint06a-b/attempt-NN
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
 /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
 scripts/sprint06a-b-verify.mjs evidence/sprint06a-b/attempt-03 \
 evidence/sprint06a-b/verify-NN
```

Use fresh numeric suffixes and clean committed source. Executed attempt03 and
verify01 both exit0. The collector holds the shared flock continuously from
setup through capture, cleanup and hashing. TMPDIR is disk-backed worktree
`.local/tmp`; disposable certificates, tokens, cache key and native/test binaries
are removed. Owned Compose containers/networks/volumes are absent. No root
private fixtures are read or deleted. Exact child argv/cwd/exits, raw stdout/
stderr, source/tree, actual versions and executable hashes are retained.
Five llhttp9.4.4 released files are downloaded with bounded HTTPS curl and checked
against immutable pins before compiling the unchanged05C binding. No parser,
TLS, JWT, crypto library, dependency pin or scanner rule changes.

| Receipt | SHA256 |
| --- | --- |
| attempt03 receipt | `8f2f0f6e747e574fbb9f81e54ff6ec0ac0304f27094c94306bceb59ee353a378` |
| attempt03 SHA256SUMS | `1cb6e1abcf5a96da5fc3d90e289fb167a6022def83fd9284696afb9a0af646da` |
| verify01 receipt | `c8726eeb9e4ea266786d32a476a18adab96ccf1c263b9dbdfe72860fff71d097` |
| verify01 SHA256SUMS | `d0afad27e86d398f2036ec83d777d1679b5488a91257976b7d802619f797826a` |

Attempt01's new race suite passes5 top-level/42 subtests, but its normal snapshot
test binary runs from root rather than its package directory; TestGoldenVector
cannot find `testdata/snapshot-v1.payload.json`. The collector failure/raw output
and successful cleanup are retained without relabeling. Attempt02 fixes only
the collector cwd and passes all four real Module03 packages. Attempt03 adds a
concurrent capture/cancelled-update challenge and repeats the complete final
executable-source verification. No evidence is overwritten.

## Signed Sidecar And Existing APIs

No snapshotv1 wire/schema change exists. Root explicitly authorized the narrow
`internal/configsnapshot/sprint06a_experimental.go` hook under
`//go:build aegisgate_sprint06a_feasibility`. Normal builds exclude it, confirmed
by actual `go list` and execution of normal Module03 binaries. The hook accepts
only the fixed `AEGISGATE_EXPERIMENTAL_ADMISSION_V1` signature domain, a NUL and
bounded JCS bytes, using the existing private `trust.key`, shared canonicalizer
and standard Ed25519. It exposes neither key material nor arbitrary contexts.
This research authorization is not contract/architecture approval.

The separate sidecar has version `1-experimental`. It signs deployment, exact
snapshot artifact SHA256, deployment generation, snapshot creation/expiry/key,
and tenant/route/resource-generation bindings. Route, policy, pool and singleton
endpoint generations must match the actual verified snapshot. Its signing key
must equal the snapshot signing key under the same root-authenticated TrustStore.
There is no second admission trust root. Size is32KiB, nesting24, at most128
bindings, one explicit `strict_finite` profile,1536KiB wire and2500ms request.
Missing/unknown fields, duplicate keys/bindings, absent/unknown/streaming profile,
unsigned/tampered/context/digest/deployment/tenant/route/generation substitutions,
and alternate limits are denied. Unknown and downgrade versions are denied.

The adapter verifies the snapshot with `configsnapshot.Verify`, then uses actual
`configconsumer.Apply`, `Capture`, `Snapshot`, `Resolve`, `Close`, `UpdateTrust`,
`Restore`, `CurrentAck` and encrypted `DiskLKG`. One adapter mutex stages sidecar
and snapshot together and captures their pair atomically. Rejected candidates
retain the prior authenticated pair. Snapshot replay floors and retention stay
owned by the real consumer. A recovered snapshot without its authenticated exact
sidecar never admits; sidecar retrieval/pair durability is not implemented as a
production distribution protocol. Trust bundle expiry/key retirement applies
to new captures immediately; already captured operations retain their lease,
consistent with Module03 semantics, until normal completion/cancellation.

## Executed Controls

Attempt03:6 top-level/42 subtests PASS under Go race instrumentation, zero skips.
The compiled test binary uses the feasibility tag; its SHA256 is in the receipt.

| Control | Actual result |
| --- | --- |
| Signed finite tenants A/B |200; correct signed tenant/generation/body hash; verified origin certificate; exactly-once completion control |
| Bootstrap without profile |503; zero customer-origin handlers |
|27 sidecar mutations |Denied; prior generation7 remains captured; includes streaming, cross-tenant, replay/downgrade/domain/signature and resource substitutions |
| JWT missing/tampered/expired/future/issuer/audience/kid/cross-tenant |401; no new customer-origin handler; required auth remains true |
| Unknown SNI / Host-SNI mismatch |TLS refusal /421 before customer-origin dial |
| Wrong origin TLS hostname |502; no customer-origin handler; verification retained |
| CL10/abc then valid seven-byte completion |No admission capture/handler during synchronized150ms prefix; complete body200 exactly once |
| CL10/abc EOF, folded header, late folded trailer |400; no additional customer-origin handlers |
| Captured request across rollback |In-flight200 stays deployment7/resource7; following request200 deployment9/resource7 |
| Cancellation across update |Client close cancels customer-origin context and releases capture; generation10 subsequent request200 |
| Concurrent captures/cancelled rollback |Four readers race updates; no mixed generation/policy/pool; cancelled update denied; newer rollback9/resource7 wins |
| DiskLKG, provisioning floor, stale/expired profile |Actual encrypted recovery succeeds; missing sidecar/below-floor recovery and stale/expired admission denied |
| Shared root-authenticated key rotation |Old key snapshot/sidecar captures denied after retirement; new-key generation8 captures; expired bundle denied |

Normal Module03 race binaries all exit0 with real isolated fixtures:

| Package | Top-Level / Subtests / Skips |
| --- | --- |
| configsnapshot |14 /50 /0 |
| configconsumer |16 /15 /0 |
| configpublish |5 /7 /0 |
| configrollout |11 /18 /0 |

These unchanged suites include actual mutual-TLS artifact fetching, root/key
rotation, encrypted LKG/recovery/drain, PostgreSQL durable rollout/CAS/audit,
canary security-pause/newer rollback and JetStream mTLS/durability/restart.
The B adapter does not claim a new sidecar canary distribution system. Tagged
`go vet`, gofmt, pinned Prettier3.9.10, Node syntax and scoped whitespace pass.
Verify01 binds47 artifact hashes, all listed source hashes and actual source
tree, normal-build exclusion and all11 protected files before/after. Private
fixture values, JWT strings and PEM private keys have zero matches in captured
streams. Root/F full security scans and final integration/hosted gates are separate.

## Limits And Stop

The unchanged05D finite TLS front has static test routes/generation1 to a fixed
loopback Go admission service. It validates original Host/SNI before that hop.
The Go service verifies its own distinct TLS SNI, then trusts that owned
front-to-admission fixture boundary for original Host/SNI consistency; it cannot
independently recover the original client SNI. A direct trusted-loopback caller
is therefore outside the demonstrated external ingress boundary. JWT and signed
profile validation occur after finite staging and its internal admission-hop
TLS dial. Zero customer-origin effects for denials do not mean zero internal
hop bytes/dials. Generation capture begins at Go admission, not TLS handshake
or original header arrival. A collection of these hops is not an eligible
single-boundary production gateway. New06A A runtime is not combined here.

JWT keys/issuer are provisioned in process for disposable tests; maintained
ES256/kid/iss/aud/exp/nbf/iat validation is exercised, but JWKS discovery, refresh,
revocation and complete Module06 authorization are not implemented. Bearers are
never logged or forwarded to the customer origin. Signed HTTPS origin URLs are
not SSRF authority: the fixture maps only two exact approved URLs to two owned
loopback sockets, pins expected TLS DNS names/CA and never follows redirects.
Public origin DNS/rebinding/dial-IP policy and production private-connect remain
unimplemented and cannot be inferred from these positives.

Strict finite limits are the fixed05D transport profile, not flexible tenant
quota support or A's cgroup/resource proof. Streaming/WS/gRPC remains unsupported;
there is no early-progress PASS or original-contract repair. No raw bearer,
private key or user body is retained. Reported body digests refer only to small
synthetic fixture bodies. No throughput, resource capacity or production custody
claim, contract activation, public endpoint test, push or merge is performed.

## Agent Completion Report

- Module: Sprint06A B, Module01/03 local feasibility.
- Status: complete scoped implementation/evidence; independent review pending.
- Commits/files:00d5f61 source;702324a collector fix/retained failure;260dc7f final source;ce5e803 retained final run; B-owned hook/package/scripts/evidence/report only.
- Architecture/ADR decisions: none; research hook authorization only.
- Contracts changed: no accepted snapshotv1 or effective acceptance contract.
- Positive tests: exact locked commands above, attempt03/verify01 exit0;6/42 new and46/90 Module03 race checks, zero skips.
- Security negatives: sidecar/JWT/tenant/TLS/EOF/fold/stale/replay/rotation/floor/cancellation controls above; all asserted denials pass.
- Performance: not measured; no capacity claim.
- Known blockers: multi-hop original-SNI boundary, post-staging capture, production auth/SSRF/distribution/custody and full ingress remain unproved; Module01 NO-GO.
- Human review needed: F/root source/evidence review; named architecture/security decisions remain PENDING.
- Next unblocked modules: none; root may integrate compatible research sources and run final gates without changing runtime eligibility.
