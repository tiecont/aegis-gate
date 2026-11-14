import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { receipt, hash } from './sprint04c-repro-receipts.mjs';

const proof = receipt(process.argv[2]);
try {
  proof.record.scope = 'Source/receipt/hash and bounded observation verification only; no new runtime or security PASS';
  proof.record.checked = [];
  for (const attempt of ['upstream-01', 'reproh-01', 'reprot-01', 'reprot-02']) {
    const prefix = `evidence/sprint04c-b/${attempt}`;
    const record = JSON.parse(fs.readFileSync(`${prefix}/commands.json`));
    assert.equal(record.tracked_clean, true); assert.match(record.source_commit, /^[a-f0-9]{40}$/);
    assert.equal(execFileSync('git', ['rev-parse', `${record.source_commit}^{tree}`], { encoding: 'utf8' }).trim(), record.source_tree);
    assert.ok(!record.error); assert.equal(record.node, 'v26.13.0');
    let entries = 0;
    for (const line of fs.readFileSync(`${prefix}/SHA256SUMS`, 'utf8').trim().split('\n')) {
      const [, digest, file] = /^([a-f0-9]{64})  (.+)$/.exec(line);
      assert.equal(hash(fs.readFileSync(file)), digest, file); entries++;
    }
    for (const source of record.sources) {
      const bytes = execFileSync('git', ['show', `${record.source_commit}:${source.file}`], { maxBuffer: 8 << 20 });
      assert.equal(hash(bytes), source.sha256, source.file);
    }
    for (const command of record.commands) {
      assert.equal(command.exit_code, 0, command.name); assert.equal(command.signal, null, command.name);
      for (const stream of ['stdout', 'stderr']) assert.equal(hash(fs.readFileSync(command[stream].file)), command[stream].sha256);
    }
    if (attempt !== 'upstream-01') {
      assert.equal(record.cleanup.lock_held_through_cleanup, true); assert.equal(record.cleanup.fixture_removed, true);
      assert.equal(record.completed_observations, true);
      assert.ok(record.container_absent ?? record.cleanup.container_absent);
    } else {
      assert.equal(record.projects.length, 3);
      for (const project of record.projects) {
        assert.equal(project.same_release_revision, true);
        assert.ok(project.files.every((file) => file.same_retained_bytes));
      }
    }
    proof.record.checked.push({ attempt, source: record.source_commit, entries });
  }
  const h1 = JSON.parse(fs.readFileSync('evidence/sprint04c-b/reproh-01/commands.json'));
  assert.equal(h1.probes.length, 29); assert.equal(h1.completed_observations, true); assert.equal(h1.trailer_delivery_proven, false);
  const headers = h1.probes.slice(0, 2);
  assert.ok(headers.every((p) => p.status.at(-1) === 200 && p.origin.decrypted_bytes === 177 && p.origin.handlers.length === 1));
  const field = (raw) => raw[raw.findIndex((s) => s.toLowerCase() === 'x-folded') + 1];
  assert.equal(field(headers[0].origin.handlers[0].headers), 'first second');
  assert.equal(field(headers[1].origin.handlers[0].headers), 'first second');
  const te = h1.probes.filter((p) => /^(malformed-HTTP-invalid-transfer-encoding|strict-ingress-TE-|supplemental-repeated-transfer-encoding-fields)/.test(p.name));
  assert.equal(te.length, 16);
  for (const p of te) {
    assert.equal(p.status.at(-1), p.listener === 'default' ? 501 : 400);
    assert.equal(p.peer_end, true); assert.equal(p.timed_out, false);
    assert.equal(p.origin.decrypted_bytes, 0); assert.equal(p.origin.new_connections, 0); assert.equal(p.origin.handlers.length, 0);
    assert.equal(p.origin.parser_errors, 0); assert.equal(p.origin.transport_errors, 0);
  }
  assert.ok(h1.probes.filter((p) => p.name.startsWith('origin-501-control')).every((p) => p.status.at(-1) === 501));
  const h2 = JSON.parse(fs.readFileSync('evidence/sprint04c-b/reprot-02/commands.json'));
  assert.equal(h2.probes.length, 5);
  assert.ok([h2.probes[0], h2.probes.at(-1)].every((p) => p.response_end_stream_observed && !p.timed_out && p.origin.handlers.length === 1));
  assert.ok(h2.probes.slice(1, 4).every((p) => p.origin.bytes === 0 && p.origin.handlers.length === 0 && p.origin.native_connections === 0));
  // This is an incomplete frame-envelope observer; do not infer full request isolation.
  assert.ok(h2.probes.every((p) => p.observer_complete_security_attribution === false));
  proof.record.original_gate = 'unchanged NO-GO; no original75 or23 runtime rerun claimed';
  assert.equal(proof.command('immutable-manifest', [process.execPath, 'spikes/edge-comparison/extract-baseline.mjs', '--check']).status, 0);
  const protectedDelta = proof.command('protected-baseline', ['git', 'diff', '--name-only', 'a325b9ecc086e09467f61b49f17da241bf8e43ea', 'HEAD', '--',
    'spikes/pingora', 'spikes/edge-comparison', 'spikes/envoy/config.mjs', 'spikes/envoy/recovery-config.mjs',
    'spikes/envoy/wire-observer.mjs', 'spikes/envoy/wire-fixtures.mjs', 'spikes/envoy/sprint04b-*', 'docs/THREAT_MODEL.md', 'docs/QUALITY_GATES.md']);
  assert.equal(protectedDelta.status, 0); assert.equal(protectedDelta.stdout.toString(), '');
  for (const file of ['sprint04c-repro-h1.mjs', 'sprint04c-repro-h2.mjs', 'sprint04c-upstream.mjs', 'sprint04c-upstream-verify.mjs', 'sprint04c-repro-receipts.mjs'])
    assert.equal(proof.command(`syntax-${file}`, [process.execPath, '--check', `spikes/envoy/${file}`]).status, 0);
  assert.equal(proof.command('authored-whitespace', ['git', 'diff', '--check', 'a325b9e', 'HEAD', '--', 'spikes/envoy/sprint04c-*',
    'docs/reports/sprint04c-b-upstream.md', 'evidence/sprint04c-b/PLAN.md', 'evidence/sprint04c-b/upstream-requests.md']).status, 0);
} catch (error) { proof.record.error = error.stack; }
finally { proof.finish(); }
