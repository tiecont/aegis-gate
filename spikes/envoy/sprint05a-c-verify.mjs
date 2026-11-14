import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
import { evaluate } from '../edge-comparison/evaluate.mjs';
assertLock();
const output = process.argv[2]; assert.ok(output && !fs.existsSync(output));
fs.mkdirSync(output, { recursive: true });
const base = 'evidence/sprint05a-c';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const read = (f) => JSON.parse(fs.readFileSync(f));
const record = { started_at: new Date().toISOString(), source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  source_tree: execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(), argv: process.argv,
  node: process.version, node_sha256: hash(fs.readFileSync(process.execPath)), commands: [], original_runs: [], lifecycle: [],
  security_verdict: 'NO-GO: original H2 aggregate-zero-byte assertion still fails; no repair claimed' };
try {
  for (const dir of ['recovery-01', 'windows-01', 'identity-01', 'partition-01', 'bounded-02', 'windows-plain-01']) {
    const receipt = read(`${base}/${dir}/receipt.json`); const result = read(`${base}/${dir}/results.json`);
    assert.equal(receipt.completed, true); assert.equal(receipt.cleanup.remaining, ''); assert.equal(receipt.cleanup.fixture_removed, true);
    for (const item of read(`${base}/${dir}/SHA256.json`)) assert.equal(hash(fs.readFileSync(`${base}/${dir}/${item.file}`)), item.sha256, `${dir}/${item.file}`);
    for (const { file, sha256 } of receipt.source_hashes) assert.equal(hash(execFileSync('git', ['show', `${receipt.source_commit}:${file}`])), sha256, `${dir} exact committed source ${file}`);
    const decision = evaluate(result); assert.equal(decision.passed, 69); assert.equal(decision.mandatory_tests, 75);
    const negative = result.tests.find((t) => t.name === 'HTTP2-authority-Host-and-SNI-confusion-rejected');
    assert.equal(negative.status, 'fail'); assert.equal(negative.origin.decrypted_bytes, 9); assert.equal(negative.origin.handler_invocations, 0); assert.equal(negative.origin.parser_errors, 0);
    let raw;
    if (receipt.tap === 'tap') {
      const tap = read(`${base}/${dir}/raw-h2.json`); assert.equal(tap.incomplete, false);
      const i = tap.boundaries.findIndex((b) => b.message.startsWith('FAIL HTTP2-authority-Host-and-SNI-confusion-rejected'));
      const before = tap.boundaries[i - 1]; const after = tap.boundaries[i]; assert.ok(before.message.startsWith('PASS HTTP2-downstream-and-upstream-ALPN'));
      raw = tap.connections.map((c) => {
        const start = before.offsets.find((x) => x.id === c.id)?.bytes ?? 0;
        const end = after.offsets.find((x) => x.id === c.id)?.bytes ?? 0;
        return c.chunks.map((x) => x.hex).join('').slice(start * 2, end * 2);
      }).join('');
      assert.equal(raw, '000000040100000000');
    }
    const controls = result.tests.filter((t) => /ALPN|body-streaming|WebSocket|gRPC|connection-pooling|pools-are-partitioned|trust-store|config|snapshot|TLS-rejects/.test(t.name));
    assert.ok(controls.length >= 10); assert.ok(controls.every((t) => t.status === 'pass'));
    record.original_runs.push({ directory: dir, source_commit: receipt.source_commit, source_tree: receipt.source_tree,
      receipt_sha256: hash(fs.readFileSync(`${base}/${dir}/receipt.json`)), evidence_manifest_sha256: hash(fs.readFileSync(`${base}/${dir}/SHA256.json`)),
      passed: decision.passed, failed: decision.failed, negative, raw_origin_hex: raw ?? null,
      raw_origin_sha256: raw ? hash(Buffer.from(raw, 'hex')) : null, positive_controls: controls.map((t) => t.name) });
  }
  for (const dir of ['lifecycle-windows-03', 'lifecycle-partition-02', 'lifecycle-bounded-02']) {
    const receipt = read(`${base}/${dir}/receipt.json`);
    for (const item of read(`${base}/${dir}/SHA256.json`)) assert.equal(hash(fs.readFileSync(`${base}/${dir}/${item.file}`)), item.sha256);
    assert.ok(!receipt.error); assert.equal(receipt.tests.length, 7); assert.ok(receipt.tests.every((t) => t.status === 'pass'));
    assert.equal(receipt.cleanup.container_absent, true); assert.equal(receipt.cleanup.lock_held, true); assert.equal(receipt.cleanup.fixture_removed, true);
    for (const probe of receipt.tests.find((t) => t.name === 'cold-denials-no-origin-dial-or-bytes').detail) assert.equal(probe.origin_tcp_accepts, 0);
    const sequential = receipt.tests.find((t) => t.name === 'valid-cold-warm-sequential-reuse');
    const concurrent = receipt.tests.find((t) => t.name === 'concurrent-streams-share-valid-pool');
    record.lifecycle.push({ directory: dir, source_commit: receipt.source_commit, passed: 7,
      sequential_requests: sequential.detail.length, concurrent_streams: concurrent.detail.length,
      sequential_origin_connections: new Set(sequential.detail.map((r) => r.connection)).size,
      concurrent_origin_connections: new Set(concurrent.detail.map((r) => r.connection)).size,
      receipt_sha256: hash(fs.readFileSync(`${base}/${dir}/receipt.json`)), evidence_manifest_sha256: hash(fs.readFileSync(`${base}/${dir}/SHA256.json`)),
      limitations: 'Additional userinfo probe can end with native RST8 and no response; this does not satisfy or replace original 400/421 assertion. Warm diagnostics run after valid reuse and do not reproduce original timing.' });
  }
  const files = execFileSync('git', ['ls-files', 'spikes/envoy/sprint05a-c-*.mjs'], { encoding: 'utf8' }).trim().split('\n');
  for (const [label, args] of [...files.map((f) => [`syntax-${path.basename(f)}`, ['--check', f]]),
    ['baseline', ['spikes/edge-comparison/extract-baseline.mjs', '--check']],
    ['observer-contract-evaluator-tests', ['--test', 'spikes/edge-comparison/tls-observer.test.mjs', 'spikes/edge-comparison/contract.test.mjs', 'spikes/edge-comparison/evaluate.test.mjs']]]) {
    const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
    for (const stream of ['stdout', 'stderr']) fs.writeFileSync(`${output}/${label}.${stream}`, r[stream] ?? '');
    record.commands.push({ label, argv: [process.execPath, ...args], exit_code: r.status, signal: r.signal }); assert.equal(r.status, 0, label);
  }
  assert.equal(execFileSync('docker', ['ps', '-aq', '--filter', 'name=aegis-envoy-sprint05a-c-'], { encoding: 'utf8' }).trim(), '');
  assert.equal(fs.readdirSync('.local').filter((d) => d.startsWith('sprint05a-c-')).length, 0);
  record.cleanup = { containers_absent: true, fixture_directories_absent: true, lock_held: true };
} catch (e) { record.error = e.stack; process.exitCode = 1; }
record.ended_at = new Date().toISOString();
fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(record, null, 2) + '\n');
fs.writeFileSync(`${output}/SHA256.json`, JSON.stringify(fs.readdirSync(output).sort().map((file) => ({ file, sha256: hash(fs.readFileSync(`${output}/${file}`)) })), null, 2) + '\n');
console.log(JSON.stringify({ original: record.original_runs.map((r) => ({ run: r.directory, passed: r.passed, bytes: r.negative.origin.decrypted_bytes, raw: r.raw_origin_hex })), lifecycle: record.lifecycle, error: record.error }, null, 2));
