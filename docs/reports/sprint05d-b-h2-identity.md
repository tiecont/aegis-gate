# Sprint05D B: H2 userinfo supported API stop

Status: scoped investigation complete; **no supported repair found**. Both exact
original23 userinfo assertions still FAIL. Module01 NO-GO;04-12 LOCKED;
production BLOCKED. No runtime selection, authorization change or ADR approval.

## Experiment Declared Before Execution

| Field | Declaration |
| --- | --- |
| Failure | Original compound identity and individual userinfo require400/421; peer reset is insufficient. |
| Hypothesis | A released public validation/status hook might act before irreversible codec rejection. |
| Mechanism | Inspect the released error override, codec callbacks, UHV and local replies; execute a minimal baseline proof only if no supported hook exists. |
| Targeted input | Exact original23 compound and individual bodies, `:authority=user@edge-b.test`, native client, original deadlines/assertions. |
| Positive control | Exact individual Host/authority denials and encoded valid identity/pool reuse. |
| Stop | Missing supported precodec callback or reset without400/421 ends this repair path; no full suite, Go build or settings loop. |

## Released Source And API Boundary

Source is Envoy1.40.2 commit b2d89e0ae53916f28770771fbdd49c5c99c5c5a2,
bound to the pinned image and extracted binary. Ten fresh source/API downloads,
URLs, HTTP statuses, byte counts and SHA256 values are in attempt02/receipt.json.
The files below are retained there with `upstream-` and slash-to-`__` names.

1. TLS/SNI precedes HTTP. Existing config.mjs:103-112 binds the verified
   hostname filter chain and TLS1.2+; line152 installs tls_inspector. The
   diagnostic relay verifies certificate/SNI=edge-b.test/ALPN=h2; its raw
   traffic is forwarded without header rewriting. Verified origin identity
   is separately lab-origin.test/h2.
2. codec_impl.cc:2565-2581 allocates the stream on begin-headers; onHeader
   at2584 saves individual fields. A stream object is **not** evidence that
   complete headers reached HCM. onHeaders:1288-1351 calls decodeHeaders only
   after the adapter's header-block handling. This is the pseudoheader/authority
   boundary that filters cannot precede through public HTTP filter APIs.
3. protocol.proto:710-718 documents
   `override_stream_error_on_invalid_http_message` as choosing offending-stream
   termination rather than whole-connection termination. codec_impl.cc:1432-1475
   marks messaging-error reset state or returns callback failure. It provides
   no HTTP response/status callback. At1545-1639 stream-close processing raises
   reset callbacks. Prior05B C already verifies override=true for all variants;
   no toggle experiment was repeated here.
4. HCM conn_manager_impl.cc:1557-1594 receives complete decoded headers and
   invokes validateHeaders. Its UHV branch1433-1485 can send400 before the
   ordinary filter chain at1813. HTTP2 validator:362-376 delegates authority to
   validateHostHeader; header_validator.cc:282-292 rejects `@`. These source
   paths are **not a claim that UHV ran in this shipped binary**.
5. HCM proto:1093-1095 marks typed_header_validation_config
   `not-implemented-hide`; validator proto:34 keeps its extension hidden.
   config.cc:142-210 additionally gates factory creation on ENVOY_ENABLE_UHV
   and the runtime feature, and rejects extension configuration when omitted
   from the binary. Historical05A validator01 already records the shipped
   image's unsupported-extension error. A rebuild/private validator or enabling
   permissive parsing is outside this supported-hook task.
6. FilterManager sendLocalReply:1056 prepares and encodes a local HTTP reply;
   rewrite calls occur at1160/1205/1250. local_reply.cc:178 rewrites an existing
   response. Neither is a public interception point for an adapter reset before
   complete-header delivery. Existing Lua authority421 policy likewise needs
   decoded headers. Mapping a reply cannot manufacture a missing reply.

This establishes a precise **inspected-release/API stop**, not a theorem about
every Envoy release or an internal callback trace. The executable evidence is
the peer reset below; no internal callback instrumentation was added. A future
released, documented validation/error-to-status hook and exact targeted proof
would be new evidence. Another timeout/window/flush/codec toggle is not.

## Minimal Fresh Proof

Only five original probe bodies execute. sprint05d-b-select.mjs inserts one
name guard at probe entry; selection.json binds original and transformed source
hashes plus the exact insertion. Original files stay byte-identical. The
verifier reconstructs that transformation. This is **not** an original23 score
or original75 rerun. Historical73/75 and19/23 remain by reference.

| Selected original body | Actual result |
| --- | --- |
| settled-reuse-identity-and-three-authority-negatives | FAIL, userinfo peerRST1; two prior valid handlers and324 aggregate bytes belong to the compound body |
| individual-settled-Host-denial | PASS421, zero origin bytes/handlers |
| individual-settled-authority-denial | PASS421, zero origin bytes/handlers |
| individual-settled-userinfo-denial | FAIL, peerRST1, zero origin connections/bytes/handlers/parser/transport errors |
| valid-identity-and-pool-reuse-after-negative-frames | PASS, two encoded requests, same native origin connection, lab-origin.test authority/SNI andh2 |

Peer connections4/7 contain actual Envoy-to-client reset bytes
`00000403000000000100000001`, SHA256
902f528c71b3d55985510ee73256814dee0bdf71ce6320ad21bd0f6531f20185.
Neither has an earlier client reset or response HEADERS for that stream.
peer.json retains1,867 raw synthetic bytes, frame/chunk hashes and timestamps,
zero omissions. Offline decoding of retained chunks reproduces every recorded
frame. This additional verified TLS relay establishes peer origin; it changes
diagnostic transport and grants no original timing/aggregate-zero acceptance.
The existing origin observer retains all observed bytes, including controls;
no subtraction or rejection-interval shift was introduced.

## Execution And Integrity

Baseline aa289da; branch fix/sprint05d-h2-identity-status. Runtime source was
committed clean at62d8a90b7853d0c4f6789f54e8760580b4b47f9e,
tree97a6f019f04f763338a81235ff194659ba85f805. Node26.13.0 SHA256
0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b;
Envoy SHA2561d64506e25c1844f146162ddb2ece7010fa4e784faddb40a079021491f1f03cc.
The receipt verifies the original extraction receipt/image and actual version
reports1.40.2/Clean/RELEASE/BoringSSL. No rebuild or dependency change.

```sh
NODE=/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05d-b-run.mjs evidence/sprint05d-b/attempt-02
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05d-b-verify.mjs evidence/sprint05d-b/verify-01
```

Attempt01 exits1 before any probe: optional bazel/repository_locations.bzl
fetch returned404. Its ten successful downloads, error and cleanup are retained;
the optional fetch was removed at62d8a90. Attempt02 completes in6.1s with
collector0, selected child1, both protected checks0, version/OpenSSL/ldd0.
All fixture setup, source downloads, execution, cleanup and hashes hold the
shared flock. TMPDIR/private material uses disk-backed worktree .local;
listeners bind127.0.0.1 only; no public test endpoint. Cleanup finds no owned
process and removes private fixtures/native staging; .local is empty.

Verify01 at clean a09565d exits0:40 retained artifact hashes,302 committed-source
bindings,11 protected originals, exact single selection insertion, both resets,
raw frame replay, valid reuse and syntax/whitespace. Its exit0 verifies evidence
consistency, not runtime/security acceptance. Verify02 adds pinned Prettier3.9.10
and offline pinned Gitleaks source/evidence/report scans, each required to return
an empty finding array, plus observed host tool hashes. Its receipt records the
actual outcome separately. No repeated runtime run is needed for report edits.

Native prlimit core0/nofile1024/cpu180 does not provide memory/PID cgroups;
resource/runtime/security eligibility stayfalse. Full make check/security-scan,
hosted CI and independent F acceptance are not claimed by B.

## Agent Completion Report

- Module:01, Sprint05D B.
- Status:complete scoped source/API stop; requested runtime repair blocked.
- Commits/files: b2b9754 collector,1f20ba2 failed evidence,62d8a90 optional-fetch fix,a09565d measured proof/verifier; final report/scan receipts follow. B-owned names only.
- Architecture/ADR decisions:none; ADR012 stays proposed and approvals pending.
- Contracts changed:none; original75/23 inputs, evaluator, observer and deadlines unchanged.
- Positive tests executed:locked attempt02 three selected controlsPASS; protected checks0; verify01 integrity/syntax/whitespace0; verify02 outcomes in its receipt.
- Security negative tests executed:both original userinfo assertionsFAIL with peerRST1, individual origin0/0; no required400/421 repair.
- Performance data:not applicable; no benchmark/resource/capacity claim.
- Known risks/release blockers:no supported precodec status path in inspected release; strict-ingress and unchanged isolation gates remain unmet.
- Human review needed:F/root exact-source review; no human runtime approval inferred.
- Next unblocked modules:none; independent review and a concrete released supported hook are prerequisites to further candidate work.
