# Sprint04-A B executable plan

Only additive test tools, evidence/sprint04a-b and the B report are owned here.
No engine, parser, candidate configuration, shared gate or corpus edits.

1. Verify pinned baseline manifest, raw/expected inputs and tracked sources.
2. Wrap the existing TLS observer with bounded per-connection observation;
   decode frame envelopes only in test code. Verify byte, identity, ALPN and
   TLS rejection behavior against direct/native controls.
3. Commit sources before proof. Run unchanged75 with the pinned Host-retaining
   Envoy; retain nested failures. Repeat with an additive import hook to expose
   frame identity without changing corpus/evaluator or byte accounting.
4. Run bounded cold/reused authority, malformed frame/header, cancellation,
   slow-reader, partial-header, stream/connection cap and termination probes.
   Hold the fixture lock through all child exits and cleanup.
5. Bind commands, exits, versions, source/evidence hashes and limitations to a
   report; retain failed attempts. Commit evidence/report separately.

Acceptance is honest reproduction and useful bounded observations, never a
GO decision. Setup/TLS/control frames, request frames, handlers, parser errors
and transport errors remain distinct; the zero-byte contract is unchanged.

Current continuation: restored old branch at256de386, created
test/module01-origin-boundary and rebased its nine commits onto origin/main
3e039408. Preserve historical evidence against original source objects.
Add a native H2 direct/observed authority/SNI/encoded-target/reuse control and
verify owned process/container cleanup before removing fresh fixture secrets.
Commit these sources, reproduce unchanged75/diagnostic75 and all bounded probes
into fresh attempt05, then write sprint04a-b-origin-boundary.md for root/E.
