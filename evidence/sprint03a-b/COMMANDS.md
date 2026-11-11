# Executed command ledger

Working directory:`/home/tiecont/Projects/aegis-gate-sprint03-b`.
All proxy/lab/Docker/scan invocations hold
`flock /tmp/aegisgate-sprint02-fixtures.lock` for their complete duration.
An initial3-test unit invocation before the final locked runs was not locked;
it used only temporary local PKI,was repeated under the lock,and is not the final
evidence relied on. No third-party traffic or public listeners were tested.

## Final common proof (run06)

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock env \
  AEGIS_RUN_ROOT=/home/tiecont/Projects/aegis-gate-sprint03-b/.local \
  AEGIS_CANDIDATE_COMMAND=/home/tiecont/Projects/aegis-gate-sprint03-b/spikes/envoy/launch \
  AEGIS_CANDIDATE_NAME=envoy \
  AEGIS_CANDIDATE_ROOT=/home/tiecont/Projects/aegis-gate-sprint03-b \
  AEGIS_CANDIDATE_ARTIFACTS='["/home/tiecont/Projects/aegis-gate-sprint03-b/spikes/envoy/launcher.mjs","/home/tiecont/Projects/aegis-gate-sprint03-b/spikes/envoy/config.mjs","/home/tiecont/Projects/aegis-gate-sprint03-b/spikes/envoy/image.lock.json"]' \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  /home/tiecont/Projects/aegis-gate/spikes/edge-comparison/run.mjs \
  > evidence/sprint03a-b/shared-run-06.log 2>&1
```

Exit1:69pass,6fail,all75 IDs,zero skipped,fatal absent.
Run05 used this identical command with `shared-run-05.log` and the pre-drain
compiler:68pass,7fail,exit1. Run04 omitted `AEGIS_CANDIDATE_ARTIFACTS`:66/75,exit1.
Runs01/02/03 used the same absolute runner and launcher with NAME/ROOT but
omitted `AEGIS_RUN_ROOT` and `AEGIS_CANDIDATE_ARTIFACTS`,because root originally
owned fixture paths. They generated ignored lab files in root's `.local` under
the original contract; no root source was changed.01startup failure,02=59/75,
03incomplete,with no final JSON. The user then required own run root,used from04.

## Unit, image and secrets

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  --test spikes/envoy/config.test.mjs > evidence/sprint03a-b/unit-tests.log 2>&1
flock /tmp/aegisgate-sprint02-fixtures.lock docker pull envoyproxy/envoy:v1.40.2
flock /tmp/aegisgate-sprint02-fixtures.lock docker pull envoyproxy/envoy:distroless-v1.40.2 \
  > evidence/sprint03a-b/distroless-pull.log 2>&1
flock /tmp/aegisgate-sprint02-fixtures.lock spikes/envoy/scan.sh \
  > evidence/sprint03a-b/scan-command.log 2>&1
flock /tmp/aegisgate-sprint02-fixtures.lock docker manifest inspect \
  envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded \
  > evidence/sprint03a-b/image-manifest.json 2> evidence/sprint03a-b/image-manifest.log
flock /tmp/aegisgate-sprint02-fixtures.lock docker manifest inspect \
  envoyproxy/envoy@sha256:16e0d4dac937ffa34103aa6ba1013dc2030b9de2a249273c8d23c7c5c2989664 \
  > evidence/sprint03a-b/image-amd64-manifest.json 2> evidence/sprint03a-b/image-amd64-manifest.log
flock /tmp/aegisgate-sprint02-fixtures.lock docker image save --output .local/envoy-distroless.tar \
  envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded
flock /tmp/aegisgate-sprint02-fixtures.lock python3 scripts/image_identity.py \
  evidence/sprint03a-b/image-vulnerabilities.json .local/envoy-distroless.tar \
  sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded \
  > evidence/sprint03a-b/image-identity.log 2>&1
```

Unit3/3,exit0. Standard Ubuntu scan exit1,2HIGH retained; final distroless scan
exit0,no HIGH/CRITICAL. SBOM generated. Exported image identity verifier exit0.
`scan.sh` records exact pinned scanner/runtime arguments; it ran once per image.
The source Gitleaks command uses the same pinned8.30.1 scanner/config as repository
policy,scoped to `/repo/spikes/envoy`,redacted JSON and no network.

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock spikes/envoy/scan-owned-secrets.sh
```

This records the final source,evidence and report scans,all exit0 with no findings.
The initial report scan flagged prose in the SDS table as `generic-api-key`;
its redacted finding/log are retained under `report-secrets-attempt-01.*`.
The table was reworded into ordinary spaced prose and rescanned;no rule,ignore
or scanner configuration was changed. There was no credential in that finding.

## Supplemental real-process workload

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock \
  /home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node \
  spikes/envoy/benchmark.mjs evidence/sprint03a-b/run-06-results.json \
  evidence/sprint03a-b/benchmark-processes.json \
  > evidence/sprint03a-b/benchmark-command.log 2>&1
```

First attempt exit1 at Nginx startup,preserved under `benchmark-attempt-01.*`.
Final attempt after explicit read-only Nginx temp paths:exit0,zero errors/timeouts.
No shared test or expectation was changed.

## Read-only upstream research and evidence collection

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/research.mjs
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/collect.mjs \
  evidence/sprint03a-b/shared-run-06.log evidence/sprint03a-b/run-06
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node spikes/envoy/finalize-evidence.mjs
sha256sum -c evidence/sprint03a-b/SHA256SUMS
git diff --check
```

The public upstream requests fetch release/source metadata only; they are not
load/abuse/security tests. The finalizer checks75unique pass/fail IDs and verifies
current candidate source equals root's run06 launch-time hashes. It produces
dependency bindings,NO-GO summary and owned artifact hashes. No private keys or
fixture manifests containing secret material are copied to evidence.

## Final cleanup and formatting

```sh
flock /tmp/aegisgate-sprint02-fixtures.lock docker inspect --format \
  '{{.Name}} {{.Config.Image}} {{range .Mounts}}{{.Source}} {{end}}' aegis-envoy-3038279
flock /tmp/aegisgate-sprint02-fixtures.lock docker stop --timeout 2 aegis-envoy-3038279
flock /tmp/aegisgate-sprint02-fixtures.lock docker ps --filter name=aegis-envoy --format '{{.Names}}'
git diff --cached --check
git diff --cached --check -- spikes/envoy docs/reports/sprint03a-b-envoy.md
```

Run03's interrupted launcher left this older owned Ubuntu container. Its mounts
match own `.local/envoy-run-Inr6xe` and the original fixture run; after ownership
verification it was stopped,exit0. Final inventory is empty. Completed final
proof and supplemental benchmark had already stopped their own containers.
Full staged diff check exits2 for literal HTTP CRLF and extra blank lines in raw
tool logs; the source/report check exits0. Raw logs are preserved unchanged.
