import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
import { strategies } from './sprint05a-c-config.mjs';
import { evaluate } from '../edge-comparison/evaluate.mjs';
import { setTimeout as delay } from 'node:timers/promises';
process.umask(0o077);
assertLock();
const root = process.cwd();
const [outArg, mode = 'windows', tap = 'tap'] = process.argv.slice(2);
assert.ok(outArg && strategies.includes(mode) && ['tap', 'plain'].includes(tap));
const output = path.resolve(outArg);
assert.ok(!fs.existsSync(output), 'fresh evidence required');
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim(), '', 'commit source first');
fs.mkdirSync(output, { recursive: true });
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = execFileSync('git', ['ls-files', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs', 'spikes/envoy/config.mjs', 'spikes/envoy/recovery-config.mjs', 'spikes/envoy/sprint05a-c-*', 'spikes/envoy/image.lock.json'], { encoding: 'utf8' }).trim().split('\n');
const record = { started_at: new Date().toISOString(), source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  source_tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(), node: process.version, argv: process.argv,
  scope: 'unchanged original75/evaluator; loopback only; passive tap optional; no gate exemptions',
  policy: mode, tap, lock: '/tmp/aegisgate-sprint02-fixtures.lock', source_hashes: files.map((file) => ({ file, sha256: hash(file) })), commands: [] };
const save = () => fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(record, null, 2) + '\n');
function command(label, program, args, env = {}) {
  const start = new Date().toISOString();
  const r = spawnSync(program, args, { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  for (const stream of ['stdout', 'stderr']) fs.writeFileSync(path.join(output, `${label}.${stream}`), r[stream] ?? '');
  record.commands.push({ label, program, args, env, started_at: start, ended_at: new Date().toISOString(), exit_code: r.status, signal: r.signal,
    stdout_sha256: hash(path.join(output, `${label}.stdout`)), stderr_sha256: hash(path.join(output, `${label}.stderr`)) });
  save(); console.log(`${label}: exit=${r.status}`); return r;
}
const fixture = path.join(root, '.local', `sprint05a-c-${path.basename(output)}`);
const generatedBefore = new Set(fs.existsSync('.local') ? fs.readdirSync('.local') : []);
try {
  assert.equal(command('baseline', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']).status, 0);
  command('image', 'docker', ['image', 'inspect', JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')).image, '--format', '{{.Id}} {{json .RepoDigests}}']);
  fs.mkdirSync(fixture, { recursive: true });
  const env = { AEGIS_CANDIDATE_NAME: `sprint05a-c-${mode}`, AEGIS_CANDIDATE_COMMAND: process.execPath,
    AEGIS_CANDIDATE_ARGS: JSON.stringify([path.join(root, 'spikes/envoy/sprint05a-c-launcher.mjs')]),
    AEGIS_CANDIDATE_ARTIFACTS: JSON.stringify(files.filter((f) => f.startsWith('spikes/envoy/')).map((f) => path.join(root, f))),
    AEGIS_SPRINT05A_C_POLICY: mode, AEGIS_RUN_ROOT: fixture };
  if (tap === 'tap') env.AEGIS_SPRINT05A_C_TAP = path.join(output, 'raw-h2.json');
  const run = command('original75', process.execPath, [...(tap === 'tap' ? ['--import', './spikes/envoy/sprint05a-c-tap.mjs'] : []), 'spikes/edge-comparison/run.mjs'], env);
  const resultPath = run.stdout?.match(/^Evidence: (.+\/results\.json)$/m)?.[1];
  assert.ok(resultPath?.startsWith(fixture), 'incomplete original proof');
  const result = JSON.parse(fs.readFileSync(resultPath));
  for (const file of ['results.json', 'proxy.log']) fs.copyFileSync(path.join(path.dirname(resultPath), file), path.join(output, file));
  const decision = evaluate(result);
  fs.writeFileSync(path.join(output, 'decision.json'), JSON.stringify(decision, null, 2) + '\n');
  command('evaluate', process.execPath, ['spikes/edge-comparison/evaluate.mjs', path.join(output, 'results.json')]);
  record.completed = true;
  record.decision = decision;
} catch (e) { record.error = e.stack; process.exitCode = 1; }
finally {
  assertLock();
  const ids = execFileSync('docker', ['ps', '-aq', '--filter', 'name=aegis-envoy-sprint05a-c-'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const owned = ids.length ? JSON.parse(execFileSync('docker', ['inspect', ...ids], { encoding: 'utf8' })).filter((c) => c.Mounts.some((m) => m.Source.startsWith(`${root}/.local/sprint05a-c-`))) : [];
  record.cleanup = { lock_held: true, stopped: [] };
  for (const c of owned) record.cleanup.stopped.push({ name: c.Name, exit_code: command(`stop-${c.Id.slice(0, 8)}`, 'docker', ['stop', '--timeout', '2', c.Id]).status });
  for (let attempt = 0; attempt < 50; attempt++) {
    record.cleanup.remaining = execFileSync('docker', ['ps', '-aq', '--filter', 'name=aegis-envoy-sprint05a-c-'], { encoding: 'utf8' }).trim();
    if (!record.cleanup.remaining) break;
    await delay(100);
  }
  save();
  assert.equal(record.cleanup.remaining, '');
  fs.rmSync(fixture, { recursive: true, force: true });
  for (const dir of fs.readdirSync('.local')) if (!generatedBefore.has(dir) && dir.startsWith('sprint05a-c-envoy-')) fs.rmSync(path.join('.local', dir), { recursive: true });
  record.cleanup.fixture_removed = !fs.existsSync(fixture);
  for (const { file, sha256 } of record.source_hashes) assert.equal(hash(file), sha256, file);
  record.ended_at = new Date().toISOString(); save();
  const manifest = fs.readdirSync(output).filter((f) => fs.statSync(path.join(output, f)).isFile()).sort().map((file) => ({ file, sha256: hash(path.join(output, file)) }));
  fs.writeFileSync(path.join(output, 'SHA256.json'), JSON.stringify(manifest, null, 2) + '\n');
}
