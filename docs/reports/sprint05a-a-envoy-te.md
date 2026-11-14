# Sprint05A Agent A: Envoy TE Candidate

Implementation and local proof in progress. This is an isolated supported
status-only local-reply mapper experiment, not an architecture decision.
Module01 remains NO-GO; Modules04-12 LOCKED; production BLOCKED.

Plan: import immutable recovery configuration; add local501-to400 mapping
and a separately named launcher; run four exact historical TE vectors on
fresh/reused downstream connections, additional keep-alive closure diagnostics,
origin501, valid chunked TE/methods, encoded targets and ordered pipeline;
execute unchanged full75 and evaluator. Preserve all remaining failures.
Source must be committed clean before runtime collection. Shared fixture lock
covers setup, execution, raw capture, hashes and verified cleanup. Evidence and
final report follow in a separate commit, with exact commands and sources.
