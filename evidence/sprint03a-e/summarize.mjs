import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { evaluate } from '../../spikes/edge-comparison/evaluate.mjs';

const root = process.cwd();
const output = 'evidence/sprint03a-e';
const read = (p) => JSON.parse(fs.readFileSync(p));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hash = (p) => digest(fs.readFileSync(p));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const harnessCommit = '4179b42b9616c2a5ff5aac0e747564e496bde346';
const harnessFiles = ['spikes/pingora/lab.mjs', ...['manifest.json', 'run.mjs', 'contract.mjs', 'evaluate.mjs', 'supplemental.mjs', 'extract-baseline.mjs'].map((p) => `spikes/edge-comparison/${p}`)];
const summary = { recorded_at: new Date().toISOString(), reviewer_head_before_report_commit: git('rev-parse', 'HEAD'),
  harness_commit: harnessCommit, harness_files: harnessFiles.map((file) => {
    const expected = digest(execFileSync('git', ['show', `${harnessCommit}:${file}`]));
    assert.equal(hash(file), expected);
    return { file, sha256: expected };
  }), external_inputs_at_finalization: [
    '/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node',
    '/home/tiecont/Projects/aegis-gate/.local/tools/bin/cargo-audit',
    '/usr/lib/libssl.so.3', '/usr/lib/libcrypto.so.3',
  ].map((file) => ({ file, sha256: hash(file) })), candidates: {}, retained_historical_runs: [] };
const sourceCommits = { pingora: 'ca573d2c8aee21ed1943e3e66778d1e997cd04af', hyper: 'c17e0bf590ad4d229d1d43f139b4dfd25f63df72', envoy: 'f7660dd44582badfd1815aaa17b7f8e6a4b3c58b' };
for (const name of ['pingora', 'hyper', 'envoy']) {
  const result = read(`${output}/${name}/results.json`);
  if (name === 'pingora') {
    const retained = '416358486ea4221c8b0141b7d6895b81f61d42d05f65d56d5aaf6184865c0152';
    assert.equal(result.candidate.artifacts[0].sha256, retained);
    const adr = execFileSync('git', ['show', '668b8d998d8a39f3a554a9e42ad6a1a270049d27:docs/ADR-011-pingora-evaluation.md'], { encoding: 'utf8' });
    assert.ok(adr.includes(retained));
    summary.retained_pingora_binary_binding = { sha256: retained, baseline_commit: '668b8d998d8a39f3a554a9e42ad6a1a270049d27',
      recorded_in: 'docs/ADR-011-pingora-evaluation.md', prior_adr_sha256: digest(adr), freshly_rebuilt_by_reviewer: false };
  }
  const evaluated = evaluate(result);
  assert.equal(evaluated.mandatory_tests, 75);
  const prefix = `spikes/${name}/`;
  const files = git('ls-tree', '-r', '--name-only', sourceCommits[name], prefix).split('\n')
    .filter((f) => /(?:Cargo\.(?:toml|lock)|src\/.*\.rs|\.mjs|\/launch|image\.lock\.json)$/.test(f) && !harnessFiles.includes(f));
  const sources = files.map((file) => {
    const expected = digest(execFileSync('git', ['show', `${sourceCommits[name]}:${file}`]));
    assert.equal(hash(file), expected, `candidate source changed: ${file}`);
    return { file, sha256: expected };
  });
  summary.candidates[name] = { source_commit: sourceCommits[name], sources, result_sha256: hash(`${output}/${name}/results.json`),
    ...evaluated, started_at: result.started_at, completed_at: result.completed_at,
    runtime_artifacts: result.candidate.artifacts,
    failures: result.tests.filter((t) => t.status === 'fail'),
    malformed_observations: result.ingress_observations.filter((r) => r.origin_dispatches || r.origin_inbound_bytes || r.origin_parse_errors || !/^HTTP\/1\.[01] 4\d\d/.test(r.response) && !(r.response === '' && r.peer_closed && !r.timed_out)),
    tls_authority_protocol_health_tests: result.tests.filter((t) => /TLS|SNI|HTTP2|body-streaming|WebSocket|gRPC|rotation|snapshot|pool|health|cancellation/.test(t.name)),
    benchmark: result.benchmark,
    benchmark_resources_valid_for_proxy: name !== 'envoy',
  };
}
for (const file of [
  'evidence/sprint03a-d/pingora-instrumentation-failure.json',
  'evidence/sprint03a-a/results.json', 'evidence/sprint03a-a/corrected/results.json',
  'evidence/sprint03a-c/shared-run-01.json', 'evidence/sprint03a-c/shared-run-02.json',
  ...git('ls-tree', '-r', '--name-only', sourceCommits.envoy, 'evidence/sprint03a-b/').split('\n').filter((f) => /run-\d+-results\.json$/.test(f)),
]) {
  const result = read(file);
  summary.retained_historical_runs.push({ file, sha256: hash(file), tests: result.tests.length,
    passed: result.tests.filter((t) => t.status === 'pass').length, failed: result.tests.filter((t) => t.status === 'fail').length,
    fatal: result.fatal ?? null, result: result.result,
    selected_as_reviewer_reproduction: false });
}
summary.audits = Object.fromEntries([['pingora', 'prepare/pingora-audit.stdout.txt'], ['hyper', 'hyper-build/audit.stdout.txt']].map(([name, file]) => {
  const audit = read(`${output}/${file}`);
  assert.deepEqual(audit.settings.ignore, []);
  return [name, { database: audit.database, package_count: audit.lockfile['dependency-count'], vulnerabilities: audit.vulnerabilities,
    warnings: audit.warnings, sha256: hash(`${output}/${file}`) }];
}));
const image = read(`${output}/image-review/image-vulnerabilities.json`);
summary.image_review = { image: image.ArtifactName, scan_created_at: image.CreatedAt, scanner: image.Trivy,
  metadata: { ImageID: image.Metadata.ImageID, RepoDigests: image.Metadata.RepoDigests, DiffIDs: image.Metadata.DiffIDs, OS: image.Metadata.OS },
  results: image.Results.map((r) => ({ target: r.Target, class: r.Class, type: r.Type, high_critical_findings: r.Vulnerabilities ?? [] })),
  scan_sha256: hash(`${output}/image-review/image-vulnerabilities.json`),
  archive_binding: fs.readFileSync(`${output}/image-binding/bind.stdout.txt`, 'utf8').trim(),
  limitations: ['Scanner detected OS packages only; no language-specific files. No exhaustive scan of embedded Envoy/BoringSSL/C++ dependencies or signature attestation is established.'] };
summary.envoy_process_benchmark = read(`${output}/envoy-benchmark/results.json`);
summary.origin_calibration = read(`${output}/origin-calibration.json`);
summary.disposition = 'All candidates NO-GO; no architecture, production or gate acceptance. Root owns final integration/CI.';
fs.writeFileSync(`${output}/review-summary.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(summary.candidates).map(([name, r]) => [name, { passed: r.passed, total: r.mandatory_tests, source_commit: r.source_commit }]))));
