import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';

process.umask(0o077); assertLock();
const root = process.cwd();
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05a-f\/extended-\d+$/);
assert.ok(!fs.existsSync(output));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
fs.mkdirSync(output, { recursive: true });
const record = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  argv: process.argv, started_at: new Date().toISOString(), node: process.version,
  node_sha256: sha(fs.readFileSync(process.execPath)), commands: [], checkouts: [], security_pass: false };
const save = () => fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(record, null, 2) + '\n');
function run(label, cwd, argv, expected = [0], environment = {}) {
  assertLock(); const started_at = new Date().toISOString();
  const r = spawnSync(argv[0], argv.slice(1), { cwd, env: { ...process.env, NODE_OPTIONS: '', ...environment },
    timeout: 300000, maxBuffer: 32 << 20 });
  const streams = ['stdout', 'stderr'].map((name) => {
    const file = `${output}/${label}.${name}`; const bytes = r[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes); return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  record.commands.push({ label, cwd, argv, environment, started_at, ended_at: new Date().toISOString(),
    exit_code: r.status, signal: r.signal, error: r.error?.message, streams }); save();
  console.log(`${label}: exit=${r.status}`); assert.ok(expected.includes(r.status), label); return r;
}
const base = git('ls-tree', '-r', '541d1d9').split('\n');
function immutable(cwd) {
  const current = new Map(execFileSync('git', ['ls-tree', '-r', 'HEAD'], { cwd, encoding: 'utf8' })
    .trim().split('\n').map((l) => [l.split('\t')[1], l]));
  for (const line of base) assert.equal(current.get(line.split('\t')[1]), line);
  return { objects: base.length, baseline: git('rev-parse', '541d1d9'),
    inventory_sha256: sha(Buffer.from(base.join('\n') + '\n')) };
}
function copy(cwd, from, name) { fs.cpSync(path.join(cwd, from), `${output}/${name}`, { recursive: true, errorOnExist: true }); }
function json(file) { return JSON.parse(fs.readFileSync(`${output}/${file}`)); }
const sources = { b: '133d3ea', c: 'd4fc4b1', combined: '8d293c8' };
try {
  for (const [name, ref] of Object.entries(sources)) {
    const commit = git('rev-parse', ref); const cwd = `/tmp/aegisgate-05a-f-exact-${name}`;
    assert.ok(!fs.existsSync(cwd), 'fresh detached checkout required');
    run(`checkout-${name}`, root, ['git', 'worktree', 'add', '--detach', cwd, commit]);
    const item = { name, cwd, commit, tree: git('rev-parse', `${commit}^{tree}`), baseline: immutable(cwd) };
    record.checkouts.push(item); save();
    run(`manifest-${name}`, cwd, [process.execPath, 'spikes/edge-comparison/extract-baseline.mjs', '--check']);
    if (name !== 'b') {
      run(`dependencies-${name}`, cwd, [process.execPath,
        '/home/tiecont/Projects/aegis-gate/.local/toolchains/node/lib/node_modules/npm/bin/npm-cli.js',
        'ci', '--prefix', 'spikes/pingora', '--ignore-scripts', '--engine-strict', '--no-audit', '--no-fund']);
      fs.mkdirSync(`${cwd}/node_modules`);
      for (const module of ['ws', '@grpc']) fs.symlinkSync(`../spikes/pingora/node_modules/${module}`, `${cwd}/node_modules/${module}`, 'dir');
    }
    if (name === 'b') {
      const pins = JSON.parse(fs.readFileSync(`${cwd}/evidence/sprint05a-b/source-01/sources.json`));
      for (const p of pins.downloads) {
        const cache = path.resolve('/tmp/aegisgate-05a-b', p.cache);
        if (!fs.existsSync(cache)) continue;
        const bytes = fs.readFileSync(cache); assert.equal(sha(bytes), p.sha256);
        const target = path.resolve(cwd, p.cache); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(cache, target);
      }
      run('b-restore', cwd, [process.execPath, 'spikes/envoy/sprint05a-b-restore.mjs']);
      run('b-llhttp', cwd, [process.execPath, 'spikes/envoy/sprint05a-b-run.mjs', 'llhttp', 'evidence/sprint05a-b/llhttp-90']);
      copy(cwd, 'evidence/sprint05a-b/llhttp-90', 'b-llhttp');
      const r = json('b-llhttp/receipt.json'); assert.equal(r.source_commit, commit);
      assert.equal(r.completed_observations, true); assert.equal(r.probes.length, 22);
      assert.ok(r.fold_rejections.length === 10 && r.fold_rejections.every((p) => p.pass));
      for (const p of r.probes.filter((p) => p.name.startsWith('original-'))) {
        const manifest = JSON.parse(fs.readFileSync(`${cwd}/spikes/edge-comparison/manifest.json`));
        const original = manifest.negatives.find((v) => `original-${v.name}` === p.name);
        assert.equal(p.request_hex, Buffer.from(original.request).toString('hex'));
        assert.equal(p.strict_rejection, true); assert.equal(p.client_sent_fin, false);
      }
      assert.equal(r.fragment_checks.length, 24);
      for (const p of r.fragment_checks) assert.equal(p.error, p.name === 'valid-trailer' ? 'HPE_OK' : 'HPE_INVALID_HEADER_TOKEN');
      assert.equal(r.cleanup.fixture_removed, true); assert.equal(r.cleanup.container_absent, true);
      record.b = { fold_rejections: r.fold_rejections, fragment_checks: r.fragment_checks, narrow_accept: true };
    } else if (name === 'c') {
      run('c-original75', cwd, [process.execPath, 'spikes/envoy/sprint05a-c-run.mjs', 'evidence/sprint05a-f/c-original75', 'bounded', 'tap']);
      copy(cwd, 'evidence/sprint05a-f/c-original75', 'c-original75');
      const r = json('c-original75/receipt.json'); assert.equal(r.source_commit, commit); assert.equal(r.completed, true);
      const result = json('c-original75/results.json'); const h2 = result.tests.find((t) => t.name === 'HTTP2-authority-Host-and-SNI-confusion-rejected');
      assert.equal(h2.status, 'fail'); assert.equal(h2.origin.decrypted_bytes, 9); assert.equal(h2.origin.handler_invocations, 0);
      const raw = json('c-original75/raw-h2.json');
      record.c = { decision: r.decision, h2, raw_capture_sha256: sha(Buffer.from(JSON.stringify(raw))), repair_accept: false };
      run('c-lifecycle', cwd, [process.execPath, 'spikes/envoy/sprint05a-c-lifecycle.mjs', 'evidence/sprint05a-f/c-lifecycle'], [0], { AEGIS_SPRINT05A_C_POLICY: 'bounded' });
      copy(cwd, 'evidence/sprint05a-f/c-lifecycle', 'c-lifecycle');
      const lifecycle = json('c-lifecycle/receipt.json'); assert.equal(lifecycle.source_commit, commit);
      assert.ok(lifecycle.tests.length === 7 && lifecycle.tests.every((t) => t.status === 'pass'));
      record.c.lifecycle_tests = lifecycle.tests.map(({ name, status }) => ({ name, status }));
    } else {
      run('combined', cwd, [process.execPath, 'spikes/envoy/sprint05a-combined-run.mjs', 'evidence/sprint05a-f/candidate-90']);
      copy(cwd, 'evidence/sprint05a-f/candidate-90', 'combined');
      const r = json('combined/commands.json'); assert.equal(r.source_commit, commit);
      assert.equal(r.recording_complete, true); assert.equal(r.cleanup_complete, true);
      record.combined = { original75: r.original75, original23: r.original23, security_pass: false };
    }
    assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd, encoding: 'utf8' }).trim(), '');
    item.baseline_after = immutable(cwd); save();
  }
  record.completed = true;
} catch (error) { record.error = error.stack; process.exitCode = 1; }
finally {
  assertLock(); record.lock_held_through_capture_cleanup_hashing = true; record.ended_at = new Date().toISOString(); save();
  const files = [];
  const walk = (dir) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else files.push(file);
  } }; walk(output);
  fs.writeFileSync(`${output}/SHA256SUMS`, files.sort().map((file) => `${sha(fs.readFileSync(file))}  ${file}\n`).join(''));
}
