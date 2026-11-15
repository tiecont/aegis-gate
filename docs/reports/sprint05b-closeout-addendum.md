# Sprint 05-B Integration Closeout

Sprint05B scoped engineering delivery is COMPLETE. This addendum records the
actual delivery after the measured completion report and supersedes historical
pending integration delivery fields. It changes no security assertion or gate
requirement. The closeout PR's own metadata remains separately verifiable.

## Exact Delivery

- Integration PR: https://github.com/tiecont/aegis-gate/pull/19.
- Final independently reviewed head: `fe659f98422106123e845bb2fcf01ba4996f907c`.
- Integration main merge: `dd445fda3d6989fdb50cca13d641571eecfcdc29`,
  merged 2026-11-15T03:10:30Z.
- Head and merge tree: `3be882edad4fb31984166ed4a577328fe338ba26`;
  no source delta between the accepted head and merge.
- Exact final-head hosted run `43669783439`: foundation-quality PASS,
  job `132677048002`; supply-chain-security PASS, job `132677047847`.
  Intermediate run `43633078400` also passed but is not final-head evidence.
- Exact integration-main hosted run `43671151410`: foundation-quality PASS and
  supply-chain-security PASS; both complete on `dd445fda3d6989fdb50cca13d641571eecfcdc29`.
- Full local tested source: `7725063dd65e07d26b7579f428a29424e1f8f4f8`, tree
  `dcc33021cbac83a1f106b95d9ddd18ca5dfb1386`. Locked `make check`,
  `make security-scan`, teardown and volume removal all exit 0. Source-bound
  receipts, scanner results and cleanup are in `evidence/sprint05b-root/gates-02/`.
  The failed gates01 is preserved separately, with explicit sanitized provenance.
- Independent F checkpoint `1d8769b`, final source/local-gate acceptance
  `32ed751`, and external final-head/hosted acceptance permit this non-production
  tooling/evidence integration only. The accepted head incorporates the review
  artifacts without changing the reviewed parser, fixture or protocol source.
  Post-merge independent receipt acceptance is recorded separately after review.

GitHub raw run/jobs/merge receipts are retained under
`evidence/sprint05b-root/pr19-*`, collected after the observed events with actual
source/tree, argv, tool identity, exits, output sizes and SHA256. Receipt commits
follow the observed source; none invents a self-referential commit hash. The
receipt-only closeout PR has its own hosted checks and does not replace the
integration-head/main verification.

## Measured Outcome

The maintained llhttp 9.4.4 incremental in-process N-API binding is implemented
and independently reproduced. It has bounded state and feeds, no parsing
subprocess, exact historical folded-input rejection, fragmented input, EOF,
pipeline, valid target, trailer, limit and cancellation controls. Its finite H1
admission fixture observes zero origin effects for the folded negative. This is
a narrow parser/admission capability, not a complete eligible ingress runtime.

No original assertion is newly repaired in the combined Envoy candidate:
**73/75 original cases and 19/23 supplemental probes**, unchanged from Sprint05A.
Obs-fold still forwards 263 bytes to one handler. The original H2 identity case
still records `000000040100000000`, nine SETTINGS ACK bytes on a reused valid
origin connection with zero handlers. Those bytes remain a FAIL. The two
userinfo/deadline assertions and two missing peer error-frame assertions remain
FAIL. Peer RST_STREAM attribution and causal SETTINGS-only controls clarify the
runtime stop without subtracting bytes or changing observation windows.

Independent streaming proof records 1,049,201 origin bytes before rejecting a
late folded trailer when a valid prefix is streamed. Finite staging avoids
those effects but waits for completion. Neither design satisfies the complete
streaming/admission contract. This is a scoped executable counterexample, not
a universal HTTP/2 impossibility claim or permission to revise ADR012.

Real Module00/02/03 regressions pass, including independent serial-package race
execution: 11 packages, 89 top-level tests, 151 subtests, zero skips. Contracts,
dashboard, TLS/credentials, image/restart/stale-volume and tenancy/configuration
negatives pass. Test error reporting removes callback URLs. TCP fixture readiness
and package scheduling improve isolation without altering assertions, deadlines,
product locking or internal concurrency. Natural lock observations do not prove
the cause of earlier HTTP timeouts. Dependency pins and scanner policy remain.

| Gate | Disposition |
| --- | --- |
| Module00 | PASS local |
| Module01 | NO-GO |
| Module02 | PASS local |
| Module03 | PASS local |
| Modules04-12 | LOCKED |
| Production | BLOCKED |
| ADR012 / human architecture and security owners / approval | PROPOSED / PENDING / PENDING |

All six remaining original failures are rejected by independent review. No
production runtime boundary, private codec fork, parser waiver, TLS weakening,
external publication or locked-module implementation is accepted. Evidence-
referenced worktrees/branches are preserved; owned disposable fixtures and private
material have cleanup receipts.

The next implementation needs a maintained complete ingress admission boundary
with an explicit executable late-trailer/streaming strategy, and a new supported
H2 lifecycle mechanism that removes the original nine-byte interval while
preserving valid reuse. The four supplemental response/frame contracts also
need actual unchanged-assertion repairs. Repeating the disproven pool/flush
settings is not justified. A future GO still needs unchanged75/23, complete
TLS/identity/configuration/resource proof, independent reproduction, local/hosted
gates and recorded affirmative human architecture/security approval.
