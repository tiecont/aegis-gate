import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { compile } from './sprint05b-c-config.mjs';

process.umask(0o077); const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05b-c\/verify-\d+$/); assert.ok(!fs.existsSync(output));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, { maxBuffer: 16 << 20 });
assert.equal(git('status', '--porcelain', '--untracked-files=no').toString().trim(), '');
const receipt = { argv: process.argv, source_commit: git('rev-parse', 'HEAD').toString().trim(),
  started_at: new Date().toISOString(), assertions: [], results: [], semantic_security_pass: false };
let checksums = 0; let sourceHashes = 0;
for (const entry of fs.readdirSync('evidence/sprint05b-c')) {
  const base = `evidence/sprint05b-c/${entry}`; const sums = `${base}/SHA256SUMS`;
  if (!fs.existsSync(sums)) continue;
  for (const line of fs.readFileSync(sums, 'utf8').trim().split('\n')) {
    const [digest, file] = line.split('  '); assert.equal(sha(fs.readFileSync(file)), digest, file); checksums++;
  }
  const r = JSON.parse(fs.readFileSync(`${base}/receipt.json`));
  for (const s of r.sources ?? []) { assert.equal(sha(git('show', `${r.source_commit}:${s.file}`)), s.sha256, s.file); sourceHashes++; }
  if (!entry.startsWith('attempt-')) continue;
  const result = JSON.parse(fs.readFileSync(`${base}/original23.json`));
  const test = r.commands.find((c) => c.label === 'original23'); assert.equal(test.exit_code, 1);
  if (result.fatal) {
    assert.match(result.fatal, /owned listener readiness/); assert.equal(result.tests.length, 0);
  } else {
    assert.equal(result.tests.length, 23);
    const native = r.transport === 'native';
    assert.equal(result.tests.filter((t) => t.status === 'pass').length, entry === 'attempt-01' || native ? 19 : 18);
    if (native) {
      assert.equal(r.native.binary.sha256, '1d64506e25c1844f146162ddb2ece7010fa4e784faddb40a079021491f1f03cc');
      assert.equal(sha(fs.readFileSync(r.native.binary.file)), r.native.binary.sha256);
      assert.equal(r.cleanup_complete, true);
      for (const name of ['raw-H2-uppercase-header-name', 'raw-H2-connection-specific-header',
        'slow-reader-backpressure-and-response-cancellation', '32-partial-header-connections-termination-drain']) {
        assert.equal(result.tests.find((t) => t.name === name).status, 'pass');
      }
    }
    for (const name of ['raw-H2-HEADERS-stream-zero', 'raw-H2-zero-WINDOW_UPDATE']) {
      const t = result.tests.find((t) => t.name === name); assert.equal(t.status, 'fail');
      assert.deepEqual(t.observation.received_frames, []); assert.equal(t.observation.peer_closed, true);
      assert.equal(t.origin.bytes, 0); assert.equal(t.origin.handlers, 0);
    }
  }
  receipt.results.push({ attempt: entry, mode: r.mode, transport: r.transport ?? 'docker', source_commit: r.source_commit,
    tests: result.tests.length, passed: result.tests.filter((t) => t.status === 'pass').length,
    failures: result.failures, setup_failure: Boolean(result.fatal), raw_exit: test.exit_code });
}
const relay = JSON.parse(fs.readFileSync('evidence/sprint05b-c/attempt-14/relay-frames.json'));
assert.equal(relay.omitted, 0);
const userinfo = [];
for (const name of ['settled-reuse-identity-and-three-authority-negatives', 'individual-settled-userinfo-denial']) {
  const index = relay.boundaries.findIndex((b) => b.message === `${name}: fail`); assert.ok(index > 0);
  const start = BigInt(relay.boundaries[index - 1].time_ns), end = BigInt(relay.boundaries[index].time_ns);
  const frames = relay.connections.flatMap((c) => c.frames.filter((f) => f.direction === 'envoy-to-client' &&
    f.type === 3 && f.error_code === 1 && BigInt(f.time_ns) > start && BigInt(f.time_ns) < end)
    .map((f) => ({ connection: c.id, upstream_authorized: c.upstream_authorized, ...f })));
  assert.equal(frames.length, 1); assert.equal(frames[0].upstream_authorized, true);
  const connection = relay.connections.find((c) => c.id === frames[0].connection);
  assert.ok(!connection.frames.some((f) => f.direction === 'client-to-envoy' && f.type === 3 &&
    BigInt(f.time_ns) <= BigInt(frames[0].time_ns)));
  userinfo.push({ probe: name, peer_reset: frames[0], client_cancel_before_peer_reset: false });
}
assert.ok(relay.connections.some((c) => c.frames.some((f) => f.direction === 'client-to-envoy' && f.type === 3 && f.error_code === 8)));
receipt.peer_attribution = { scope: relay.scope, userinfo, cancellation_control_code: 8,
  acceptance_unchanged: 'userinfo peer reset is not the required 400/421 response' };
receipt.assertions.push({ checksums, committed_source_hashes: sourceHashes });
git('diff', '--exit-code', '8758b1c', 'HEAD', '--', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs',
  'spikes/envoy/wire-probes.mjs', 'spikes/envoy/wire-observer.mjs');
receipt.assertions.push('protected corpus, payloads, deadlines, oracle and observer unchanged');
for (const file of fs.readdirSync('spikes/envoy').filter((f) => /^sprint05b-c-.*\.mjs$/.test(f))) {
  assert.equal(spawnSync(process.execPath, ['--check', `spikes/envoy/${file}`]).status, 0, file);
}
process.env.AEGIS_05A_D_POLICY = 'stream-errors';
for (const mode of ['flush-zero', 'flush-long', 'header-timeout']) {
  process.env.AEGIS_05B_C_MODE = mode;
  const config = compile({ generation: 1, ca_file: '/synthetic/ca.pem', routes: [{ host: 'edge-b.test',
    origin_name: 'lab-origin.test', origin_port: 443, cert_file: '/synthetic/cert.pem', key_file: '/synthetic/key.pem', h2: true }] }, 12345, '/synthetic');
  for (const listener of config.bootstrap.static_resources.listeners) for (const chain of listener.filter_chains) {
    assert.equal(chain.filters[0].typed_config.http2_protocol_options.override_stream_error_on_invalid_http_message, true);
  }
  for (const file of Object.values(config.files)) for (const resource of file.resources ?? []) {
    const h2 = resource.typed_extension_protocol_options?.['envoy.extensions.upstreams.http.v3.HttpProtocolOptions']?.explicit_http_config?.http2_protocol_options;
    if (h2) { assert.equal(h2.initial_stream_window_size, 65535); assert.equal(h2.initial_connection_window_size, 65535); }
  }
}
receipt.assertions.push('all supported variants retain stream errors and minimum upstream H2 windows');
receipt.ended_at = new Date().toISOString(); receipt.verification_complete = true;
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
fs.writeFileSync(`${output}/SHA256SUMS`, `${sha(fs.readFileSync(`${output}/receipt.json`))}  ${output}/receipt.json\n`);
console.log(JSON.stringify(receipt, null, 2));
