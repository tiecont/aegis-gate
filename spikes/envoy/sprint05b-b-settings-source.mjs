import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05b-b\/settings-source-[a-z0-9-]+$/);
assert.ok(!fs.existsSync(output)); fs.mkdirSync(output, { recursive: true });
const sha = (b) => createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
const pin = JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json'));
const receipt = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  argv: process.argv, node: process.version, started_at: new Date().toISOString(), files: [], patches: [] };
async function get(url, limit = 4 << 20) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); assert.equal(r.status, 200, url);
  const b = Buffer.from(await r.arrayBuffer()); assert.ok(b.length < limit);
  receipt.files.push({ url, status: r.status, bytes: b.length, sha256: sha(b) }); return b;
}
function excerpt(name, b, pattern, before = 5, after = 18) {
  const lines = b.toString().split('\n'), indexes = new Set(); let matches = 0;
  lines.forEach((line, i) => { if (pattern.test(line)) {
    matches++; for (let j = Math.max(0, i - before); j < Math.min(lines.length, i + after); j++) indexes.add(j);
  } }); assert.ok(matches);
  fs.writeFileSync(`${output}/${name}`, [...indexes].sort((a, b) => a - b).map((i) => `${i + 1}: ${lines[i]}`).join('\n') + '\n');
}
try {
  const base = `https://raw.githubusercontent.com/envoyproxy/envoy/${pin.source_commit}`;
  const header = await get(`${base}/source/common/http/http2/codec_impl.h`);
  excerpt('codec-settings-callbacks.excerpt', header, /OnSettingsStart|OnSettingsEnd|OnSettingsAck/);
  const lock = await get(`${base}/MODULE.bazel.lock`);
  const hashes = JSON.parse(lock).registryFileHashes;
  const sourceURL = Object.keys(hashes).find((url) => url.includes('raw.githubusercontent.com/envoyproxy/bazel-registry/') &&
    url.endsWith('/modules/nghttp2/1.66.0.envoy/source.json'));
  assert.ok(sourceURL); const source = await get(sourceURL); assert.equal(sha(source), hashes[sourceURL]);
  fs.writeFileSync(`${output}/nghttp2-source.json`, source);
  const metadata = JSON.parse(source);
  const archive = await get(metadata.url);
  assert.equal(createHash('sha256').update(archive).digest('base64'), metadata.integrity.slice('sha256-'.length));
  const args = ['-xzOf', '-', `${metadata.strip_prefix}/lib/nghttp2_session.c`];
  const session = execFileSync('tar', args, { input: archive, maxBuffer: 2 << 20 });
  receipt.extraction = { program: 'tar', args, exit_code: 0, member_sha256: sha(session), archive_sha256: sha(archive) };
  excerpt('nghttp2-settings-ack.excerpt', session, /int nghttp2_session_on_settings_received|if \(!noack &&|0 \/\* ACK \*\//);
  for (const [name, integrity] of Object.entries(metadata.patches)) {
    const patch = await get(sourceURL.replace('/source.json', `/patches/${name}`));
    assert.equal(createHash('sha256').update(patch).digest('base64'), integrity.slice('sha256-'.length));
    receipt.patches.push({ name, sha256: sha(patch), paths: patch.toString().split('\n').filter((s) => s.startsWith('+++ ')),
      settings_ack_symbol_mentions: patch.toString().split('\n').filter((s) => /session_on_settings_received|!noack|NGHTTP2_FLAG_ACK/.test(s)) });
  }
  receipt.exit_code = 0;
} catch (error) { receipt.error = error.stack; receipt.exit_code = 1; process.exitCode = 1; }
receipt.ended_at = new Date().toISOString(); fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
fs.writeFileSync(`${output}/SHA256.json`, JSON.stringify(fs.readdirSync(output).sort()
  .map((file) => ({ file, sha256: sha(fs.readFileSync(`${output}/${file}`)) })), null, 2) + '\n');
