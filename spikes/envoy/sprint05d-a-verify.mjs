import fs from 'node:fs';
import assert from 'node:assert/strict';
import { assertLock } from './wire-fixtures.mjs';
import { command, hash } from './sprint05d-a-build.mjs';
assertLock();
const [directory, out] = process.argv.slice(2);
assert.match(directory ?? '', /^evidence\/sprint05d-a\/run-\d+$/);
assert.match(out ?? '', /^evidence\/sprint05d-a\/verify-\d+$/); assert.ok(!fs.existsSync(out));
const record = { started: new Date().toISOString(), argv: process.argv, commands: [], pass: false,
  runtimeGO: false, productionEligible: false, streamingPass: false, artifactHashes: 0, sourceBindings: 0 };
const git = async (...args) => (await command(record, ['/usr/bin/git', ...args])).trim();
assert.equal(await git('status', '--porcelain', '--untracked-files=all'), '', 'commit verifier/report before verification');
record.sourceCommit = await git('rev-parse', 'HEAD'); record.sourceTree = await git('rev-parse', 'HEAD^{tree}');
fs.mkdirSync(out);
try {
  for (const attempt of fs.readdirSync('evidence/sprint05d-a').filter((name) => /^run-\d+$/.test(name))) {
    for (const line of fs.readFileSync(`evidence/sprint05d-a/${attempt}/SHA256SUMS`, 'utf8').trim().split('\n')) {
      const [digest, file] = line.split('  '); assert.equal(hash(fs.readFileSync(file)), digest); record.artifactHashes++;
    }
  }
  const receipt = JSON.parse(fs.readFileSync(`${directory}/receipt.json`));
  const capture = JSON.parse(fs.readFileSync(`${directory}/command.json`));
  record.receiptSha256 = hash(fs.readFileSync(`${directory}/receipt.json`));
  assert.equal(capture.exit, 0); assert.equal(capture.signal, null); assert.equal(capture.error, undefined);
  assert.equal(capture.lockHeldThroughHashes, true); assert.equal(receipt.lockHeldThroughCleanup, true);
  assert.equal(capture.stdout, fs.readFileSync(`${directory}/run.stdout`, 'utf8'));
  assert.equal(capture.stderr, fs.readFileSync(`${directory}/run.stderr`, 'utf8')); assert.equal(capture.stderr, '');
  assert.equal(await git('rev-parse', `${receipt.sourceCommit}^{tree}`), receipt.sourceTree);
  for (const pin of receipt.sources) {
    const committed = await command(record, ['/usr/bin/git', 'show', `${receipt.sourceCommit}:${pin.file}`]);
    assert.equal(hash(Buffer.from(committed)), pin.sha256); assert.equal(hash(fs.readFileSync(pin.file)), pin.sha256);
    record.sourceBindings++;
  }
  assert.equal(receipt.error, undefined); assert.equal(receipt.cleanupError, undefined);
  assert.equal(receipt.completeValidationPass, true); assert.equal(receipt.streamingPass, false);
  assert.equal(receipt.streamingPositive.pass, false); assert.equal(receipt.runtimeGO, false); assert.equal(receipt.productionEligible, false);
  assert.equal(receipt.privateFixtureRemoved, true); assert.equal(fs.existsSync(receipt.tmpdir), false);
  assert.ok(receipt.tmpdir.startsWith('/home/')); assert.equal(Object.keys(receipt.hypothesis).length, 6);
  assert.equal(receipt.node.sha256, hash(fs.readFileSync(process.execPath)));
  for (const tool of receipt.tools) assert.equal(hash(fs.readFileSync(tool.file)), tool.sha256);
  for (const c of receipt.commands) { assert.equal(c.exit, 0); assert.equal(c.error, undefined);
    assert.ok(c.tmpdir?.startsWith('/home/') || c.argv[0] === '/usr/bin/git' && c.tmpdir === null);
    assert.equal(hash(fs.readFileSync(c.argv[0])), c.executableSha256); }
  const pins = JSON.parse(fs.readFileSync('evidence/sprint05a-b/source-01/sources.json'));
  assert.equal(receipt.upstream.length, 5);
  for (const upstream of receipt.upstream) assert.equal(upstream.sha256, pins.downloads.find((pin) => pin.name === `llhttp/${upstream.name}`).sha256);
  assert.deepEqual(receipt.baselineBefore, receipt.baselineAfter); assert.equal(receipt.baselineBefore.protectedFiles.length, 11);
  assert.equal(receipt.baselineBefore.previous75.passed, 73); assert.equal(receipt.baselineBefore.previous23.passed, 19);
  const baseline = JSON.parse(await command(record, [process.execPath, 'scripts/sprint05b-baseline.mjs']));
  assert.deepEqual(baseline, receipt.baselineBefore);
  assert.equal(receipt.probes.length, 29); const probes = new Map(receipt.probes.map((p) => [p.name, p])); assert.equal(probes.size, 29);
  function zero(origin) {
    for (const key of ['bytes', 'connections', 'parserErrors', 'tlsErrors', 'dials']) assert.equal(origin[key], 0);
    assert.deepEqual(origin.handlers, []); assert.deepEqual(origin.raw, []);
  }
  for (const p of receipt.probes) {
    if (p.beforeCompletion) { zero(p.beforeCompletion); assert.equal(p.privateMode, '0700/0600'); }
    if (p.response?.statuses.every((status) => status >= 400)) zero(p.origin);
  }
  for (const [name, status] of [
    ['no-body-staged-positive', 200], ['CL-common-prefix-valid', 200], ['CL-common-prefix-EOF', 400],
    ['chunk-common-prefix-valid', 200], ['chunk-common-prefix-EOF', 400], ['chunk-common-prefix-late-fold', 400],
    ['complete-CL-write-EOF', 200], ['declared-stage-oversize', 413], ['chunk-stage-oversize', 413],
    ['aggregate-stage-file-quota', 503], ['aggregate-ciphertext-byte-quota', 503], ['ciphertext-tamper-auth-before-dial', 503],
    ['incomplete-chunk-waits-for-origin-progress', 408], ['absolute-incomplete-request-deadline', 408],
    ['finite-CL-upload', 200], ['finite-chunk-upload', 200], ['healthy-after-quotas-auth-timeouts', 200],
    ['healthy-after-subprocess-restart', 200]
  ]) assert.deepEqual(probes.get(name).response.statuses, [status], name);
  assert.equal(probes.get('CL-common-prefix-valid').commonPrefixSha256, probes.get('CL-common-prefix-EOF').commonPrefixSha256);
  for (const name of ['chunk-common-prefix-EOF', 'chunk-common-prefix-late-fold'])
    assert.equal(probes.get(name).commonPrefixSha256, probes.get('chunk-common-prefix-valid').commonPrefixSha256);
  const cancel = probes.get('staged-CL-cancellation'); assert.equal(cancel.released, true); zero(cancel.origin);
  const restart = probes.get('SIGKILL-ciphertext-orphan-restart');
  assert.equal(restart.orphan.keyPersisted, false); assert.equal(restart.orphan.mode, 0o600);
  assert.equal(restart.recovery.reclaimedFiles, 1); assert.equal(restart.recovery.reclaimedBytes, restart.orphan.bytes);
  assert.deepEqual(receipt.children.map((child) => [child.exit, child.signal]), [[null, 'SIGKILL'], [0, null]]);
  assert.equal(restart.stopped.metrics.cleanupError, undefined); assert.equal(restart.stopped.metrics.activeContexts, 0);
  for (const value of Object.values(receipt.cleanup)) assert.equal(value, 0);
  assert.ok(receipt.metrics.peakDisk <= receipt.limits.diskBytes); assert.equal(receipt.metrics.admitted, receipt.metrics.requests);
  assert.equal(receipt.metrics.originDials, receipt.metrics.requests);
  await command(record, ['/usr/bin/git', 'diff', '--check', 'aa289da3f48334ec8e2156f66ebd2a8f3cfb3324']);
  record.changedFiles = (await git('diff', '--name-only', 'aa289da3f48334ec8e2156f66ebd2a8f3cfb3324')).split('\n');
  assert.ok(record.changedFiles.every((name) => /^spikes\/envoy\/sprint05d-a-/.test(name) || /^evidence\/sprint05d-a\//.test(name) || name === 'docs/reports/sprint05d-a-admission.md'));
  for (const name of (await git('ls-files', 'spikes/envoy/sprint05d-a-*.mjs')).split('\n'))
    await command(record, [process.execPath, '--check', name]);
  record.probes = receipt.probes.length; record.completeValidationSource = receipt.sourceCommit;
  record.pass = true;
} catch (error) { record.error = { message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
  assertLock(); record.lockHeldThroughHashes = true; record.ended = new Date().toISOString();
  fs.writeFileSync(`${out}/receipt.json`, JSON.stringify(record, null, 2) + '\n');
  fs.writeFileSync(`${out}/SHA256SUMS`, `${hash(fs.readFileSync(`${out}/receipt.json`))}  ${out}/receipt.json\n`);
  console.log(JSON.stringify({ pass: record.pass, probes: record.probes, artifactHashes: record.artifactHashes,
    sourceBindings: record.sourceBindings, error: record.error, streamingPass: false, runtimeGO: false }));
}
