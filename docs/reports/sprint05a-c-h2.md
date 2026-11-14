# Sprint05A C: original H2 zero-byte gate remains failed

Status: bounded implementation/reproduction COMPLETE; H2 repair NOT FOUND.
Module01 remains NO-GO, Modules04-12 LOCKED, production BLOCKED. No acceptance
policy, observer, baseline test, evaluator, TLS verification or production code
was changed. This is an Agent C handoff to `/tmp/aegisgate-05a-root`, not an
independent review or human architecture/security decision.

## Measured result

All six completed unchanged-original75 runs scored **69/75**. The original
`HTTP2-authority-Host-and-SNI-confusion-rejected` assertion failed in every run:
**9 decrypted origin bytes, 0 handlers, 0 parser errors**. Five passive captures
show exactly `000000040100000000` on the already established origin connection.
This is an H2 SETTINGS ACK; its SHA256 is
`a9fd441cc14ae4b467f3ea0a0ed70de71bb5834db34815eca9cceb70017adfd6`.
It remains a failure, with no subtraction, exclusion or causal exemption.

| Evidence directory | Supported strategy | Original75 | H2 bytes |
| --- | --- | --- | --- |
| recovery-01 | Import unchanged recovery-config, retained original H2 Host | 69/75 | 9, raw ACK |
| windows-01 | Both hops: stream/connection windows65535, HPACK table0 | 69/75 | 9, raw ACK |
| identity-01 | Windows plus explicit retained-Host check before router | 69/75 | 9, raw ACK |
| partition-01 | Identity plus per-downstream H2 pool partitioning | 69/75 | 9, raw ACK |
| bounded-02 | Identity plus H2 max requests per connection32 | 69/75 | 9, raw ACK |
| windows-plain-01 | Windows; no passive tap/import at all | 69/75 | 9, original counter |

The other five original failures remain visible: invalid Transfer-Encoding,
obsolete folded header, repeated chunked, chunked not final, and supplemental
repeated TE fields. This work does not combine with A/B work or claim73/75.

## Implementation and source findings

All additions are named `sprint05a-c-*`. The policy imports recovery-config;
the launcher preserves loopback-only listeners, verified origin TLS, generation
specific clusters, bounded streams/connections/queues, streaming, immutable
cluster names and restricted containers. No pooling disablement, request timing
delay, response buffering or observer-counter relocation is used. Partitioning
and bounded32 still permit multiple requests and concurrent streams per pool.
The identity variant checks retained `host` in the existing per-SNI chain before
router admission, in addition to the baseline authority check. It does not claim
access to raw pre-normalization header provenance.

Released Envoy1.40.2 is pinned by image
`envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded`
and source `b2d89e0ae53916f28770771fbdd49c5c99c5c5a2`. Retained bounded excerpts
and complete-source hashes are in `evidence/sprint05a-c/source-02/`:

- `protocol.proto:592-631`: HPACK0 is supported; H2 initial stream and connection
  windows have minimum65535. These are receive/buffer settings, not an ACK gate.
- `protocol.proto:405-409`: max requests1 effectively disables keepalive;32 was
  used instead. The H2 limit is approximate with concurrent streams.
- `protocol.proto:730-748`: custom SETTINGS cannot collide with named settings;
  no inspected documented setting suppresses peer SETTINGS acknowledgment.
- `codec_impl.cc:1817-1872`: settings are submitted to the maintained adapter;
  the initial connection window only conditionally adds a WINDOW_UPDATE.
- `cluster.proto:1323-1325`: separate per-downstream connection pools are a
  supported option. `http2/conn_pool.cc:17-38` bounds initial streams against
  max requests. The common pool source retains stream accounting/drain logic.

These source/API findings plus the measured variants establish failure of the
tested strategies, not a theorem about every Envoy option or future release.
No private codec, production raw parser, extra proxy boundary or protocol
downgrade was introduced.

## Controls and limitations

Completed lifecycle runs `lifecycle-windows-03`, `lifecycle-partition-02` and
`lifecycle-bounded-02` each passed7/7: cold denials without origin TCP accepts,
TLS relay connections or
bytes; six valid sequential requests using one H2 connection; eight concurrent
streams using one H2 connection; warm denied requests with all bytes retained;
route pool separation; old-generation in-flight completion with a new pool for
generation2; retired CA rejection without old-pool reuse and recovery in a newer
generation. The trust-negative transport error is expected and recorded.

These are extra diagnostics, not timing replacements: warm denials follow six
requests and concurrent traffic, so the initial ACK may already be consumed.
The unchanged original test still fails. The diagnostic userinfo client can
end with native RST8 and no response; that only supports its no-origin-effect
observation, not the original required400/421 assertion. Fixture generations
are not a Module03 signed-snapshot integration proof. No complete HPACK/causal
attribution or resource-soak proof is claimed.

All six original runs also pass the existing ALPN, H1/H2 body streaming,
WebSocket, gRPC streaming/trailers/cancellation, certificate rotation, invalid/
replay snapshot retention, invalid certificate config retention, wrong/expired/
untrusted origin TLS, trust-store retirement, H1 reuse and route pool controls.
The passive tap duplicates bytes at TLS server events, without replacing the
original observer or callback. Test-end offsets yield the exact ACK interval;
original counters are authoritative. The separate plain run has the same9-byte
failure, without that instrumentation. No timing-sensitive stability claim is
made beyond these completed runs.

## Exact commands and evidence

Working directory `/tmp/aegisgate-05a-c`; Node is
`/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node` (v26.13.0).
For the commands below set `NODE` to that path. All runtime fixtures serialize
from setup through capture, evidence hashing and cleanup under the shared lock.
Dependencies were installed from the unchanged Pingora lab lockfile using
`npm ci --ignore-scripts --no-audit --no-fund`; no dependency files changed.

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-c-run.mjs evidence/sprint05a-c/recovery-01 recovery tap
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-c-run.mjs evidence/sprint05a-c/windows-01 windows tap
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-c-run.mjs evidence/sprint05a-c/identity-01 identity tap
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-c-run.mjs evidence/sprint05a-c/partition-01 partition tap
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-c-run.mjs evidence/sprint05a-c/bounded-02 bounded tap
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-c-run.mjs evidence/sprint05a-c/windows-plain-01 windows plain
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-c-lifecycle.mjs evidence/sprint05a-c/lifecycle-windows-03
AEGIS_SPRINT05A_C_POLICY=partition flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-c-lifecycle.mjs evidence/sprint05a-c/lifecycle-partition-02
AEGIS_SPRINT05A_C_POLICY=bounded flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-c-lifecycle.mjs evidence/sprint05a-c/lifecycle-bounded-02
"$NODE" spikes/envoy/sprint05a-c-source.mjs evidence/sprint05a-c/source-02
flock /tmp/aegisgate-sprint02-fixtures.lock "$NODE" spikes/envoy/sprint05a-c-verify.mjs evidence/sprint05a-c/verify-02
```

Use fresh output directories for reproduction; receipts are immutable. The
outer original-run collector exits0 on complete capture; original75 and the
unchanged evaluator each exit1 because of the six mandatory failures. All
three eligible lifecycle collectors and final verifier exit0. The verifier
executes syntax checks for every C source, `extract-baseline.mjs --check`, and
the unchanged observer/contract/evaluator tests (7 passed,0 failed). It verifies
each original receipt source hash against its exact committed git object and
each eligible evidence manifest. Protected baseline objects equal `8e77a4f`;
inventory SHA256 is
`4fb93b05f5fcd796bedafcc8a7bb5154e9ab7b2f2c4f046a878e83a934483662`.

Failed history is retained. `lifecycle-windows-01` hit an undefined response
for a native reset and then a missing spawnSync import during cleanup. It is
not eligible proof; `cleanup-recovery.json` records locked fixture recovery.
`bounded-01` measured69/75 but its collector stopped a remaining owned container
and asserted absence before Docker removal completed. It is also not eligible;
its locked recovery receipt is retained. The corrected collector waits up to5s
for removal. Completed reruns have absence/fixture removal receipts, and final
verification found zero C containers or C fixture directories. Source01 retained
an empty pool excerpt because its match patterns missed actual symbol names;
source02 retains the corrected excerpt without overwriting source01.
Earlier successful lifecycle receipts and verify01 are also retained. The final
lifecycle revision adds a separate TCP-accept counter, so cold no-dial proof
does not rely solely on successful TLS connections.
`git diff --cached --check` flags preserved raw stderr CRLF/blank lines and
official source excerpt whitespace. Those observations remain byte-exact;
the authored C source/report whitespace check passes. The final checks receipt
retains both outputs. Full integration `make check`, security scan, hosted CI
and independent reproduction belong to root/F and were not run or claimed here.

## Exact source and evidence hashes

Source was committed before runtime proof. Recovery/windows use source commit
`e17c5fab6c52687e7f85997f88615ce8d1545fb2`, tree
`6bcc6a4107ad6f482d0fd21238b14da0b7c23481`; identity uses
`48f42f8d99b8ff999b655c102c62c928e694624e`, tree
`b666e5a7c52066904d9aaa742118a36739128d63`; partition uses
`823da03101e69814d0312484a57fffca0a830fa6`, tree
`c5ac375f039bdb932b6aaa35f81d2f8fa45723cb`.
Bounded02/plain runs use
`12500ceca2b689f6352fb246597e5b04ee928759`, tree
`2c882f90ba427a45de9b6d7bc16970e68bfd8e1c`.
Final lifecycle and executable verification source is
`b3f2f73d2c119fb59e6258e34a8cc5608c0f9638`, tree
`931ac74123753db693733c5607e7dff451ac7e32`. This report/evidence commit follows
those sources; no candidate implementation changed after eligible proof.

| C source suffix (.mjs) | SHA256 |
| --- | --- |
| config | 0b6beb2550917a435f00038ce5951a78f9805965b98ece58806580cfa7a07e8b |
| launcher | 140a6ce76a5ad4856f1c9b147ca215747e5b87e656834f1bc0d05484fb0ae0f7 |
| lifecycle | b2239786cbcc767c137876ffe460de01420b3979a7d991959a6fefcf82b7c7d4 |
| run | e2942b24804059728f2c8cc37f2675edcae10f7bdc618f5d59e14e0ed3fc575e |
| source | 1bb335edf18be8420820fb34d84c187e16656869b8a3a94c4779f6da2f522bf8 |
| tap | 19a78e0eb422cb7cd8f986557bcad3ede4198dfeeeebaca61fcca4f45da27604 |
| verify | 4cac6880b360e6488b02eaddafa99ddb1d3bf1e86a1b007455f8e3f7a2f1b1f7 |

`verify-02/receipt.json` SHA256:
`e1a17daad352d104715ef0cc9099d9e7fa302ae6170351b6874861c0bf0fa235`.
It enumerates every eligible run source/tree, receipt hash, manifest hash, exact
negative and raw bytes. `verify-02/SHA256.json` SHA256:
`5f62d69f98bac01f53f3e26f41aa180f06972f6b30d59b6ba466eb838915430f`.
`source-02/receipt.json` SHA256:
`47592b4ec9ebca7c2c59303d8bd1fc0b9f10dcb3ed273d2d71b4163db048a13a`.
`source-02/SHA256.json` SHA256:
`5bcd6a029bd288d92c533b6f4498366559c22115d080a6197c3cec3895d03b3d`.
The package-level `evidence/sprint05a-c/SHA256.json` covers retained history and
the report as well; it intentionally excludes itself. No private fixture key,
token, fetched HTML, push, merge or additional worker is included.

## Agent Completion Report

- Module/status:01, Sprint05A C experiments complete; mandatory H2 repair blocked.
- Commits/files: additive C policy, launcher, passive tap, locked runner,
  lifecycle/source/verifier, report and retained evidence; source commits above.
- Architecture/ADR decisions: none changed; aggregate zero bytes remains binding.
- Contracts changed: none. No production implementation or signed config adapter.
- Positive tests: six original runs retain valid controls; lifecycle21/21;
  verifier syntax/corpus/object checks and unchanged observer suite7/7 pass.
- Negative tests: all five supported variants fail the exact original H2 gate;
  plain no-tap control agrees. Raw ACK is not a security PASS.
- Performance: original lab records its benchmark profile; no comparative
  performance or capacity claim is made from this bounded diagnostic work.
- Known risks/release blockers: original six Envoy failures, unproved broader
  strict-ingress/resource scope, independent review and human decision pending.
- Human review needed: existing architecture/security gates, not an implied waiver.
- Next unblocked work: root/F may reproduce exact committed C sources and
  independently verify the scoped failure conclusion. A/B work remains separate;
  Module04 stays locked. A different supported lifecycle mechanism would need
  fresh unchanged original75 proof before any repaired claim.
