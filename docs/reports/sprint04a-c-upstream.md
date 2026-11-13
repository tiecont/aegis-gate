# Sprint04-A C - Upstream Resolution

Result: research complete; **no eligible released alternative identified**.
Module01 NO-GO is retained. No runtime candidate, broad PoC, shared fixture,
architecture/gate edit, scanner ignore, maintainer publication or merge was performed.
Branch `research/module01-upstream-capability`, `/tmp/aegisgate-04a-c`.

## Current Assignment and Independent Stop

Restored the missing owned worktree using `git worktree add --force
/tmp/aegisgate-04a-c research/module01-upstream-resolution` at original
`a795e619e528c08b5f22b0a3f8701e7284e96b52`; created the current branch and
rebased onto `origin/main` = `3e03940848c81751c87bbcec131238abb7d28e1b`.
The inherited coordinator-only execution-contract commit was excluded with
`git rebase --onto origin/main 5cfc6db`; the final diff owns only C evidence
and this report. Original committed research and failed attempts remain intact.

Fresh collection from clean committed source
`1272faa3273c9db8675dcdd463201eb544bf14d1` ran2026-11-13
09:50:53.103Z-09:51:19.227Z. `current-01/commands.json` retains49 successful
nested commands, exact argv/URLs, statuses, tool versions, times, source hashes
and raw body/stdout/stderr digests. The15 re-fetched released source/API files
are byte-identical to the prior committed evidence; latest versions and their
source revisions below are unchanged. Read-only official source/API retrieval
is the only external activity; no external traffic probes or publication.

C independently confirms A's `4d2d0c751cdc22cb06ec1bb305b321921a06ba7e`
scoped stop using its own fresh upstream source, rather than treating A's report
as proof. Envoy1.40.2 Balsa hardcodes continuation acceptance (:181), strips
CR/LF before value callbacks (:450-464), and implements raw-header/trailer
callbacks as no-ops (:304-305). Those overrides and the framer are private
(`balsa_parser.h:39-45,71`). Public `HeaderValidator` takes parsed request/trailer
maps (:48-54,64-69); its transforms also take maps (:87-108). A validator hook
cannot reconstruct erased folding provenance. No strict-fold option was found
in the inspected released constructor, protocol/default-validator proto and
runtime sources. This conclusion does not exhaust all older supported branches
or future extensions, and does not assert an upstream vulnerability.

Candidate count0; new75-case runtime executions0. A has stopped; no credible
complete maintained alternative is identified, so no broad candidate rebuild
or replacement was attempted. H2 bytes remain B's independent wire assignment;
C makes no new origin-byte/handler/parser/transport observation or passing claim.

## Release and Source Matrix

Official GitHub latest-release API responses were refreshed2026-11-13.
All are stable/non-draft. Commit endpoints resolve tags to immutable source:

| Project | Latest released version / published UTC | Immutable source revision |
| --- | --- | --- |
| Envoy | [1.40.2](https://github.com/envoyproxy/envoy/releases/tag/v1.40.2), 2026-10-27T01:51:56Z | `b2d89e0ae53916f28770771fbdd49c5c99c5c5a2` |
| Pingora | [0.9.1](https://github.com/cloudflare/pingora/releases/tag/0.9.1), 2026-11-03T01:07:23Z | `f86ffda5d3ae5c3baf5125682138b33b26c01b08` |
| Hyper | [1.12.0](https://github.com/hyperium/hyper/releases/tag/v1.12.0), 2026-10-06T15:58:27Z | `7f67699ce32d717081deb7018b4da7d679277ac0` |

Envoy's retained `RELEASES.md` provides a12-month stable maintenance window;
1.40.2 is the newest stable, with recent CA-bundle release changes. Pingora's
release fixes Tokio1.54 compatibility and zstd requirements. Hyper adds header
size bounds and outgoing framing fixes. None of these release notes establishes
the missing incoming strict mode. No equivalent LTS window was established for
Pingora/Hyper; latest stable is not an invented support-service guarantee.
Retained licenses are Envoy/Pingora Apache-2.0 and Hyper MIT.

| Versioned track | Released | Supported API / policy | Proposed, not released proof | Missing prerequisite |
| --- | --- | --- | --- | --- |
| Envoy1.40.2 | Latest stable, unchanged immutable source below |12-month stable maintenance policy; Host retention, local reply mapping and parsed-map validator surfaces exist | Local strict-fold upstream request; focused TE mapping remains unexecuted | Public pre-normalization fold rejection; complete H2 zero-byte identity denial and TE4xx/close proof |
| Pingora0.9.1 | Latest stable | Public pipeline/session/startup APIs exist; no LTS/support SLA established | PR1117 YAML replacement open/unmerged; strict target/framing and ordered ProxyHttp pipeline requests | Released strict mode before target rewriting, valid pipeline integration, dependency removal and proof |
| Hyper1.12.0 | Latest stable | Maintained server Builder exposes bounds/keepalive/upgrades; no LTS/support SLA established | Local reject-both/raw-target API request; default-branch inspection is source-only | Incoming CL+TE rejection and fragment provenance before service dispatch; equivalent proxy integration proof |

None of these partial supported interfaces meets the whole eligibility contract.
Proposed means a local request or unmerged upstream change, not a supported
released fix. Source review and a successful collector do not provide runtime
capability evidence.

All source references below are relative to `evidence/sprint04a-c/upstream/<project>/`
at the revision above. `*-commands.json` retain exact URL/argv/time/status/hash
for every fetch; full raw source and metadata are kept, including failed paths.

| Property | Released source/API evidence | Supported capability / exact remaining condition |
| --- | --- | --- |
| Envoy obs-fold | `source/common/http/http1/balsa_parser.cc:181,304-305,450-464`; `.h:39-45,71`; `envoy/http/header_validator.h:54` | Balsa continuation rejection is hardcoded false; raw input callbacks are private no-ops; CR/LF removed before onHeaderValue. Public validator consumes parsed maps. No config/runtime strict switch found in inspected APIs. |
| Envoy H2 identity | `source/common/http/http2/codec_impl.cc:2188,2523-2524,2585-2608` | Host retention runtime guard exists; codec allows differing Host/authority. Retention is necessary for application equality/SNI policy but does not establish zero bytes before denial. B owns classification of historical nine bytes. |
| Envoy TE | `source/common/http/http1/codec_impl.cc:902-927,1375-1416`; HCM proto `LocalReplyConfig:1160`, `ResponseMapper:1208` | CL/TE default rejection exists; unsupported TE sets501. Local reply status mapping is a credible **partial** released API, but decoder-less direct-error fallback and close need runtime proof. It cannot fix obs-fold. No blanket claim that a supported TE mapping is absent. |
| Envoy UHV | HCM proto `typed_header_validation_config:1073-1095`; default validator proto | Field remains `not-implemented-hide`; build/runtime details matter. Parsed-map UHV can validate syntax/CL-TE but does not recover folded wire provenance. A owns any build/config feasibility claim. |
| Envoy encoded/pipeline | HCM proto `normalize_path:961`, escaped-slash action981; default validator proto `skip_path_normalization`, `KEEP_UNCHANGED` | Maintained preservation controls exist. A strict candidate must retain the immutable valid encoded-target and two-request pipeline tests; rejecting encoded spaces/slashes globally is disallowed. No new runtime pass claimed. |
| Pingora targets | `pingora-core/src/protocols/http/v1/server.rs:437-455,1307,1765-1795`; `src/apps/mod.rs:64-96` | Invalid Token/Version retry escapes the target and replaces buffer before raw-header access. HttpServerOptions has no disable-retry strict field. Raw original target/provenance or strict no-retry parser option is missing from inspected public API. |
| Pingora framing | same H1 source405-432,484-515 | CL removed when TE exists; original-byte maintained-parser check can detect some framing, but repeated chunked/raw-target distinctions and all negatives remain prerequisites. No custom scanner proposed. |
| Pingora pipeline | H1 `set_pipelining_enabled:1014`, `reuse:1448`; `protocols/http/server.rs:35-52` | Supported low-level pipeline prefix/reuse APIs exist. Default false; ordered proxy-loop integration remains to be demonstrated. Presence of these APIs does not repair strict targets or overturn historical pipeline failure. |
| Pingora H2/SNI | `pingora-core/src/protocols/http/v2/server.rs:316-360,476-487`; `pingora-proxy/src/proxy_trait.rs` | Released Host/authority semantic validation exists; verified TLS SNI/tenant binding still belongs to request policy before upstream work. No new deficiency is inferred for historical passing Pingora H2 cases. |
| Hyper CL/TE | `src/proto/h1/role.rs:225-230,275-300`; `src/server/conn/http1.rs` | Incoming parser removes CL when TE follows and skips CL when TE precedes. No reject-both/raw-header policy callback found in complete server Builder methods. Outgoing sanitation is a different path. |
| Hyper fragments | same URI constructor; archive-verified `registry/http-1.5.0/src/uri/path.rs:20-30` | Dynamic PathAndQuery truncates fragments; service receives normalized Uri. Static constructor's fragment rejection does not control Hyper's dynamic parse. Missing reject-before-normalization/raw-target API. |
| Hyper bounds/pipeline | H1 Builder `max_headers`, `max_header_size`, `max_buf_size`, `header_read_timeout`, `keep_alive`, `pipeline_flush`; H2 Builder retained | Supported resource controls are present. They do not recover removed CL/fragment provenance. Preserve positive encoded/pipeline cases rather than disable keepalive. |

Fresh source-only default-branch snapshots in `current-01/`: Envoy main
`8ce942ce56c433e352d2657603d7bf33d4dbb4b4` still has continuation false/private
no-op callbacks; Pingora main `3f87e92c982ee27c714506e16ae362776faea4aa` retains
the target retry and flagged dependencies. Hyper's default branch is **master**,
resolved through its repository API to `b638fc0de351987f3eaffa2bdabd393c8679a9e8`.
Its incoming parser still removes/skips CL (:280-299) and merely disables
keepalive when CL+TE coexist (:359-361); Builder still exposes no inspected
reject-both/raw-target policy. These are unexecuted, unreleased observations.
Earlier Envoy main0dfc464 and wrong Hyper main422 remain historical evidence,
not overwritten. No exhaustive search of all extensions/older branches is claimed.

## Dependency Provenance and Exposure

Five locked offline inverse trees exit0. They establish `derivative2.2.0` in
Pingora core/load-balancing and `unsafe-libyaml0.2.11` through
`serde_yaml0.9.34+deprecated` in core. These are nonoptional core dependencies
for the current manifest; disabling the load-balancer feature would leave core.
Archive verification checks382 files across7 crates with zero source mismatches;
all archive SHA256 equal committed lock checksums. Registry source, download URL,
archive path, file counts and retained source hashes are in
`registry-provenance.json`; exact key archive hashes:

```text
fcc3dd5e9e9c0b295d6e1e4d811fb6f157d5ffd784b8d202fc62eac8035a770b derivative2.2.0
673aac59facbab8a9007c7f6108d11f63b603f7cabff99fabf650fea5c32b861 unsafe-libyaml0.2.11
6a8b1a1a2ebf674015cc02edccce75287f1a0130d394307b36743c2f5d504b47 serde_yaml0.9.34+deprecated
a535f47f65fdcb003f9e1df04cd18e614c128dfe9388acce3f211ae38ac14d68 pingora-core0.9.1
cbd4318f1349222fd355029ba59fc387cb955b3ed5c0411137e3c0ee0486b481 pingora-load-balancing0.9.1
```

Derivative is a build-time proc macro. `PeerOptions` derives Debug while omitting
three hook fields (`upstreams/peer.rs:497-568`); `Backend` derives equality/hash/
ordering with `ext` ignored (`pingora-load-balancing/src/lib.rs:170-189`). A
replacement must preserve these semantics and avoid expanding debug exposure.

YAML is runtime code: spike `Server::new(None)` at main.rs289 reaches
`ServerConf::new()` then the fixed `---\nversion: 1` literal through serde_yaml
(`server/configuration/mod.rs:335-352`). Public YAML load/dump APIs also exist.
This spike does not accept untrusted YAML; that limits input exposure, not the
dependency risk. A useful supported partial alternative exists:
`Server::new_with_opt_and_conf(None, ServerConf::default())` bypasses YAML parse
(`server/mod.rs:448-478`). C has not applied/runtime-tested it; the nonoptional
serde_yaml/unsafe-libyaml dependency remains in the binary dependency graph.

Fresh pinned cargo-audit0.23.0 exits0: zero known vulnerabilities, two unmaintained
warnings, RUSTSEC-2024-0388 and0449. Database has1490 advisories; separate Git
receipt pins `af7b3ec33460b8e2de8d422e16d628518891a519`. `--no-fetch` means a
snapshot audit, not a claim of future/current database completeness. The fresh
RustSec source records corroborate both warnings; neither has patched versions.
Issue889 is open; PR1117 is open/unmerged at
`522eb28e4b2dba6449274ed7267edca0b8137184` in `current-01/pingora/pr-1117.json`.
Fresh official RustSec head also resolves to the exact same DB commit above;
both advisory bodies are retained at that immutable revision. PR1117's
serde-saphyr/MSRV1.89 proposal and reported tests are author claims, not released
code or C test results.
No scanner exception/private fork is accepted.

## Execution, Drafts and Stop

Committed research tools: `f5ca72b` and `2b98407`. All runtime candidate sources,
75-case input/expected corpus and shared gate files remain unchanged. Exact
commands/times/exits/stdout/stderr/hashes are in command receipts:

| Command | Exit / result |
| --- | --- |
| `node evidence/sprint04a-c/research.mjs upstream` | 1; release/source200s, two guessed paths404 retained |
| `node evidence/sprint04a-c/research.mjs local` | 1; trees/metadata0; generic audit unavailable101; Hyper all-platform offline cache missing windows-sys101 |
| `node evidence/sprint04a-c/research.mjs followup` | 1; source200s, wrong Hyper main422 and old Bazel path404 retained |
| `node evidence/sprint04a-c/research.mjs local-followup` | 0; pinned audit0, Linux-filtered Hyper metadata0, tool/database versions0 |
| `python3 evidence/sprint04a-c/verify-provenance.py` | 0; 7 archives/382 files match lock/source |
| `node evidence/sprint04a-c/closeout.mjs` | 0; syntax, archive verification, immutable baseline, owned-source whitespace and pinned offline Gitleaks all0;96 fetched/log file hashes verified |

The historical scoped Gitleaks scan processed4.18MB of owned evidence with no
leaks; it is not a repository/history security-scan claim. `verification.json` records
each exact command, source commit, time, exit and stdout/stderr digest.
`SHA256SUMS` binds the report and all owned evidence except the manifest itself.
No full repository `make check`/`make security-scan` was run by C; root owns
integration regression gates, and runtime sources were not edited.

`drafts/upstream-requests.md` contains local-only request drafts and conditional
reproducer commands. No draft was published and no traffic probe was executed.
Historical counts/bytes here are explicitly inherited from Sprint03-B, not new
runtime observations. Research itself observes no origins, handlers or transport.

The earlier C closeout observed A at70813bd while still investigating. That
historical status is superseded by A's4d2d0c7 completed scoped stop, independently
confirmed above. Neither released Pingora nor Hyper meets all prerequisites.
The partial TE mapping, pipeline API and programmatic startup paths are concrete
supported interfaces, not an eligible engine. No alternative is advanced.

## Current Verification and E Handoff

Collection command (exit0, all49 nested commands exit0):

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04a-c/capability-refresh.mjs collect current-01
```

Verification uses `capability-refresh.mjs verify verify-01 current-01` with the
same pinned Node26.13.0. It checks historical manifest bytes against original
a795e619 Git objects, previous command receipts, new launch-time source objects
and fresh raw receipt hashes. The read-only archive checker verifies all7
published archives/382 files against locked checksums and cached/retained source.
It also checks the immutable corpus and byte-identical runtime/security files
against3e039408, syntax, whitespace, and offline pinned Gitleaks for actual owned
evidence plus this report. The scanner uses `flock --no-fork` for its entire
container lifetime, including cleanup; no fixture service or public listener.

`verify-01/commands.json` records exit0 at source
`055f8cd954c73abad1cd2fea821c184b44b9238b`; all7 nested commands exit0. It
verifies139 original manifest entries,96 previous receipt files and137 fresh
body/stdout/stderr files with zero mismatches. Published archive verification
again checks7 packages/382 files, no mismatch; original65 IDs/extraction pass
and the unchanged full `spikes/` diff preserves all75 inputs/expectations,
encoded/pipeline positives and mandatory zero-byte assertions. The offline
Gitleaks scan inspected5.61MB of actual owned evidence/report and found no leaks.
This is a scoped scan, not a full repository, image vulnerability or release gate.

The original139-entry manifest remains in `historical-SHA256SUMS` and original
Git objects; current `SHA256SUMS` binds the full owned handoff. Failed initial
fetches/tool/cache attempts remain retained, not reclassified as successes.
Root/E own full repository check/scan, hosted gates and independent acceptance.

E can repeat the offline verifier from a clean committed checkout using a fresh
output directory; never rerun the historical collectors over retained paths:

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04a-c/capability-refresh.mjs verify review-01 current-01
sha256sum --check evidence/sprint04a-c/SHA256SUMS --quiet
```

The verifier deliberately refuses to overwrite an existing attempt directory.
The final evidence commit contains a second verification receipt after this
completed report is committed, plus the generated whole-handoff manifest.
Review range is `origin/main..research/module01-upstream-capability`; every
changed file is under `evidence/sprint04a-c/` or this report. No integration,
merge, downstream-module opening or architecture selection was performed by C.

Stop/dependency: obtain a maintained released pre-normalization obs-fold
rejection API; prove Host/:authority/verified-SNI denial before **any** origin
bytes and the unchanged TE4xx/actual-close contract. Or obtain released Pingora
strict target/framing mode with ordered valid pipelines and maintenance removal;
or Hyper incoming reject-both and fragment/raw-target API. Then A/root may pin a
bounded candidate and execute unchanged75 plus H2/resource/TLS/identity tests.
Independent E review and explicit human architecture approval remain necessary.

## Agent Completion Report

- Module:01 upstream research. Status: complete investigation; eligible engine blocked.
- Commits/files changed: rebased research2dfa584,d3d5dc7,55eab22,959b794,723e781;
  current collection tool1272faa and current evidence/verifier055f8cd; completed
  report/proof commits follow on this branch. Only C report/evidence/tools/drafts.
- Architecture/ADR decisions: retain scoped upstream stop and Module01 NO-GO;
  no architecture approval, contract change or risk acceptance.
- Contracts changed: none; immutable75, TLS, authorization and zero-byte rules intact.
- Positive tests: exact collection/verification commands above exit0; inverse trees,
  dated audit, archives, historical/current provenance and immutable corpus pass.
- Security negative tests: none newly executed; historical failures remain failures.
  Scoped offline Gitleaks/whitespace/syntax checks exit0; no scanner ignore.
- Performance: none measured; research records origin counters as unobserved/null.
- Known risks/release blockers: missing released strict APIs, unresolved Pingora
  maintenance chain; Module01 NO-GO,04-12 locked, production BLOCKED.
- Human review: root/E evidence acceptance; explicit architecture decision only
  after a complete eligible technical proof. Drafts remain unpublished.
- Next unblocked modules: focused upstream remediation and independent00/02/03
  maintenance only; no dependent production-edge implementation.
