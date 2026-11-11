import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Read-only public metadata/source retrieval; never sends protocol test traffic.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'spikes/pingora/evidence/sprint02-upstream.json');
const records = [];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
async function retrieve(url, json = false) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': 'AegisGate-sprint02-read-only-research' } });
  const body = await response.text();
  if (!response.ok) throw new Error(`read-only fetch ${response.status}: ${url}`);
  const record = { url, fetched_at: new Date().toISOString(), sha256: sha256(body) };
  records.push(record);
  return { record, body: json ? JSON.parse(body) : body };
}
function excerpt(source, start, end) {
  const lines = source.split('\n');
  const first = lines.findIndex((line) => line.includes(start));
  if (first < 0) return null;
  const last = end ? lines.findIndex((line, index) => index > first && line.includes(end)) : first + 35;
  return { first_line: first + 1, text: lines.slice(first, last < 0 ? first + 60 : last).join('\n') };
}

const release = await retrieve('https://api.github.com/repos/cloudflare/pingora/releases/latest', true);
release.record.release = { tag: release.body.tag_name, url: release.body.html_url,
  published_at: release.body.published_at, body: release.body.body };
const commit = await retrieve('https://api.github.com/repos/cloudflare/pingora/commits/main', true);
commit.record.commit = { sha: commit.body.sha, url: commit.body.html_url, date: commit.body.commit.committer.date };
for (const revision of ['0.9.1', commit.body.sha]) {
  for (const file of ['pingora-core/src/apps/mod.rs', 'pingora-core/src/protocols/http/v1/server.rs',
    'pingora-proxy/src/lib.rs', 'pingora-core/src/server/configuration/mod.rs',
    'pingora-core/Cargo.toml', 'pingora-load-balancing/Cargo.toml']) {
    const { body, record } = await retrieve(`https://raw.githubusercontent.com/cloudflare/pingora/${revision}/${file}`);
    record.excerpts = {
      options: excerpt(body, 'pub struct HttpServerOptions', '/// Settings persisted'),
      normalization: excerpt(body, 'HeaderParseState::Invalid(e) => match e', '/// Validate the request'),
      normalization_call: excerpt(body, 'if let Some(new_buf) = escape_illegal_request_line(&buf)'),
      escape: excerpt(body, 'static REQUEST_LINE_REGEX', '#[inline]'),
      proxy_parse_order: excerpt(body, 'match self.handle_new_request(session).await', 'async fn http_cleanup'),
      custom_accept: excerpt(body, '/// Create an [`HttpProxy`] without wrapping', '/// # Example'),
      default_yaml: excerpt(body, 'pub fn new() -> Option<Self>', 'pub fn validate(self)'),
      dependency_lines: body.split('\n').filter((line) => /derivative|serde_yaml|unsafe-libyaml/.test(line)),
    };
  }
}
for (const term of ['strict', 'escape_illegal_request_line', 'serde_yaml', 'derivative']) {
  const query = encodeURIComponent(`repo:cloudflare/pingora ${term}`);
  const { record, body } = await retrieve(`https://api.github.com/search/issues?q=${query}&per_page=20`, true);
  record.search = { term, total_count: body.total_count, incomplete_results: body.incomplete_results,
    items: body.items.map((item) => ({ title: item.title, url: item.html_url, state: item.state,
      updated_at: item.updated_at, pull_request: Boolean(item.pull_request) })) };
}
{
  const { body, record } = await retrieve(`https://raw.githubusercontent.com/cloudflare/pingora/${commit.body.sha}/pingora-core/src/protocols/http/custom/server.rs`);
  record.custom_downstream_session = { visibility: 'doc(hidden) public trait; source review only',
    excerpt: excerpt(body, '/// A concrete custom downstream session.', '#[doc(hidden)]') };
}
for (const number of [1000, 1117]) {
  const { body, record } = await retrieve(`https://api.github.com/repos/cloudflare/pingora/pulls/${number}`, true);
  record.pull_request = { url: body.html_url, title: body.title, state: body.state, merged_at: body.merged_at,
    head_sha: body.head.sha, base_sha: body.base.sha, body: body.body };
}
const registry = path.join(process.env.HOME, '.cargo/registry');
for (const crate of ['pingora-core', 'pingora-proxy']) {
  const { body, record } = await retrieve(`https://crates.io/api/v1/crates/${crate}/0.9.1`, true);
  const cache = path.join(registry, 'cache/index.crates.io-1949cf8c6b5b557f', `${crate}-0.9.1.crate`);
  const archiveHash = sha256(fs.readFileSync(cache));
  if (archiveHash !== body.version.checksum) throw new Error(`crate archive checksum mismatch: ${crate}`);
  const files = crate === 'pingora-core' ? ['src/apps/mod.rs', 'src/protocols/http/v1/server.rs'] : ['src/lib.rs'];
  record.crate = { name: crate, version: '0.9.1', archive_sha256: archiveHash, matches_registry_checksum: true,
    source_checks: files.map((file) => {
      const archiveContent = execFileSync('tar', ['-xzOf', cache, `${crate}-0.9.1/${file}`]);
      const extracted = fs.readFileSync(path.join(registry, 'src/index.crates.io-1949cf8c6b5b557f', `${crate}-0.9.1`, file));
      if (!archiveContent.equals(extracted)) throw new Error(`cached source differs from published archive: ${crate}/${file}`);
      return { file, sha256: sha256(extracted), matches_published_archive: true };
    }) };
}
for (const [crate, advisory] of [['derivative', 'RUSTSEC-2024-0388'], ['unsafe-libyaml', 'RUSTSEC-2024-0449']]) {
  const { record, body } = await retrieve(`https://raw.githubusercontent.com/RustSec/advisory-db/main/crates/${crate}/${advisory}.md`);
  record.advisory = body;
}
fs.writeFileSync(output, JSON.stringify({ purpose: 'source review only; no upstream patch, issue submission or alternative runtime proof',
  records }, null, 2));
console.log(`Read-only upstream evidence: ${output}`);
