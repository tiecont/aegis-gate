# Sprint05-A final integration closeout

Sprint05-A engineering delivery is COMPLETE in its scoped isolated feasibility,
test and regression boundaries. This addendum supersedes merge/hosted-review
PENDING fields in the checkpoint completion/status and component reports. It
does not supersede any failed security assertion or grant runtime approval.

## Exact delivery receipt

- PR17: https://github.com/tiecont/aegis-gate/pull/17, merged2026-11-14T17:00:05Z.
- Final reviewed head: `12b870eac50925e1b5e086617975069995129c95`.
- Final integration main merge: `581a609df8c3c3a0ce62d75f4f58fa6db8f76816`.
- Head and merge tree: `a4fe8e5d1286d7862e5817bf8d9fed2a464c5c07`; exact diff empty.
- Exact-head hosted run43617194188: foundation-quality PASS and
  supply-chain-security PASS. Earlier43616665413 was cancelled by the final
  evidence update; its interim foundation success is not final-head proof.
- Exact-main hosted run43618663914: foundation-quality PASS at17:03:37Z and
  supply-chain-security PASS at17:05:48Z,2026-11-14.
- Exact local source `c117d96a0216de301c2a8033e79edee21a936f4a`, tree
  `e47d07a6fcdd88c4d827e725bcd8abd263f648d9`: full locked check/security scan,
  teardown and volume cleanup all exit0; gates02 source/stream/hash and cleanup
  proof independently ACCEPTed at8ce5aef. Earlier gates01 remains rejected.
- Final exact PR-head source/receipt/hosted ACCEPT: independent3c9e666,
  `sprint05a-f-pr17-review.md`. Component/source/gate reviews dc669e1,c5cd051,
  8ce5aef remain scoped to their recorded commits and claims.

Hosted run/jobs/merge receipt groups are committed at
`evidence/sprint05a-root/{pr17-final-run,pr17-final-jobs,pr17-merge,
pr17-main-run,pr17-main-jobs}/`. They bind source/tree, safe command argv,
tool binary/version, timestamps, raw GitHub responses, exits and SHA256.
Their receipt commits5967d29/9d99305 follow the measured source and avoid a
self-referential hash. Subsequent closeout documentation/receipts do not
change the tested candidate or original corpus. The closeout PR's own final
head/merge hosted checks remain separately verifiable GitHub metadata.

## Measured outcome and retained blockers

The original75 improves from historical Envoy69/75 to independently reproduced
**73/75**: all four TE assertions PASS on unchanged expectations. Actual peer
close and zero origin effects are verified; genuine upstream501 remains501.
Obs-fold still sends263 origin bytes to1 handler. Original H2 identity negative
still records9 SETTINGS ACK bytes, hex `000000040100000000`, on a reused origin
connection. Five supported strategies and the no-tap control fail that exact
all-byte requirement. These are not repaired or waived.

Combined unchanged23 measures **19/23**. Two malformed-header H2 assertions
are independently reproduced repairs. Reduced windows bound the observed
8/32MiB paused producers to196608 bytes and preserve cancellation; historical
16/23 and independent fresh17/23 baseline variation are retained. The two
userinfo deadlines and two missing connection-error-frame assertions still
FAIL.17 extra controls are observation-complete, not alternate security PASS.

Unmodified released llhttp9.4.4 demonstrates pre-normalization header/trailer
fold rejection with zero origin effects in the bounded test-only adapter.
This is not a complete maintained ingress runtime or an authorized architecture
substitution. Whole-message buffering, subprocess use and missing streaming/H2/
identity/generation/resource breadth remain concrete integration constraints.

Actual00/02/03 integrations and security regressions pass with0 skips; strict
dependencies/dashboard checks pass. TS7 still fails supported peer resolution;
TS6 pins/minimatch override remain. Pingora's two unmaintained warnings remain
unsuppressed. No production monotonic floor service, Module04/10 runtime,
external publication, public listener or production activation was added.

| Gate | Final sprint disposition |
| --- | --- |
| Module00 | PASS local |
| Module01 | NO-GO |
| Module02 | PASS local |
| Module03 | PASS local |
| Modules04-12 | LOCKED |
| Production | BLOCKED |
| ADR012 | PROPOSED |
| Named architecture/security owner and approval | PENDING |

Existing worktrees/branches referenced by retained evidence remain available;
no broad Git/Docker cleanup removed historical proof. Owned disposable runtime
fixtures, credentials, containers, volumes and networks have recorded cleanup.
Rejected old04C local ancestry remains disclosed and excluded from publication;
unchanged scanners pass on the complete publishable ancestry, without ignores.

Next engineering action is a maintained complete strict-parser integration that
preserves streaming and unchanged admission requirements, plus a supported H2
lifecycle mechanism that actually passes the original zero-byte interval.
Resolve the four remaining23 assertions, then require unchanged75/23 and full
TLS/identity/config/cancellation/pool/resource proof, maintenance review, clean
independent reproduction, local/hosted gates and affirmative recorded human
approval before any Module01 gate transition.
