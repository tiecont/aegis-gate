#!/bin/sh
set -u
cd "$(dirname "$0")/../.."
node_bin=${AEGIS_NODE:-/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node}
image=$("$node_bin" -p 'JSON.parse(require("fs").readFileSync("spikes/envoy/image.lock.json")).image')
reports="$PWD/evidence/sprint03a-b"
mkdir -p "$PWD/.local/trivy-cache"
scanner='aquasec/trivy:0.69.1@sha256:1c78ed1ef824ab8bb05b04359d186e4c1229d0b3e67005faacb54a7d71974f73'
status=0
docker image inspect "$image" > "$reports/image-inspect.json" || status=1
docker run --rm --network none --read-only --user "$(id -u):$(id -g)" --cap-drop ALL \
  --security-opt no-new-privileges:true --entrypoint /usr/local/bin/envoy "$image" --version \
  > "$reports/envoy-version.log" 2>&1 || status=1
docker run --rm --user "$(id -u):$(id -g)" -e TRIVY_CACHE_DIR=/cache \
  -v "$PWD/.local/trivy-cache:/cache" -v "$reports:/reports" "$scanner" image --image-src remote \
  --severity HIGH,CRITICAL --exit-code 1 --format json --output /reports/image-vulnerabilities.json "$image" \
  > "$reports/image-scan.log" 2>&1 || status=1
docker run --rm --user "$(id -u):$(id -g)" -e TRIVY_CACHE_DIR=/cache \
  -v "$PWD/.local/trivy-cache:/cache" -v "$reports:/reports" "$scanner" image --image-src remote \
  --format cyclonedx --output /reports/image-sbom.cdx.json "$image" > "$reports/image-sbom.log" 2>&1 || status=1
printf 'scan_exit=%s\n' "$status"
exit "$status"
