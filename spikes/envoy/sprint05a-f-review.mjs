import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
import { evaluate } from '../edge-comparison/evaluate.mjs';
import { assertRejected } from '../edge-comparison/contract.mjs';

process.umask(0o077);
assertLock();
const [output, aOutput] = process.argv.slice(2);
assert.match(output ?? '', /^evidence\/sprint05a-f\/ad-\d+$/);
assert.match(aOutput ?? '', /^evidence\/sprint05a-a\/attempt-\d+$/);
assert.ok(!fs.existsSync(output) && !fs.existsSync(aOutput));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain'), '', 'commit reviewer source before proof');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const baseline = '541d1d915ce6a3b679dc3fed3ea0a98f908ce001';
const owners = { a: '9391ba922bc8daa2c68c86bb5e770d8685b6a4d7', d: git('rev-parse', 'd067286') };
const sourceFiles = git('ls-files', 'spikes/envoy', 'spikes/edge-comparison', 'spikes/pingora', 'scripts/sprint04c-gates.mjs').split('\n');
const receipt = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  owners, source_clean: true, argv: process.argv, started_at: new Date().toISOString(),
  node: { binary: process.execPath, version: process.version, sha256: sha(fs.readFileSync(process.execPath)) },
  fixture_lock: '/tmp/aegisgate-sprint02-fixtures.lock', commands: [], results: [],
  sources: sourceFiles.map((file) => ({ file, sha256: sha(fs.readFileSync(file)) })),
  security_acceptance: false };
const pending = new Map();
const write = (file, bytes) => {
  if (fs.existsSync(output)) fs.writeFileSync(file, bytes); else pending.set(file, bytes);
};
const save = () => write(`${output}/commands.json`, JSON.stringify(receipt, null, 2) + '\n');
async function run(label, argv, expected = [0], environment = {}) {
  assertLock();
  const started_at = new Date().toISOString();
  const child = spawn(argv[0], argv.slice(1), { env: { ...process.env, NODE_OPTIONS: '', ...environment }, stdio: ['ignore', 'pipe', 'pipe'] });
  const buffers = { stdout: [], stderr: [] };
  for (const stream of Object.keys(buffers)) child[stream].on('data', (b) => buffers[stream].push(b));
  let timed_out = false;
  const timer = setTimeout(() => { timed_out = true; child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 6000).unref(); }, 240000);
  const result = await new Promise((resolve) => {
    child.once('error', (error) => resolve({ exit_code: null, error: error.message }));
    child.once('close', (exit_code, signal) => resolve({ exit_code, signal }));
  });
  clearTimeout(timer);
  const streams = Object.entries(buffers).map(([stream, chunks]) => {
    const bytes = Buffer.concat(chunks); const file = `${output}/${label}.${stream}`;
    write(file, bytes); return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  receipt.commands.push({ label, argv, environment, started_at, ended_at: new Date().toISOString(), ...result, timed_out, streams });
  save(); console.log(`${label}: exit=${result.exit_code}`);
  assert.equal(timed_out, false, label); assert.ok(expected.includes(result.exit_code), label);
  return Buffer.concat(buffers.stdout).toString();
}
function immutable() {
  const inventory = execFileSync('git', ['ls-tree', '-rz', baseline]);
  const entries = inventory.toString().split('\0').filter(Boolean);
  for (const entry of entries) {
    const [info, file] = entry.split('\t'); const [mode, , oid] = info.split(' ');
    const b = mode === '120000' ? Buffer.from(fs.readlinkSync(file)) : fs.readFileSync(file);
    assert.equal(createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'), oid, file);
  }
  return { commit: baseline, tree: git('rev-parse', `${baseline}^{tree}`), objects: entries.length, inventory_sha256: sha(inventory) };
}
let fixture;
let initialDirs;
try {
  receipt.baseline_before = immutable();
  receipt.owner_files = [];
  for (const [owner, commit] of Object.entries(owners)) {
    for (const file of git('ls-tree', '-r', '--name-only', commit, 'spikes/envoy').split('\n').filter((f) => f.startsWith(`spikes/envoy/sprint05a-${owner}-`))) {
      const b = execFileSync('git', ['show', `${commit}:${file}`]);
      assert.deepEqual(fs.readFileSync(file), b, file);
      receipt.owner_files.push({ owner, commit, file, sha256: sha(b) });
    }
  }
  assert.ok(receipt.owner_files.length >= 9);
  await run('strict-dependencies', [process.execPath,
    '/home/tiecont/Projects/aegis-gate/.local/toolchains/node/lib/node_modules/npm/bin/npm-cli.js',
    'ci', '--prefix', 'spikes/pingora', '--ignore-scripts', '--engine-strict', '--no-audit', '--no-fund']);
  fs.mkdirSync('node_modules', { recursive: true });
  for (const name of ['ws', '@grpc']) if (!fs.existsSync(`node_modules/${name}`))
    fs.symlinkSync(`../spikes/pingora/node_modules/${name}`, `node_modules/${name}`, 'dir');
  // A's runner requires a completely clean tree, so flush reviewer receipts afterwards.
  await run('a-runner', [process.execPath, 'spikes/envoy/sprint05a-a-run.mjs', aOutput]);
  fs.mkdirSync(output, { recursive: true });
  for (const [file, bytes] of pending) fs.writeFileSync(file, bytes);
  pending.clear();
  const a = JSON.parse(fs.readFileSync(`${aOutput}/full75.json`));
  const summary = evaluate(a);
  assert.equal(summary.passed, 73); assert.equal(summary.protocol_proof_pass, false);
  assert.deepEqual(summary.failed, ['malformed-HTTP-obsolete-folded-header', 'HTTP2-authority-Host-and-SNI-confusion-rejected']);
  receipt.a = { output: aOutput, summary, failures: a.tests.filter((t) => t.status === 'fail') };
  const focused = JSON.parse(fs.readFileSync(`${aOutput}/focused.json`));
  assert.equal(focused.completed, true); assert.equal(focused.probes.length, 51);
  for (const p of focused.probes.filter((p) => p.historical_name)) {
    assert.equal(p.identity.authorized, true);
    for (const field of ['origin_new_connections', 'origin_dispatches', 'origin_inbound_bytes', 'origin_parse_errors', 'origin_transport_errors']) assert.equal(p[field], 0);
    assert.equal(p.peer_end, true); assert.equal(p.peer_closed, true);
    assert.equal(p.local_destroy, false); assert.equal(p.client_sent_fin, false); assert.equal(p.timed_out, false);
    if (p.name.startsWith('candidate:')) assertRejected(p); else assert.throws(() => assertRejected(p));
  }
  fs.mkdirSync('.local', { recursive: true });
  initialDirs = new Set(fs.readdirSync('.local'));
  fixture = fs.mkdtempSync(path.resolve('.local/sprint05a-f-'));
  for (const mode of ['baseline', 'windows', 'stream-errors']) {
    const environment = mode === 'baseline' ? {} : { AEGIS_05A_D_POLICY: mode,
      NODE_OPTIONS: `--import=${path.resolve('spikes/envoy/sprint05a-d-select.mjs')}` };
    await run(`d-${mode}`, [process.execPath, 'spikes/envoy/wire-probes.mjs',
      path.resolve(output, `d-${mode}.json`), path.join(fixture, mode)], [1], environment);
    const raw = JSON.parse(fs.readFileSync(`${output}/d-${mode}.json`));
    assert.ok(!raw.fatal, raw.fatal); assert.equal(raw.tests.length, 23);
    const passed = raw.tests.filter((t) => t.status === 'pass').length;
    assert.equal(passed, { baseline: 16, windows: 17, 'stream-errors': 19 }[mode]);
    receipt.results.push({ mode, passed, total: 23, failures: raw.failures }); save();
  }
  await run('d-controls', [process.execPath, 'spikes/envoy/sprint04c-protocol.mjs',
    path.resolve(output, 'd-controls.json'), path.join(fixture, 'controls')], [0], {
    AEGIS_05A_D_POLICY: 'stream-errors', NODE_OPTIONS: `--import=${path.resolve('spikes/envoy/sprint05a-d-select.mjs')}` });
  const controls = JSON.parse(fs.readFileSync(`${output}/d-controls.json`));
  assert.equal(controls.tests.length, 17);
  assert.ok(controls.tests.every((t) => t.status === 'observation-complete'));
  receipt.controls = { total: 17, semantic_security_pass: false };
  await run('immutable-manifest', [process.execPath, 'spikes/edge-comparison/extract-baseline.mjs', '--check']);
  await run('removed-inspection-object', ['git', 'cat-file', '-e', '7bad0dc7cf80ff73c4f6edc335d1354efbc338ba'], [1, 128]);
  receipt.withheld = [];
  for (const attempt of ['01', '02']) {
    const data = JSON.parse(fs.readFileSync(`evidence/sprint05a-a/attempt-${attempt}/withheld.json`));
    for (const entry of data.streams) {
      assert.equal(fs.existsSync(entry.file), false);
      assert.equal(git('log', '--all', '--format=%H', '--', entry.file), '', 'forbidden stream in reachable history');
      receipt.withheld.push(entry);
    }
  }
  const retired = JSON.parse(fs.readFileSync('evidence/sprint05a-a/attempt-02/commands.json')).source_commit;
  await run('retired-source-not-ancestor', ['git', 'merge-base', '--is-ancestor', retired, 'HEAD'], [1, 128]);
  receipt.retired_source = retired;
  receipt.collection_complete = true;
} catch (error) { receipt.error = error.stack; process.exitCode = 1; }
finally {
  fs.mkdirSync(output, { recursive: true });
  for (const [file, bytes] of pending) fs.writeFileSync(file, bytes);
  // Limit inspection to candidate names and mount fields; never read Config/Env.
  try {
    const listing = await run('cleanup-candidates', ['docker', 'ps', '-a', '--filter', 'name=^/aegis-envoy-',
      '--filter', 'name=^/aegis-sprint05a-a-', '--format', '{{.ID}} {{.Names}}']);
    receipt.cleanup = { stopped: [] };
    for (const line of listing.trim().split('\n').filter(Boolean)) {
      const [id, name] = line.split(' ');
      const mounts = JSON.parse(await run(`mounts-${id}`, ['docker', 'inspect', '--format', '{{json .Mounts}}', id]));
      if (!mounts.some((m) => m.Source.startsWith(`${process.cwd()}/.local/`))) continue;
      await run(`stop-${id}`, ['docker', 'stop', '--timeout', '2', id]);
      receipt.cleanup.stopped.push(name);
    }
  } catch (error) { receipt.cleanup_error = error.stack; process.exitCode = 1; }
  if (fixture) fs.rmSync(fixture, { recursive: true, force: true });
  if (initialDirs) for (const dir of fs.readdirSync('.local')) {
    if (!initialDirs.has(dir) && /^(envoy-run-|sprint05a-f-)/.test(dir)) fs.rmSync(path.join('.local', dir), { recursive: true, force: true });
  }
  try {
    receipt.baseline_after = immutable();
    for (const s of receipt.sources) assert.equal(sha(fs.readFileSync(s.file)), s.sha256, s.file);
    receipt.new_fixture_directories = initialDirs ? fs.readdirSync('.local').filter((d) => !initialDirs.has(d)) : [];
    assert.deepEqual(receipt.new_fixture_directories, []);
  } catch (error) { receipt.integrity_error = error.stack; process.exitCode = 1; }
  assertLock(); receipt.lock_held_through_cleanup = true; receipt.ended_at = new Date().toISOString(); save();
  const files = fs.readdirSync(output).sort().filter((f) => f !== 'SHA256SUMS');
  fs.writeFileSync(`${output}/SHA256SUMS`, files.map((f) => `${sha(fs.readFileSync(`${output}/${f}`))}  ${output}/${f}`).join('\n') + '\n');
}
