import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from '../spikes/envoy/wire-fixtures.mjs';

process.umask(0o077);
assertLock();
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05a-f-final\/verify-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { maxBuffer: 32 << 20 });
const text = (...args) => git(...args).toString().trim();
const sha = (b) => createHash('sha256').update(b).digest('hex');
const blob = (commit, file) => git('show', `${commit}:${file}`);
const base = '541d1d915ce6a3b679dc3fed3ea0a98f908ce001';
const independent = 'acec5e67c46cd703145ee8ed13ee731b8db57a0d';
assert.equal(text('status', '--porcelain', '--untracked-files=no'), '');
fs.mkdirSync(output, { recursive: true });
const receipt = { source_commit: text('rev-parse', 'HEAD'), source_tree: text('rev-parse', 'HEAD^{tree}'),
  argv: process.argv, cwd: process.cwd(), node: process.version, node_binary_sha256: sha(fs.readFileSync(process.execPath)),
  started_at: new Date().toISOString(), reused_independent_commit: independent, manifests: [], sources: [], commands: [] };
const json = (read, file) => JSON.parse(read(file));
const fromGit = (commit) => (file) => blob(commit, file);
const fRead = fromGit(independent);
function manifest(read, file, map = (f) => f) {
  const bytes = read(file), lines = bytes.toString().trim().split('\n');
  for (const line of lines) {
    const [, digest, name] = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.equal(sha(read(map(name))), digest, name);
  }
  receipt.manifests.push({ file, sha256: sha(bytes), entries: lines.length });
}
function sources(r, field = 'sources') {
  assert.equal(text('rev-parse', `${r.source_commit}^{tree}`), r.source_tree);
  for (const s of r[field]) assert.equal(sha(blob(r.source_commit, s.file)), s.sha256, s.file);
  receipt.sources.push({ commit: r.source_commit, tree: r.source_tree, files: r[field].length });
}
function run(label, argv) {
  assertLock();
  const started_at = new Date().toISOString();
  const r = spawnSync(argv[0], argv.slice(1), { timeout: 60000, maxBuffer: 16 << 20 });
  const streams = ['stdout', 'stderr'].map((name) => {
    const file = `${output}/${label}.${name}`, b = r[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, b); return { file, bytes: b.length, sha256: sha(b) };
  });
  receipt.commands.push({ label, argv, started_at, ended_at: new Date().toISOString(), exit_code: r.status,
    signal: r.signal, error: r.error?.message, streams });
  assert.equal(r.status, 0, label); return r.stdout.toString();
}
function suite(read, file, total, passed) {
  const r = json(read, file);
  assert.ok(!r.fatal); assert.equal(r.tests.length, total);
  assert.equal(r.tests.filter((t) => t.status === 'pass').length, passed);
  return r;
}
try {
  const before = text('ls-tree', '-r', base).split('\n');
  const current = new Map(text('ls-tree', '-r', 'HEAD').split('\n').map((l) => [l.split('\t')[1], l]));
  const changed = before.filter((l) => current.get(l.split('\t')[1]) !== l).map((l) => l.split('\t')[1]);
  assert.equal(before.length, 4003);
  assert.deepEqual(changed, ['scripts/sprint04c-gates.mjs']);
  receipt.baseline = { commit: base, tree: text('rev-parse', `${base}^{tree}`), objects: before.length,
    reviewed_exceptions: changed, inventory_sha256: sha(git('ls-tree', '-r', base)) };
  const protectedPaths = ['spikes/edge-comparison', 'spikes/pingora/lab.mjs', 'spikes/envoy/config.mjs',
    'spikes/envoy/recovery-config.mjs', 'spikes/envoy/recovery-launcher.mjs', 'spikes/envoy/wire-probes.mjs', 'spikes/envoy/wire-fixtures.mjs'];
  const protectedBytes = git('ls-tree', '-r', base, '--', ...protectedPaths);
  assert.deepEqual(git('ls-tree', '-r', 'HEAD', '--', ...protectedPaths), protectedBytes);
  receipt.baseline.protected_inventory_sha256 = sha(protectedBytes);
  run('immutable75', [process.execPath, 'spikes/edge-comparison/extract-baseline.mjs', '--check']);
  run('original-tests', [process.execPath, '--test', 'spikes/edge-comparison/contract.test.mjs',
    'spikes/edge-comparison/evaluate.test.mjs', 'spikes/edge-comparison/tls-observer.test.mjs']);

  const f = 'evidence/sprint05a-f/extended-01';
  manifest(fRead, `${f}/SHA256SUMS`);
  const extended = json(fRead, `${f}/receipt.json`);
  assert.ok(extended.completed && extended.lock_held_through_capture_cleanup_hashing);
  for (const c of extended.commands) { assert.equal(c.exit_code, 0); assert.equal(c.signal, null); }
  const b = json(fRead, `${f}/b-llhttp/receipt.json`); sources(b);
  assert.equal(b.source_commit, '133d3eae70fa6dfe6b27ee0b4ca0ce08b8d44dcf');
  assert.ok(b.completed_observations && b.observer_control.exact_match);
  assert.ok(b.cleanup.container_absent && b.cleanup.fixture_removed && b.cleanup.lock_held_through_hashing);
  assert.equal(b.probes.length, 22); assert.equal(b.fold_rejections.length, 10);
  assert.ok(b.fold_rejections.every((p) => p.pass));
  for (const pin of b.pins.downloads) {
    assert.equal(sha(fs.readFileSync(path.resolve('/tmp/aegisgate-05a-f-exact-b', pin.cache))), pin.sha256, pin.name);
  }
  const originals = json(fromGit(base), 'spikes/edge-comparison/manifest.json').negatives.filter((p) => /obsolete.fold/.test(p.name));
  for (const original of originals) {
    const p = b.probes.find((p) => p.name === `original-${original.name}`);
    assert.equal(p.request_hex, Buffer.from(original.request).toString('hex'));
    assert.ok(p.strict_rejection);
  }
  for (const p of b.parses.filter((p) => p.result.error === 'HPE_INVALID_HEADER_TOKEN')) {
    const bytes = Buffer.from(p.input_hex, 'hex'), end = p.result.consumed;
    assert.ok([9, 32].includes(bytes[end]));
    assert.equal(bytes.subarray(end - 2, end).toString(), '\r\n');
    assert.ok(p.result.events.every((e) => e.offset + e.hex.length / 2 <= end));
  }
  assert.equal(b.fragment_checks.length, 24);
  for (const p of b.fragment_checks) {
    assert.equal(p.error, p.name === 'valid-trailer' ? 'HPE_OK' : 'HPE_INVALID_HEADER_TOKEN');
    assert.equal(p.complete_count, p.name === 'valid-trailer' ? 1 : 0);
  }
  const delayed = b.probes.find((p) => p.name === 'delayed-folded-trailer');
  assert.deepEqual(delayed.before_final_fragment, { origin_bytes: 0, new_connections: 0, handlers: [] });
  const mixed = b.probes.find((p) => p.name === 'valid-then-folded-pipeline');
  assert.deepEqual(mixed.status, [200, 400]); assert.equal(mixed.origin.bytes, 52);
  assert.equal(Buffer.from(mixed.origin.hex, 'hex').toString(), 'GET /first%2Fsegment HTTP/1.1\r\nHost: edge-a.test\r\n\r\n');
  receipt.b = { source_commit: b.source_commit, wire_probes: b.probes.length, fold_rejections: 10,
    fragment_controls: 24, exact_originals: originals.length, pin_files: b.pins.downloads.length,
    narrow_accept: true, complete_ingress_accept: false };

  sources(json(fRead, `${f}/c-original75/receipt.json`), 'source_hashes');
  const c = suite(fRead, `${f}/c-original75/results.json`, 75, 69);
  const h2 = c.tests.find((t) => t.name === 'HTTP2-authority-Host-and-SNI-confusion-rejected');
  assert.equal(h2.status, 'fail'); assert.equal(h2.origin.decrypted_bytes, 9);
  assert.equal(h2.origin.handler_invocations, 0); assert.equal(h2.origin.parser_errors, 0);
  const raw = json(fRead, `${f}/c-original75/raw-h2.json`); assert.equal(raw.incomplete, false);
  const i = raw.boundaries.findIndex((p) => p.message.startsWith('FAIL HTTP2-authority-Host-and-SNI-confusion-rejected'));
  assert.ok(i > 0);
  const chunks = raw.connections.flatMap((p) => p.chunks.filter((q) =>
    BigInt(q.time_ns) > BigInt(raw.boundaries[i - 1].time_ns) && BigInt(q.time_ns) < BigInt(raw.boundaries[i].time_ns)));
  assert.equal(chunks.map((p) => p.hex).join(''), '000000040100000000');
  const life = json(fRead, `${f}/c-lifecycle/receipt.json`);
  assert.equal(life.tests.length, 7); assert.ok(life.tests.every((p) => p.status === 'pass'));
  receipt.c = { original75: 69, h2, ack_hex: chunks.map((p) => p.hex).join(''), lifecycle: 7, repair_accept: false };

  const combined = json(fRead, `${f}/combined/commands.json`); sources(combined);
  assert.ok(combined.recording_complete && combined.cleanup_complete && combined.lock_held_through_cleanup);
  const both = suite(fRead, `${f}/combined/original75.json`, 75, 73);
  const extra = suite(fRead, `${f}/combined/original23.json`, 23, 19);
  for (const name of ['raw-H2-uppercase-header-name', 'raw-H2-connection-specific-header']) {
    const p = extra.tests.find((p) => p.name === name); assert.equal(p.status, 'pass');
    for (const k of ['connections', 'bytes', 'handlers', 'parser_errors', 'transport_errors']) assert.equal(p.origin[k], 0);
    assert.ok(p.error_frames.some((p) => p.hex === '00000403000000000100000001'));
  }
  const controls = json(fRead, `${f}/combined/controls.json`);
  assert.equal(controls.tests.length, 17); assert.ok(controls.tests.every((p) => p.status === 'observation-complete'));
  assert.equal(controls.semantic_security_pass, false);
  receipt.combined = { passed75: 73, passed23: 19, controls: 17, security_accept: false,
    failures75: both.tests.filter((p) => p.status === 'fail'), failures23: extra.failures };
  for (const [cwd, prefix, expected] of [
    ['/tmp/aegisgate-05a-combined', 'evidence/sprint05a-root/candidate-02', '8d293c8ad7ab5c2deaac868462913243852adde7'],
    ['/tmp/aegisgate-05a-d', 'evidence/sprint05a-d/attempt-03', 'c698a4af61195aad5a8a80d2b8d0d090f0f1d068'],
  ]) {
    const read = (file) => fs.readFileSync(path.join(cwd, file));
    manifest(read, `${prefix}/SHA256SUMS`);
    const r = json(read, `${prefix}/commands.json`); sources(r); assert.equal(r.source_commit, expected);
    assert.ok(r.cleanup_complete && r.recording_complete && r.lock_held_through_cleanup);
    const controls = json(read, `${prefix}/controls.json`);
    assert.equal(controls.tests.length, 17); assert.ok(controls.tests.every((p) => p.status === 'observation-complete'));
    assert.equal(controls.semantic_security_pass, false);
    if (prefix.includes('candidate')) {
      suite(read, `${prefix}/original75.json`, 75, 73); suite(read, `${prefix}/original23.json`, 23, 19);
    }
  }

  const eRead = fromGit('a0012829bc3cd3196a69efd21c53a9605e7569f6'), eDir = 'evidence/sprint05a-e/attempt-01';
  manifest(eRead, `${eDir}/SHA256SUMS`);
  const e = json(eRead, `${eDir}/commands.json`);
  assert.ok(e.passed && e.tracked_clean && e.lock_held_through_cleanup && e.owned_private_material_removed);
  assert.equal(text('rev-parse', `${e.source_commit}^{tree}`), e.source_tree);
  assert.equal(e.commands.length, 64);
  const streams = Object.fromEntries(['stdout', 'stderr'].map((s) => [s, eRead(`${eDir}/${s}.log`)]));
  const offsets = { stdout: 0, stderr: 0 }, labels = new Map();
  for (const c of e.commands) {
    assert.ok(!labels.has(c.label)); labels.set(c.label, c);
    assert.equal(c.exit_code, c.label.startsWith('lock-') || c.label === 'typescript7-strict-resolution' ? 1 : 0);
    assert.equal(c.signal, null); assert.equal(c.error_code, null);
    for (const [s, p] of Object.entries(c.streams)) {
      assert.equal(p.offset, offsets[s]); const b = streams[s].subarray(p.offset, p.offset + p.length);
      assert.equal(b.length, p.length); assert.equal(sha(b), p.sha256); offsets[s] += p.length;
    }
  }
  for (const s of Object.keys(streams)) assert.equal(offsets[s], streams[s].length);
  const rawE = (label, s = 'stdout') => { const p = labels.get(label).streams[s]; return streams[s].subarray(p.offset, p.offset + p.length).toString(); };
  const go = rawE('go-full-race-integration');
  assert.doesNotMatch(go, /--- (FAIL|SKIP):/);
  const counts = { packages: (go.match(/^ok\s/gm) ?? []).length, top_level: (go.match(/^--- PASS:/gm) ?? []).length,
    subtests: (go.match(/^\s+--- PASS:/gm) ?? []).length, skipped: 0 };
  assert.deepEqual(counts, { packages: 11, top_level: 88, subtests: 151, skipped: 0 });
  assert.equal(labels.get('go-full-race-integration').environment.AEGIS_TENANCY_INTEGRATION, '1');
  assert.match(rawE('typescript7-strict-resolution', 'stderr'), /ERESOLVE/);
  assert.match(rawE('typescript7-strict-resolution', 'stderr'), />=4\.8\.4 <6\.1\.0/);
  const audit = json(eRead, `${eDir}/dependencies/pingora-spike-vulnerabilities.log`);
  assert.deepEqual(audit.settings.ignore, []); assert.equal(audit.vulnerabilities.found, false);
  assert.deepEqual(audit.warnings.unmaintained.map((p) => p.advisory.id).sort(), ['RUSTSEC-2024-0388', 'RUSTSEC-2024-0449']);
  for (const file of ['scripts/sprint05a-e-regressions.mjs', 'scripts/sprint05a-e-fixtures.py', 'scripts/sprint05a-e-verify.py']) {
    assert.deepEqual(fs.readFileSync(file), blob(e.source_commit, file));
  }
  for (const c of e.commands.filter((c) => c.label.startsWith('cleanup-') && !c.label.includes('image'))) assert.equal(rawE(c.label).trim(), '');
  const refs = json(eRead, `${eDir}/baseline-references.json`).files;
  assert.equal(refs.length, 57);
  for (const p of refs) { const b = blob(p.commit, p.file); assert.equal(sha(b), p.sha256); assert.equal(b.length, p.bytes); assert.equal(text('rev-parse', `${p.commit}:${p.file}`), p.blob); }
  receipt.e = { source_commit: e.source_commit, commands: 64, slices: 128, go: counts, baseline_references: refs.length,
    dependency_stop_preserved: true, accepted_local_regressions: true };
  const project = e.compose_project;
  for (const kind of ['container', 'network', 'volume']) for (const key of ['com.docker.compose.project', 'aegisgate.fixture.owner']) {
    assert.equal(run(`e-cleanup-${kind}-${key}`, ['docker', kind, 'ls', '--filter', `label=${key}=${project}`, '--format', '{{.ID}}']).trim(), '');
  }
  run('authored-whitespace', ['git', 'diff', '--check', base, 'HEAD', '--', 'scripts/sprint05a-f-final-verify.mjs', 'evidence/sprint05a-f-final/PLAN.md']);
  receipt.completed = true;
} catch (error) { receipt.error = error.stack; process.exitCode = 1; }
finally {
  assertLock(); receipt.ended_at = new Date().toISOString(); receipt.lock_held_through_hashing = true;
  fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
  const files = fs.readdirSync(output).sort();
  fs.writeFileSync(`${output}/SHA256SUMS`, files.map((file) => `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}\n`).join(''));
}
console.log(JSON.stringify({ completed: receipt.completed ?? false, error: receipt.error, evidence: output }));
