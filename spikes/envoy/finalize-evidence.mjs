import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const directory = 'evidence/sprint03a-b';
const read = (f) => JSON.parse(fs.readFileSync(path.join(directory, f)));
const hash = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const results = read('run-06-results.json');
const benchmark = read('benchmark-processes.json');
const scan = read('image-vulnerabilities.json');
const lock = JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json'));
const failures = results.tests.filter((t) => t.status === 'fail');
assert.equal(results.tests.length, 75);
assert.equal(new Set(results.tests.map((t) => t.name)).size, 75);
assert.ok(results.tests.every((t) => ['pass', 'fail'].includes(t.status)));
for (const artifact of results.candidate.artifacts) assert.equal(hash(artifact.path), artifact.sha256, 'candidate changed since final shared run');
const root = '/home/tiecont/Projects/aegis-gate';
const external = [process.execPath, ...['spikes/edge-comparison/run.mjs', 'spikes/edge-comparison/contract.mjs',
  'spikes/edge-comparison/manifest.json', 'spikes/edge-comparison/supplemental.mjs', 'spikes/pingora/lab.mjs',
  'scripts/image_identity.py'].map((f) => path.join(root, f))];
const dependencies = {
  node: { version: process.version, path: process.execPath, sha256: hash(process.execPath) },
  runtime_javascript_dependencies: 'Node builtin modules only; no npm packages',
  envoy: { ...lock, index_digest: lock.image.split('@')[1],
    platform: 'linux/amd64', platform_manifest_digest: 'sha256:16e0d4dac937ffa34103aa6ba1013dc2030b9de2a249273c8d23c7c5c2989664',
    config_digest: scan.Metadata.ImageID, crypto: 'BoringSSL; see envoy-version.log',
    identity: 'image-identity.log verifies exported index/platform/config/ordered layer hashes against scanned config',
    scan_limit: 'Trivy OS/package coverage is not a complete audit of statically linked Envoy/C++ dependencies',
    provenance_limit: 'immutable registry content pin and binary version verified; release signature/attestation not verified',
  },
  external_inputs_at_finalization: external.map((file) => ({ file, sha256: hash(file) })),
  launch_time_inputs: { artifacts: results.candidate.artifacts, lab_sha256: results.lab_sha256,
    manifest_sha256: results.test_manifest_sha256, supplemental_sha256: results.supplemental_sha256 },
};
fs.writeFileSync(path.join(directory, 'dependencies.json'), JSON.stringify(dependencies, null, 2) + '\n');
const findings = (scan.Results ?? []).flatMap((r) => r.Vulnerabilities ?? []);
const summary = { disposition: 'NO-GO', tests: 75, passed: 75 - failures.length, failed: failures.length,
  failures: failures.map(({ name, error, origin }) => ({ name, error, origin })),
  benchmark_result: benchmark.result, image_scan_high_critical: findings.filter((v) => ['HIGH', 'CRITICAL'].includes(v.Severity)).length,
  mandatory_failures_close_gate: true, production_or_architecture_approval: false,
};
fs.writeFileSync(path.join(directory, 'final-summary.json'), JSON.stringify(summary, null, 2) + '\n');
const owned = ['spikes/envoy', directory, 'docs/reports'].flatMap((dir) => fs.readdirSync(dir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && (dir !== 'docs/reports' || entry.name.startsWith('sprint03a-b-')))
  .map((entry) => path.join(dir, entry.name))).filter((file) => !file.endsWith('/SHA256SUMS')).sort();
fs.writeFileSync(path.join(directory, 'SHA256SUMS'), owned.map((file) => `${hash(file)}  ${file}\n`).join(''));
console.log(JSON.stringify({ disposition: summary.disposition, passed: summary.passed, failed: summary.failed }));
