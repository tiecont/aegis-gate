#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
scanner='ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f'
for scope in source evidence report; do
  case "$scope" in
    source) target=spikes/envoy ;;
    evidence) target=evidence/sprint03a-b ;;
    report) target=docs/reports/sprint03a-b-envoy.md ;;
  esac
  docker run --rm --network none --user "$(id -u):$(id -g)" \
    -v "$PWD:/repo:ro" -v "$PWD/evidence/sprint03a-b:/reports" "$scanner" dir \
    "/repo/$target" --config /repo/.github/gitleaks.toml --redact --report-format json \
    --report-path "/reports/$scope-secrets.json" --no-banner \
    > "evidence/sprint03a-b/$scope-secrets.log" 2>&1
done
