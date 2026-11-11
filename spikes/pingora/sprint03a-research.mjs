import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Public metadata/source reads only. Protocol tests belong to the locked lab.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'evidence/sprint03a-a/upstream.json');
const records = [];
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function retrieve(url, json = false) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': 'AegisGate-Sprint03A-read-only-research' },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`read-only retrieval ${response.status}: ${url}`);
  const record = { url, fetched_at: new Date().toISOString(), sha256: digest(text) };
  records.push(record);
  return { record, body: json ? JSON.parse(text) : text };
}
function selectedLines(source, pattern, context = 7) {
  const lines = source.split('\n');
  const indexes = new Set();
  lines.forEach((line, index) => {
    if (pattern.test(line)) {
      for (let n = Math.max(0, index - context); n <= Math.min(lines.length - 1, index + context); n++) indexes.add(n);
    }
  });
  return [...indexes].sort((a, b) => a - b).map((index) => ({ line: index + 1, text: lines[index] }));
}

const release = await retrieve('https://api.github.com/repos/cloudflare/pingora/releases/latest', true);
release.record.release = { tag: release.body.tag_name, url: release.body.html_url,
  published_at: release.body.published_at, prerelease: release.body.prerelease, body: release.body.body };
const crate = await retrieve('https://crates.io/api/v1/crates/pingora', true);
crate.record.versions = crate.body.versions.slice(0, 12).map(({ num, created_at, yanked, rust_version, checksum }) =>
  ({ num, created_at, yanked, rust_version, checksum }));
crate.record.max_stable_version = crate.body.crate.max_stable_version;
const main = await retrieve('https://api.github.com/repos/cloudflare/pingora/commits/main', true);
main.record.commit = { sha: main.body.sha, date: main.body.commit.committer.date, url: main.body.html_url };

const sources = [
  ['pingora-core/src/apps/mod.rs', /pub struct HttpServerOptions|strict|force_custom|h1.*limit/],
  ['pingora-core/src/apps/http_app.rs', /process_new|read_request|force_custom/],
  ['pingora-core/src/protocols/http/v1/server.rs', /HeaderParseState::Invalid|escape_illegal_request_line|get_headers_raw_bytes|pub fn validate_request|transfer_encoding|transfer-encoding|pub fn set_request_body_reader/],
  ['pingora-core/src/protocols/http/custom/server.rs', /doc\(hidden\)|pub trait Session|pub struct Session|async fn|fn .*digest|fn .*timeout/],
  ['pingora-proxy/src/lib.rs', /pub struct HttpProxy|pub fn http_proxy|pub fn new\(|handle_new_request\(session\)|early_request_filter|custom|process_new_http/],
  ['pingora-proxy/src/proxy_trait.rs', /early_request_filter|request_filter|request_header_filter|downstream/],
  ['pingora-core/src/listeners/mod.rs', /trait ConnectionFilter|should_accept/],
  ['pingora-core/src/server/configuration/mod.rs', /pub fn new\(|load_from_yaml|serde_yaml|version: 1/],
  ['pingora-core/Cargo.toml', /derivative|serde_yaml|saphyr|features|patched_http1/],
  ['pingora-load-balancing/Cargo.toml', /derivative/],
  ['Cargo.toml', /rust-version|derivative|serde_yaml|saphyr/],
];
for (const revision of [release.body.tag_name, main.body.sha]) {
  for (const [file, pattern] of sources) {
    const { body, record } = await retrieve(`https://raw.githubusercontent.com/cloudflare/pingora/${revision}/${file}`);
    record.source = { revision, file, lines: body.split('\n').length, excerpts: selectedLines(body, pattern) };
  }
}
for (const term of ['strict', 'escape_illegal_request_line', 'custom downstream', 'hyper', 'serde_yaml', 'derivative']) {
  const { body, record } = await retrieve(`https://api.github.com/search/issues?q=${encodeURIComponent(`repo:cloudflare/pingora ${term}`)}&per_page=30`, true);
  record.search = { term, total_count: body.total_count, incomplete_results: body.incomplete_results,
    items: body.items.map((item) => ({ title: item.title, url: item.html_url, state: item.state,
      updated_at: item.updated_at, pull_request: Boolean(item.pull_request) })) };
}
for (const [kind, numbers] of [['issues', [674, 779, 889, 1058]], ['pulls', [1000, 1117]]]) {
  for (const number of numbers) {
    const { body, record } = await retrieve(`https://api.github.com/repos/cloudflare/pingora/${kind}/${number}`, true);
    record.item = { url: body.html_url, title: body.title, state: body.state, updated_at: body.updated_at,
      closed_at: body.closed_at, merged_at: body.merged_at ?? null, head_sha: body.head?.sha ?? null,
      body: body.body };
  }
}
const registry = path.join(process.env.HOME, '.cargo/registry');
for (const name of ['pingora-core', 'pingora-proxy', 'pingora-load-balancing']) {
  const { body, record } = await retrieve(`https://crates.io/api/v1/crates/${name}/0.9.1`, true);
  const archive = path.join(registry, 'cache/index.crates.io-1949cf8c6b5b557f', `${name}-0.9.1.crate`);
  const archiveHash = digest(fs.readFileSync(archive));
  if (archiveHash !== body.version.checksum) throw new Error(`registry checksum mismatch: ${name}`);
  const files = ['Cargo.toml', ...sources.filter(([file]) => file.startsWith(`${name}/src/`))
    .map(([file]) => file.slice(name.length + 1))];
  record.published_source = { name, version: '0.9.1', archive_sha256: archiveHash,
    checksum_matches_registry: true, files: files.map((file) => {
      const published = execFileSync('tar', ['-xzOf', archive, `${name}-0.9.1/${file}`]);
      const cached = fs.readFileSync(path.join(registry, 'src/index.crates.io-1949cf8c6b5b557f', `${name}-0.9.1`, file));
      if (!cached.equals(published)) throw new Error(`cached source modified: ${name}/${file}`);
      return { file, sha256: digest(cached), matches_published_archive: true };
    }) };
}
for (const [name, id] of [['derivative', 'RUSTSEC-2024-0388'], ['unsafe-libyaml', 'RUSTSEC-2024-0449']]) {
  const { body, record } = await retrieve(`https://raw.githubusercontent.com/RustSec/advisory-db/main/crates/${name}/${id}.md`);
  record.advisory = body;
}
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify({
  purpose: 'Fresh public source review and published-cache identity, no upstream modification or unexecuted runtime claim',
  script_sha256: digest(fs.readFileSync(fileURLToPath(import.meta.url))), records,
}, null, 2)}\n`);
console.log(`Upstream research: ${output} (${records.length} retrievals)`);
