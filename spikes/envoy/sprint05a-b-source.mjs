import fs from 'node:fs';
import assert from 'node:assert/strict';
import { receipt, hash } from './sprint05a-b-receipts.mjs';

const proof = receipt(process.argv[2]);
const cache = '.local/sprint05a-b-sources';
fs.mkdirSync(cache, { recursive: true });
function fetch(name, url, excerpt) {
  const r = proof.command(name, ['curl', '--fail-with-body', '--silent', '--show-error', '--location',
    '--proto', '=https', '--proto-redir', '=https', '--tlsv1.2', '--connect-timeout', '10',
    '--max-time', '30', '--max-filesize', '8388608', url]);
  assert.equal(r.status, 0, name);
  const row = proof.record.commands.at(-1);
  const target = `${cache}/${name.replaceAll('/', '_')}`;
  fs.writeFileSync(target, r.stdout);
  proof.record.downloads.push({ name, url, cache: target, bytes: r.stdout.length, sha256: hash(r.stdout) });
  if (excerpt) {
    fs.unlinkSync(row.stdout.file);
    row.stdout = { bytes: r.stdout.length, sha256: hash(r.stdout), cache: target, omitted_full_generated_source: true };
    const lines = r.stdout.toString().split('\n'); const selected = new Set();
    for (let i = 0; i < lines.length; i++) if (excerpt.test(lines[i]))
      for (let j = Math.max(0, i - 8); j <= Math.min(lines.length - 1, i + 18); j++) selected.add(j);
    proof.file(`${name}.excerpts`, [...selected].sort((a, b) => a - b).map((i) => `${i + 1}: ${lines[i]}`).join('\n') + '\n');
  }
  proof.save(); return r.stdout;
}
try {
  proof.record.downloads = [];
  const envoy = 'b2d89e0ae53916f28770771fbdd49c5c99c5c5a2';
  const llhttp = '816485216511b86459b2e6478190e14c38c14891';
  for (const [name, repo, tag, revision] of [
    ['envoy', 'envoyproxy/envoy', 'v1.40.2', envoy],
    ['llhttp', 'nodejs/llhttp', 'release/v9.4.4', llhttp],
  ]) {
    const release = JSON.parse(fetch(`${name}/release`, `https://api.github.com/repos/${repo}/releases/tags/${tag}`));
    assert.equal(release.draft, false); assert.equal(release.prerelease, false);
    assert.equal(JSON.parse(fetch(`${name}/commit`, `https://api.github.com/repos/${repo}/commits/${tag}`)).sha, revision);
  }
  for (const file of ['source/common/http/http1/balsa_parser.cc', 'source/common/http/http1/balsa_parser.h',
    'api/envoy/config/core/v3/protocol.proto',
    'api/envoy/extensions/http/header_validators/envoy_default/v3/header_validator.proto',
    'source/common/runtime/runtime_features.cc'])
    fetch(`envoy/${file}`, `https://raw.githubusercontent.com/envoyproxy/envoy/${envoy}/${file}`);
  for (const file of ['include/llhttp.h', 'src/api.c', 'src/http.c', 'src/llhttp.c', 'LICENSE-MIT', 'README.md'])
    fetch(`llhttp/${file}`, `https://raw.githubusercontent.com/nodejs/llhttp/${llhttp}/${file}`,
      file === 'src/llhttp.c' ? /Unexpected whitespace after header value|n_header_value_lws:|Invalid header value char|F_TRAILING/ : null);
  fetch('nginx/changes', 'https://nginx.org/en/CHANGES-1.30');
  const ng = JSON.parse(fetch('nginx/commit', 'https://api.github.com/repos/nginx/nginx/commits/release-1.30.6')).sha;
  proof.record.nginx_revision = ng;
  for (const file of ['src/http/ngx_http_parse.c', 'src/http/ngx_http_request_body.c',
    'src/http/modules/ngx_http_proxy_module.c', 'src/core/nginx.h', 'LICENSE'])
    fetch(`nginx/${file}`, `https://raw.githubusercontent.com/nginx/nginx/${ng}/${file}`,
      file.endsWith('.c') ? /case sw_trailer|ch <= 0x20|ngx_http_parse_chunked|proxy_request_buffering|proxy_pass_trailers/ : null);
  proof.file('sources.json', JSON.stringify({ downloads: proof.record.downloads, nginx_revision: ng }, null, 2) + '\n');
} catch (e) { proof.record.error = e.stack; }
finally { proof.finish(); }
