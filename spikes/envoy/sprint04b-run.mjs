import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';

process.umask(0o077); assertLock();
const root = process.cwd(); const output = path.resolve(process.argv[2]);
assert.ok(output.startsWith(path.join(root, 'evidence/sprint04b-c/')) && !fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hash = (file) => sha(fs.readFileSync(file));
assert.equal(git('status', '--porcelain'), '', 'commit source before proof');
const sources = git('ls-files', 'spikes/envoy', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs', 'spikes/pingora/package.json', 'spikes/pingora/package-lock.json').split('\n');
const historical = git('ls-files', 'evidence/sprint04a-b').split('\n');
const record = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  base_merge: 'cbb5f71db84b9489bf4a6260696bbba29ab4a561', source_clean: true,
  argv: process.argv, cwd: root, node: process.version, executable: process.execPath, node_sha256: hash(process.execPath),
  openssl: process.versions.openssl, started_at: new Date().toISOString(), commands: [],
  source_hashes: sources.map((file) => ({ file, sha256: hash(file) })),
  historical_receipts: historical.map((file) => {
    const before = sha(execFileSync('git', ['show', `cbb5f71:${file}`], { maxBuffer: 32 * 1024 * 1024 }));
    assert.equal(hash(file), before); return { file, sha256: before };
  }) };
const immutable = ['spikes/pingora/lab.mjs', ...['manifest.json', 'contract.mjs', 'supplemental.mjs', 'evaluate.mjs', 'tls-observer.mjs'].map((f) => `spikes/edge-comparison/${f}`), 'spikes/envoy/wire-probes.mjs'];
record.immutable = immutable.map((file) => {
  const before = sha(execFileSync('git', ['show', `cbb5f71:${file}`])); assert.equal(hash(file), before);
  return { file, sha256: before };
});
fs.mkdirSync(output, { recursive: true });
const save = () => fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(record, null, 2) + '\n');
save();
async function capture(label, program, args, environment = {}, timeoutMs = 240000) {
  const out = fs.openSync(path.join(output, `${label}.stdout`), 'wx', 0o600);
  const err = fs.openSync(path.join(output, `${label}.stderr`), 'wx', 0o600);
  const command = { label, program, args, cwd: root, environment, timeout_ms: timeoutMs, started_at: new Date().toISOString() };
  record.commands.push(command); save();
  const child = spawn(program, args, { cwd: root, env: { ...process.env, ...environment }, stdio: ['ignore', out, err] });
  const timer = setTimeout(() => { command.timed_out = true; child.kill('SIGTERM'); }, timeoutMs);
  const kill = setTimeout(() => child.kill('SIGKILL'), timeoutMs + 8000);
  const outcome = await new Promise((resolve) => {
    child.once('error', (e) => resolve({ exit_code: null, error: e.message }));
    child.once('exit', (code, signal) => resolve({ exit_code: code, signal }));
  });
  clearTimeout(timer); clearTimeout(kill); fs.closeSync(out); fs.closeSync(err);
  Object.assign(command, outcome, { ended_at: new Date().toISOString(), stdout_sha256: hash(path.join(output, `${label}.stdout`)), stderr_sha256: hash(path.join(output, `${label}.stderr`)) });
  save(); console.log(`${label}: exit=${outcome.exit_code}`); return outcome.exit_code;
}
function ownedContainers() {
  const ids = execFileSync('docker', ['ps', '-aq', '--filter', 'name=aegis-envoy-'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  if (!ids.length) return [];
  return JSON.parse(execFileSync('docker', ['inspect', ...ids], { encoding: 'utf8' }))
    .filter((c) => c.Mounts.some((m) => m.Source.startsWith(path.join(root, '.local/')))).map((c) => c.Name.slice(1));
}
const local = path.join(root, '.local'); fs.mkdirSync(local, { recursive: true });
const initial = new Set(fs.readdirSync(local)); const runRoot = fs.mkdtempSync(path.join(local, 'sprint04b-c-'));
record.fixture_root = runRoot; save();
try {
  assert.equal(await capture('syntax', process.execPath, ['--check', 'spikes/envoy/sprint04b-protocol.mjs']), 0);
  assert.equal(await capture('observer-unit', process.execPath, ['--test', 'spikes/envoy/wire-observer.test.mjs', 'spikes/envoy/sprint04b-observer.test.mjs']), 0);
  assert.equal(await capture('baseline-manifest', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']), 0);
  await capture('image', 'docker', ['image', 'inspect', JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')).image, '--format', '{{.Id}} {{.Os}}/{{.Architecture}}']);
  await capture('openssl', 'openssl', ['version']);
  const env = { AEGIS_CANDIDATE_NAME: 'envoy-1.40.2-retain-original-h2-host', AEGIS_CANDIDATE_COMMAND: process.execPath,
    AEGIS_CANDIDATE_ARGS: JSON.stringify([path.join(root, 'spikes/envoy/recovery-launcher.mjs')]),
    AEGIS_CANDIDATE_ARTIFACTS: JSON.stringify(sources.filter((f) => f.startsWith('spikes/envoy/')).map((f) => path.join(root, f))), AEGIS_RUN_ROOT: runRoot };
  await capture('unchanged75', process.execPath, ['spikes/edge-comparison/run.mjs'], env);
  const resultPath = fs.readFileSync(path.join(output, 'unchanged75.stdout'), 'utf8').match(/^Evidence: (.+\/results\.json)$/m)?.[1];
  assert.ok(resultPath?.startsWith(runRoot), '75-case proof incomplete; preserve attempt');
  for (const file of ['results.json', 'proxy.log']) fs.copyFileSync(path.join(path.dirname(resultPath), file), path.join(output, `unchanged75-${file}`));
  await capture('evaluate75', process.execPath, ['spikes/edge-comparison/evaluate.mjs', path.join(output, 'unchanged75-results.json')]);
  await capture('unchanged23', process.execPath, ['spikes/envoy/wire-probes.mjs', path.join(output, 'unchanged23.json'), path.join(runRoot, 'historical23')]);
  await capture('protocol', process.execPath, ['spikes/envoy/sprint04b-protocol.mjs', path.join(output, 'protocol.json'), path.join(runRoot, 'protocol')], {}, 120000);
} catch (e) { record.fatal = e.stack; process.exitCode = 1; }
finally {
  record.cleanup = { stopped: [], lock_held_through_cleanup: true };
  for (const name of ownedContainers()) { await capture(`cleanup-${name}`, 'docker', ['stop', '--timeout', '2', name], {}, 7000); record.cleanup.stopped.push(name); }
  // Terminate only launchers whose absolute module path belongs to this worktree.
  for (const pid of fs.readdirSync('/proc').filter((p) => /^\d+$/.test(p))) {
    try {
      const args = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
      if (args[1] === path.join(root, 'spikes/envoy/recovery-launcher.mjs')) process.kill(Number(pid), 'SIGTERM');
    } catch (e) { if (!['ENOENT', 'ESRCH'].includes(e.code)) throw e; }
  }
  record.cleanup.remaining_owned_containers = ownedContainers(); assertLock();
  if (record.cleanup.remaining_owned_containers.length) process.exitCode = 1;
  else for (const name of fs.readdirSync(local)) {
    if (!initial.has(name) && (name.startsWith('envoy-run-') || path.join(local, name) === runRoot)) fs.rmSync(path.join(local, name), { recursive: true });
  }
  for (const { file, sha256 } of [...record.source_hashes, ...record.historical_receipts]) assert.equal(hash(file), sha256);
  record.ended_at = new Date().toISOString(); save();
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), fs.readdirSync(output).sort().map((f) => `${hash(path.join(output, f))}  ${f}`).join('\n') + '\n', { flag: 'wx' });
  // Collector success never means candidate security PASS; nested failures remain.
}
