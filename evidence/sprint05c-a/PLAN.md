# Sprint05C Agent A Executable Plan

Worktree /tmp/aegisgate-05c-a, branch feat/sprint05c-strict-ingress only.
Read handoff, operating/orchestrator rules, master plan, architecture, threat,
config, quality, ADR011/012, prior A/D/F and Sprint05B B/C/E/completion reports.
No original75/23 or shared implementation/status file changes. No runtime GO.

1. Extend an owned copy of the accepted persistent N-API binding using released
   llhttp callbacks: header pause, bounded metadata, targets and trailer fields.
   Upstream llhttp9.4.4 remains unchanged and source-hash verified before build.
2. Implement loopback TLS H1.1 runtime with static verified test identities,
   exact target/wire preservation and sequential downstream keepalive pipelines.
   Known bounded CL/no-body messages stream after header admission; chunked
   messages use complete private disk staging. Use explicit resource/deadline
   caps, bounded origin slots/queue, aggregate disk quota and cancellation cleanup.
3. Commit executable source before the locked proof. Record actual exact source,
   tools, argv, exits, raw observations and hashes. Failures remain retained.
4. Exercise exact historical folded bytes; fragmented headers/trailers; authority,
   target, framing and mixed pipeline negatives; multi-MiB valid streaming and
   disk staging; slow origin, cancellation, size/deadline/quota/backpressure/TLS.
   Independently demonstrate the scoped chunked late-trailer streaming conflict.
5. Verify receipts/source/protected hashes; commit evidence/report separately.
   Stop at finite H1 feasibility: no H2/WS/gRPC/config/runtime acceptance claim.
