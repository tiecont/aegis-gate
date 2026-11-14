# Sprint04-C additive closeout receipt

This addendum supersedes hosted/merge pending fields in Sprint04-C checkpoint
reports. Historical receipts, failed attempts and scoped verdicts are retained.
It does not assert a hash for the commit containing this document.

## Accepted integration and hosted gates

- Baseline main: `a325b9ecc086e09467f61b49f17da241bf8e43ea`.
- [PR15](https://github.com/tiecont/aegis-gate/pull/15) merged at
  2026-11-14T12:02:35Z as `f7d3134d59f1d1213580b8ee120d6187ae83a78b`.
  The merge API was guarded against reviewed head
  `9e809d4328e7d7645648161c601e7c45998d72f6`.
- Head and merge have identical tree
  `3c9698678301f840bbcd4eb6a40ab13496f13919`.
- Exact head [run43583949148](https://github.com/tiecont/aegis-gate/actions/runs/43583949148):
  foundation-quality132414357057 PASS;
  supply-chain-security132414357247 PASS.
- Exact merge [run43592857907](https://github.com/tiecont/aegis-gate/actions/runs/43592857907):
  foundation-quality132441089640 PASS;
  supply-chain-security132441089538 PASS.

Raw final-head, premerge, guarded merge, merged-PR, merge-source and final-main
API receipts are under `evidence/sprint04c-root/pr15-*`. Each new receipt records
source/tree, invocation, tools, times, exit status, raw streams and SHA256 hashes.
Earlier intermediate and cancelled runs remain historical, not final-head proof.

## Local gates and independent review

Full local gates ran on clean source
`dd5b48441982bf76a53982a16c53b948e59b175e`, tree
`616cd569b30c022eff47b4e7bbfdbdbe6e48362d`, from
2026-11-14T09:41:43.541Z through 09:47:06.270Z under one complete fixture-lock
lifecycle. `make check`, `make security-scan`, `make dev-down` and dedicated
volume teardown all exit0. Project containers/networks/volumes are empty;
eight owned private paths are absent. The56-entry manifest, eight command
streams and26 scanner stages are retained in
`evidence/sprint04c-root/gates-01/`. No scanner waiver or finding suppression.

F component acceptance covers A/B/C/D and corrected E2126778, with exact-source
review and retained limitations. F's independent gate binding at
`ca10abdfe6b5e604c5761c3d7786ddb90723ba74` accepts tested-source equality,
gate receipts and locked cleanup inspection. The extended source audit verifies
3,115 protected baseline objects and16 receipt groups/173 commands/346 streams/
295 source hashes. The committed F reports define their exact scope; acceptance
of research and diagnostics does not grant a runtime security GO.

The two documented ineligible omissions remain excluded: original E attempt01
stdout and its raw F scanner finding. Corrected evidence is complete; rejected
unpublished E5515913 ancestry is absent from PR15 and its merge. No omitted
artifact is described as a passing complete manifest. No evidence-linked
historical branch/commit is deleted during closeout.

## Decision and next executable work

Prepared A-F deliverables and the decision handoff are complete. Actual human
architecture owner, security owner, selected/approved contract, approval
reference and date remain **PENDING / not supplied**. ADR012 and its addendum
remain **PROPOSED**. Root recommends the original aggregate zero-byte contract
and maintained Envoy strict-ingress API research. No upstream draft is published.

No maintained released parser capability resolving provenance was established;
the separate HAProxy boundary remains an unexecuted design. Focused TE400 proof
does not change the original corpus score. Historical Pingora63/75, independently
reproduced Envoy69/75, historical Hyper70/75 and original supplemental16/23
remain the accepted results. All six Envoy and seven supplemental failures stay
mandatory. Original nine H2 SETTINGS ACK bytes `000000040100000000` still FAIL
aggregate zero-byte acceptance. Additive observer results remain incomplete
and cannot approve Option2 or waive that failure.

Resume candidate engineering only after an exact maintained RELEASED capability
demonstrably changes the historical failing behavior, or separately recorded
human authorization for a new-boundary PoC. Require targeted failures, unchanged
75 cases, all mandatory TLS/identity/protocol/stream/cancellation/pooling/config/
resource/dependency proof, independent reproduction and explicit human decision.
The handoff checklist is `sprint04c-human-approval-checklist.md`; engineering
coordination remains with root while actual human owners await assignment.

| Module/release | Final disposition |
| --- | --- |
|00,02,03 | PASS local; fresh regressions preserved |
|01 M0-PROXY-GO-NOGO | NO-GO |
|04-12 | LOCKED |
|Production | BLOCKED |

The receipt-only successor PR and its exact-head/main checks are identified by
GitHub metadata. Root verifies both required jobs before final reporting; that
metadata closes the receipt chain without another self-referential commit.
