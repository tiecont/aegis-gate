import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05b-b\/source-[a-z0-9-]+$/);
assert.ok(!fs.existsSync(output)); fs.mkdirSync(output, { recursive: true });
const pin = JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
const record = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  argv: process.argv, node: process.version, node_binary_sha256: sha(fs.readFileSync(process.execPath)),
  started_at: new Date().toISOString(), pin, files: [] };
const paths = [
  ['api/envoy/config/core/v3/protocol.proto', /use_oghttp2_codec|KeepaliveSettings|custom_settings_parameters|initial_stream_window_size|initial_connection_window_size/],
  ['source/common/http/http2/codec_impl.cc', /use_oghttp2_library_|sendSettingsHelper|SubmitSettings|OnSettings|Decoding incoming frames|Status ConnectionImpl::sendPendingFrames/],
  ['source/common/http/conn_pool_base.cc', /void MultiplexedActiveClientBase::onSettings/],
  ['source/common/runtime/runtime_features.cc', /http2_use_oghttp2/],
  ['bazel/repository_locations.bzl', /nghttp2|com_google_quiche/],
  ['api/envoy/extensions/upstreams/http/v3/http_protocol_options.proto', /message HttpProtocolOptions|http2_protocol_options|explicit_http_config/],
];
try {
  for (const [file, pattern] of paths) {
    const url = `https://raw.githubusercontent.com/envoyproxy/envoy/${pin.source_commit}/${file}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, url); const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length < 1024 * 1024);
    const lines = bytes.toString().split('\n'), included = new Set(); let matches = 0;
    for (let i = 0; i < lines.length; i++) if (pattern.test(lines[i])) {
      matches++; for (let j = Math.max(0, i - 8); j < Math.min(lines.length, i + 25); j++) included.add(j);
    }
    assert.ok(matches, file);
    const excerpt = [...included].sort((a, b) => a - b).map((i) => `${i + 1}: ${lines[i]}`).join('\n') + '\n';
    const name = file.replaceAll('/', '__') + '.excerpt'; fs.writeFileSync(path.join(output, name), excerpt);
    record.files.push({ url, status: response.status, bytes: bytes.length, full_source_sha256: sha(bytes),
      excerpt: name, excerpt_sha256: sha(excerpt), matches });
  }
  const protectedPaths = ['spikes/edge-comparison', 'spikes/pingora/lab.mjs', 'spikes/envoy/config.mjs',
    'spikes/envoy/recovery-config.mjs', 'spikes/envoy/recovery-launcher.mjs', 'spikes/envoy/wire-probes.mjs', 'spikes/envoy/wire-fixtures.mjs'];
  const baseline = git('ls-tree', '-r', '8758b1c', '--', ...protectedPaths);
  assert.equal(git('ls-tree', '-r', 'HEAD', '--', ...protectedPaths), baseline);
  fs.writeFileSync(`${output}/protected-objects.txt`, baseline + '\n'); record.protected_equality = true;
  record.exit_code = 0;
} catch (error) { record.error = error.stack; record.exit_code = 1; process.exitCode = 1; }
record.ended_at = new Date().toISOString(); fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(record, null, 2) + '\n');
fs.writeFileSync(`${output}/SHA256.json`, JSON.stringify(fs.readdirSync(output).sort()
  .map((file) => ({ file, sha256: sha(fs.readFileSync(`${output}/${file}`)) })), null, 2) + '\n');
