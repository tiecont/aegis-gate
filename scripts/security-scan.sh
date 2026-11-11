#!/bin/sh
# Fail closed: absent tools, database failures and findings are nonzero.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
export GOTOOLCHAIN=go1.27.4
mode=${1:-all}
case "$mode" in all|dependencies|secrets|sbom|images) ;; *) printf 'usage: %s [all|dependencies|secrets|sbom|images]\n' "$0" >&2; exit 64;; esac
reports="$PWD/.local/evidence/security"
mkdir -p "$reports" "$PWD/.local/trivy-cache" "$PWD/.local/bin"
trivy='aquasec/trivy:0.69.1@sha256:1c78ed1ef824ab8bb05b04359d186e4c1229d0b3e67005faacb54a7d71974f73'
gitleaks='ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f'
status=0
run() {
  label=$1
  shift
  printf 'Running %s\n' "$label"
  if "$@" >"$reports/$label.log" 2>&1; then
    printf 'PASS %s\n' "$label"
  else
    result=$?
    printf 'FAIL %s (exit %s; inspect .local/evidence/security/%s.log)\n' "$label" "$result" "$label" >&2
    status=1
  fi
}
trivy_run() {
  docker run --rm --user "$(id -u):$(id -g)" -e TRIVY_CACHE_DIR=/cache \
    -v "$PWD:/repo:ro" -v "$PWD/.local/trivy-cache:/cache" -v "$reports:/reports" \
    "$trivy" "$@"
}
if [ "$mode" = all ] || [ "$mode" = dependencies ]; then
  if [ ! -x .local/bin/govulncheck ] || ! .local/bin/govulncheck -version 2>/dev/null | grep -q 'govulncheck@v1.9.0'; then
    run install-govulncheck env GOBIN="$PWD/.local/bin" go install golang.org/x/vuln/cmd/govulncheck@v1.9.0
  fi
  if [ ! -x .local/tools/bin/cargo-audit ] || ! .local/tools/bin/cargo-audit --version | grep -q 'cargo-audit 0.23.0'; then
    run install-cargo-audit cargo +1.99.1 install cargo-audit --version 0.23.0 --locked --root "$PWD/.local/tools"
  fi
  run rust-vulnerabilities .local/tools/bin/cargo-audit audit --file apps/edge/Cargo.lock --json
  node_bin=$(scripts/node-path.sh)
  node_directory=$(dirname "$node_bin")
  run go-scanner-gate-selftest "$node_bin" scripts/gate-selftest.mjs --scanner
  run go-vulnerabilities .local/bin/govulncheck -C apps/control-api/cmd/control-api -scan=module
  run npm-root-vulnerabilities env PATH="$node_directory:$PATH" npm audit --audit-level=high --json
  run npm-dashboard-vulnerabilities env PATH="$node_directory:$PATH" npm --prefix apps/dashboard audit --audit-level=high --json
fi
if [ "$mode" = all ] || [ "$mode" = secrets ]; then
  run worktree-secrets docker run --rm --user "$(id -u):$(id -g)" \
    -v "$PWD:/repo:ro" -v "$reports:/reports" "$gitleaks" dir /repo \
    --config /repo/.github/gitleaks.toml --redact --report-format json --report-path /reports/secrets.json --no-banner
  # Worktree exclusions permit generated local fixtures only. They must never be tracked.
  tracked_generated=$(git ls-files -- .local ':(glob)**/node_modules/**' ':(glob)**/target/**' ':(glob)**/.next/**')
  if [ -n "$tracked_generated" ]; then
    printf 'FAIL generated/cache/private fixture paths are tracked in git\n' >&2
    status=1
  fi
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    # History uses built-in rules without worktree fixture exclusions.
    run history-secrets docker run --rm --user "$(id -u):$(id -g)" \
      -v "$PWD:/repo:ro" -v "$reports:/reports" "$gitleaks" git /repo \
      --redact --report-format json --report-path /reports/history-secrets.json --no-banner --log-opts=--all
  else
    printf 'No git commits exist; history scan has no input\n' >"$reports/history-secrets.log"
  fi
fi
if [ "$mode" = all ] || [ "$mode" = sbom ]; then
  run repository-sbom trivy_run fs /repo --scanners vuln --format cyclonedx \
    --output /reports/repository.cdx.json --skip-dirs /repo/.local --skip-dirs /repo/.git \
    --skip-dirs /repo/node_modules --skip-dirs /repo/apps/dashboard/node_modules --skip-dirs /repo/apps/edge/target
  run filesystem-vulnerabilities trivy_run fs /repo --scanners vuln --severity HIGH,CRITICAL --exit-code 1 \
    --format json --output /reports/filesystem-vulnerabilities.json --skip-dirs /repo/.local \
    --skip-dirs /repo/.git --skip-dirs /repo/node_modules --skip-dirs /repo/apps/dashboard/node_modules \
    --skip-dirs /repo/apps/edge/target
fi
if [ "$mode" = all ] || [ "$mode" = images ]; then
  # Scan exactly the immutable references used by Compose, including local builds.
  if [ ! -f .local/compose.env ] || [ ! -f .local/fixture-images.env ] || [ ! -f .local/fixture-images.lock.json ]; then
    printf 'FAIL local fixture image environment/lock missing; run make fixture-images\n' >&2
    status=1
  elif docker compose --env-file .local/compose.env --env-file .local/fixture-images.env \
      -f infra/compose/compose.yaml config --format json >"$reports/compose-config.json" 2>"$reports/compose-images.log" && \
      python3 - "$reports" >"$reports/image-inventory.tsv" 2>"$reports/image-inventory.log" <<'PYINVENTORY'
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

reports = Path(sys.argv[1])
config = json.loads((reports / 'compose-config.json').read_text())
lock = json.loads(Path('.local/fixture-images.lock.json').read_text())
assert lock.get('schema_version') == 1, 'Unsupported fixture image lock schema'
expected = {'postgres': Path('infra/compose/Dockerfile.postgres'),
            'demo-origin': Path('infra/compose/Dockerfile.origin')}
source_files = {'postgres': ['Dockerfile.postgres', 'su-exec-wrapper.sh'],
                'demo-origin': ['Dockerfile.origin']}
assert set(config['services']) == {'postgres', 'redis', 'nats', 'demo-origin'}, 'Unexpected Compose service inventory'
for service, definition in sorted(config['services'].items()):
    image = definition['image']
    if service in expected:
        assert re.fullmatch(r'sha256:[0-9a-f]{64}', image), 'Local image must be immutable ID'
        record = lock[service]
        assert image == record['image_id'], 'Compose image does not match build lock'
        assert hashlib.sha256(expected[service].read_bytes()).hexdigest() == record['dockerfile_sha256'], 'Dockerfile differs from built image lock'
        names = sorted(source_files[service])
        assert record['source_files'] == names, 'Unexpected local build source inventory'
        digest = hashlib.sha256()
        for name in names:
            digest.update(name.encode() + b'\0' + (Path('infra/compose') / name).read_bytes() + b'\0')
        assert digest.hexdigest() == record['source_sha256'], 'Local build source differs from immutable lock'
        inspected = subprocess.check_output(['docker', 'image', 'inspect', '--format', '{{.Id}}', image], text=True).strip()
        assert inspected == image, 'Docker local image identity mismatch'
        source = 'local'
    else:
        assert re.fullmatch(r'[^\s]+@sha256:[0-9a-f]{64}', image), 'Remote image must be pinned by digest'
        source = 'remote'
    print(service, source, image, sep='\t')
provenance = {'schema_version': 1}
for service in expected:
    provenance[service] = {key: lock[service][key] for key in ['image_id', 'base', 'dockerfile_sha256', 'source_sha256', 'source_files']}
(reports / 'fixture-images.lock.json').write_text(json.dumps(provenance, indent=2) + '\n')
PYINVENTORY
  then
    index=0
    while IFS="$(printf '\t')" read -r service source image; do
      index=$((index + 1))
      printf 'Image %s: %s %s\n' "$index" "$service" "$image"
      rm -f "$reports/image-$index-vulnerabilities.json" "$reports/image-$index.cdx.json"
      if [ "$source" = local ]; then
        archive="$reports/image-$index.tar"
        rm -f "$archive"
        if docker image save --output "$archive" "$image" >"$reports/image-$index-export.log" 2>&1; then
          run "image-$index-vulnerabilities" trivy_run image --input "/reports/image-$index.tar" \
            --severity HIGH,CRITICAL --exit-code 1 --format json --output "/reports/image-$index-vulnerabilities.json"
          run "image-$index-sbom" trivy_run image --input "/reports/image-$index.tar" \
            --format cyclonedx --output "/reports/image-$index.cdx.json"
          run "image-$index-identity" python3 scripts/image_identity.py "$reports/image-$index-vulnerabilities.json" "$archive" "$image"
          rm -f "$archive"
        else
          printf 'FAIL image export for %s\n' "$service" >&2
          status=1
          rm -f "$archive"
        fi
      else
        run "image-$index-vulnerabilities" trivy_run image --image-src remote --severity HIGH,CRITICAL --exit-code 1 \
          --format json --output "/reports/image-$index-vulnerabilities.json" "$image"
        run "image-$index-sbom" trivy_run image --image-src remote --format cyclonedx \
          --output "/reports/image-$index.cdx.json" "$image"
      fi
    done <"$reports/image-inventory.tsv"
  else
    printf 'FAIL immutable Compose image inventory/lock validation (inspect .local/evidence/security/image-inventory.log)\n' >&2
    status=1
  fi
fi
exit "$status"
