import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertLock } from './wire-fixtures.mjs';

process.umask(0o077); assertLock();
const output = path.resolve(process.argv[2]); const root = process.cwd();
assert.ok(output.startsWith(path.join(root, 'evidence/sprint04b-c/')) && !fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
const sha = (b) => createHash('sha256').update(b).digest('hex');
const hash = (f) => sha(fs.readFileSync(f));
assert.equal(git('status', '--porcelain'), '', 'commit source/report/receipts before verification');
const record = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'), argv: process.argv,
  cwd: root, node: process.version, node_sha256: hash(process.execPath), started_at: new Date().toISOString(), commands: [], attempts: [] };
fs.mkdirSync(output, { recursive: true });
const save = () => fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(record, null, 2) + '\n');
save();
function command(label, program, args) {
  const started = new Date().toISOString(); const c = spawnSync(program, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  for (const stream of ['stdout', 'stderr']) fs.writeFileSync(path.join(output, `${label}.${stream}`), c[stream] ?? '');
  record.commands.push({ label, program, args, cwd: root, started_at: started, ended_at: new Date().toISOString(), exit_code: c.status, signal: c.signal, error: c.error?.message,
    stdout_sha256: hash(path.join(output, `${label}.stdout`)), stderr_sha256: hash(path.join(output, `${label}.stderr`)) }); save();
  console.log(`${label}: exit=${c.status}`); assert.equal(c.status, 0, label);
}
try {
  for (const dir of ['attempt01', 'attempt02']) {
    const base = path.join('evidence/sprint04b-c', dir); const r = JSON.parse(fs.readFileSync(path.join(base, 'commands.json')));
    assert.equal(r.source_tree, git('rev-parse', `${r.source_commit}^{tree}`)); assert.equal(r.source_clean, true);
    for (const { file, sha256 } of r.source_hashes) assert.equal(sha(execFileSync('git', ['show', `${r.source_commit}:${file}`])), sha256);
    for (const { file, sha256 } of [...r.historical_receipts, ...r.immutable]) assert.equal(hash(file), sha256);
    for (const c of r.commands) for (const stream of ['stdout', 'stderr']) assert.equal(hash(path.join(base, `${c.label}.${stream}`)), c[`${stream}_sha256`]);
    for (const line of fs.readFileSync(path.join(base, 'SHA256SUMS'), 'utf8').trim().split('\n')) {
      const [expected, file] = line.split('  '); assert.equal(hash(path.join(base, file)), expected);
    }
    assert.deepEqual(r.cleanup.remaining_owned_containers, []); assert.equal(r.cleanup.lock_held_through_cleanup, true);
    record.attempts.push({ dir, source_commit: r.source_commit, files: fs.readdirSync(base).length, sha256sums: hash(path.join(base, 'SHA256SUMS')) });
  }
  const historic = JSON.parse(fs.readFileSync('evidence/sprint04a-b/attempt04/probes.json'));
  const fresh = JSON.parse(fs.readFileSync('evidence/sprint04b-c/attempt01/unchanged23.json'));
  assert.equal(fresh.tests.length, 23); assert.deepEqual(fresh.tests.map((t) => t.name), historic.tests.map((t) => t.name));
  assert.deepEqual(fresh.failures, historic.failures);
  const original75 = JSON.parse(fs.readFileSync('evidence/sprint04a-b/attempt02/diagnostic75-results.json'));
  const fresh75 = JSON.parse(fs.readFileSync('evidence/sprint04b-c/attempt01/unchanged75-results.json'));
  assert.equal(fresh75.tests.length, 75); assert.deepEqual(fresh75.tests.map((t) => t.name), original75.tests.map((t) => t.name));
  assert.deepEqual(fresh75.tests.filter((t) => t.status !== 'pass').map((t) => t.name), original75.tests.filter((t) => t.status !== 'pass').map((t) => t.name));
  record.historical23 = { probes: 23, failed: fresh.failures, failed_count: fresh.failures.length };
  record.unchanged75 = { tests: 75, failed: fresh75.tests.filter((t) => t.status !== 'pass').map((t) => t.name) };
  command('whitespace', 'git', ['diff', '--check', 'cbb5f71']);
  command('observer-transparency', process.execPath, ['--test', 'spikes/envoy/sprint04b-observer.test.mjs']);
  for (const file of git('ls-files', 'spikes/envoy/sprint04b-*').split('\n').filter((f) => f.endsWith('.mjs'))) command(`syntax-${path.basename(file)}`, process.execPath, ['--check', file]);
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  for (const [label, target] of [['source', 'spikes/envoy'], ['evidence', 'evidence/sprint04b-c'], ['report', 'docs/reports/sprint04b-c-protocol.md']]) {
    command(`secrets-${label}`, 'docker', ['run', '--rm', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`,
      '-v', `${root}:/repo:ro`, '-v', `${output}:/reports`, scanner, 'dir', `/repo/${target}`, '--config', '/repo/.github/gitleaks.toml', '--redact',
      '--report-format', 'json', '--report-path', `/reports/${label}-secrets.json`, '--no-banner']);
  }
} catch (e) { record.fatal = e.stack; process.exitCode = 1; }
finally {
  assertLock(); record.ended_at = new Date().toISOString(); save();
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), fs.readdirSync(output).sort().map((f) => `${hash(path.join(output, f))}  ${f}`).join('\n') + '\n', { flag: 'wx' });
}
