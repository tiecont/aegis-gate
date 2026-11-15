import fs from 'node:fs';
import assert from 'node:assert/strict';
import { rawCommand, hash } from './sprint05c-a-build.mjs';

const directory = process.argv[2]; assert.match(directory ?? '', /^evidence\/sprint05c-a\/run-\d+$/);
const receipt = JSON.parse(fs.readFileSync(`${directory}/receipt.json`));
const raw = JSON.parse(fs.readFileSync(`${directory}/command.json`));
assert.equal(raw.exit, 0); assert.equal(raw.error, undefined); assert.equal(raw.lockHeldAfterChild, true);
assert.equal(receipt.complete, true); assert.equal(receipt.error, undefined); assert.equal(receipt.cleanupError, undefined);
assert.equal(receipt.runtimeGO, false); assert.equal(receipt.productionEligible, false);
const git = async (...args) => {
  const r = await rawCommand(['git', ...args]); assert.equal(r.exit, 0, r.stderr); return r.stdout.trim();
};
assert.equal(await git('rev-parse', `${receipt.sourceCommit}^{tree}`), receipt.sourceTree);
for (const pin of receipt.sources) {
  const r = await rawCommand(['git', 'show', `${receipt.sourceCommit}:${pin.file}`]);
  assert.equal(r.exit, 0); assert.equal(hash(Buffer.from(r.stdout)), pin.sha256, pin.file);
  assert.equal(hash(fs.readFileSync(pin.file)), pin.sha256, `current ${pin.file}`);
}
for (const line of fs.readFileSync(`${directory}/SHA256SUMS`, 'utf8').trim().split('\n')) {
  const [digest, file] = line.split('  '); assert.equal(hash(fs.readFileSync(file)), digest);
}
assert.equal(receipt.baseline.protectedFiles.length, 11);
for (const pin of receipt.baseline.protectedFiles) assert.equal(hash(fs.readFileSync(pin.file)), pin.sha256);
assert.equal(receipt.baseline.previous75.passed, 73); assert.equal(receipt.baseline.previous23.passed, 19);
for (const c of receipt.commands) { assert.equal(c.exit, 0); assert.equal(c.error, undefined); }
assert.deepEqual(receipt.cleanup, { fixtureAbsent: true, sockets: 0, nativeParsers: 0, diskBytes: 0, stageFiles: 0,
  originActive: 0, originQueued: 0, activeContexts: 0, listenersClosed: true, lockHeld: true });
assert.equal(receipt.nativeChecks.length, 6); assert.equal(receipt.nativeChecks.reduce((n, r) => n + r.splits, 0), 653);
const names = new Set(receipt.probes.map((p) => p.name));
assert.equal(names.size, receipt.probes.length);
for (const name of ['malformed-HTTP-obsolete-folded-header', 'strict-ingress-TE-obsolete-fold',
  'valid-request-EOF', 'truncated-chunk-EOF', 'mixed-stream-disk-pipeline', 'mixed-disk-stream-pipeline',
  'valid-invalid-pipeline', 'invalid-valid-pipeline', 'CL-TE-pipeline', 'one-byte-valid-chunked', 'one-byte-valid-CL',
  'ordered-connection-message-cap', 'two-MiB-known-length-stream', 'one-MiB-private-stage', 'aggregate-disk-quota',
  'aggregate-stage-file-cap', 'origin-queue-503-and-cancel', 'stage-cancel', 'stream-upload-cancel', 'TCP-handshake-cap',
  'stage-idle-408', 'absolute-header-408', 'stage-absolute-408-waiting-for-progress', 'response-backpressure-cancel',
  'unknown-SNI-TLS-denial', 'origin-hostname-verification']) assert.ok(names.has(name), name);
const byName = (name) => receipt.probes.find((p) => p.name === name);
const originals = JSON.parse(fs.readFileSync('spikes/edge-comparison/manifest.json')).negatives.filter((p) => /obsolete.fold/.test(p.name));
for (const original of originals) {
  const row = byName(original.name); assert.equal(row.originalInputHex, Buffer.from(original.request).toString('hex'));
  assert.deepEqual(row.response.statuses, [400]); assert.equal(row.origin.bytes, 0); assert.equal(row.origin.connections, 0);
  assert.deepEqual(row.origin.handlers, []); assert.equal(row.origin.parserErrors, 0); assert.equal(row.origin.tlsErrors, 0);
}
for (const probe of receipt.probes) {
  if (probe.response) assert.equal(probe.response.peerClosed, true);
  if (probe.origin) for (const row of probe.origin.raw) {
    assert.match(row.sha256, /^[a-f0-9]{64}$/); assert.ok(Number.isSafeInteger(row.bytes));
  }
}
const stream = byName('two-MiB-known-length-stream'); assert.ok(stream.early.bytes > 0); assert.equal(stream.early.ended, false);
assert.equal(stream.origin.handlers[0].bodyBytes, 2 * 1024 * 1024);
assert.equal(byName('one-MiB-private-stage').beforeCompletion.bytes, 0);
assert.equal(byName('one-MiB-private-stage').beforeCompletion.privateMode, '0600');
assert.equal(byName('aggregate-disk-quota').released, 0); assert.equal(byName('aggregate-stage-file-cap').released, true);
assert.ok(byName('stream-upload-cancel').origin.handlers[0].aborted);
assert.equal(receipt.streamingStop.parser.error, 'HPE_INVALID_HEADER_TOKEN');
assert.ok(receipt.streamingStop.originBeforeFinalTrailer > 0); assert.equal(receipt.streamingStop.zeroByteAndEarlyProgressCoexist, false);
assert.equal(receipt.streamingStop.finiteStageIsIndefiniteStreaming, false);
assert.ok(receipt.metrics.peakDisk <= receipt.limits.diskBytes); assert.ok(receipt.metrics.peakOriginQueue <= receipt.limits.originQueue);
assert.ok(receipt.metrics.peakConnections <= receipt.limits.connections); assert.ok(receipt.metrics.peakReadable <= receipt.limits.readableBytes);
console.log(JSON.stringify({ verified: true, sourceCommit: receipt.sourceCommit, sourceTree: receipt.sourceTree,
  probes: receipt.probes.length, nativeSplits: 653, protectedFiles: 11, completeH1Runtime: false, runtimeGO: false }));
