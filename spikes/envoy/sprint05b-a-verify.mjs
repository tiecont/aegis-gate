import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const out = process.argv[2]; assert.match(out, /^evidence\/sprint05b-a\/run-\d+$/);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (const line of fs.readFileSync(`${out}/SHA256SUMS`, 'utf8').trim().split('\n')) {
  const [expected, file] = line.split('  '); assert.equal(hash(fs.readFileSync(file)), expected, file);
}
const r = JSON.parse(fs.readFileSync(`${out}/receipt.json`));
const command = JSON.parse(fs.readFileSync(`${out}/command.json`));
assert.equal(command.exit, 0); assert.equal(command.signal, null);
assert.equal(r.sourceCommit, command.source_commit);
assert.equal(execFileSync('git', ['rev-parse', `${r.sourceCommit}^{tree}`], { encoding: 'utf8' }).trim(), r.sourceTree);
for (const s of r.sources) {
  assert.equal(hash(execFileSync('git', ['show', `${r.sourceCommit}:${s.file}`])), s.sha256, s.file);
  assert.equal(hash(fs.readFileSync(s.file)), s.sha256, 'current source differs from measured source');
}
assert.equal(r.completed, true); assert.equal(r.error, undefined);
for (const c of r.commands) { assert.equal(c.exit, 0, c.argv.join(' ')); assert.equal(c.signal, null); }
assert.equal(r.cleanup.fixtureAbsent, true); assert.equal(r.cleanup.remainingSockets, 0);
assert.equal(r.cleanup.listeners, 0); assert.equal(r.cleanup.liveNativeParsers, 0);
assert.equal(r.cleanup.allocatedStaging, 0); assert.equal(r.cleanup.lockHeldThroughCleanup, true);
assert.ok(r.native.stateBytes < 4096); assert.equal(r.native.version, '9.4.4');
assert.equal(r.nativeIsolationAndEOF, true);
const manifest = JSON.parse(fs.readFileSync('spikes/edge-comparison/manifest.json'));
for (const p of manifest.negatives.filter((p) => /obsolete.fold/.test(p.name))) {
  const row = r.probes.find((v) => v.name === `original-${p.name}`); assert.ok(row);
  assert.equal(row.originalInputHex, Buffer.from(p.request).toString('hex'));
  assert.deepEqual(row.status, [400]); assert.equal(row.peerEnd, true);
  assert.equal(row.origin.bytes, 0); assert.equal(row.origin.connections, 0);
  assert.deepEqual(row.origin.handlers, []); assert.equal(row.origin.parserErrors, 0);
  assert.equal(row.origin.transportErrors, 0);
}
for (const row of r.probes) { assert.equal(row.timedOut, false); assert.equal(row.identity.authorized, true); }
for (const target of manifest.encoded_targets) {
  const row = r.probes.find((p) => p.name === `encoded-${target}`);
  assert.equal(row.origin.handlers[0].url, target);
}
assert.ok(r.metrics.peakConnections <= r.limits.connections);
assert.ok(r.metrics.peakAllocatedStaging <= r.limits.stagingBytesGlobal);
assert.ok(r.metrics.peakQueuedMessages <= r.limits.queuedMessages);
assert.ok(r.metrics.rejections.connections >= 1);
assert.equal(r.originTLSMismatch.requestBytes, 0);
assert.equal(r.prefixStreamingCounterexample.strictZeroByteContract, false);
assert.ok(r.prefixStreamingCounterexample.beforeTrailer.bytes > 0);
assert.equal(r.verifiedObserverOrigins.all, true);
assert.ok(r.staging.find((p) => p.name === 'disk-96KiB-valid-body').origin.bytes > 98304);
console.log(JSON.stringify({ verified: true, sourceCommit: r.sourceCommit, sourceTree: r.sourceTree,
  nativeGroups: r.nativeChecks.length, splitChecks: r.nativeChecks.reduce((n, v) => n + (v.splitChecks ?? 0), 0),
  wireControls: r.probes.length, stagingControls: r.staging.length, cleanup: r.cleanup,
  streamingCounterexample: r.prefixStreamingCounterexample }));
