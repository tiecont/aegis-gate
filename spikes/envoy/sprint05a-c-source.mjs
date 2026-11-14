import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const output = process.argv[2];
assert.ok(output && !fs.existsSync(output));
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim(), '');
fs.mkdirSync(output, { recursive: true });
const pin = JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json'));
const hash = (s) => createHash('sha256').update(s).digest('hex');
const record = { source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  started_at: new Date().toISOString(), argv: process.argv, node: process.version, release: pin, files: [] };
const paths = [
  ['api/envoy/config/core/v3/protocol.proto', /initial_stream_window_size|initial_connection_window_size|custom_settings_parameters|hpack_table_size|max_requests_per_connection/],
  ['api/envoy/config/cluster/v3/cluster.proto', /connection_pool_per_downstream_connection|per_upstream_preconnect_ratio/],
  ['source/common/http/http2/codec_impl.cc', /sendSettingsHelper|SubmitSettings|INITIAL_CONNECTION_WINDOW_SIZE|OnSettingsStart|OnSettingsEnd/],
  ['source/common/http/http2/conn_pool.cc', /calculateInitialStreamsLimit|maxRequestsPerConnection|allocateConnPool|ActiveClient::ActiveClient/],
  ['source/common/conn_pool/conn_pool_base.cc', /maxRequestsPerConnection|remaining_requests|drainConnections|shouldConnect/],
];
try {
  for (const [file, pattern] of paths) {
    const url = `https://raw.githubusercontent.com/envoyproxy/envoy/${pin.source_commit}/${file}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, url); const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length < 1024 * 1024);
    const lines = bytes.toString().split('\n'); const indexes = [];
    for (let i = 0; i < lines.length; i++) if (pattern.test(lines[i])) indexes.push(i);
    const included = new Set();
    for (const i of indexes.slice(0, 18)) for (let j = Math.max(0, i - 12); j <= Math.min(lines.length - 1, i + 18); j++) included.add(j);
    const excerpt = [...included].sort((a, b) => a - b).map((i) => `${i + 1}: ${lines[i]}`).join('\n') + '\n';
    const filename = file.replaceAll('/', '__') + '.excerpt';
    fs.writeFileSync(path.join(output, filename), excerpt);
    record.files.push({ url, status: response.status, bytes: bytes.length, full_source_sha256: hash(bytes), excerpt: filename, excerpt_sha256: hash(excerpt), matches: indexes.length });
  }
  const original = execFileSync('git', ['ls-tree', '-r', '8e77a4f', '--', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs', 'spikes/envoy/config.mjs', 'spikes/envoy/recovery-config.mjs', 'spikes/envoy/recovery-launcher.mjs', 'spikes/envoy/wire-probes.mjs', 'spikes/envoy/wire-fixtures.mjs']);
  const current = execFileSync('git', ['ls-tree', '-r', 'HEAD', '--', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs', 'spikes/envoy/config.mjs', 'spikes/envoy/recovery-config.mjs', 'spikes/envoy/recovery-launcher.mjs', 'spikes/envoy/wire-probes.mjs', 'spikes/envoy/wire-fixtures.mjs']);
  assert.deepEqual(current, original); fs.writeFileSync(path.join(output, 'protected-objects.txt'), current);
  record.protected_object_equality = true; record.protected_sha256 = hash(current);
} catch (e) { record.error = e.stack; process.exitCode = 1; }
record.ended_at = new Date().toISOString();
fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(record, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'SHA256.json'), JSON.stringify(fs.readdirSync(output).sort().map((file) => ({ file, sha256: hash(fs.readFileSync(path.join(output, file))) })), null, 2) + '\n');
