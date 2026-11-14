# Sprint05A Agent A: Envoy TE Candidate

Measured unchanged75: **73/75**, four historical TE failures repaired in this
isolated candidate. The evaluator exits1 and `protocol_proof_pass=false`.
Obsolete folding and the original H2 zero-origin-byte failure remain FAIL.
Module01 remains **NO-GO**; Modules04-12 LOCKED; production BLOCKED.

## Sources And Scope

Immutable main is `541d1d915ce6a3b679dc3fed3ea0a98f908ce001`, tree
`89eff9430f2bb7044683eaf9e62e6657a7295a86`. Branch is
`fix/sprint05a-envoy-te-rejection`, worktree `/tmp/aegisgate-05a-a`.
Implementation source was committed clean as
`1626bf4249554dfc6a6721aa3a3702630a1ca50b`, tree
`208668e2931a8c300a8a9b393fd048f997573038`, before any runtime receipt.
Eligible final runtime attempt03 uses clean source
`ac18c5db473b9cb8952da93480560d7ffbfb0d31`, tree
`aafe3f99ed565478762804c90b633e5f4328ab63`.
Later verifier/report commits add no candidate behavior changes. Exact component
handoff head is the final branch commit, also reported in the CLI completion.

Read Sprint05A contract, operating/orchestration rules, Module01 instructions,
architecture, threat model, config and quality gates, and
[Sprint04C B proof](sprint04c-b-upstream.md) before implementation. No separate
A1-A12 task list was supplied in this session; the execution contract and user
request define this scope. No worker was spawned and no push/merge performed.

`spikes/envoy/sprint05a-a-config.mjs` imports `recovery-config.mjs`, which imports
the immutable original config. Every HCM receives the supported
`local_reply_config.mappers[].filter.status_code_filter` EQ501 =>400 mapping.
No body matching, codec string matching, raw parser, Lua TE scanner, dependency
change or private runtime fork. It applies to all local501 reasons, not only TE;
that intentionally broader local status policy needs independent review before
any acceptance. An actual origin501 is preserved by the runtime control.
`sprint05a-a-config.test.mjs` verifies both H1/H2 route chains and whole compiled
object equality after removing only the mapper. All baseline identity, TLS,
resource, routing, encoded target, pooling and hot-update policies remain equal.

The additive launcher retains manifest validation, CDS-before-RDS ordering,
SDS reload, strict origin CA/SAN/SNI verification, Host retention, loopback
listener and container limits (one worker,2CPU,256MiB,64PIDs,read-only,no caps).
Candidate name is `envoy-sprint05a-a-te`. It uses the existing released image:
`envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`,
Envoy1.40.2/BoringSSL commit `b2d89e0ae53916f28770771fbdd49c5c99c5c5a2`.
Node26.13.0 is `/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node`,
SHA256 `0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b`.
OpenSSL4.1.0,ws8.22.2,grpc-js1.14.7 are recorded. Existing lab dependencies
were linked through ignored `node_modules` directories; no package files changed.

## Measurements

Historical Envoy result was69/75 with six failures, retained by immutable
reference in Sprint04C B. Fresh focused baseline/candidate listeners reproduce
the four TE differences on the same fixture. The complete baseline75 is not
rerun here; the complete *candidate75* is freshly measured, unchanged.

| Original test ID | Fresh baseline | Candidate full75 |
| --- | --- | --- |
| `malformed-HTTP-invalid-transfer-encoding` |501,peer end,zero origin effects |PASS400 |
| `strict-ingress-TE-repeated-chunked` |501,peer end,zero origin effects |PASS400 |
| `strict-ingress-TE-not-final-chunked` |501,peer end,zero origin effects |PASS400 |
| `supplemental-repeated-transfer-encoding-fields` |501,peer end,zero origin effects |PASS400 |
| `malformed-HTTP-obsolete-folded-header` |Historical FAIL retained |FAIL:1 handler,263 decrypted bytes |
| `HTTP2-authority-Host-and-SNI-confusion-rejected` |Historical FAIL retained |FAIL:0 handlers,9 decrypted bytes |

Four exact requests are imported from the unchanged manifest/supplemental
sources, including all request-line,host,connection,body and CRLF bytes. In
order, their TE fields are `cow`, `chunked, chunked`, `chunked, gzip`, and two
separate `chunked` fields. Exact request SHA256 in that order:

```text
c9b39ca183e97c6c2f21ef486005d0fc92b07b55543db8361e4d227ac2986edb
896ca844f7a408f8e12304cf302b0c3ea31b94930b5923aa7f32d10f1e871d42
88c42d855422b7bb57f8691174d90be612a3e3073d59c1cfdd16af8de8d0df0a
0691db9909996eeb07d4ad4b06c79391c752ae060ea0d12dc793c4e43f68ddec
```

Focused proof has51 probes:32 TE (4 vectors x2 baseline/candidate x2 exact/
keep-alive x2 fresh/reused),2 actual origin501,7 methods(GET,HEAD,POST,PUT,PATCH,
DELETE,OPTIONS),3 valid chunked POST/PUT/PATCH,6 exact encoded targets and one
ordered two-request pipeline. All controls pass. Each reused probe first
requires a complete200 warmup on the same open downstream connection and
records warmup origin effects separately. Additional keep-alive diagnostics
change only the Connection header and are explicitly marked non-original.

All16 candidate TE diagnostics return400 and all16 baseline diagnostics return
501. No client FIN is sent. Every probe observes peer end/close before local
cleanup and the2500ms deadline; no timeout/local destroy/error. TE intervals
have zero decrypted bytes,new origin connections,handlers,parser errors and
transport errors. Largest TE elapsed observation including40ms settle is
1131.73ms. Exact original `assertRejected` is executed:16 baseline failures,
16 candidate passes. No custom weakened evaluator replaces it.

Origin501 remains501 on baseline and candidate with actual origin dispatch and
bytes. Valid chunked bodies reach origin as `abc`; all method names, six encoded
targets and pipeline `/first%2Fsegment`, `/second?x=%2520` are checked exactly.
The origin byte observer is a verified TLS relay before the native parser;
direct control captures exactly76/76 bytes. Both TLS hops verify CA and DNS SAN.

The unchanged full75 includes all functional and negative assertions, not just
the51 supplemental diagnostic probes. It exits1; unchanged `evaluate.mjs`
exits1 and lists precisely the two failures above. Folding sends malformed
traffic to an owned origin; H2's9 bytes are not subtracted as control traffic.
No fold/trailer or H2 policy repair is claimed. Original75/23, evaluator,
acceptance policy and every one of4003 immutable-main working blobs remain
byte/object-identical before and after proof. `extract-baseline.mjs --check`
and protected contract/evaluator tests pass. No original test/baseline edits.

## Verification Handoff

`checks-01` completes at clean source
`faecf2eab5ce447b6de50e7061410280b954fc7f`, tree
`39b6b6a70bbaa2a81c9a202a6aa30496a5998f45`, UTC
2026-11-14T14:10:06.078Z through14:10:22.691Z. All13 child commands exit0:
manifest extraction, config equality, six syntax checks, authored whitespace,
pinned offline gitleaks version and source/evidence/report scans. The verifier
also checks101 retained inventory files, command-stream hashes (four explicit
withheld exceptions), exact runtime-source Git/working hashes, full75 evaluator
result, unchanged historical TE bytes and all focused peer/counter assertions.
It confirms4003 baseline objects and cleanup, and the removed inspection blob
is absent from the local object store. `git fsck --connectivity-only
--no-reflogs` exits0; unrelated dangling objects are left untouched.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
 /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
 spikes/envoy/sprint05a-a-verify.mjs evidence/sprint05a-a/checks-02
```

This is the next available suffix; executed verification used `checks-01`.
Verification receipt SHA256 is
`c3ccece0122caf4ceb90d347082cddcba3a2fbe2966553e2b73ceef5de472efa`;
its `SHA256SUMS` is
`c297a19c96e07d06d7e8f6201b088e0ed4a7827a706a55fd451c3909a6a5413d`.
These component checks grant no independent F verdict or root/hosted gate.

## Reproduction And Receipts

From a clean checkout with the existing pinned lab Node dependencies installed,
choose a fresh output suffix; preserve the global lock for the entire command:

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock \
 /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
 spikes/envoy/sprint05a-a-run.mjs evidence/sprint05a-a/attempt-04
```

The runner checks full immutable-main object equality, records tools, invokes
focused diagnostics, then runs exactly `node spikes/edge-comparison/run.mjs`
with supported candidate environment (complete values in `commands.json`):
`AEGIS_CANDIDATE_NAME=envoy-sprint05a-a-te`, command=exact Node path,
args=absolute `sprint05a-a-launcher.mjs`, private absolute `AEGIS_RUN_ROOT`,
and candidate artifact hashes. It invokes unchanged evaluator on raw results.
Collection exits0 only when evidence is complete; the runtime/evaluator exits1
are recorded as failed protocol proof. No new75 security PASS is inferred.

Attempt03 UTC lifecycle is2026-11-14T13:51:35.881Z through13:53:53.420Z.
`commands.json` records exact source/tree,argv,safe env,tool identity,times,
exits,source hashes and raw stdout/stderr hashes. Principal SHA256:

| Artifact under `evidence/sprint05a-a/attempt-03/` | SHA256 |
| --- | --- |
| `commands.json` | `a74d2506659796624b8ab069c957a3c27b3689c3cd1a38c5d3dd8c5fff077d72` |
| `full75.json` | `6d49f4a513ea170995b9c2df95a1fe5620eef2f0768aa969399950471b03c232` |
| `focused.json` | `2c3093cd0a6dc89d0ea16d26af2b7ab368672cdf9edd5d3adc1c6fceeb4790c9` |
| `SHA256SUMS` | `89b3a08c10bddca22a9c08479f3bc18eb92ed16468ad191003d89d14ea437cfd` |

Evidence reuses historical packages by immutable reference. Attempt01 failed
dependency resolution before traffic. Attempt02 measured73/75 but is provisional:
initial cleanup collection retained unrelated container environment fields.
Those four raw streams and their unpushed Git objects were removed; explicit
withheld records preserve hash/size, not contents. They are ineligible evidence.
[Capture correction](../../evidence/sprint05a-a/CAPTURE-CORRECTION.md) records
the collector defect/removal; attempt03 collects candidate names/mounts only.
The verifier checks retained hashes, exact source blobs, original request bytes,
all16 closure/counter assertions, and absence of the removed local object.

Private PKI and generated fixture directories are removed while holding the
lock. No owned containers or newly created fixture directories remain; before/
after source checks and evidence hashes are within the same lock lifecycle.
No Compose network or public listener is created. Container identity/ports are
unique/dynamic; every proxy/origin listener binds127.0.0.1. The unchanged lab's
short reference workload runs only on these owned fixtures.

The full75 bounded benchmark completed with zero request errors/timeouts.
Its built-in candidate CPU/RSS samples cover the Node launcher only and are
ineligible as Envoy resource results. Separate actual Envoy/proc sampling is
retained: full75 PID612298,623 samples,peak RSS76439552 bytes,400 CPU ticks
over62340ms. These aggregate the whole functional lifecycle, not a capacity
benchmark. No SLO, fairness, sustained bound or performance ranking is claimed.

## Agent Completion Report

- Module:01/Sprint05A Agent A; scoped candidate and runtime proof complete;
  overall runtime NO-GO.
- Commits/files: additive `spikes/envoy/sprint05a-a-*`,
  `evidence/sprint05a-a/`, this report. Exact implementation/runtime sources above.
- Architecture/ADR decisions: none; affirmative human architecture/security
  approval PENDING. Supported integration only, no production implementation.
- Contracts changed: none; immutable75/23 and zero-origin-byte policy preserved.
- Positive tests: focused51 complete, config equality/protected tests/manifest
  pass; full75 gives73 passes, two retained failures. Exact commands/exits above.
- Security negatives: all four TE cases repaired on original full75 assertions;
  focused fresh/reused peer closure and zero origin counters; fold/H2 still fail.
- Performance: bounded local controls only; actual Envoy samples retained with
  launcher-only benchmark measurement limitation explicitly recorded.
- Known blockers: pre-normalization folding, H2 all-byte invariant, remaining
  mandatory protocol/resource/dependency gates, independent reproduction and
  human decision. Full `make check`/`make security-scan` and hosted jobs belong
  to root integration and are not claimed here.
- Human review needed: F independently reproduce exact sources/receipts and
  issue scoped ACCEPT/REJECT; root review the capture correction and broader
  local501 mapping policy. No reviewer decision is invented.
- Next unblocked action: root/F exact-source verification and integration review
  using this branch's final head; Modules04-12 stay LOCKED.
