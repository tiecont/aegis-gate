import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
const [root, output] = process.argv.slice(2);
const head = '71a3dc6381223d54fa8b23ecf84ff205e0b52ea6';
const baseline = 'cbb5f71db84b9489bf4a6260696bbba29ab4a561';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const gb = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32 << 20 });
const git = (...args) => gb(...args).toString().trim();
const read = f => fs.readFileSync(path.join(root, f));
const json = f => JSON.parse(read(f));
assert.ok(root && output && !fs.existsSync(output));
assert.equal(git('rev-parse', 'HEAD'), head); assert.equal(git('status', '--porcelain'), '');
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no']).toString().trim(), '');
fs.mkdirSync(output, { recursive: true });
const receipt = { head, tree: git('rev-parse', 'HEAD^{tree}'), reviewer: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(),
  argv: process.argv, node: process.version, node_sha256: hash(fs.readFileSync(process.execPath)), started_at: new Date().toISOString(), commands: [], attempts: [] };
function run(label, program, args) {
  const started_at = new Date().toISOString(); const c = spawnSync(program, args, { cwd: root, maxBuffer: 32 << 20 }); const streams = {};
  for (const stream of ['stdout', 'stderr']) { const file = path.join(output, `${label}.${stream}`); fs.writeFileSync(file, c[stream] ?? '', { flag: 'wx' }); streams[stream] = { file, sha256: hash(fs.readFileSync(file)) }; }
  receipt.commands.push({ label, program, args, cwd: root, started_at, ended_at: new Date().toISOString(), exit_code: c.status, signal: c.signal, streams });
  assert.equal(c.status, 0, label);
}
try {
  const changed = git('diff', '--name-only', baseline, head).split('\n');
  assert.ok(changed.every(f => /^(spikes\/envoy\/sprint04b-|evidence\/sprint04b-c\/|docs\/reports\/sprint04b-c-protocol.md)/.test(f)));
  receipt.files = changed.map(file => ({ file, sha256: hash(read(file)) }));
  for (const dir of ['attempt01', 'attempt02', 'verification01', 'verification02']) {
    const base = `evidence/sprint04b-c/${dir}`; const r = json(`${base}/commands.json`);
    assert.equal(git('rev-parse', `${r.source_commit}^{tree}`), r.source_tree);
    for (const f of r.source_hashes ?? []) assert.equal(hash(gb('show', `${r.source_commit}:${f.file}`)), f.sha256);
    for (const f of [...r.historical_receipts ?? [], ...r.immutable ?? []]) {
      assert.equal(hash(read(f.file)), f.sha256); assert.equal(hash(gb('show', `${baseline}:${f.file}`)), f.sha256);
    }
    for (const c of r.commands) for (const stream of ['stdout', 'stderr']) assert.equal(hash(read(`${base}/${c.label}.${stream}`)), c[`${stream}_sha256`]);
    const lines = read(`${base}/SHA256SUMS`).toString().trim().split('\n');
    for (const line of lines) { const [, expected, file] = /^([a-f0-9]{64})  (.+)$/.exec(line); assert.equal(hash(read(path.join(base, file))), expected); }
    if (r.cleanup) { assert.equal(r.source_clean, true); assert.equal(r.cleanup.lock_held_through_cleanup, true); assert.deepEqual(r.cleanup.remaining_owned_containers, []); }
    if (dir === 'verification01') { assert.ok(r.fatal); assert.equal(r.commands[0].exit_code, 2); }
    if (dir === 'verification02') { assert.ok(!r.fatal); assert.ok(r.commands.every(c => c.exit_code === 0)); }
    receipt.attempts.push({ dir, source: r.source_commit, source_files: r.source_hashes?.length ?? 0, historical_files: r.historical_receipts?.length ?? 0, manifest_entries: lines.length, commands: r.commands.map(c => [c.label, c.exit_code]) });
  }
  const original = json('evidence/sprint04a-b/attempt02/diagnostic75-results.json');
  const fresh = json('evidence/sprint04b-c/attempt01/unchanged75-results.json');
  assert.equal(fresh.tests.length, 75); assert.deepEqual(fresh.tests.map(t => t.name), original.tests.map(t => t.name));
  const failures = tests => tests.filter(t => t.status !== 'pass').map(t => t.name);
  assert.deepEqual(failures(fresh.tests), failures(original.tests)); assert.equal(failures(fresh.tests).length, 6);
  receipt.corpus75 = { passed: 69, failed: failures(fresh.tests) };
  const probes = json('evidence/sprint04b-c/attempt01/unchanged23.json'); const old = json('evidence/sprint04a-b/attempt04/probes.json');
  assert.equal(probes.tests.length, 23); assert.deepEqual(probes.tests.map(t => t.name), old.tests.map(t => t.name)); assert.deepEqual(probes.failures, old.failures);
  receipt.corpus23 = { passed: 16, failed: probes.failures };
  const prior = json('evidence/sprint04b-c/attempt01/protocol.json'); const current = json('evidence/sprint04b-c/attempt02/protocol.json');
  for (const p of [prior, current]) { assert.equal(p.semantic_security_pass, false); assert.equal(p.tests.length, 17); assert.ok(p.tests.every(t => t.status === 'observation-complete')); }
  const at = name => current.tests.find(t => t.name === name);
  receipt.malformed = current.tests.slice(0, 8).map(t => {
    assert.equal(t.peer_closed, true); assert.equal(t.error_frame_observed, false); assert.ok(Object.values(t.origin).every(n => n === 0));
    assert.ok(t.lifecycle.some(e => e.event === 'close' && e.local_cleanup_started === false && e.ms < t.local_deadline_ms));
    assert.ok(t.received.events.every(e => ![3, 7].includes(e.type)));
    return { name: t.name, sent_hex: t.sent_hex, received_bytes: t.received.bytes, close: t.lifecycle.find(e => e.event === 'close'), origin: t.origin };
  });
  receipt.userinfo = [];
  for (const t of current.tests.filter(t => t.name.startsWith('userinfo-native'))) {
    const o = t.observations.at(-1); assert.equal(o.received_wire_trace.available, false); assert.equal(o.rst_code_before_local_cleanup, 8);
    assert.ok(!o.events.some(e => e.event === 'response')); const socketClose = o.events.find(e => e.event === 'socket-close');
    assert.equal(socketClose.local_cleanup_started, false); assert.ok(socketClose.ms < o.events.find(e => e.event === 'close').ms);
    receipt.userinfo.push({ name: t.name, events: o.events, trace: o.received_wire_trace });
  }
  const eight = at('paused-native-reader-large8'); assert.equal(eight.origin_closed_before_client_cancel, true); assert.equal(eight.cancel_ms, null); assert.equal(eight.cancellation_proven, false);
  assert.equal(eight.samples[1].produced, 8388608); assert.equal(eight.samples[1].stream_state.localWindowSize, 0);
  for (const name of ['paused-native-reader-large8', 'paused-native-reader-large32']) for (const s of at(name).samples) assert.equal(s.received_wire_trace.available, false);
  const thirtyTwo = at('paused-native-reader-large32'); assert.equal(thirtyTwo.samples[2].produced, 16842752);
  assert.equal(thirtyTwo.samples[2].origin_wire_at_sample.records[0].origin_to_candidate.streams['3'].data_bytes, 16777216);
  assert.ok(thirtyTwo.cancellation_proven && thirtyTwo.cancel_ms >= 0); assert.equal(thirtyTwo.origin_rst_code, 2);
  const upload = at('partial-upload-native-cancel'); assert.equal(upload.received, 16384); assert.equal(upload.origin_rst_code, 2); assert.equal(upload.downstream_wire_trace.available, false);
  assert.ok(upload.origin_wire.records.some(r => r.candidate_to_origin.events.some(e => e.hex === '00000403000000000500000002')));
  const ws = at('WebSocket-two-messages-and-close'); assert.deepEqual(ws.values, ['first', 'second']); assert.equal(ws.close_code, 1000); assert.equal(current.websocket_origin.close, 1000);
  const grpc = at('gRPC-streaming-trailers'); assert.deepEqual(grpc.values, ['echo:one', 'echo:two']); assert.equal(grpc.trailers['lab-trailer'], 'complete');
  const cancel = at('gRPC-cancel-reaches-origin'); assert.ok(cancel.cancel_ms >= 0); assert.ok(cancel.origin_wire.records.some(r => r.candidate_to_origin.events.some(e => e.hex === '00000403000000000300000002')));
  receipt.corrected_labels = { completed_8MiB_before_cancel: true, cancellation_proven_8MiB: false, native_wire_unavailable: true };
  receipt.buffering = { produced8: eight.samples.map(s => s.produced), produced32: thirtyTwo.samples.map(s => s.produced), cancel32_ms: thirtyTwo.cancel_ms, upload_cancel_ms: upload.cancel_ms, grpc_cancel_ms: cancel.cancel_ms };
  run('immutable75', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']);
  run('source-whitespace', 'git', ['diff', '--check', baseline, head, '--', 'spikes/envoy/sprint04b-*', 'docs/reports/sprint04b-c-protocol.md']);
  run('relay-independent', 'flock', ['/tmp/aegisgate-sprint02-fixtures.lock', process.execPath, '--test', 'spikes/envoy/sprint04b-observer.test.mjs']);
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  for (const [name, target] of [['source', 'spikes/envoy'], ['evidence', 'evidence/sprint04b-c'], ['report', 'docs/reports/sprint04b-c-protocol.md']]) run(`secrets-${name}`, 'flock', ['/tmp/aegisgate-sprint02-fixtures.lock', 'docker', 'run', '--rm', '--pull=never', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`, '-v', `${root}:/repo:ro`, '-v', `${path.resolve(output)}:/reports`, scanner, 'dir', `/repo/${target}`, '--config', '/repo/.github/gitleaks.toml', '--redact', '--no-banner']);
  assert.equal(git('status', '--porcelain'), ''); receipt.verdict = 'ACCEPT scoped diagnostic investigation; six/seven failures and protocol conformance unresolved'; receipt.exit_code = 0;
} catch (error) { receipt.error = error.stack; receipt.exit_code = 1; process.exitCode = 1; }
finally {
  receipt.ended_at = new Date().toISOString(); receipt.scope = 'Read-only exact C provenance and observation review, independent three relay tests and offline scans. No candidate/full75/full23 rerun, gate waiver or GO.';
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), fs.readdirSync(output).sort().map(f => `${hash(fs.readFileSync(path.join(output, f)))}  ${path.join(output, f)}`).join('\n') + '\n');
  console.log(JSON.stringify({ output, exit_code: receipt.exit_code, verdict: receipt.verdict, error: receipt.error ?? null }));
}
