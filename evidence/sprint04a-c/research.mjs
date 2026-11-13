import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const output = path.join(root, 'evidence/sprint04a-c');
const mode = process.argv[2];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim();
const provenance = {
  started_at: new Date().toISOString(),
  argv: process.argv,
  cwd: root,
  source_commit: git('rev-parse', 'HEAD'),
  tracked_status: git('status', '--porcelain', '--untracked-files=no'),
  records: [],
};

function save(file, bytes) {
  const target = path.join(output, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  return { file, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) };
}

function command(name, argv) {
  const started_at = new Date().toISOString();
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd: root, timeout: 120000, maxBuffer: 16 * 1024 * 1024,
  });
  const row = {
    name, argv, started_at, ended_at: new Date().toISOString(),
    exit_code: result.status, signal: result.signal, error: result.error?.message,
    stdout: save(`local/${name}.stdout.txt`, result.stdout ?? Buffer.alloc(0)),
    stderr: save(`local/${name}.stderr.txt`, result.stderr ?? Buffer.alloc(0)),
  };
  provenance.records.push(row);
  console.log(JSON.stringify({ name, exit_code: row.exit_code }));
  return result;
}

async function fetchSource(file, url) {
  const started_at = new Date().toISOString();
  const temporary = path.join(output, `${file}.curl`);
  fs.mkdirSync(path.dirname(temporary), { recursive: true });
  const argv = ['curl', '--silent', '--show-error', '--fail-with-body',
    '--location', '--max-time', '45', '--retry', '1',
    '--user-agent', 'AegisGate-local-source-review', '--output', temporary,
    '--write-out', '%{http_code}', url];
  const response = spawnSync(argv[0], argv.slice(1), { cwd: root, timeout: 100000 });
  const bytes = fs.existsSync(temporary) ? fs.readFileSync(temporary) : Buffer.alloc(0);
  if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  const row = {
    argv, url, started_at, ended_at: new Date().toISOString(),
    exit_code: response.status, http_status: Number(response.stdout?.toString()),
    stderr: response.stderr?.toString(), ...save(file, bytes),
  };
  provenance.records.push(row);
  console.log(JSON.stringify({ file, exit_code: row.exit_code, http_status: row.http_status }));
  return row.exit_code === 0 ? bytes : null;
}

const repositories = {
  envoy: 'envoyproxy/envoy', pingora: 'cloudflare/pingora', hyper: 'hyperium/hyper',
};
const sources = {
  envoy: [
    'RELEASES.md', 'LICENSE', 'bazel/repository_locations.bzl',
    'source/common/http/http1/balsa_parser.cc',
    'source/common/http/http1/codec_impl.cc',
    'source/common/http/http2/codec_impl.cc',
    'source/common/runtime/runtime_features.cc',
    'source/extensions/http/header_validators/envoy_default/default_header_validator.cc',
    'source/extensions/http/header_validators/envoy_default/http1_header_validator.cc',
    'source/extensions/http/header_validators/envoy_default/http2_header_validator.cc',
    'api/envoy/extensions/http/header_validators/envoy_default/v3/header_validator.proto',
    'api/envoy/config/core/v3/protocol.proto',
    'api/envoy/extensions/filters/network/http_connection_manager/v3/http_connection_manager.proto',
  ],
  pingora: [
    'Cargo.toml', 'LICENSE', 'pingora/Cargo.toml', 'pingora-core/Cargo.toml',
    'pingora-core/src/protocols/http/v1/server.rs',
    'pingora-core/src/protocols/http/v2/server.rs',
    'pingora-core/src/server/configuration/mod.rs',
    'pingora-core/src/services/listening.rs',
    'pingora-load-balancing/Cargo.toml', 'pingora-load-balancing/src/lib.rs',
    'pingora-proxy/Cargo.toml', 'pingora-proxy/src/proxy_trait.rs',
    'pingora-http/src/lib.rs',
  ],
  hyper: [
    'Cargo.toml', 'LICENSE', 'src/proto/h1/role.rs',
    'src/server/conn/http1.rs', 'src/server/conn/http2.rs', 'src/proto/h2/server.rs',
  ],
};

if (mode === 'upstream') {
  for (const [name, repo] of Object.entries(repositories)) {
    const release = await fetchSource(`upstream/${name}/release.json`,
      `https://api.github.com/repos/${repo}/releases/latest`);
    if (!release) continue;
    const tag = JSON.parse(release).tag_name;
    const commit = await fetchSource(`upstream/${name}/commit.json`,
      `https://api.github.com/repos/${repo}/commits/${tag}`);
    if (!commit) continue;
    const revision = JSON.parse(commit).sha;
    for (const file of sources[name]) {
      await fetchSource(`upstream/${name}/${file}`,
        `https://raw.githubusercontent.com/${repo}/${revision}/${file}`);
    }
  }
  for (const [file, url] of [
    ['pingora/derivative-issue-889.json', 'https://api.github.com/repos/cloudflare/pingora/issues/889'],
    ['pingora/yaml-pr-1117.json', 'https://api.github.com/repos/cloudflare/pingora/pulls/1117'],
    ['rustsec/RUSTSEC-2024-0388.md', 'https://raw.githubusercontent.com/RustSec/advisory-db/main/crates/derivative/RUSTSEC-2024-0388.md'],
    ['rustsec/RUSTSEC-2024-0449.md', 'https://raw.githubusercontent.com/RustSec/advisory-db/main/crates/unsafe-libyaml/RUSTSEC-2024-0449.md'],
  ]) await fetchSource(`upstream/${file}`, url);
} else if (mode === 'followup') {
  for (const [name, repo] of Object.entries(repositories)) {
    const commit = await fetchSource(`upstream/${name}/main-commit.json`,
      `https://api.github.com/repos/${repo}/commits/main`);
    if (!commit) continue;
    const revision = JSON.parse(commit).sha;
    const files = name === 'envoy'
      ? ['source/common/http/http1/balsa_parser.cc', 'api/envoy/extensions/http/header_validators/envoy_default/v3/header_validator.proto']
      : name === 'pingora'
        ? ['pingora-core/Cargo.toml', 'pingora-core/src/protocols/http/v1/server.rs', 'pingora-core/src/server/configuration/mod.rs', 'pingora-load-balancing/Cargo.toml']
        : ['src/proto/h1/role.rs', 'src/server/conn/http1.rs'];
    for (const file of files) await fetchSource(`upstream/${name}/main/${file}`,
      `https://raw.githubusercontent.com/${repo}/${revision}/${file}`);
  }
  const revision = JSON.parse(fs.readFileSync(path.join(output, 'upstream/envoy/commit.json'))).sha;
  for (const file of [
    'source/extensions/http/header_validators/envoy_default/header_validator.cc',
    'envoy/http/header_validator.h', 'source/common/http/http1/balsa_parser.h',
    'source/common/http/conn_manager_impl.cc',
    'api/envoy/extensions/filters/http/header_to_metadata/v3/header_to_metadata.proto',
    'bazel/repositories.bzl',
  ]) await fetchSource(`upstream/envoy/${file}`,
    `https://raw.githubusercontent.com/envoyproxy/envoy/${revision}/${file}`);
  for (const [name, repo, files] of [
    ['pingora', 'cloudflare/pingora', ['pingora-core/src/upstreams/peer.rs',
      'pingora-core/src/server/mod.rs', 'pingora-core/src/apps/mod.rs',
      'pingora-core/src/protocols/http/server.rs', 'pingora-core/src/protocols/http/authority.rs']],
  ]) {
    const revision = JSON.parse(fs.readFileSync(path.join(output, `upstream/${name}/commit.json`))).sha;
    for (const file of files) await fetchSource(`upstream/${name}/${file}`,
      `https://raw.githubusercontent.com/${repo}/${revision}/${file}`);
  }
  for (const [file, url] of [
    ['envoy/bazel-directory.json', `https://api.github.com/repos/envoyproxy/envoy/contents/bazel?ref=${revision}`],
    ['rustsec/commit.json', 'https://api.github.com/repos/RustSec/advisory-db/commits/main'],
  ]) await fetchSource(`upstream/${file}`, url);
} else if (mode === 'local-followup') {
  command('audit-version', ['/home/tiecont/Projects/aegis-gate/.local/tools/bin/cargo-audit', '--version']);
  command('pingora-audit-pinned', ['/home/tiecont/Projects/aegis-gate/.local/tools/bin/cargo-audit',
    'audit', '--no-fetch', '--db', '/home/tiecont/.cargo/advisory-db',
    '--file', 'spikes/pingora/Cargo.lock', '--json']);
  command('advisory-db-head', ['git', '-C', '/home/tiecont/.cargo/advisory-db', 'log', '-1', '--format=%H %cI']);
  command('hyper-metadata-linux', ['cargo', '+1.99.1', 'metadata', '--format-version', '1',
    '--locked', '--offline', '--filter-platform', 'x86_64-unknown-linux-gnu',
    '--manifest-path', 'spikes/hyper/Cargo.toml']);
} else if (mode === 'local') {
  command('node-version', ['node', '--version']);
  command('cargo-version', ['cargo', '+1.99.1', '--version']);
  command('rust-version', ['rustc', '+1.99.1', '--version', '--verbose']);
  command('curl-version', ['curl', '--version']);
  for (const dependency of ['derivative', 'unsafe-libyaml', 'serde_yaml', 'httparse', 'http']) {
    command(`${dependency}-tree`, ['cargo', '+1.99.1', 'tree', '--locked', '--offline',
      '--manifest-path', 'spikes/pingora/Cargo.toml', '-i', dependency]);
  }
  command('pingora-metadata', ['cargo', '+1.99.1', 'metadata', '--format-version', '1',
    '--locked', '--offline', '--manifest-path', 'spikes/pingora/Cargo.toml']);
  command('hyper-metadata', ['cargo', '+1.99.1', 'metadata', '--format-version', '1',
    '--locked', '--offline', '--manifest-path', 'spikes/hyper/Cargo.toml']);
  command('pingora-audit', ['cargo', '+1.99.1', 'audit', '--no-fetch', '--file', 'spikes/pingora/Cargo.lock']);
} else {
  throw new Error('Usage: node evidence/sprint04a-c/research.mjs upstream|local');
}
provenance.ended_at = new Date().toISOString();
save(`${mode}-commands.json`, `${JSON.stringify(provenance, null, 2)}\n`);
if (provenance.records.some((row) => row.exit_code !== 0)) process.exitCode = 1;
