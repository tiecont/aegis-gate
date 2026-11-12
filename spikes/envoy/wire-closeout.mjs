import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
import { supplementalNegatives, supplementalTestNames } from '../edge-comparison/supplemental.mjs';

process.umask(0o077); assertLock();
const reportOnly = process.argv[2] === '--report-only';
const root = process.cwd(); const base = 'evidence/sprint04a-b';
const output = path.join(base, reportOnly ? 'report-verification' : 'verification');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sha = (data) => createHash('sha256').update(data).digest('hex');
const hash = (file) => sha(fs.readFileSync(file));
assert.equal(git('status', '--porcelain'), '', 'commit proof sources before verification');
assert.ok(!fs.existsSync(output), 'never overwrite evidence'); fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const record = { source_commit: git('rev-parse', 'HEAD'), source_clean: true, argv: process.argv,
  started_at: new Date().toISOString(), node: process.version, node_sha256: hash(process.execPath),
  tool_sha256: hash('spikes/envoy/wire-closeout.mjs'), commands: [], failures: [] };
function capture(label, program, args) {
  const started_at = new Date().toISOString();
  const run = spawnSync(program, args, { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  for (const stream of ['stdout', 'stderr']) fs.writeFileSync(path.join(output, `${label}.${stream}.txt`), run[stream] ?? '');
  record.commands.push({ label, program, args, cwd: root, started_at, ended_at: new Date().toISOString(), exit_code: run.status,
    signal: run.signal, error: run.error?.message, stdout_sha256: hash(path.join(output, `${label}.stdout.txt`)),
    stderr_sha256: hash(path.join(output, `${label}.stderr.txt`)) });
  if (run.status !== 0) record.failures.push(label);
  console.log(`${label}: exit=${run.status}`);
}
if (!reportOnly) {
  const checks = [];
  for (const attempt of ['attempt01', 'attempt02', 'attempt03', 'attempt04']) {
    const directory = path.join(base, attempt);
    for (const line of fs.readFileSync(path.join(directory, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
      const [expected, filename] = line.split('  '); assert.equal(hash(path.join(directory, filename)), expected);
    }
    const commands = JSON.parse(fs.readFileSync(path.join(directory, 'commands.json')));
    for (const source of commands.source_hashes) {
      assert.equal(sha(execFileSync('git', ['show', `${commands.source_commit}:${source.file}`])), source.sha256);
    }
    checks.push({ attempt, source_commit: commands.source_commit, source_clean: commands.source_clean,
      manifest_valid: true, historical_source_hashes_valid: true });
  }
  fs.writeFileSync(path.join(output, 'historical-source-verification.json'), JSON.stringify(checks, null, 2) + '\n');
  const manifest = JSON.parse(fs.readFileSync('spikes/edge-comparison/manifest.json'));
  const files = ['spikes/pingora/lab.mjs', ...['manifest.json', 'contract.mjs', 'supplemental.mjs', 'evaluate.mjs', 'tls-observer.mjs'].map((f) => `spikes/edge-comparison/${f}`)];
  const immutable = { baseline: 'e5adeb4c3ea163d0028c9f29bed07b1128fb1065',
    test_ids: [...manifest.baseline_tests, ...supplementalTestNames], rejection_contract: manifest.rejection_contract,
    encoded_targets: manifest.encoded_targets,
    raw_negatives: [...manifest.negatives, ...supplementalNegatives.map((n) => ({ ...n, name: `supplemental-${n.name}` }))]
      .map(({ name, request }) => ({ name, bytes: Buffer.byteLength(request), sha256: sha(request) })),
    raw_and_expected_source_hashes: files.map((file) => {
      const pinned = sha(execFileSync('git', ['show', `e5adeb4c3ea163d0028c9f29bed07b1128fb1065:${file}`]));
      assert.equal(hash(file), pinned); return { file, baseline_sha256: pinned, current_sha256: hash(file) };
    }) };
  assert.equal(immutable.test_ids.length, 75);
  fs.writeFileSync(path.join(output, 'immutable-raw-expected.json'), JSON.stringify(immutable, null, 2) + '\n');
  const syntax = fs.readdirSync('spikes/envoy').filter((name) => name.startsWith('wire-') && name.endsWith('.mjs'));
  for (const file of syntax) capture(`syntax-${file}`, process.execPath, ['--check', `spikes/envoy/${file}`]);
  capture('focused-tests', process.execPath, ['--test', 'spikes/envoy/config.test.mjs', 'spikes/edge-comparison/contract.test.mjs',
    'spikes/edge-comparison/evaluate.test.mjs', 'spikes/edge-comparison/tls-observer.test.mjs', 'spikes/envoy/wire-observer.test.mjs']);
  capture('source-whitespace', 'git', ['diff', '--check', '6e113e1', '--', 'spikes/envoy']);
}
const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
for (const [label, target] of reportOnly ? [['report', 'docs/reports/sprint04a-b-wire-review.md']] : [['source', 'spikes/envoy'], ['evidence', base]]) {
  capture(`${label}-secrets`, 'docker', ['run', '--rm', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`,
    '-v', `${root}:/repo:ro`, '-v', `${path.join(root, output)}:/reports`, scanner, 'dir', `/repo/${target}`,
    '--config', '/repo/.github/gitleaks.toml', '--redact', '--report-format', 'json', '--report-path', `/reports/${label}-secrets.json`, '--no-banner']);
}
record.ended_at = new Date().toISOString();
fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(record, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'SHA256SUMS'), fs.readdirSync(output).sort().map((f) => `${hash(path.join(output, f))}  ${f}`).join('\n') + '\n', { flag: 'wx' });
if (record.failures.length) process.exitCode = 1;
