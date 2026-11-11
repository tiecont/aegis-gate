import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { evaluate } from '../edge-comparison/evaluate.mjs';
process.umask(0o077);
const root = process.cwd();
const output = path.join(root, 'evidence/sprint03b-e/runtime-host-retention');
assert.ok(!fs.existsSync(output), 'immutable evidence: choose a fresh output');
const lock = '/tmp/aegisgate-sprint02-fixtures.lock';
const inode = fs.statSync(lock).ino;
assert.ok(fs.readFileSync('/proc/locks', 'utf8').split('\n').some((line) => {
  const fields = line.trim().split(/\s+/);
  return fields[1] === 'FLOCK' && fields[3] === 'WRITE' && fields[4] === String(process.ppid) && fields[5]?.endsWith(`:${inode}`);
}), 'run directly under flock for entire fixture lifetime');
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const harness = ['spikes/pingora/lab.mjs', ...['manifest.json', 'contract.mjs', 'supplemental.mjs', 'evaluate.mjs', 'tls-observer.mjs'].map((file) => `spikes/edge-comparison/${file}`)];
const files = [...harness, ...['config.mjs', 'recovery-config.mjs', 'recovery-launcher.mjs', 'recovery-run.mjs', 'image.lock.json'].map((file) => `spikes/envoy/${file}`)];
const record = { started_at: new Date().toISOString(), source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  source_clean: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim() === '',
  source_hashes: files.map((file) => ({ file, sha256: hash(file) })), commands: [] };
function capture(label, program, args, environment = {}) {
  const started_at = new Date().toISOString();
  const child = spawnSync(program, args, { cwd: root, env: { ...process.env, ...environment }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  for (const stream of ['stdout', 'stderr']) fs.writeFileSync(path.join(output, `${label}.${stream}.txt`), child[stream] ?? '');
  record.commands.push({ label, program, args, environment, started_at, ended_at: new Date().toISOString(), exit_code: child.status, signal: child.signal,
    stdout_sha256: hash(path.join(output, `${label}.stdout.txt`)), stderr_sha256: hash(path.join(output, `${label}.stderr.txt`)) });
  fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(`${label}: exit=${child.status}`);
  return child;
}
assert.ok(record.source_clean, 'commit executable source before recording proof');
assert.equal(capture('manifest', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']).status, 0);
const fixtureRoot = path.join(root, '.local/recovery-host-retention');
fs.mkdirSync(fixtureRoot, { mode: 0o700 });
const launcher = path.join(root, 'spikes/envoy/recovery-launcher.mjs');
const artifacts = files.filter((f) => f.startsWith('spikes/envoy/')).map((f) => path.join(root, f));
const run = capture('lab', process.execPath, ['spikes/edge-comparison/run.mjs'], {
  AEGIS_CANDIDATE_NAME: 'envoy-1.40.2-retain-original-h2-host', AEGIS_CANDIDATE_COMMAND: process.execPath,
  AEGIS_CANDIDATE_ARGS: JSON.stringify([launcher]), AEGIS_CANDIDATE_ARTIFACTS: JSON.stringify(artifacts), AEGIS_RUN_ROOT: fixtureRoot });
const resultPath = run.stdout?.match(/^Evidence: (.+\/results\.json)$/m)?.[1];
assert.ok(resultPath?.startsWith(fixtureRoot), 'retain incomplete run logs; do not invent result');
fs.copyFileSync(resultPath, path.join(output, 'results.json'));
fs.copyFileSync(path.join(path.dirname(resultPath), 'proxy.log'), path.join(output, 'proxy.log'));
capture('evaluate', process.execPath, ['spikes/edge-comparison/evaluate.mjs', path.join(output, 'results.json')]);
const result = JSON.parse(fs.readFileSync(resultPath));
fs.writeFileSync(path.join(output, 'decision.json'), JSON.stringify(evaluate(result), null, 2) + '\n');
for (const { file, sha256 } of record.source_hashes) assert.equal(hash(file), sha256, `source mutated during proof: ${file}`);
record.ended_at = new Date().toISOString();
fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(record, null, 2) + '\n');
