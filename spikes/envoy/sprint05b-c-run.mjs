import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
import { cleanupOwned } from './sprint05b-c-cleanup.mjs';

process.umask(0o077); assertLock();
const [output, mode = 'baseline', transport = 'docker', capture = 'events'] = process.argv.slice(2);
assert.ok(['docker', 'native'].includes(transport));
assert.match(output ?? '', /^evidence\/sprint05b-c\/attempt-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
git('diff', '--exit-code', '8758b1c', 'HEAD', '--', 'spikes/edge-comparison',
  'spikes/pingora/lab.mjs', 'spikes/envoy/wire-probes.mjs', 'spikes/envoy/wire-observer.mjs');
fs.mkdirSync(output, { recursive: true }); fs.mkdirSync('.local', { recursive: true });
const initial = new Set(fs.readdirSync('.local'));
const fixture = fs.mkdtempSync(path.resolve('.local/sprint05b-c-'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const sources = git('ls-files', 'spikes/envoy', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs').split('\n');
const nativeSelect = transport === 'native' ? 'spikes/envoy/sprint05b-c-native-select.mjs' :
  ['baseline', 'untapped'].includes(mode) ? 'spikes/envoy/sprint05a-combined-select.mjs' : 'spikes/envoy/sprint05b-c-select.mjs';
const env = { AEGIS_05A_D_POLICY: 'stream-errors', AEGIS_05B_C_MODE: mode,
  NODE_OPTIONS: `--import=${path.resolve(nativeSelect)}${mode === 'untapped' ? '' : ` --import=${path.resolve('spikes/envoy/sprint05b-c-tap.mjs')}`}${capture === 'relay' ? ` --import=${path.resolve('spikes/envoy/sprint05b-c-peer-relay.mjs')}` : ''}`,
  AEGIS_05B_C_CAPTURE: path.resolve(output, 'peer-frames.json'), AEGIS_05B_C_RELAY_CAPTURE: path.resolve(output, 'relay-frames.json') };
let nativePin;
if (transport === 'native') {
  const extraction = '/home/tiecont/Projects/aegis-gate/evidence/sprint05b-root/native-extract-01/receipt.json';
  const bytes = fs.readFileSync(extraction), r = JSON.parse(bytes);
  assert.equal(r.complete, true); assert.equal(r.cleanup.absent, true);
  assert.equal(r.image, JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')).image);
  assert.equal(sha(fs.readFileSync(r.binary.file)), r.binary.sha256);
  Object.assign(env, { AEGIS_05B_NATIVE_BINARY: r.binary.file, AEGIS_05B_NATIVE_SHA256: r.binary.sha256 });
  nativePin = { extraction, extraction_sha256: sha(bytes), extraction_source_commit: r.source_commit,
    binary: r.binary, limitations: 'same image binary, host libraries, prlimit only; no container resource eligibility proof' };
}
const receipt = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  source_clean: true, argv: process.argv, mode, transport, capture, native: nativePin, started_at: new Date().toISOString(),
  node: process.version, node_binary_sha256: sha(fs.readFileSync(process.execPath)), environment: env,
  sources: sources.map((file) => ({ file, sha256: sha(fs.readFileSync(file)) })), commands: [] };
const save = () => fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
const versionName = `aegis-sprint05b-c-version-${process.pid}`;
function run(label, program, args, expected = [0]) {
  assertLock(); const started_at = new Date().toISOString();
  const r = spawnSync(program, args, { env: { ...process.env, ...env }, timeout: 180000, maxBuffer: 16 << 20 });
  const streams = ['stdout', 'stderr'].map((name) => {
    const file = `${output}/${label}.${name}`; const bytes = r[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes); return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  receipt.commands.push({ label, program, args, started_at, ended_at: new Date().toISOString(),
    exit_code: r.status, signal: r.signal, error: r.error?.message, streams }); save();
  console.log(`${label}: exit=${r.status}`); assert.ok(expected.includes(r.status), label); return r;
}
try {
  run('openssl', 'openssl', ['version']); run('docker', 'docker', ['version', '--format', '{{.Server.Version}}']);
  const image = JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')).image;
  run('image', 'docker', ['image', 'inspect', image, '--format', '{{.Id}} {{json .RepoDigests}}']);
  if (transport === 'docker') run('envoy-version', 'docker', ['run', '--rm', '--pull', 'never', '--name', versionName, '--network', 'none', '--entrypoint', '/usr/local/bin/envoy', image, '--version']);
  else { run('envoy-version', env.AEGIS_05B_NATIVE_BINARY, ['--version']); run('native-libraries', 'ldd', [env.AEGIS_05B_NATIVE_BINARY]); }
  run('original23', process.execPath, ['spikes/envoy/wire-probes.mjs', path.resolve(output, 'original23.json'), fixture], [0, 1]);
  const result = JSON.parse(fs.readFileSync(`${output}/original23.json`));
  assert.ok(!result.fatal); assert.equal(result.tests.length, 23);
  receipt.original23 = { passed: result.tests.filter((t) => t.status === 'pass').length, failures: result.failures };
  receipt.recording_complete = true;
} catch (error) { receipt.error = error.stack; process.exitCode = 1; }
finally {
  assertLock();
  receipt.cleanup = await cleanupOwned(run, versionName);
  receipt.resources = [];
  for (const entry of fs.readdirSync('.local')) {
    if (initial.has(entry) || !/^(sprint05b-c-|envoy-run-)/.test(entry)) continue;
    const dir = path.resolve('.local', entry);
    for (const file of ['resources.jsonl', 'bootstrap.json']) {
      if (fs.existsSync(path.join(dir, file))) {
        const bytes = fs.readFileSync(path.join(dir, file));
        receipt.resources.push({ directory: entry, file, bytes: bytes.length, sha256: sha(bytes) });
        if (file === 'bootstrap.json') fs.writeFileSync(`${output}/bootstrap.json`, bytes);
      }
    }
    fs.rmSync(dir, { recursive: true });
  }
  assert.ok(!fs.existsSync(fixture));
  for (const entry of receipt.sources) assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256);
  receipt.cleanup_complete = true; receipt.lock_held_through_cleanup_hashing = true;
  receipt.ended_at = new Date().toISOString(); save();
  fs.writeFileSync(`${output}/SHA256SUMS`, fs.readdirSync(output).sort().map((file) =>
    `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}\n`).join(''));
}
