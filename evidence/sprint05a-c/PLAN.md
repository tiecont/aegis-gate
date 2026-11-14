# Sprint05A C executable plan

Own only additive sprint05a-c source, evidence and report. Import recovery-config;
retain exact original75 runner, evaluator, observer, inputs, timing and counters.
Commit executable source before proof. Serialize setup through cleanup with
`flock /tmp/aegisgate-sprint02-fixtures.lock` using the required Node executable.

1. Inspect released v1.40.2 initial-window/SETTINGS and pool APIs and codec path.
2. Run unchanged original75 with recovery, minimum windows/zero HPACK table,
   earlier retained-Host denial, per-downstream pools, and bounded reuse32.
   All variants retain pooling, TLS verification and resource caps.
3. Collect passive duplicate raw relay bytes without replacing the immutable
   observer. Repeat candidate without the tap to check for measurement effects.
4. Add bounded H2 cold/warm/concurrent/reuse, route/trust/generation controls.
5. Preserve failed attempts, exact source/evidence digests and fixture cleanup.
   A nonzero original counter remains FAIL even if its bytes are SETTINGS ACK.
6. Commit report separately. No production claims, pushes, merges or delegation.
