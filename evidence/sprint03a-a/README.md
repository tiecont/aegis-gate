# Agent A evidence

Disposition: **NO-GO**, research only. No private PKI is committed.

- `corrected/results.json`: authoritative fresh full75 run,63 pass/12 fail;
  exact original baseline57/65 with eight failures, plus four supplemental
  failures. Node TLS alerts are separate `transport_errors`; genuine HPE/raw
  packet failures still increment parser errors. No tests are excluded.
- `corrected/run.json`: locked exact commands, nonsecret env overrides,
  before/after shared-source hashes, results/proxy-log hashes, inventory and
  expected/actual failure sets. Script preserves actual exit1.
- `corrected/*.stdout.txt` / `*.stderr.txt`: original contract/lab output.
- Root-level `results.json`, `run.json`, lab and contract logs: earlier
  **misclassified/polluted run**,55/75 (baseline49/65). Retained verbatim;
  **not valid baseline evidence**. Shared Node HTTPS `clientError` classification
  was corrected by Root before the authoritative rerun; failing TLS assertions
  had cascaded into route/pool/cancellation/health/benchmark failures.
- `upstream.json`: fresh metadata/source/issue/PR/advisory retrievals with URL,
  time, SHA256 and numbered excerpts; published crate checksum/cache checks.
- `verification.json`: locked scoped commands/exits/output hashes, own/root
  source equality and explicitly reused release binary provenance.
- `cargo-audit.json`:206 locked dependencies,0 known vulnerabilities,
  **2 unmaintained warnings**, no ignore or risk acceptance. Original output.
- `derivative-tree.txt`, `unsafe-libyaml-tree.txt`: actual inverse paths.
- `npm-audit.json`: fresh lockfile audit,0 vulnerabilities. `fmt.txt` is empty
  because formatting passed; zero-length stderr files are retained evidence.
- The two lab stderr transcripts retain assertion-generated trailing blank
  lines. Source/document/JSON whitespace checks exclude only these verbatim
  files; the unrestricted staged check reports their EOF blank lines.
- `artifact-sha256.json`: generated artifact inventory after final documentation.

Report: `docs/reports/sprint03a-a-pingora.md`. Reproduction scripts live in
`spikes/pingora/sprint03a-{research,verify,run}.mjs`. Every lab/scan holds
`/tmp/aegisgate-sprint02-fixtures.lock` for its full duration. Raw commands and
hashes identify each run separately. The root checkout is read-only for Agent A;
all fixture writes use the absolute assigned `.local` through `AEGIS_RUN_ROOT`.

An independent reviewer must rerun the same shared corpus and review provenance
before integration. No affirmative gate, production readiness, maintained
strict adapter or architecture replacement is claimed.
