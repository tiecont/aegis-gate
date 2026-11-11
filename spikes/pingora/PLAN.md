# Module 01 implementation plan

## Sprint02 B execution

1. Reproduce the unchanged 35-case release lab under the sprint fixture lock.
2. Expand `lab.mjs` target, Host/authority and framing/pipelined vectors with
   explicit origin-dispatch counters and positive encoded-target preservation.
3. Reinspect locked and maintained upstream parser/options/ingress APIs without
   patching dependencies or implementing a framing parser; retain source hashes.
4. Re-run Rust checks, release lab and lockfile audits, export redacted evidence.
5. Propose an ADR011 evidence/alternatives update and write the sprint02 report.
   Commit/publish the assigned research branch and draft PR for root review;
   root owns gate/status changes. Any failed mandatory proof remains NO-GO.

Keep this executable spike in its own Cargo workspace. No production edge code,
shared management contract or root toolchain is changed by the spike.

1. Pin the current Pingora stable release and OpenSSL backend; inspect enabled
   dependency tree, license and advisories before adopting it.
2. Build a loopback-only proxy using maintained Pingora parsing/TLS, atomic
   immutable route/certificate snapshots and existing restricted lab PKI.
3. Exercise two-name SNI selection/rotation, HTTP1/2, streaming/WS/gRPC,
   cancellation/timeouts, origin TLS negatives, malformed framing and pooling.
4. Measure a bounded owned-lab reference comparison and record environment.
5. Document actual evidence and unresolved gaps in ADR-011 and the module report.
   Gate remains closed unless every mandatory proof passes. A dependency or
   capability blocker stops dependent runtime implementation and is escalated
   with two alternatives; no technology substitution or TLS bypass is allowed.

Execution: the executable, 4 unit tests, 35-case local harness and controlled
reference benchmark are implemented. Final release run: 34 integration/security
cases pass, invalid request-target rejection fails. Current gate is closed;
see ADR-011 and `docs/reports/01-pingora-feasibility.md`. No dependent production
edge module was opened and no architecture replacement was made.

Sprint02 final:5 unit tests pass; expanded release lab57/65 passes,8 failures
retained. Origin evidence includes handler invocations, decrypted inbound bytes
and parser errors so relative-target502 is not mistaken for ingress rejection.
All6 encoded-target controls preserve their targets. Scope remains research;
see `docs/reports/sprint02-b-pingora.md` and proposed ADR011 evidence update.
