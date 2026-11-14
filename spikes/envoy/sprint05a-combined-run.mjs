import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';

process.umask(0o077); assertLock();
const [output] = process.argv.slice(2);
assert.match(output ?? '', /^evidence\/sprint05a-(?:root|f)\/candidate-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 << 20 }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
git('diff', '--exit-code', '541d1d9', 'HEAD', '--', 'spikes/edge-comparison',
  'spikes/pingora/lab.mjs', 'spikes/envoy/wire-probes.mjs', 'spikes/envoy/wire-observer.mjs');
fs.mkdirSync(output, { recursive: true }); fs.mkdirSync('.local', { recursive: true });
const initial = new Set(fs.readdirSync('.local'));
const fixture = fs.mkdtempSync(path.resolve('.local/sprint05a-combined-'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = git('ls-files', 'spikes/envoy', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs').split('\n');
const environment = { AEGIS_05A_D_POLICY: 'stream-errors',
  NODE_OPTIONS: `--import=${path.resolve('spikes/envoy/sprint05a-combined-select.mjs')}`,
  PINGORA_SPIKE_PROFILE: 'release', AEGIS_RUN_ROOT: fixture,
  AEGIS_CANDIDATE_NAME: 'envoy-1.40.2-sprint05a-te-and-protocol',
  AEGIS_CANDIDATE_COMMAND: process.execPath,
  AEGIS_CANDIDATE_ARGS: JSON.stringify([path.resolve('spikes/envoy/sprint05a-a-launcher.mjs')]),
  AEGIS_CANDIDATE_ARTIFACTS: JSON.stringify(files.filter((f) => f.startsWith('spikes/envoy/')).map((f) => path.resolve(f))) };
const record = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  source_clean: true, argv: process.argv, cwd: process.cwd(), started_at: new Date().toISOString(),
  node: process.version, node_binary_sha256: sha(fs.readFileSync(process.execPath)), environment,
  sources: files.map((file) => ({ file, sha256: sha(fs.readFileSync(file)) })), commands: [] };
const save = () => fs.writeFileSync(`${output}/commands.json`, JSON.stringify(record, null, 2) + '\n');
function run(label, program, args, expected = [0]) {
  assertLock(); const started_at = new Date().toISOString();
  const child = spawnSync(program, args, { env: { ...process.env, ...environment }, timeout: 240000, maxBuffer: 16 << 20 });
  const streams = ['stdout', 'stderr'].map((name) => {
    const file = `${output}/${label}.${name}`; const bytes = child[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes); return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  record.commands.push({ label, program, args, environment, started_at, ended_at: new Date().toISOString(),
    exit_code: child.status, signal: child.signal, error: child.error?.message, streams });
  save(); console.log(`${label}: exit=${child.status}`);
  assert.ok(expected.includes(child.status), `${label}: unexpected result`); return child;
}
let complete = true;
try {
  run('openssl', 'openssl', ['version']); run('docker', 'docker', ['version', '--format', '{{.Server.Version}}']);
  run('image', 'docker', ['image', 'inspect', JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')).image,
    '--format', '{{.Id}} {{json .RepoDigests}}']);
  run('immutable75', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']);
  const original = run('original75', process.execPath, ['spikes/edge-comparison/run.mjs'], [0, 1]);
  const resultPath = original.stdout.toString().match(/^Evidence: (.+)$/m)?.[1];
  assert.ok(resultPath?.startsWith(fixture + '/'));
  const bytes = fs.readFileSync(resultPath); fs.writeFileSync(`${output}/original75.json`, bytes);
  const result = JSON.parse(bytes); assert.ok(!result.fatal); assert.equal(result.tests.length, 75);
  record.original75 = { passed: result.tests.filter((t) => t.status === 'pass').length,
    failures: result.tests.filter((t) => t.status === 'fail').map((t) => ({ name: t.name, error: t.error, origin: t.origin })) };
  run('evaluate75', process.execPath, ['spikes/edge-comparison/evaluate.mjs', `${output}/original75.json`], [0, 1]);
  run('original23', process.execPath, ['spikes/envoy/wire-probes.mjs', path.resolve(output, 'original23.json'), path.join(fixture, 'original23')], [0, 1]);
  const extra = JSON.parse(fs.readFileSync(`${output}/original23.json`)); assert.equal(extra.tests.length, 23); assert.ok(!extra.fatal);
  record.original23 = { passed: extra.tests.filter((t) => t.status === 'pass').length, failures: extra.failures };
  run('controls', process.execPath, ['spikes/envoy/sprint04c-protocol.mjs', path.resolve(output, 'controls.json'), path.join(fixture, 'controls')]);
  const controls = JSON.parse(fs.readFileSync(`${output}/controls.json`)); assert.equal(controls.tests.length, 17);
  assert.ok(controls.tests.every((t) => t.status === 'observation-complete')); record.semantic_security_pass = false;
} catch (error) { record.error = error.stack; complete = false; }
finally {
  assertLock();
  try {
    const ids = execFileSync('docker', ['ps', '-aq', '--filter', 'name=^/aegis-envoy-', '--filter', 'name=^/aegis-sprint05a-a-'],
      { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    const owned = [];
    for (const id of ids) {
      const mounts = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .Mounts}}', id]));
      if (mounts.some((m) => m.Source.startsWith(path.resolve('.local') + '/'))) owned.push(id);
    }
    record.cleanup_stopped = owned;
    for (const id of owned) run(`cleanup-${id}`, 'docker', ['stop', '--timeout', '2', id]);
    for (const id of owned) assert.notEqual(spawnSync('docker', ['inspect', id], { stdio: 'ignore' }).status, 0, 'owned container retained');
    for (const entry of fs.readdirSync('.local')) {
      if (!initial.has(entry) && /^(sprint05a-combined-|sprint05a-a-envoy-|envoy-run-)/.test(entry)) fs.rmSync(`.local/${entry}`, { recursive: true });
    }
    assert.ok(!fs.existsSync(fixture)); record.cleanup_complete = true;
  } catch (error) { record.cleanup_error = error.stack; complete = false; }
  for (const entry of record.sources) assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256);
  record.recording_complete = complete; record.lock_held_through_cleanup = true; record.ended_at = new Date().toISOString(); save();
  const list = fs.readdirSync(output).sort();
  fs.writeFileSync(`${output}/SHA256SUMS`, list.map((file) => `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}\n`).join(''));
}
process.exitCode = complete ? 0 : 1;
