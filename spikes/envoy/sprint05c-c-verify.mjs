import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, { maxBuffer: 32 << 20 });
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05c-c\/verify-\d+$/);
assert.ok(!fs.existsSync(output));
assert.equal(git('status', '--porcelain', '--untracked-files=no').toString().trim(), '');
let artifacts = 0, sourceBindings = 0;
const results = [];
for (const attempt of ['01', '02', '03', '04']) {
  const dir = `evidence/sprint05c-c/attempt-${attempt}`;
  for (const line of fs.readFileSync(`${dir}/SHA256SUMS`, 'utf8').trim().split('\n')) {
    const [expected, file] = line.split('  ');
    assert.ok(file.startsWith(`${dir}/`)); assert.equal(sha(fs.readFileSync(file)), expected); artifacts++;
  }
  const receipt = JSON.parse(fs.readFileSync(`${dir}/receipt.json`));
  assert.equal(receipt.source_clean, true);
  assert.equal(git('rev-parse', `${receipt.source_commit}^{tree}`).toString().trim(), receipt.source_tree);
  for (const entry of receipt.sources) {
    assert.equal(sha(git('show', `${receipt.source_commit}:${entry.file}`)), entry.sha256); sourceBindings++;
  }
  for (const key of ['recording_complete', 'cleanup_complete', 'lock_held_through_cleanup_hashing']) assert.equal(receipt[key], true);
  assert.deepEqual(receipt.owned_processes_remaining, []);
  assert.equal(receipt.commands.find((c) => c.label === 'original23').exit_code, 1);
  for (const label of ['protected-before', 'protected-after']) {
    const command = receipt.commands.find((c) => c.label === label);
    assert.equal(command.exit_code, 0);
    const protection = JSON.parse(fs.readFileSync(command.streams[0].file));
    assert.equal(protection.protectedFiles.length, 11);
    for (const entry of protection.protectedFiles) assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256);
  }
  const suite = JSON.parse(fs.readFileSync(`${dir}/original23.json`));
  assert.equal(suite.tests.length, 23);
  const failures = suite.tests.filter((t) => t.status !== 'pass').map((t) => t.name);
  assert.deepEqual(failures, receipt.original23.failures);
  assert.equal(receipt.original23.passed, attempt === '01' ? 19 : 20);
  const userinfo = suite.tests.find((t) => t.name === 'individual-settled-userinfo-denial');
  assert.equal(userinfo.status, 'fail'); assert.equal(userinfo.observation.rst_code, 1);
  assert.equal(userinfo.origin.bytes, 0); assert.equal(userinfo.origin.handlers, 0);
  if (attempt !== '01') {
    for (const name of ['raw-H2-HEADERS-stream-zero', 'raw-H2-zero-WINDOW_UPDATE']) {
      const test = suite.tests.find((t) => t.name === name);
      assert.equal(test.status, 'pass'); assert.equal(test.origin.bytes, 0); assert.equal(test.origin.handlers, 0);
      assert.ok(test.error_frames.some((f) => f.type === 7 && f.stream === 0 && f.error_code === 1));
    }
    const regression = suite.tests.find((t) => t.name === 'raw-H2-unexpected-CONTINUATION');
    assert.equal(regression.status, 'fail'); assert.deepEqual(regression.observation.received_frames, []);
    assert.equal(regression.observation.peer_closed, true);
  }
  if (attempt === '04') {
    const bootstrap = JSON.parse(fs.readFileSync(`${dir}/bootstrap.json`));
    assert.ok(bootstrap.layered_runtime.layers.some((l) => l.static_layer?.['envoy.reloadable_features.http2_use_oghttp2'] === true));
    for (const listener of bootstrap.static_resources.listeners) for (const chain of listener.filter_chains) {
      assert.equal(chain.filters[0].typed_config.http2_protocol_options.use_oghttp2_codec, undefined);
    }
  }
  results.push({ attempt, mode: receipt.mode, source_commit: receipt.source_commit, passed: receipt.original23.passed, failures });
}
const relay = JSON.parse(fs.readFileSync('evidence/sprint05c-c/attempt-03/relay-frames.json'));
assert.equal(relay.omitted, 0);
for (const id of [6, 9]) {
  const connection = relay.connections.find((c) => c.id === id);
  assert.equal(connection.upstream_authorized, true); assert.equal(connection.upstream_alpn, 'h2');
  assert.equal(connection.upstream_sni, 'edge-b.test');
  const rst = connection.frames.find((f) => f.direction === 'envoy-to-client' && f.type === 3 && f.error_code === 1);
  assert.equal(rst.hex, '00000403000000000100000001');
  assert.ok(!connection.frames.some((f) => f.direction === 'client-to-envoy' && f.type === 3 && BigInt(f.time_ns) < BigInt(rst.time_ns)));
}
for (const id of [11, 12]) assert.ok(relay.connections.find((c) => c.id === id).frames.some((f) =>
  f.direction === 'client-to-envoy' && f.type === 3 && f.error_code === 8 && f.hex === '00000403000000000100000008'));
const retained = JSON.parse(fs.readFileSync('evidence/sprint05b-c/source-01/receipt.json'));
for (const entry of retained.files) assert.equal(sha(fs.readFileSync(`evidence/sprint05b-c/source-01/${entry.file.replaceAll('/', '__')}`)), entry.sha256);
const runtimeSource = 'evidence/sprint04a-c/upstream/envoy/source/common/runtime/runtime_features.cc';
assert.equal(sha(fs.readFileSync(runtimeSource)), '02188275d7be1cda84c4b1b50d6b36063ff1e0c74048c38fef500dc883f8b644');
assert.ok(fs.readFileSync(runtimeSource, 'utf8').includes('FALSE_RUNTIME_GUARD(envoy_reloadable_features_http2_use_oghttp2)'));
const bFile = 'evidence/sprint05c-b/go-ordering-02/original23.json';
const bBytes = git('show', `235fe4a:${bFile}`), b = JSON.parse(bBytes);
assert.equal(b.tests.length, 23); assert.equal(b.tests.filter((t) => t.status === 'pass').length, 17);
for (const name of ['raw-H2-HEADERS-stream-zero', 'raw-H2-zero-WINDOW_UPDATE']) assert.equal(b.tests.find((t) => t.name === name).status, 'pass');
const summary = { source_commit: git('rev-parse', 'HEAD').toString().trim(), artifacts, sourceBindings, results,
  retained_source_receipt_sha256: sha(fs.readFileSync('evidence/sprint05b-c/source-01/receipt.json')),
  b_reference: { commit: '235fe4a24524cdc89577590ebe8bf872e4b11575', file: bFile, sha256: sha(bBytes), passed: 17 },
  integrity_verified: true, semantic_security_pass: false, resource_eligible: false };
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(summary, null, 2) + '\n');
fs.writeFileSync(`${output}/SHA256SUMS`, `${sha(fs.readFileSync(`${output}/receipt.json`))}  ${output}/receipt.json\n`);
console.log(JSON.stringify(summary, null, 2));
