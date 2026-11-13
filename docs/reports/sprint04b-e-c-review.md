# Sprint04-B E C Independent Review

Verdict: **ACCEPT scoped protocol investigation** at exact C head
`71a3dc6381223d54fa8b23ecf84ff205e0b52ea6`, tree
`fa99ceeeccd961ee97b57159b8a3f2e6910b5b2c`. No blocking defect found in this
diagnostic/evidence scope. This does not accept a candidate or resolve the six
mandatory/seven supplemental failures. Module01 NO-GO,04-12 LOCKED, production
BLOCKED; zero-byte expectations and human architecture/security approvals remain.

## Provenance And Unchanged Expectations

Clean detached review source contains80 changed files, confined to additive C
report, evidence and five diagnostic/helper modules. Both attempt source trees
and all48 source hashes verify against their original Git objects. Each binds
227 retained historical files and seven immutable harness/observer/probe files,
equal to baseline `cbb5f71`. Four manifests verify:27/16 attempt entries and
3/24 verification entries, plus every command stream hash. Cleanup records hold
the fixture lock and retain no owned containers. C's first whitespace verifier
failure stays failed; the second source-only check leaves raw HTTP CRLF intact.

Fresh original75 names match retained original names exactly:69 pass and the
same six failures. Original23 names/failure set likewise remain16 pass/seven
failures. Original75 collector/evaluator and23 collector nested exits remain1;
collector completion is never a security PASS. Both17-diagnostic collections
explicitly set `semantic_security_pass=false` and label observation completion.

## Observation Review

- Four malformed raw H2 cases, immediate and settled: all origin
  connection/byte/HEADERS/DATA/handler/parser/transport counters are zero;
  peer close occurs before local cleanup and deadline. Immediate sees no
  frames; settled sees setup frames only. No RST/GOAWAY is present. Listeners
  are installed before writes, but zero origin activity or a close does not
  establish conforming error handling. Exact internal cause remains unresolved.
- Native userinfo: socket close precedes Node stream close/code8 and local
  teardown, with no response. Host/authority controls return421. Corrected
  source marks native socket wire capture unavailable, so local `rstCode=8`
  is not claimed as a peer-sent CANCEL. Raw settled setup-only evidence is
  separate. The old response-plus-end deadline label remains failed.
-8MiB: all8,388,608 bytes are produced by200ms, origin already closes normally
  before client cancellation; corrected `cancel_ms=null` and
  `cancellation_proven=false` are accurate. Earlier negative cancellation
  latency/native zero taps remain disclosed instrumentation errors, not proof.
-32MiB: final sample16,842,752 producer bytes versus16,777,216 DATA bytes on
  origin stream3, client receive window0 and readable65,535 bytes. Producer,
  relay, application/window and RSS measurements differ. The retained upstream
 16MiB window is a consistency explanation, not complete buffer attribution,
  fairness, leak freedom or steady-memory bound. Timing varies across runs.
- Incomplete response and partial-upload cancellation show bounded upstream
  closure and actual RST_STREAM2, not wire-preservation of downstream CANCEL8.
  Corrected raw reset hex matches stream3/stream5 and upload16,384 DATA bytes.
  C's measured response/upload/gRPC cancellation intervals are16.95/4.64/1.59ms;
  these are retained local observations, not E performance measurements or SLOs.
- WebSocket two-message echo/close1000 and gRPC two responses/trailer plus
  cancellation have independent local origins. gRPC relay data is correctly
  stored in `origin_wire`, distinct from native H2 origin counters. TLS
  identities, direction, connection/stream counters and resets are retained.

The additive relay uses verified origin CA/SAN/SNI, bounded connections and
frame/control summaries, and no payload rewriting. It does not preserve peer
IP, original TLS/mTLS session, segmentation or timing. Its decoder is a bounded
frame-envelope observer, not full HPACK/state validation or a production parser.
Native downstream wire capture remains unavailable; the transparent-relay test
does not erase that limit. No A proposed-contract observer acceptance follows.

## Independent Execution

Committed E verifier `eaf0d81`, clean exact C snapshot:

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04b-e/c-review.mjs /home/tiecont/Projects/aegis-gate-04b-e-c evidence/sprint04b-e/c-01
```

Exit0,2026-11-13T17:18:59.603Z-17:19:05.898Z. It independently executes the
immutable75 extractor, source whitespace, offline pinned source/evidence/report
secret scans and the following complete locked fixture lifecycle:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node --test spikes/envoy/sprint04b-observer.test.mjs
```

All three tests pass, none skipped: coalesced frame decoding, fragmented/bounded
control samples, and direct-versus-relayed verified H2 identity/encoded target/
body transparency. The last compares262,144 DATA bytes each direction, identical
request body SHA256, SNI/authority/path and certificate fingerprint. Raw output
and tool hashes are retained. E did not rerun full75/23 or the17 Envoy diagnostics;
there is no eligible runtime candidate to reproduce. Original failures remain.

`evidence/sprint04b-e/c-01/verification.json` SHA256:
`f9e9a789f454396cf0735ead0b8af6ff652b14942f2f7d95b46256ee68104031`.

## Agent Completion Report

- Module/status: Sprint04-B E C diagnostic review complete; exact head ACCEPT.
- Changes: E-only verifier/report/proof, no C edits or upstream publication.
- Decisions/contracts: none changed; full local/hosted root gates and affirmative
  human architecture/security decisions remain separate.
- Tests: provenance/hash/immutable checks, three independent relay tests and
  three offline scoped secret scans exit0. No capacity/conformance GO claim.
- Remaining: six mandatory failures, seven original supplemental failures,
  malformed close root cause, unavailable native trace, active WS/gRPC drain
  and resource proof. B and root integration/helper review remain next.
