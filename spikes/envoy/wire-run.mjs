import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { evaluate } from '../edge-comparison/evaluate.mjs';
import { assertLock } from './wire-fixtures.mjs';

process.umask(0o077); assertLock();
const root = process.cwd(); const output = path.resolve(process.argv[2] ?? 'evidence/sprint04a-b/attempt01');
assert.ok(output.startsWith(path.join(root, 'evidence/sprint04a-b/')));
assert.ok(!fs.existsSync(output), 'immutable evidence requires a fresh directory');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hash = (file) => sha(fs.readFileSync(file));
const status = git('status', '--porcelain'); assert.equal(status, '', 'commit sources before proof');
const sources = git('ls-files', 'spikes/envoy', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs', 'spikes/pingora/package.json', 'spikes/pingora/package-lock.json').split('\n');
const immutable = ['spikes/pingora/lab.mjs', ...['manifest.json', 'contract.mjs', 'supplemental.mjs', 'evaluate.mjs', 'tls-observer.mjs'].map((f) => `spikes/edge-comparison/${f}`)];
const baseline = 'e5adeb4c3ea163d0028c9f29bed07b1128fb1065';
const record = { source_commit: git('rev-parse', 'HEAD'), source_clean: status === '',
  started_at: new Date().toISOString(), node: process.version, executable: process.execPath,
  node_sha256: hash(process.execPath), argv: process.argv, baseline,
  source_hashes: sources.map((file) => ({ file, sha256: hash(file) })),
  immutable: immutable.map((file) => {
    const before = sha(execFileSync('git', ['show', `${baseline}:${file}`]));
    assert.equal(hash(file), before, `immutable input changed: ${file}`);
    return { file, baseline_sha256: before, current_sha256: hash(file) };
  }), commands: [] };
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const save = () => fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(record, null, 2) + '\n');
function capture(label, program, args, env = {}) {
  const started_at = new Date().toISOString();
  const child = spawnSync(program, args, { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024, timeout: 100000, killSignal: 'SIGTERM' });
  for (const stream of ['stdout', 'stderr']) fs.writeFileSync(path.join(output, `${label}.${stream}.txt`), child[stream] ?? '');
  record.commands.push({ label, program, args, environment: env, cwd: root, started_at,
    ended_at: new Date().toISOString(), exit_code: child.status, signal: child.signal, error: child.error?.message,
    stdout_sha256: hash(path.join(output, `${label}.stdout.txt`)), stderr_sha256: hash(path.join(output, `${label}.stderr.txt`)) });
  save(); console.log(`${label}: exit=${child.status}`); return child;
}
function cleanupOwnedLaunchers() {
  // spawnSync timeout does not terminate grandchildren. Match this worktree only.
  for (const entry of fs.readdirSync('/proc').filter((s) => /^\d+$/.test(s))) {
    try {
      const args = fs.readFileSync(`/proc/${entry}/cmdline`, 'utf8').split('\0');
      if (args[1] !== path.join(root, 'spikes/envoy/recovery-launcher.mjs')) continue;
      const pid = Number(entry);
      capture(`cleanup-${pid}`, 'docker', ['stop', '--timeout', '2', `aegis-envoy-${pid}`]);
      process.kill(pid, 'SIGTERM');
    } catch {}
  }
}
let incomplete = false;
try {
  capture('versions', 'openssl', ['version']);
  capture('image', 'docker', ['image', 'inspect', JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')).image, '--format', '{{.Id}} {{.Os}}/{{.Architecture}}']);
  assert.equal(capture('manifest', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']).status, 0);
  const unit = capture('observer-unit', process.execPath, ['--test', 'spikes/envoy/wire-observer.test.mjs']);
  if (unit.status !== 0) incomplete = true;
  const local = path.join(root, '.local'); fs.mkdirSync(local, { recursive: true, mode: 0o700 });
  const runRoot = fs.mkdtempSync(path.join(local, 'wire-proof-'));
  record.fixture_root = runRoot; save();
  const launcher = path.join(root, 'spikes/envoy/recovery-launcher.mjs');
  const environment = { AEGIS_CANDIDATE_NAME: 'envoy-1.40.2-retain-original-h2-host',
    AEGIS_CANDIDATE_COMMAND: process.execPath, AEGIS_CANDIDATE_ARGS: JSON.stringify([launcher]),
    AEGIS_CANDIDATE_ARTIFACTS: JSON.stringify(sources.filter((f) => f.startsWith('spikes/envoy/')).map((f) => path.join(root, f))),
    AEGIS_RUN_ROOT: runRoot };
  for (const mode of ['unchanged75', 'diagnostic75']) {
    const extra = mode === 'diagnostic75' ? { AEGIS_WIRE_TRACE: path.join(output, 'diagnostic-wire.json') } : {};
    const args = mode === 'diagnostic75' ? ['--import', './spikes/envoy/wire-trace.mjs', 'spikes/edge-comparison/run.mjs'] : ['spikes/edge-comparison/run.mjs'];
    const run = capture(mode, process.execPath, args, { ...environment, ...extra });
    cleanupOwnedLaunchers();
    const resultsPath = run.stdout?.match(/^Evidence: (.+\/results\.json)$/m)?.[1];
    if (!resultsPath?.startsWith(runRoot)) { incomplete = true; continue; }
    for (const file of ['results.json', 'proxy.log']) fs.copyFileSync(path.join(path.dirname(resultsPath), file), path.join(output, `${mode}-${file}`));
    capture(`${mode}-evaluate`, process.execPath, ['spikes/edge-comparison/evaluate.mjs', path.join(output, `${mode}-results.json`)]);
    fs.writeFileSync(path.join(output, `${mode}-decision.json`), JSON.stringify(evaluate(JSON.parse(fs.readFileSync(resultsPath))), null, 2) + '\n');
  }
  const probes = capture('probes', process.execPath, ['spikes/envoy/wire-probes.mjs', path.join(output, 'probes.json'), path.join(runRoot, 'bounded-probes')]);
  cleanupOwnedLaunchers();
  if (probes.status !== 0) incomplete = true;
} catch (error) { record.fatal = error.stack; incomplete = true; }
finally {
  cleanupOwnedLaunchers();
  record.ended_at = new Date().toISOString(); record.recording_complete = !incomplete;
  for (const { file, sha256 } of record.source_hashes) assert.equal(hash(file), sha256, `source mutation: ${file}`);
  save();
  const manifest = fs.readdirSync(output).sort().map((f) => `${hash(path.join(output, f))}  ${f}`).join('\n') + '\n';
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), manifest, { flag: 'wx', mode: 0o600 });
  if (incomplete) process.exitCode = 1;
}
