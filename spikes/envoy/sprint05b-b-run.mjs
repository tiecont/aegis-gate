import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { assertLock } from './wire-fixtures.mjs';

process.umask(0o077); assertLock();
const [output, tap = 'tap'] = process.argv.slice(2);
assert.match(output ?? '', /^evidence\/sprint05b-b\/[a-z0-9-]+$/);
assert.ok(['tap', 'plain'].includes(tap)); assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 << 20 }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'commit source first');
git('diff', '--exit-code', '8758b1c', 'HEAD', '--', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs',
  'spikes/envoy/config.mjs', 'spikes/envoy/recovery-config.mjs', 'spikes/envoy/recovery-launcher.mjs',
  'spikes/envoy/wire-probes.mjs', 'spikes/envoy/wire-fixtures.mjs');
fs.mkdirSync(output, { recursive: true }); fs.mkdirSync('.local', { recursive: true });
const initial = new Set(fs.readdirSync('.local'));
const fixture = fs.mkdtempSync(path.resolve('.local/sprint05b-b-'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = git('ls-files', 'spikes/envoy', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs',
  'spikes/pingora/package.json', 'spikes/pingora/package-lock.json').split('\n');
const environment = { AEGIS_05A_D_POLICY: 'stream-errors',
  NODE_OPTIONS: `--import=${path.resolve('spikes/envoy/sprint05a-combined-select.mjs')}`,
  PINGORA_SPIKE_PROFILE: 'release', AEGIS_RUN_ROOT: fixture,
  AEGIS_CANDIDATE_NAME: 'envoy-1.40.2-sprint05b-b-unchanged-combined',
  AEGIS_CANDIDATE_COMMAND: process.execPath,
  AEGIS_CANDIDATE_ARGS: JSON.stringify([path.resolve('spikes/envoy/sprint05a-a-launcher.mjs')]),
  AEGIS_CANDIDATE_ARTIFACTS: JSON.stringify(files.filter((f) => f.startsWith('spikes/envoy/')).map((f) => path.resolve(f))) };
const record = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  source_clean: true, argv: process.argv, cwd: process.cwd(), started_at: new Date().toISOString(),
  node: process.version, node_binary_sha256: sha(fs.readFileSync(process.execPath)), environment, tap,
  sources: files.map((file) => ({ file, sha256: sha(fs.readFileSync(file)) })), commands: [] };
const save = () => fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(record, null, 2) + '\n');
function run(label, program, args, expected = [0], extra = {}) {
  assertLock(); const started_at = new Date().toISOString();
  const child = spawnSync(program, args, { env: { ...process.env, ...environment, ...extra }, timeout: 240000, maxBuffer: 16 << 20 });
  const streams = ['stdout', 'stderr'].map((name) => {
    const file = `${output}/${label}.${name}`; const bytes = child[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes); return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  record.commands.push({ label, program, args, environment: { ...environment, ...extra }, started_at,
    ended_at: new Date().toISOString(), exit_code: child.status, signal: child.signal, error: child.error?.message, streams });
  save(); console.log(`${label}: exit=${child.status}`);
  assert.ok(expected.includes(child.status), `${label}: unexpected result`); return child;
}
let complete = true;
try {
  run('openssl', 'openssl', ['version']); run('docker', 'docker', ['version', '--format', '{{.Server.Version}}']);
  run('image', 'docker', ['image', 'inspect', JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')).image,
    '--format', '{{.Id}} {{json .RepoDigests}}']);
  run('immutable75', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']);
  const original = run('original75', process.execPath,
    [...(tap === 'tap' ? ['--import', './spikes/envoy/sprint05b-b-tap.mjs'] : []), 'spikes/edge-comparison/run.mjs'], [0, 1],
    tap === 'tap' ? { AEGIS_05B_B_TAP: path.resolve(output, 'wire.json') } : {});
  const resultPath = original.stdout.toString().match(/^Evidence: (.+)$/m)?.[1];
  assert.ok(resultPath?.startsWith(fixture + '/'));
  const bytes = fs.readFileSync(resultPath); fs.writeFileSync(`${output}/original75.json`, bytes);
  fs.copyFileSync(path.join(path.dirname(resultPath), 'proxy.log'), `${output}/proxy.log`);
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
    const ids = execFileSync('docker', ['ps', '-aq'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    const owned = [];
    for (const id of ids) {
      const c = JSON.parse(execFileSync('docker', ['inspect', id]))[0];
      if (/^\/aegis-(envoy-|sprint05a-a-)/.test(c.Name) &&
        c.Mounts.some((m) => m.Source.startsWith(path.resolve('.local') + '/'))) owned.push(id);
    }
    record.cleanup_stopped = owned;
    for (const id of owned) run(`cleanup-${id}`, 'docker', ['stop', '--timeout', '2', id]);
    for (const id of owned) {
      for (let i = 0; i < 50 && spawnSync('docker', ['inspect', id], { stdio: 'ignore' }).status === 0; i++) await delay(100);
      assert.notEqual(spawnSync('docker', ['inspect', id], { stdio: 'ignore' }).status, 0, 'owned container retained');
    }
    record.cleanup_removed = [];
    for (const entry of fs.readdirSync('.local')) {
      if (!initial.has(entry) && /^(sprint05b-b-|sprint05a-a-envoy-|envoy-run-)/.test(entry)) {
        fs.rmSync(`.local/${entry}`, { recursive: true }); record.cleanup_removed.push(entry);
      }
    }
    assert.ok(!fs.existsSync(fixture)); record.cleanup_complete = true;
  } catch (error) { record.cleanup_error = error.stack; complete = false; }
  for (const entry of record.sources) assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256);
  record.recording_complete = complete; record.lock_held_through_hash_and_cleanup = true; record.ended_at = new Date().toISOString(); save();
  fs.writeFileSync(`${output}/SHA256.json`, JSON.stringify(fs.readdirSync(output).sort()
    .map((file) => ({ file, sha256: sha(fs.readFileSync(`${output}/${file}`)) })), null, 2) + '\n');
}
process.exitCode = complete ? 0 : 1;
