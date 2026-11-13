import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { execFileSync, spawnSync } from 'node:child_process';

const output = process.argv[2];
assert.ok(output && !fs.existsSync(output), 'choose a fresh evidence directory');
const git = (...args) => execFileSync('git', args);
assert.equal(git('status', '--porcelain', '--untracked-files=no').toString().trim(), '', 'commit sources first');
fs.mkdirSync(output, { recursive: true });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = (file) => fs.existsSync(file) ? fs.readFileSync(file) : gunzipSync(fs.readFileSync(`${file}.gz`));
const record = { started_at: new Date().toISOString(), argv: process.argv, cwd: process.cwd(),
  source_commit: git('rev-parse', 'HEAD').toString().trim(), source_clean: true,
  node_version: process.version, commands: [] };
function capture(name, program, args) {
  const started_at = new Date().toISOString();
  const child = spawnSync(program, args, { timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  const streams = {};
  for (const stream of ['stdout', 'stderr']) {
    const bytes = child[stream] ?? Buffer.alloc(0);
    fs.writeFileSync(path.join(output, `${name}.${stream}`), bytes);
    streams[`${stream}_sha256`] = hash(bytes);
  }
  record.commands.push({ name, program, args, started_at, ended_at: new Date().toISOString(),
    exit_code: child.status, signal: child.signal, error: child.error?.message ?? null, ...streams });
  console.log(`${name}: exit=${child.status}`);
  assert.equal(child.status, 0, `${name} failed; retain attempt`);
}
try {
  const integrity = [];
  for (const [attempt, failures] of [['upstream-02', ['repository-locations']], ['upstream-03', []]]) {
    const directory = `evidence/sprint04a-a/${attempt}`;
    const receipt = JSON.parse(fs.readFileSync(`${directory}/commands.json`));
    assert.equal(receipt.source_clean, true);
    assert.deepEqual(receipt.failed_commands, failures);
    for (const command of receipt.commands) {
      for (const stream of ['stdout', 'stderr']) {
        assert.equal(hash(read(`${directory}/${command.name}.${stream}`)), command[`${stream}_sha256`]);
      }
      assert.equal(command.exit_code, failures.includes(command.name) ? 22 : 0);
    }
    for (const source of receipt.source_hashes) {
      assert.equal(hash(git('show', `${receipt.source_commit}:${source.file}`)), source.sha256);
    }
    integrity.push({ attempt, source_commit: receipt.source_commit, verified_commands: receipt.commands.length,
      verified_source_objects: receipt.source_hashes.length, failed_commands: failures,
      receipt_sha256: hash(fs.readFileSync(`${directory}/commands.json`)) });
  }
  const protectedFiles = git('ls-files', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs').toString().trim().split('\n');
  for (const file of protectedFiles) {
    assert.equal(hash(fs.readFileSync(file)), hash(git('show', `e5adeb4c3ea163d0028c9f29bed07b1128fb1065:${file}`)));
  }
  fs.writeFileSync(path.join(output, 'integrity.json'), JSON.stringify({ upstream_attempts: integrity,
    immutable_contract_files: protectedFiles, runtime_candidate_executed: false }, null, 2) + '\n');
  capture('collector-syntax', process.execPath, ['--check', 'spikes/envoy/strict-research.mjs']);
  capture('checker-syntax', process.execPath, ['--check', 'spikes/envoy/strict-check.mjs']);
  capture('immutable-baseline', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']);
  capture('source-whitespace', 'git', ['diff', '--check', 'e5adeb4', '--', 'spikes/envoy/strict-research.mjs',
    'spikes/envoy/strict-check.mjs', 'docs/reports/sprint04a-a-envoy.md']);
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  capture('scanner-version', 'flock', ['/tmp/aegisgate-sprint02-fixtures.lock', 'docker', 'run', '--rm',
    '--network', 'none', scanner, 'version']);
  for (const [name, target] of [['source', 'spikes/envoy'], ['evidence', 'evidence/sprint04a-a'],
    ['report', 'docs/reports/sprint04a-a-envoy.md']]) {
    capture(`${name}-secrets`, 'flock', ['/tmp/aegisgate-sprint02-fixtures.lock', 'docker', 'run', '--rm',
      '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`, '-v', `${process.cwd()}:/repo:ro`,
      scanner, 'dir', `/repo/${target}`, '--config', '/repo/.github/gitleaks.toml', '--redact', '--no-banner']);
  }
} catch (error) {
  record.error = error.stack;
  process.exitCode = 1;
} finally {
  record.ended_at = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(record, null, 2) + '\n');
}
