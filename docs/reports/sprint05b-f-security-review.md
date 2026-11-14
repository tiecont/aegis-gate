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

## C: supplemental protocol scoped stops

**ACCEPT narrow additive diagnostics and scoped stops; REJECT all four failed
supplemental requirements.** Independently measured clean source
`fe92fc16b8b84f6670a778070a4583b0225ced56`; final package `0170010` changes only
the report and verify03 evidence. All C executable bytes are identical.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint05b-f-review.mjs c fe92fc1 evidence/sprint05b-f/c-01
```

Both the untapped original23 and separate verified TLS relay original23 return
19/23, raw exits1, collection exits0. Userinfo receives peer RST_STREAM1,
hex `00000403000000000100000001`, instead of required400/421. Relay connections6
and9 verify SNI=edge-b.test/ALPN=h2 and show no earlier client RST. Client
CANCEL8 appears only on connections11/12, in cancellation controls, with hex
`00000403000000000100000008`. No client cancellation is credited as rejection.
Raw HEADERS on stream0 and zero WINDOW_UPDATE have no received error frame
before peer close; unchanged zero-origin counters do not repair that failure.

The separate relay modifies diagnostic downstream transport and cannot replace
untapped timing/resource evidence. Both fresh runs preserve valid protocol,
uppercase/connection-header, backpressure, cancellation and drain results.
Locked six-round cleanup and fresh-source checks complete. Original75/23,
observers and deadlines are byte-identical to baseline.

Final C receipts15/16/17 record exact-root-launcher flush0/flush1s/header500ms
variants at19/23. Their original suite exits1, bootstrap setting bytes and
source/tree/hash bindings check. The settings show no supported repair; F did
not repeat every already failing variant. Pinned codec early-return/flush paths
support a bounded explanation but do not prove an internally queued GOAWAY.
Hidden/unimplemented validator or codec fields remain excluded.

## Evidence Integrity

Offline `scripts/sprint05b-f-audit.mjs evidence/sprint05b-f/audit-01` verifies
60 committed manifests,1,087 artifact hashes and2,632 captured-source hashes
across final A/B/C/D/E and root `fb4cc6a`, with zero errors. Each package's11
protected parser/corpus/evaluator/observer/fixture files exactly match baseline
`8758b1c`. Final A37f5439 vs measured95ded76, C0170010 vs measuredfe92fc1, and
Dd85d04b vs implementationeba8445 have identical relevant executable bytes.
This is offline integrity verification; it starts no fixture and grants no
semantic security PASS.

## E: regression collector

**ACCEPT narrow test-only collector and authentic retained evidence; REJECT an
independent full-regression PASS from F's first replay.** Final E source
`7755f7ae51d9a5e087c638371e41d8c2133e679c` changes no product or dependency
code. Its sole existing fixture edit expands the isolated project-name regex
from05A to05A/05B; no security assertion changes. E's original successful
attempt02 raw commands, all source/tree bindings and manifest hashes verify.

F independently strict-installs root/dashboard/spike dependencies, starts
disposable PostgreSQL/Redis/NATS fixtures and passes credential/TLS negatives.
The unmodified private-image integration then fails fresh PostgreSQL readiness
before race/config/dashboard regression execution. Raw failure, successful
volume/container/network removal and private-material removal are retained in
`evidence/sprint05b-f/e-01`. This is a failed replay, not a waived image gate;
F does not infer its cause from the generic readiness error.

```sh
flock -w 600 /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node scripts/sprint05b-f-review.mjs e 7755f7a evidence/sprint05b-f/e-01
```

Focused actual integration execution is queued separately. Root's full
`make check`/`make security-scan` must still pass and cleanup must verify before
integration delivery; neither the collector's addition nor this narrow review
grants those gates.

## Root Helpers And Integration

**ACCEPT scoped native diagnostic/cleanup tools and safe readiness diagnostics;
REJECT native resource eligibility and production acceptance.** Root source
`fb4cc6a` retains exact-image extraction provenance and acknowledges native
prlimit core0/nofile1024/cpu180 lacks Docker memory/PID/CPU cgroups and filesystem
isolation. B's independent extraction produces the same binary SHA256. Root's
launcher retains combined compiler, verified TLS, loopback listeners and
validated manifest generation. Its resource helper hashes the live executable
before reading `/proc` RSS; only additive observations import it. It changes no
original75/23 assertion or interval. candidate04's17 completed observations are
authentic diagnostics, not17 repaired security assertions.

Corrected container cleanup unions separate prefix inventories and requires
owned worktree mount paths before removal. The one-off root cleanup also
requires its exact historical container and known mount fragment. C's six-round
late-create inventory has an explicit finite observation limit. Native launchers
remain non-hermetic test processes: no cgroup isolation or indefinite orphan
cleanup guarantee is accepted. Failed cleanup receipts are superseded explicitly,
not silently rewritten.

Root `6173d1b` changes only failed private-PostgreSQL readiness diagnostics:
original60 probes and250ms sleeps/assertion remain; stdlib JSON selects fixed
State lifecycle fields plus an error-present boolean. It exports no Config.Env,
raw error text, container logs or private fixture values. This is diagnostic
evidence only and does not repair or waive a readiness failure.

Integrated source `4127839` independently passes `audit-02`:72 manifests,
1,200 artifact hashes and3,003 captured-source hashes verify with zero errors.
Every reviewed A/B/C/D/E executable and root helper matches its exact source
commit; all11 protected files match8758b1c. Product code, contracts, dependency
manifests, infra and scanner/workflow policy are unchanged from baseline.
Full gate/hosted/merge outcomes remain separate obligations; this acceptance
permits only safe testing/evidence integration.

## New Gate Findings

Full root `gates-01` at4127839 fails actual Go integration: transport OIDC
rotation/outage schema setup receives SQL57014 statement timeout and55P03 lock
timeout, and an admin OIDC callback times out. The security scanner continues
independently. Full delivery acceptance is withheld; no timeout or assertion is
weakened. Separate schema fixtures still share Store.Migrate's database-wide
advisory lock4122026002; concurrent package migrations are a plausible cause,
not yet a proven causal conclusion. Read-only lock sampling is queued with
focused E to record actual waiters/blockers before proposing test isolation.

The callback timeout exposed disposable code/state values through `url.Error`
in a private, uncommitted root failure log. F reported this promptly and did
not commit the values. Root test-only patch `de6265d` removes request URLs from
fixture error messages while retaining timeout causes. Independent clean-source
race test `TestFixtureHTTPErrorDoesNotExposeOIDCCallback` passes; F accepts this
narrow disclosure repair. It changes no request/assertion/deadline/TLS behavior.

Root `ff3f3fe` adds an explicitly sanitized derivative exporter for completed
gate evidence: structured URL query/userinfo redaction, original byte sizes and
SHA256, original receipt hash, derived receipt marking and new output hashes.
Source review accepts it for the known callback log scope. It is not a generic
secret scrubber, and the future exported artifact still requires validation.
Original failed exits cannot become PASS through export.

F `checks-01` at2af4bd6 passes five script syntax checks, repository formatting,
whitespace,255 retained F hashes and the disclosure sentinel race unit. System
gofmt failed the host's AMD64v4 requirement; pinned Go1.27.4 gofmt/build succeed.
The earlier600s shared-lock wait expired before starting any fixture and was
requeued; it is not an executed regression failure or a passed test.

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
