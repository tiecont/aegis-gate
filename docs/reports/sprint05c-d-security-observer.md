# Sprint 05-C Request-Isolation Observer

## Scope And Implementation

Question D is IMPLEMENTED/PASS for the bounded adversarial fixture suite and
UNRESOLVED for complete runtime attribution. This additive research tool cannot
replace the immutable original75/23 evaluators, change their intervals, subtract
control bytes or grant Module01 GO. The current all-byte requirement remains binding.

Source `c33bad9` adds the observer; `9d82c3a` adds live TLS, raw captures,
late rejection and lifecycle instrumentation; `b58e7bb` requires final request
decisions and a regular mode0600 external fixture-key file. Maintained
`golang.org/x/net v0.62.0` http2 Framer and stateful HPACK Decoder are unchanged;
Go1.27.4 standard-library HMAC/SHA256 authenticates ordered fixture events. No
custom production framing parser, codec patches or dependency changes exist.

Every signed event includes its sequence and previous MAC. Connection dials,
downstream/upstream stream bindings, verified TLS/SNI, tenant, generation,
handler dispatch, final decision, raw forward/reverse bytes, errors, close and
seal are checked. The key is passed separately, never trusted from the ledger.
The threat boundary trusts the fixture signer; a compromised trusted signer can
lie. No production proxy dispatch map is implied by a fixture signature.

Bounds: 256KiB aggregate decrypted wire capture, 2048 events and 2048 frames per
direction, 64KiB frame/compressed-header bound, 128 decoded fields/16KiB header
bytes/8KiB string bound, 4096-byte HPACK table. Raw captures and frame slices
retain SHA256 and hex including partial/unparsed tails. Stateful dynamic-index
references are decoded across blocks. HPACK history hashes describe decoder
input transitions, not exact internal dynamic-table mutation records: that API
remains opaque and is an explicit completeness limitation.

## Executable Proof

Run from committed clean source under the complete shared lock:

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go \
  test -race -json ./spikes/envoy/sprint05c-attribution -count=1
```

`evidence/sprint05c-d/adversarial-three/` records source `b58e7bb`, tree, exact
argv, Node binary hash, timestamps, exit0, raw Go JSON output and SHA256SUMS.
`adversarial-four` repeats the unchanged code at source8494aa2 with collector
`c3db637`, adding the actual Go binary and collector hashes to the receipt.
It is the final provenance-complete receipt, not a change to test semantics.
The live loopback TLS/H2 control verifies CA, SNI and ALPN, reads response/trailer,
records actual decrypted traffic through a wrapping net.Conn and joins reader
termination before final close/seal. A runtime check requires an ancestor to
hold the actual shared-lock inode. Test server/transport cleanup is deferred.
There are no external listeners, production credentials, retained private keys
or fixture resources after completion. HMAC keys are random in-memory fixtures
and never emitted. The JS unit wrapper incorporates the Go proof into normal
repository gates.

The suite exercises HEADERS without handlers, DATA on an existing stream, new
dial without HTTP request, partial HEADERS, missing CONTINUATION, HPACK-only
table-size activity, cross-tenant/trust-generation reuse, absent identity or
mapping, late mapping, duplicate mapping, handler/parser/transport errors,
dropped/reordered/tampered ledger events, wrong key, absent seal/close, capture
loss/overflow, missing final decision and late request rejection. Every forbidden
or incomplete scenario is ineligible for the bounded research PASS. Missing
attribution never becomes a benign control-frame exception.

The dual-contract control retains exactly `000000040100000000`: nine origin
SETTINGS ACK bytes. Current-contract bytes=9 and PASS=false. Only the separate
bounded fixture research result is true when complete and no request effect
exists. `module01_security_gate_pass` is always false. This diagnostic neither
reruns nor repairs the original historical H2 assertion.

Development preflights found a test-helper/type name collision (fixed before
source acceptance) and exercised a live control before adding its ancestor-lock
guard. Those preflights are not accepted clean-source evidence. The retained
adversarial-one receipt covers the earlier synthetic-only source; two adds live
TLS; three adds final-decision completeness; four binds collector/tool binaries.
Earlier receipts are
retained without relabeling their source or scope.

## Remaining Gaps And Gate Disposition

No complete Envoy downstream-to-origin authenticated dispatch association or
full dynamic-table mutation trace is implemented. No loss-proof system-level
capture authority, complete bidirectional H2 conformance engine or production
tenant/config integration is claimed. The signer must observe all effects;
cryptographic integrity cannot prove an honestly omitted event never occurred.
The live control validates one bounded H2 connection; it is not the original
candidate identity/concurrency/rotation matrix.

The late-rejection test retrospectively flags earlier dial/handler/frame effects
belonging to a finally rejected request. It does not prevent those effects or
resolve the streaming/late-trailer admission conflict. A future observer-backed
contract still needs independent review, complete proxy instrumentation and
recorded human architecture/security approval. Current Module01 NO-GO;
04-12 LOCKED; production BLOCKED. Independent F verdict remains separate.
