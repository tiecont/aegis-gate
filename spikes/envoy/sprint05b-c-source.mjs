import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const output = process.argv[2]; assert.ok(output && !fs.existsSync(output));
fs.mkdirSync(output, { recursive: true });
const pin = JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const receipt = { source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), pin, files: [] };
for (const file of [
  'source/common/http/http2/codec_impl.cc',
  'source/common/http/conn_manager_impl.cc',
  'source/extensions/http/header_validators/envoy_default/http2_header_validator.cc',
  'source/extensions/http/header_validators/envoy_default/header_validator.cc',
  'api/envoy/extensions/filters/network/http_connection_manager/v3/http_connection_manager.proto',
  'api/envoy/extensions/http/header_validators/envoy_default/v3/header_validator.proto',
]) {
  const url = `https://raw.githubusercontent.com/envoyproxy/envoy/${pin.source_commit}/${file}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); assert.equal(r.status, 200);
  const bytes = Buffer.from(await r.arrayBuffer()); assert.ok(bytes.length < 1024 * 1024);
  const target = file.replaceAll('/', '__'); fs.writeFileSync(`${output}/${target}`, bytes);
  receipt.files.push({ file, url, status: r.status, bytes: bytes.length, sha256: sha(bytes) });
}
fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
fs.writeFileSync(`${output}/SHA256SUMS`, fs.readdirSync(output).sort().map((file) => `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}\n`).join(''));
