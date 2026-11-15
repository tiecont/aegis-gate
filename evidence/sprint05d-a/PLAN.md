# Sprint05D AgentA Executable Plan

1. Failure: Sprint05C A1019a60 and F a-independent-03 show CL10/abc/EOF
   yields400 after89 origin bytes/one handler; finite chunk staging prevents
   late-fold effects. Read A/F/completion and required repository rules.
2. Hypothesis: complete-message staging eliminates origin effects of subsequent
   CL truncation and invalid trailers within the explicit finite bounds.
3. API: reuse the unchanged maintained llhttp9.4.4 C binding and
   callbacks from sprint05c-a-llhttp.c. Stage every message through completion
   using Node crypto AES-256-GCM, private files and bounded reads; authenticate
   the complete ciphertext before any origin slot/dial. No parser research.
   Invariant: incomplete, malformed, expired or over-quota messages produce
   zero origin dials, decrypted request bytes, handlers and parser/TLS errors.
   No-body and known-length requests follow the same staging admission rule.
4. Minimum test: identical unfinished CL/chunk prefixes must remain origin-silent
   until valid completion; EOF or late-fold completion must return400 without
   origin effects. Any pre-completion effect disproves strict staging safety.
5. Positive: exact wire hashes and completed body/trailers for valid
   CL/no-body/chunked/EOF/pipeline controls; live prefix inspection of private
   ciphertext; successful valid request after every failure and restart.
6. Stop: finite1.5MiB/message,2MiB aggregate,3 files,6 sockets, bounded
   queues/deadlines and400/408/413/503. Prove cancellation and SIGKILL/restart
   orphan cleanup. Waiting for origin progress before completion times out;
   this cannot satisfy indefinite/early request streaming. Module01 NO-GO,
   Modules04-12 LOCKED and production BLOCKED remain unchanged.

Own only sprint05d-a-* sources, this evidence namespace and the assigned report.
Commit executable source before each fresh evidence attempt; retain failures.
Full shared flock covers build, PKI, listeners, crash, recovery, cleanup and hashes.
Use pinned Node and disk-backed .local fixture/TMPDIR, never /tmp for data.
Verify all11 protected original75/23 files before and after; do not rerun or
modify those suites, baseline expectations, parsers or full benchmarks.
