// Verify a scoped STOP, never convert failing protocol assertions into acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
process.umask(0o077); assertLock();
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05b-b\/verify-[a-z0-9-]+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 << 20 }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
fs.mkdirSync(output, { recursive: true });
const sha = (b) => createHash('sha256').update(b).digest('hex');
const load = (file) => JSON.parse(fs.readFileSync(file));
const receipt = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  argv: process.argv, node: process.version, node_binary_sha256: sha(fs.readFileSync(process.execPath)),
  started_at: new Date().toISOString(), commands: [], manifests: [], originals: [], security_pass: false,
  verdict: 'SCOPED STOP: no supported repair demonstrated; original H2 all-byte gate remains FAIL' };
function run(label, program, args, expected = [0]) {
  const started_at = new Date().toISOString();
  const c = spawnSync(program, args, { timeout: 60000, maxBuffer: 8 << 20 });
  for (const stream of ['stdout', 'stderr']) fs.writeFileSync(`${output}/${label}.${stream}`, c[stream] ?? '');
  receipt.commands.push({ label, program, args, started_at, ended_at: new Date().toISOString(), exit_code: c.status,
    signal: c.signal, error: c.error?.message, stdout_sha256: sha(c.stdout ?? ''), stderr_sha256: sha(c.stderr ?? '') });
  assert.ok(expected.includes(c.status), label); return c;
}
try {
  const inventory = execFileSync('git', ['ls-tree', '-rz', '8758b1c']); let objects = 0;
  for (const row of inventory.toString().split('\0').filter(Boolean)) {
    const [info, file] = row.split('\t'), [mode, , oid] = info.split(' ');
    const b = mode === '120000' ? Buffer.from(fs.readlinkSync(file)) : fs.readFileSync(file);
    assert.equal(createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'), oid, file); objects++;
  }
  receipt.baseline = { commit: git('rev-parse', '8758b1c'), tree: git('rev-parse', '8758b1c^{tree}'),
    objects, inventory_sha256: sha(inventory) };
  const sources = git('ls-files', 'spikes/envoy/sprint05b-b-*.mjs').split('\n');
  for (const file of sources) run(`syntax-${path.basename(file)}`, process.execPath, ['--check', file]);
  run('baseline-corpus', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']);
  run('unchanged-tests', process.execPath, ['--test', 'spikes/edge-comparison/contract.test.mjs',
    'spikes/edge-comparison/evaluate.test.mjs', 'spikes/edge-comparison/tls-observer.test.mjs',
    'spikes/envoy/wire-observer.test.mjs', 'spikes/envoy/sprint05a-a-config.test.mjs']);
  for (const dir of fs.readdirSync('evidence/sprint05b-b').sort()) {
    const file = `evidence/sprint05b-b/${dir}/SHA256.json`; if (!fs.existsSync(file)) continue;
    const entries = load(file);
    for (const entry of entries) assert.equal(sha(fs.readFileSync(`evidence/sprint05b-b/${dir}/${entry.file}`)), entry.sha256, file);
    receipt.manifests.push({ file, sha256: sha(fs.readFileSync(file)), files: entries.length });
    const sourceReceipt = `evidence/sprint05b-b/${dir}/receipt.json`;
    if (fs.existsSync(sourceReceipt)) {
      const r = load(sourceReceipt);
      if (r.source_commit) {
        assert.equal(git('rev-parse', `${r.source_commit}^{tree}`), r.source_tree);
        for (const source of r.sources ?? []) assert.equal(sha(execFileSync('git', ['show', `${r.source_commit}:${source.file}`],
          { maxBuffer: 8 << 20 })), source.sha256, source.file);
      }
    }
  }
  for (const dir of ['native-tap-01', 'native-plain-01']) {
    const root = `evidence/sprint05b-b/${dir}`, r = load(`${root}/receipt.json`), original = load(`${root}/original75.json`);
    assert.equal(r.cleanup_complete, true); assert.equal(r.resource_eligibility, false);
    assert.equal(original.tests.length, 75); assert.equal(original.tests.filter((t) => t.status === 'pass').length, 73);
    assert.deepEqual(original.tests.filter((t) => t.status === 'fail').map((t) => t.name),
      ['malformed-HTTP-obsolete-folded-header', 'HTTP2-authority-Host-and-SNI-confusion-rejected']);
    const h2 = original.tests.find((t) => t.name.startsWith('HTTP2-authority-'));
    assert.deepEqual([h2.origin.decrypted_bytes, h2.origin.handler_invocations, h2.origin.parser_errors, h2.origin.transport_errors], [9, 0, 0, 0]);
    const extra = load(`${root}/original23.json`); assert.equal(extra.tests.length, 23);
    assert.equal(extra.tests.filter((t) => t.status === 'pass').length, 19);
    const controls = load(`${root}/controls.json`), failures = controls.tests.filter((t) => t.status !== 'observation-complete');
    assert.equal(controls.tests.length, 17);
    assert.deepEqual(failures.map((t) => t.name), ['paused-native-reader-large8', 'paused-native-reader-large32']);
    assert.ok(failures.every((t) => t.error.includes('docker inspect --format {{.State.Pid}}')));
    assert.equal(r.recording_complete, false);
    receipt.originals.push({ root, source_commit: r.source_commit, source_tree: r.source_tree, original75: '73/75',
      original23: '19/23', h2, overall_collector_complete: false, resource_diagnostic_failures: failures });
  }
  const cause = load('evidence/sprint05b-b/cause-01/receipt.json');
  assert.equal(cause.exit_code, 0); assert.equal(cause.tests.length, 4); assert.ok(cause.tests.every((t) => t.status === 'pass'));
  assert.equal(cause.container_absent, true); assert.equal(cause.fixture_removed, true);
  const analysisDir = `evidence/sprint05b-b/analysis-${path.basename(output)}`;
  run('causal-analysis', process.execPath, ['spikes/envoy/sprint05b-b-analyze.mjs', 'evidence/sprint05b-b/native-tap-01', analysisDir]);
  receipt.analysis = { file: `${analysisDir}/receipt.json`, sha256: sha(fs.readFileSync(`${analysisDir}/receipt.json`)) };
  assert.equal(load('evidence/sprint05b-b/source-02/receipt.json').exit_code, 0);
  assert.equal(load('evidence/sprint05b-b/settings-source-01/receipt.json').exit_code, 0);
  assert.deepEqual(fs.readdirSync('.local').filter((d) => d.startsWith('sprint05b-b-')), []);
  run('owned-processes', 'pgrep', ['-af', `${process.cwd()}/.local/sprint05b-b-`], [1]);
  receipt.exit_code = 0;
} catch (error) { receipt.error = error.stack; receipt.exit_code = 1; process.exitCode = 1; }
assertLock(); receipt.lock_held_through_hashes = true; receipt.ended_at = new Date().toISOString();
fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
fs.writeFileSync(`${output}/SHA256.json`, JSON.stringify(fs.readdirSync(output).sort()
  .map((file) => ({ file, sha256: sha(fs.readFileSync(`${output}/${file}`)) })), null, 2) + '\n');
console.log(receipt.verdict);
