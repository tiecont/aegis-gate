# Sprint05B F independent security review

Review in progress. Module01 remains NO-GO, Modules04-12 remain locked and
production remains blocked. ACCEPT below applies only to specified additive
test tooling and evidence, never to a complete runtime or release.

## A: persistent llhttp admission

**ACCEPT narrow in-process parser/admission evidence; REJECT complete ingress
or streaming-runtime acceptance.** Independently clean-cloned code source
`95ded76883c7b550285df01139a642a7def24941` runs proof and verifier exit0:

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint05b-f-review.mjs a 95ded76 evidence/sprint05b-f/a-01
```

Released llhttp9.4.4 source hashes are checked before fresh native compilation;
344-byte parser/settings state persists across feeds. All714 split points and
six one-byte feed groups execute, with interleaved instances, EOF and native
byte/message limits. Both exact historical folded inputs return400 with zero
origin bytes/connections/handlers/errors. SP/HTAB folded late trailers also
return400/zero bytes on fresh and reused client connections. Encoded targets
and valid pipeline bytes are preserved; a valid-then-invalid pipeline sends
only the preceding valid request. The fixture is a bounded whole-message
HTTP/1 admission experiment; it lacks tenant/Host authorization and H2/WS/gRPC.

The corrected cancellation probe executes successfully. Raw command/receipt
and verifier output are preserved in `evidence/sprint05b-f/a-01`; all cleanup
counts are zero, including live parsers, sockets, listeners and allocated
staging. Observed maxima: four connections,128KiB aggregate slabs,32KiB staged
per connection and four queued requests. These are local observations and
assertions, not a sustained process-memory or resource-isolation guarantee.
The serialized128KiB disk experiment also completes; it does not solve the
late-trailer ordering conflict independently reproduced under D below.

## B: original H2 and causal ACK

**ACCEPT narrow test/evidence scoped stop; REJECT original H2 all-byte gate.**
Clean cloned `f7ce126ad3bf56762e18fe8c009566728530d339` independently extracts
the pinned image binary, verifies SHA256
`1d64506e25c1844f146162ddb2ece7010fa4e784faddb40a079021491f1f03cc`, and runs
the unchanged75/23. Results are73/75 and19/23, both raw exits1. Original H1
folding reaches one origin handler/263 bytes. The original H2 interval contains
exactly `000000040100000000`: SETTINGS ACK, stream0, flags1, zero payload;
origin counters are9bytes/0handlers/0parser errors/0transport errors. The
unmodified all-byte assertion remains FAIL. Offline B analyzer exits0 with
complete capture/no omitted bytes, exact frame identity and endpoint ordering.

The B collector exits1 as expected: its historical two Docker-only optional
resource diagnostics cannot inspect a nonexistent native container. The
completed original results, both helper failures and collection error remain
in `evidence/sprint05b-f/b-01`; no native resource PASS is inferred.

F's separate causal diagnostic launches the same B native binary/config and
uses verified loopback TLS. Cold mismatch yields421/zero origin traffic; two
sequential plus four concurrent valid requests share one origin connection.
After initial SETTINGS acknowledgment, an origin SETTINGS update alone causes
the identical9-byte ACK, with no downstream request, handler or new origin
connection. The next valid request succeeds on that pool. All four controls
pass; fixture, launcher and origin sockets are gone while locked.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint05b-f-review.mjs b f7ce126 evidence/sprint05b-f/b-01
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint05b-f-cause.mjs /tmp/aegisgate-05b-f/.local/sprint05b-f-sources/b-f7ce126ad3bf evidence/sprint05b-f/cause-02
```

F `cause-01` is retained as a failed diagnostic setup: the test attempted pool
priming on the cold-denial session, which correctly received GOAWAY. Corrected
source `662c788` uses a fresh session, as B's original causal collector does.
This does not alter the original75/23 or their observation intervals.

Pinned source corroboration is bounded: the released codec flushes generated
frames, the pool allows requests before peer SETTINGS arrive, and nghttp2's
normal SETTINGS receive path queues an ACK. Hidden codec selection and
window/keepalive settings establish no supported ACK suppression/barrier.
The trace identifies JS relay order, not kernel timestamps/internal scheduling.

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
