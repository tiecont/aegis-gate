import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';

process.umask(0o077);
assertLock();
const [output, option] = process.argv.slice(2);
assert.ok(option === undefined || option === '--controls-only');
assert.match(output ?? '', /^evidence\/sprint05a-d\/attempt-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = git('ls-files', 'spikes/envoy', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs').split('\n');
const immutable = ['spikes/envoy/wire-probes.mjs', 'spikes/envoy/wire-observer.mjs',
  'spikes/envoy/recovery-launcher.mjs', 'spikes/envoy/recovery-config.mjs'];
for (const file of immutable) assert.deepEqual(fs.readFileSync(file), execFileSync('git', ['show', `541d1d9:${file}`]));
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync('.local', { recursive: true });
const fixtures = fs.mkdtempSync(path.resolve('.local/sprint05a-d-'));
const initial = new Set(fs.readdirSync('.local'));
const receipt = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  argv: process.argv, started_at: new Date().toISOString(), node: process.version,
  node_binary_sha256: sha(fs.readFileSync(process.execPath)), source_clean: true,
  sources: source.map((file) => ({ file, sha256: sha(fs.readFileSync(file)) })),
  commands: [], results: [] };
const save = () => fs.writeFileSync(`${output}/commands.json`, JSON.stringify(receipt, null, 2) + '\n');
function command(label, program, args, environment = {}) {
  assertLock();
  const started_at = new Date().toISOString();
  const child = spawnSync(program, args, { env: { ...process.env, ...environment },
    timeout: 180000, maxBuffer: 8 << 20 });
  const streams = ['stdout', 'stderr'].map((name) => {
    const file = `${output}/${label}.${name}`; const bytes = child[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes); return { file, sha256: sha(bytes), bytes: bytes.length };
  });
  receipt.commands.push({ label, program, args, environment, started_at,
    ended_at: new Date().toISOString(), exit_code: child.status, signal: child.signal,
    error: child.error?.message, streams });
  save(); console.log(`${label}: exit=${child.status}`); return child;
}
let complete = true;
try {
  for (const [label, program, args] of [
    ['openssl', 'openssl', ['version']], ['docker', 'docker', ['version', '--format', '{{.Server.Version}}']],
    ['image', 'docker', ['image', 'inspect', JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')).image,
      '--format', '{{.Id}} {{json .RepoDigests}}']],
    ['immutable75', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']],
  ]) assert.equal(command(label, program, args).status, 0);
  for (const mode of option ? [] : ['baseline', 'windows', 'stream-errors', 'flush-errors']) {
    const environment = mode === 'baseline' ? { NODE_OPTIONS: '' } : {
      AEGIS_05A_D_POLICY: mode,
      NODE_OPTIONS: `--import=${path.resolve('spikes/envoy/sprint05a-d-select.mjs')}`,
    };
    const file = path.resolve(output, `${mode}.json`);
    const child = command(mode, process.execPath, ['spikes/envoy/wire-probes.mjs', file,
      path.join(fixtures, mode)], environment);
    if (!fs.existsSync(file)) { complete = false; continue; }
    const result = JSON.parse(fs.readFileSync(file));
    receipt.results.push({ mode, exit_code: child.status, tests: result.tests.length,
      passed: result.tests.filter((t) => t.status === 'pass').length, failures: result.failures });
    assert.equal(result.tests.length, 23);
    // The suite's nonzero security result is preserved, not a collector error.
    if (![0, 1].includes(child.status)) complete = false;
    save();
  }
  if (option === '--controls-only') {
    const child = command('bounded-controls', process.execPath, ['spikes/envoy/sprint04c-protocol.mjs',
      path.resolve(output, 'controls.json'), path.join(fixtures, 'controls')], {
      AEGIS_05A_D_POLICY: 'stream-errors',
      NODE_OPTIONS: `--import=${path.resolve('spikes/envoy/sprint05a-d-select.mjs')}`,
    });
    assert.equal(child.status, 0, 'bounded control collection must complete');
    const controls = JSON.parse(fs.readFileSync(`${output}/controls.json`));
    assert.equal(controls.tests.length, 17);
    assert.ok(controls.tests.every((t) => t.status === 'observation-complete'));
    receipt.controls = controls.tests.map(({ name, status }) => ({ name, status }));
    receipt.semantic_security_pass = false;
  }
} catch (error) { receipt.error = error.stack; complete = false; }
finally {
  assertLock();
  try {
    const ids = execFileSync('docker', ['ps', '-aq', '--filter', 'name=aegis-envoy-'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    const owned = ids.length ? JSON.parse(execFileSync('docker', ['inspect', ...ids], { maxBuffer: 8 << 20 }))
      .filter((c) => c.Mounts.some((m) => m.Source.startsWith(path.resolve('.local') + '/'))) : [];
    receipt.cleanup_containers = owned.map((c) => c.Name);
    for (const c of owned) command(`stop-${c.Id.slice(0, 12)}`, 'docker', ['stop', '--timeout', '2', c.Id]);
    const active = owned.filter((c) => {
      const status = spawnSync('docker', ['inspect', c.Id], { encoding: 'utf8' });
      return status.status === 0 && JSON.parse(status.stdout)[0].State.Running;
    });
    assert.equal(active.length, 0);
    for (const entry of fs.readdirSync('.local')) {
      if (!initial.has(entry) && entry.startsWith('envoy-run-')) fs.rmSync(`.local/${entry}`, { recursive: true });
    }
    fs.rmSync(fixtures, { recursive: true });
    receipt.cleanup_complete = true;
  } catch (error) { receipt.cleanup_error = error.stack; complete = false; }
  for (const entry of receipt.sources) assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256);
  receipt.lock_held_through_cleanup = true; receipt.recording_complete = complete;
  receipt.ended_at = new Date().toISOString(); save();
  const files = fs.readdirSync(output).sort().filter((file) => file !== 'SHA256SUMS');
  fs.writeFileSync(`${output}/SHA256SUMS`, files.map((name) => `${sha(fs.readFileSync(`${output}/${name}`))}  ${output}/${name}\n`).join(''));
}
process.exitCode = complete ? 0 : 1;
