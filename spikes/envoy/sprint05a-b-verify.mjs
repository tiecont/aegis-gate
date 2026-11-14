import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { receipt, hash, git } from './sprint05a-b-receipts.mjs';
import { assertLock } from './wire-fixtures.mjs';

assertLock();
const proof = receipt(process.argv[2]);
const base = '541d1d915ce6a3b679dc3fed3ea0a98f908ce001';
try {
  proof.record.checked = [];
  for (const attempt of ['source-01', 'envoy-01', 'envoy-02', 'llhttp-01', 'llhttp-02', 'nginx-01', 'nginx-02', 'validator-01']) {
    const dir = `evidence/sprint05a-b/${attempt}`;
    const r = JSON.parse(fs.readFileSync(`${dir}/receipt.json`));
    assert.equal(r.tracked_clean, true);
    assert.equal(git('rev-parse', `${r.source_commit}^{tree}`), r.source_tree);
    for (const line of fs.readFileSync(`${dir}/SHA256SUMS`, 'utf8').trim().split('\n')) {
      const [, sha, file] = /^([a-f0-9]{64})  (.+)$/.exec(line);
      assert.equal(hash(fs.readFileSync(file)), sha, file);
    }
    for (const src of r.sources) assert.equal(hash(execFileSync('git', ['show', `${r.source_commit}:${src.file}`])), src.sha256);
    if (attempt !== 'source-01') {
      assert.ok(r.cleanup.lock_held_through_hashing && r.cleanup.container_absent && r.cleanup.fixture_removed);
      if (attempt.endsWith('02') || attempt === 'envoy-01') assert.equal(r.observer_control.exact_match, true);
    }
    proof.record.checked.push({ attempt, source: r.source_commit, tree: r.source_tree,
      error: r.error ?? null, completed: r.completed_observations ?? null, commands: r.commands.length });
  }
  const read = (name) => JSON.parse(fs.readFileSync(`evidence/sprint05a-b/${name}/receipt.json`));
  for (const name of ['envoy-01', 'envoy-02']) {
    const r = read(name); assert.ok(!r.error); assert.equal(r.completed_observations, true);
    assert.equal(r.probes.length, 20); assert.ok(r.fold_rejections.every((p) => !p.pass));
    const p = r.probes.find((p) => p.name === 'folded-trailer-sp');
    assert.equal(p.status[0], 200); assert.equal(p.origin.bytes, 236);
    assert.deepEqual(p.origin.handlers[0].trailers, ['x-folded', 'first second']);
  }
  const ll = read('llhttp-02'); assert.ok(!ll.error); assert.equal(ll.completed_observations, true);
  assert.equal(ll.probes.length, 20); assert.equal(ll.fold_rejections.length, 10);
  assert.ok(ll.fold_rejections.every((p) => p.pass));
  const delayed = ll.probes.find((p) => p.name === 'delayed-folded-trailer');
  assert.equal(delayed.before_final_fragment.origin_bytes, 0);
  assert.equal(delayed.before_final_fragment.new_connections, 0);
  assert.equal(delayed.before_final_fragment.handlers.length, 0);
  assert.deepEqual(ll.probes.find((p) => p.name === 'valid-trailer').origin.handlers[0].trailers,
    ['X-Folded', 'first second']);
  assert.equal(ll.fragment_checks.length, 24);
  for (const c of ll.fragment_checks) {
    assert.equal(c.error, c.name === 'valid-trailer' ? 'HPE_OK' : 'HPE_INVALID_HEADER_TOKEN');
    assert.equal(c.complete_count, c.name === 'valid-trailer' ? 1 : 0);
    if (c.name !== 'valid-trailer') assert.equal(c.reason, 'Unexpected whitespace after header value');
  }
  for (const p of ll.parses.filter((p) => p.result.error === 'HPE_INVALID_HEADER_TOKEN')) {
    const bytes = Buffer.from(p.input_hex, 'hex');
    assert.ok([9, 32].includes(bytes[p.result.consumed]));
    assert.equal(bytes.subarray(p.result.consumed - 2, p.result.consumed).toString(), '\r\n');
    assert.ok(p.result.events.every((e) => !Buffer.from(e.hex, 'hex').toString().includes('second')));
  }
  const mixed = ll.probes.find((p) => p.name === 'valid-then-folded-pipeline');
  assert.deepEqual(mixed.status, [200, 400]);
  assert.equal(Buffer.from(mixed.origin.hex, 'hex').toString(), 'GET /first%2Fsegment HTTP/1.1\r\nHost: edge-a.test\r\n\r\n');
  const ng = read('nginx-02'); assert.match(ng.error, /bad%00target/);
  for (const p of ng.probes.filter((p) => p.name.startsWith('folded-trailer'))) {
    assert.equal(p.status[0], 200); assert.equal(p.origin.bytes, 96);
  }
  assert.match(fs.readFileSync('evidence/sprint05a-b/validator-01/runtime.log', 'utf8'), /does not support header validator extensions/);
  // Every tracked baseline object, including all historical evidence and tests, is protected.
  const before = git('ls-tree', '-r', base).split('\n');
  const after = new Map(git('ls-tree', '-r', 'HEAD').split('\n').map((line) => [line.split('\t')[1], line]));
  for (const line of before) assert.equal(after.get(line.split('\t')[1]), line, line.split('\t')[1]);
  proof.record.protected_baseline_objects = before.length;
  for (const [name, argv] of [
    ['immutable-manifest', [process.execPath, 'spikes/edge-comparison/extract-baseline.mjs', '--check']],
    ['whitespace', ['git', 'diff', '--check', base, 'HEAD']],
    ['baseline-worktree', ['git', 'diff', '--exit-code', '--', ...before.map((line) => line.split('\t')[1])]],
  ]) assert.equal(proof.command(name, argv).status, 0);
  proof.record.scope = 'Receipt verification and exact narrow PoC assertions; no full candidate acceptance';
} catch (e) { proof.record.error = e.stack; }
finally { proof.finish(); }
