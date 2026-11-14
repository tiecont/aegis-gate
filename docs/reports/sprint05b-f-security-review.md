# Sprint05B F independent security review

Review in progress. Module01 remains NO-GO, Modules04-12 remain locked and
production remains blocked. ACCEPT below applies only to specified additive
test tooling and evidence, never to a complete runtime or release.

## D: late trailers and streaming

**ACCEPT narrow counterexample/evidence; REJECT simultaneous strict zero-byte
late-trailer rejection and precompletion upload streaming.**

Independently executed clean source
`d85d04be36b74d4b7c1f541a06d45f48e4457c06` (same runner bytes as `eba8445`),
rebuilding parser `dbb21538888de1b72ec24e29ae6a00ff7feb1255` from released,
hash-pinned llhttp9.4.4. Exact command:

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint05b-f-review.mjs d d85d04b evidence/sprint05b-f/d-01
```

All six scenarios complete, child exit0; source stays clean. The streamed
folded-trailer scenario rejects with `HPE_INVALID_HEADER_TOKEN` after exactly
1,049,201 decrypted origin bytes and one handler. Full staging rejects with
zero added bytes, connections or handlers, but sends nothing before message
completion. Stream cancellation increments origin aborts; staged cancellation
never connects. The valid scenarios each deliver the full1MiB decoded body.

Each next scenario begins only after the previous upstream abort/close and all
tracked transport sockets close; consecutive before/after counters agree.
Verified TLS uses loopback only. Final receipt records removed fixture and zero
live native parsers under the shared lock. Evidence and independent wrapper
hashes are in `evidence/sprint05b-f/d-01/SHA256SUMS`.

This finite, serialized test does not establish production disk capacity,
partial-write recovery, sustained RSS bounds, concurrent spool admission,
streaming feasibility, or replacement of the immutable75/23 suites.
