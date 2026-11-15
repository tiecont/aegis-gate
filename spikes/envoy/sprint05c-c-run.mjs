import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';

process.umask(0o077); assertLock();
const [output, mode = 'baseline', capture = 'direct'] = process.argv.slice(2);
assert.match(output ?? '', /^evidence\/sprint05c-c\/attempt-\d+$/);
assert.ok(['baseline', 'oghttp2', 'oghttp2-runtime'].includes(mode));
assert.ok(['direct', 'relay'].includes(capture));
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 << 20 }).trim();
const sha = (b) => createHash('sha256').update(b).digest('hex');
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
const extraction = '/home/tiecont/Projects/aegis-gate/evidence/sprint05b-root/native-extract-01/receipt.json';
const extractionBytes = fs.readFileSync(extraction), pin = JSON.parse(extractionBytes);
assert.equal(pin.complete, true); assert.equal(pin.cleanup.absent, true);
assert.equal(pin.image, JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')).image);
assert.equal(sha(fs.readFileSync(pin.binary.file)), pin.binary.sha256);
assert.equal(pin.binary.sha256, '1d64506e25c1844f146162ddb2ece7010fa4e784faddb40a079021491f1f03cc');
assert.equal(sha(fs.readFileSync(process.execPath)), '0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b');
fs.mkdirSync(output, { recursive: true }); fs.mkdirSync('.local', { recursive: true });
const initial = new Set(fs.readdirSync('.local'));
const fixture = fs.mkdtempSync(path.resolve('.local/sprint05c-c-'));
const sources = git('ls-files', 'spikes/envoy', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs', 'scripts/sprint05b-baseline.mjs')
  .split('\n').map((file) => ({ file, sha256: sha(fs.readFileSync(file)) }));
const env = { AEGIS_05A_D_POLICY: 'stream-errors', AEGIS_05C_C_MODE: mode,
  AEGIS_05B_NATIVE_BINARY: pin.binary.file, AEGIS_05B_NATIVE_SHA256: pin.binary.sha256,
  NODE_OPTIONS: `--import=${path.resolve('spikes/envoy/sprint05c-c-select.mjs')}${capture === 'relay' ? ` --import=${path.resolve('spikes/envoy/sprint05b-c-peer-relay.mjs')}` : ''}`,
  AEGIS_05B_C_RELAY_CAPTURE: path.resolve(output, 'relay-frames.json') };
const receipt = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'), source_clean: true,
  argv: process.argv, mode, capture, sources, environment: env, node: process.version,
  node_binary_sha256: sha(fs.readFileSync(process.execPath)), native_pin: pin.binary,
  extraction: { path: extraction, sha256: sha(extractionBytes), source_commit: pin.source_commit },
  limitations: 'native prlimit only; no container cgroup memory/PID eligibility; relay is attribution only',
  started_at: new Date().toISOString(), commands: [] };
const save = () => fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
function run(label, program, args, expected = [0]) {
  assertLock(); const started_at = new Date().toISOString();
  const r = spawnSync(program, args, { env: { ...process.env, ...env }, timeout: 180000, maxBuffer: 16 << 20 });
  const streams = ['stdout', 'stderr'].map((name) => {
    const file = `${output}/${label}.${name}`, bytes = r[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes); return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  receipt.commands.push({ label, program, args, started_at, ended_at: new Date().toISOString(),
    exit_code: r.status, signal: r.signal, error: r.error?.message, streams }); save();
  console.log(`${label}: exit=${r.status}`); assert.ok(expected.includes(r.status), label); return r;
}
try {
  run('protected-before', process.execPath, ['scripts/sprint05b-baseline.mjs']);
  run('openssl', 'openssl', ['version']);
  run('envoy-version', pin.binary.file, ['--version']);
  run('native-libraries', 'ldd', [pin.binary.file]);
  run('original23', process.execPath, ['spikes/envoy/wire-probes.mjs', path.resolve(output, 'original23.json'), fixture], [0, 1]);
  const result = JSON.parse(fs.readFileSync(`${output}/original23.json`));
  assert.ok(!result.fatal); assert.equal(result.tests.length, 23);
  receipt.original23 = { passed: result.tests.filter((t) => t.status === 'pass').length, failures: result.failures };
  run('protected-after', process.execPath, ['scripts/sprint05b-baseline.mjs']);
  receipt.recording_complete = true;
} catch (error) { receipt.error = error.stack; process.exitCode = 1; }
finally {
  assertLock(); receipt.resources = [];
  // The native launcher creates no containers; inspect only this worktree's new private directories.
  const proc = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
  const owned = proc.split('\n').filter((line) => line.includes(path.resolve('.local') + '/') &&
    (line.includes('sprint05b-native-run-') || line.includes('sprint05c-c-')));
  receipt.owned_processes_remaining = owned;
  if (owned.length) { receipt.cleanup_error = 'owned process remains; retained private material'; process.exitCode = 1; }
  else for (const entry of fs.readdirSync('.local')) {
    if (initial.has(entry) || !/^(sprint05c-c-|sprint05b-native-run-)/.test(entry)) continue;
    const dir = path.resolve('.local', entry);
    for (const file of ['resources.jsonl', 'bootstrap.json']) if (fs.existsSync(path.join(dir, file))) {
      const bytes = fs.readFileSync(path.join(dir, file));
      receipt.resources.push({ directory: entry, file, bytes: bytes.length, sha256: sha(bytes) });
      if (file === 'bootstrap.json') fs.writeFileSync(`${output}/bootstrap.json`, bytes);
    }
    fs.rmSync(dir, { recursive: true });
  }
  for (const entry of sources) assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256);
  receipt.cleanup_complete = owned.length === 0 && !fs.existsSync(fixture);
  receipt.lock_held_through_cleanup_hashing = true; receipt.ended_at = new Date().toISOString(); save();
  fs.writeFileSync(`${output}/SHA256SUMS`, fs.readdirSync(output).sort().map((file) =>
    `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}\n`).join(''));
}
