import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
import { evaluate } from '../edge-comparison/evaluate.mjs';
import { manifest, assertRejected } from '../edge-comparison/contract.mjs';
import { supplementalNegatives } from '../edge-comparison/supplemental.mjs';

process.umask(0o077); assertLock();
const output = process.argv[2]; assert.match(output ?? '', /^evidence\/sprint05a-a\/checks-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain'), '', 'verify clean committed sources');
const hash = (b) => createHash('sha256').update(b).digest('hex');
fs.mkdirSync(output);
const record = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  started_at: new Date().toISOString(), argv: process.argv, cwd: process.cwd(), source_clean: true,
  node: process.version, node_executable: process.execPath, node_sha256: hash(fs.readFileSync(process.execPath)),
  commands: [], verified_files: [], withheld_streams: [], acceptance: 'NO-GO; verification is evidence integrity only' };
function run(label, argv) {
  const started = new Date().toISOString();
  const r = spawnSync(argv[0], argv.slice(1), { timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  const streams = ['stdout', 'stderr'].map((s) => {
    const file = `${output}/${label}.${s}`; const b = r[s] ?? Buffer.alloc(0); fs.writeFileSync(file, b);
    return { file, bytes: b.length, sha256: hash(b) };
  });
  record.commands.push({ label, argv, started_at: started, ended_at: new Date().toISOString(),
    exit_code: r.status, signal: r.signal, error: r.error?.message, streams });
  console.log(`${label}: exit=${r.status}`); assert.equal(r.status, 0, label);
}
try {
  for (const name of ['attempt-01', 'attempt-02', 'attempt-03']) {
    const dir = `evidence/sprint05a-a/${name}`;
    for (const line of fs.readFileSync(`${dir}/SHA256SUMS`, 'utf8').trim().split('\n')) {
      const [digest, file] = line.split('  '); assert.equal(hash(fs.readFileSync(file)), digest, file);
      record.verified_files.push({ file, sha256: digest });
    }
    const receipt = JSON.parse(fs.readFileSync(`${dir}/commands.json`));
    const withheld = fs.existsSync(`${dir}/withheld.json`) ? JSON.parse(fs.readFileSync(`${dir}/withheld.json`)).streams : [];
    for (const c of receipt.commands) for (const s of [c.stdout, c.stderr]) {
      if (withheld.some((w) => w.file === s.file && w.sha256 === s.sha256)) {
        assert.equal(fs.existsSync(s.file), false); record.withheld_streams.push(s); continue;
      }
      assert.equal(hash(fs.readFileSync(s.file)), s.sha256, s.file);
    }
  }
  const dir = 'evidence/sprint05a-a/attempt-03';
  const receipt = JSON.parse(fs.readFileSync(`${dir}/commands.json`));
  assert.equal(receipt.collection_complete, true); assert.ok(!receipt.error && !receipt.cleanup.error);
  assert.deepEqual(receipt.cleanup.remaining_owned_containers, []);
  assert.equal(receipt.cleanup.fixture_removed, true); assert.deepEqual(receipt.cleanup.new_owned_directories, []);
  for (const s of receipt.sources) {
    assert.equal(hash(fs.readFileSync(s.file)), s.sha256);
    assert.equal(hash(execFileSync('git', ['show', `${receipt.source_commit}:${s.file}`])), s.sha256);
  }
  const result = JSON.parse(fs.readFileSync(`${dir}/full75.json`)); const summary = evaluate(result);
  assert.equal(summary.passed, 73); assert.equal(summary.protocol_proof_pass, false);
  assert.deepEqual(summary.failed, ['malformed-HTTP-obsolete-folded-header', 'HTTP2-authority-Host-and-SNI-confusion-rejected']);
  const h2 = result.tests.find((t) => t.name === summary.failed[1]);
  assert.equal(h2.origin.decrypted_bytes, 9); assert.equal(h2.origin.handler_invocations, 0);
  const focused = JSON.parse(fs.readFileSync(`${dir}/focused.json`));
  assert.equal(focused.completed, true); assert.equal(focused.probes.length, 51);
  assert.equal(focused.observer_control.observed_bytes, 76); assert.equal(focused.observer_control.authorized, true);
  const vectors = [...manifest.negatives.filter((r) => /invalid-transfer-encoding|TE-repeated-chunked|TE-not-final-chunked/.test(r.name)),
    { ...supplementalNegatives.find((r) => r.name === 'repeated-transfer-encoding-fields'), name: 'supplemental-repeated-transfer-encoding-fields' }];
  for (const v of vectors) for (const mapped of [false, true]) for (const reused of [false, true]) for (const exact of [false, true]) {
    const rows = focused.probes.filter((p) => p.historical_name === v.name && p.name.startsWith(mapped ? 'candidate:' : 'baseline:') &&
      p.reused === reused && p.exact_historical_input === exact);
    assert.equal(rows.length, 1); const p = rows[0];
    assert.equal(p.request, exact ? v.request : v.request.replace('Connection: close', 'Connection: keep-alive'));
    assert.equal(p.request_hex, Buffer.from(p.request).toString('hex'));
    assert.equal(p.peer_end, true); assert.equal(p.peer_closed, true); assert.equal(p.local_destroy, false);
    assert.equal(p.client_sent_fin, false); assert.equal(p.timed_out, false); assert.equal(p.identity.authorized, true);
    assert.equal(p.origin_new_connections, 0); assert.equal(p.origin_transport_errors, 0);
    assert.deepEqual(p.statuses, [mapped ? 400 : 501]);
    if (mapped) assertRejected(p); else assert.throws(() => assertRejected(p));
  }
  record.protocol = summary; record.focused_probes = focused.probes.length;
  run('immutable-manifest', [process.execPath, 'spikes/edge-comparison/extract-baseline.mjs', '--check']);
  run('candidate-config', [process.execPath, '--test', 'spikes/envoy/sprint05a-a-config.test.mjs']);
  for (const file of git('ls-files', 'spikes/envoy/sprint05a-a*').split('\n').filter(Boolean))
    run(`syntax-${path.basename(file)}`, [process.execPath, '--check', file]);
  run('whitespace', ['git', 'diff', '--check', '8e77a4f', '--', 'spikes/envoy/sprint05a-a*', 'docs/reports/sprint05a-a-envoy-te.md']);
  const inventory = execFileSync('git', ['ls-tree', '-rz', '541d1d915ce6a3b679dc3fed3ea0a98f908ce001']);
  for (const entry of inventory.toString().split('\0').filter(Boolean)) {
    const [info, file] = entry.split('\t'); const [mode, , oid] = info.split(' ');
    const bytes = mode === '120000' ? Buffer.from(fs.readlinkSync(file)) : fs.readFileSync(file);
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), oid, file);
  }
  record.baseline_working_objects_equal = 4003;
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  run('scanner-version', ['docker', 'run', '--rm', '--pull', 'never', '--network', 'none', scanner, 'version']);
  for (const [scope, target] of [['source', 'spikes/envoy'], ['evidence', 'evidence/sprint05a-a'], ['report', 'docs/reports/sprint05a-a-envoy-te.md']])
    run(`secret-${scope}`, ['docker', 'run', '--rm', '--pull', 'never', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`,
      '-v', `${process.cwd()}:/repo:ro`, scanner, 'dir', `/repo/${target}`, '--config', '/repo/.github/gitleaks.toml', '--redact', '--no-banner']);
  // The removed broad inspection stream must be absent even from the local object store.
  const removed = spawnSync('git', ['cat-file', '-e', '7bad0dc7cf80ff73c4f6edc335d1354efbc338ba']);
  assert.notEqual(removed.status, 0); record.removed_inspection_blob_absent = true;
  record.completed = true;
} catch (e) { record.error = e.stack; process.exitCode = 1; }
finally {
  assertLock(); record.ended_at = new Date().toISOString();
  fs.writeFileSync(`${output}/commands.json`, JSON.stringify(record, null, 2) + '\n');
  const files = fs.readdirSync(output).sort();
  fs.writeFileSync(`${output}/SHA256SUMS`, files.map((f) => `${hash(fs.readFileSync(`${output}/${f}`))}  ${output}/${f}`).join('\n') + '\n');
}
