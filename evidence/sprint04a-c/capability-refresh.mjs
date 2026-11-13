import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const owned = 'evidence/sprint04a-c';
const [mode, destination, collection] = process.argv.slice(2);
if (!['collect', 'verify'].includes(mode) || !/^[a-z]+-\d+$/.test(destination ?? '')) {
  throw new Error('Usage: capability-refresh.mjs collect|verify new-directory [collection-directory]');
}
const output = `${owned}/${destination}`;
fs.mkdirSync(output); // Refuse to overwrite any previous attempt.
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const run = (argv) => spawnSync(argv[0], argv.slice(1), {
  cwd: root, timeout: 60000, maxBuffer: 32 * 1024 * 1024,
});
const git = (...args) => {
  const result = run(['git', ...args]);
  if (result.status !== 0) throw new Error(`git ${args[0]} failed`);
  return result.stdout;
};
const sources = git('ls-files', owned, 'docs/reports/sprint04a-c-upstream.md')
  .toString().trim().split('\n').filter((file) => /\.(mjs|py|md)$/.test(file));
const receipt = {
  started_at: new Date().toISOString(), argv: process.argv, cwd: root,
  source_commit: git('rev-parse', 'HEAD').toString().trim(),
  tracked_status: git('status', '--porcelain', '--untracked-files=no').toString(),
  sources: sources.map((file) => ({ file, sha256: digest(fs.readFileSync(file)) })),
  records: [],
  observations: { runtime_candidates: 0, corpus_executions: 0,
    origin_bytes: null, origin_handlers: null, parser_errors: null,
    transport: 'Research only; no fixture or traffic listener started' },
};
if (receipt.tracked_status) throw new Error('Commit tracked sources before collecting evidence');
function save(file, bytes) {
  const target = `${output}/${file}`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  return { file: target, sha256: digest(bytes), bytes: bytes.length };
}
function command(name, argv) {
  const started_at = new Date().toISOString();
  const result = run(argv);
  receipt.records.push({ name, argv, started_at, ended_at: new Date().toISOString(),
    exit_code: result.status, signal: result.signal, error: result.error?.message,
    stdout: save(`${name}.stdout`, result.stdout ?? Buffer.alloc(0)),
    stderr: save(`${name}.stderr`, result.stderr ?? Buffer.alloc(0)) });
  console.log(JSON.stringify({ name, exit_code: result.status }));
  return result;
}
function fetchSource(file, url) {
  const target = `${output}/${file}`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const argv = ['curl', '--silent', '--show-error', '--fail-with-body', '--location',
    '--max-time', '40', '--retry', '0', '--user-agent', 'AegisGate-local-source-review',
    '--output', target, '--write-out', '%{http_code}', url];
  const started_at = new Date().toISOString();
  const result = run(argv);
  const bytes = fs.existsSync(target) ? fs.readFileSync(target) : Buffer.alloc(0);
  receipt.records.push({ name: file, argv, url, started_at, ended_at: new Date().toISOString(),
    exit_code: result.status, signal: result.signal, http_status: Number(result.stdout?.toString()),
    stdout: save(`${file}.curl-stdout`, result.stdout ?? Buffer.alloc(0)),
    stderr: save(`${file}.curl-stderr`, result.stderr ?? Buffer.alloc(0)),
    body: save(file, bytes) });
  console.log(JSON.stringify({ file, exit_code: result.status }));
  return result.status === 0 ? bytes : null;
}

try {
  command('node-version', [process.execPath, '--version']);
  if (mode === 'collect') {
    command('curl-version', ['curl', '--version']);
    const projects = [
      ['envoy', 'envoyproxy/envoy', [
        'RELEASES.md', 'source/common/http/http1/balsa_parser.cc',
        'source/common/http/http1/balsa_parser.h', 'envoy/http/header_validator.h',
        'api/envoy/config/core/v3/protocol.proto',
        'api/envoy/extensions/http/header_validators/envoy_default/v3/header_validator.proto',
        'source/common/http/http1/codec_impl.cc', 'source/common/http/http2/codec_impl.cc',
      ]],
      ['pingora', 'cloudflare/pingora', [
        'pingora-core/Cargo.toml', 'pingora-load-balancing/Cargo.toml',
        'pingora-core/src/protocols/http/v1/server.rs',
        'pingora-core/src/apps/mod.rs', 'pingora-core/src/server/mod.rs',
      ]],
      ['hyper', 'hyperium/hyper', ['src/proto/h1/role.rs', 'src/server/conn/http1.rs']],
    ];
    receipt.release_comparison = [];
    for (const [name, repo, files] of projects) {
      const releaseBytes = fetchSource(`${name}/release.json`, `https://api.github.com/repos/${repo}/releases/latest`);
      if (!releaseBytes) continue;
      const release = JSON.parse(releaseBytes);
      const commitBytes = fetchSource(`${name}/commit.json`, `https://api.github.com/repos/${repo}/commits/${release.tag_name}`);
      if (!commitBytes) continue;
      const revision = JSON.parse(commitBytes).sha;
      const previous = JSON.parse(fs.readFileSync(`${owned}/upstream/${name}/commit.json`)).sha;
      receipt.release_comparison.push({ project: name, tag: release.tag_name,
        published_at: release.published_at, draft: release.draft, prerelease: release.prerelease,
        revision, previous_revision: previous, same_revision: previous === revision });
      for (const file of files) {
        const bytes = fetchSource(`${name}/${file}`, `https://raw.githubusercontent.com/${repo}/${revision}/${file}`);
        const prior = `${owned}/upstream/${name}/${file}`;
        if (bytes && fs.existsSync(prior)) receipt.records.at(-1).matches_retained_source =
          digest(bytes) === digest(fs.readFileSync(prior));
      }
      const repositoryBytes = fetchSource(`${name}/repository.json`, `https://api.github.com/repos/${repo}`);
      if (!repositoryBytes) continue;
      const defaultBranch = JSON.parse(repositoryBytes).default_branch;
      const head = fetchSource(`${name}/head.json`, `https://api.github.com/repos/${repo}/commits/${defaultBranch}`);
      if (!head) continue;
      const headRevision = JSON.parse(head).sha;
      for (const file of files.filter((file) => /balsa_parser\.(cc|h)$|http1\.rs$|role\.rs$|v1\/server\.rs$|Cargo\.toml$/.test(file))) {
        fetchSource(`${name}/head/${file}`, `https://raw.githubusercontent.com/${repo}/${headRevision}/${file}`);
      }
    }
    for (const [name, url] of [
      ['pingora/issue-889.json', 'https://api.github.com/repos/cloudflare/pingora/issues/889'],
      ['pingora/pr-1117.json', 'https://api.github.com/repos/cloudflare/pingora/pulls/1117'],
    ]) fetchSource(name, url);
    const rustsec = fetchSource('rustsec/commit.json', 'https://api.github.com/repos/RustSec/advisory-db/commits/main');
    if (rustsec) for (const [crate, advisory] of [
      ['derivative', 'RUSTSEC-2024-0388'], ['unsafe-libyaml', 'RUSTSEC-2024-0449'],
    ]) fetchSource(`rustsec/${advisory}.md`,
      `https://raw.githubusercontent.com/RustSec/advisory-db/${JSON.parse(rustsec).sha}/crates/${crate}/${advisory}.md`);
    command('cargo-version', ['cargo', '+1.99.1', '--version']);
    command('rust-version', ['rustc', '+1.99.1', '--version', '--verbose']);
    for (const dependency of ['derivative', 'unsafe-libyaml', 'serde_yaml']) {
      command(`${dependency}-tree`, ['cargo', '+1.99.1', 'tree', '--locked', '--offline',
        '--manifest-path', 'spikes/pingora/Cargo.toml', '-i', dependency]);
    }
    const audit = '/home/tiecont/Projects/aegis-gate/.local/tools/bin/cargo-audit';
    command('audit-version', [audit, '--version']);
    command('audit-db', ['git', '-C', '/home/tiecont/.cargo/advisory-db', 'log', '-1', '--format=%H %cI']);
    command('audit', [audit, 'audit', '--no-fetch', '--db', '/home/tiecont/.cargo/advisory-db',
      '--file', 'spikes/pingora/Cargo.lock', '--json']);
  } else {
    if (!/^[a-z]+-\d+$/.test(collection ?? '')) throw new Error('Supply collection directory');
    command('syntax', [process.execPath, '--check', `${owned}/capability-refresh.mjs`]);
    command('immutable-corpus', [process.execPath, 'spikes/edge-comparison/extract-baseline.mjs', '--check']);
    command('unchanged-runtime', ['git', 'diff', '--exit-code', '3e039408', '--',
      'spikes', 'apps', 'internal', 'docs/THREAT_MODEL.md', 'docs/QUALITY_GATES.md']);
    command('whitespace', ['git', 'diff', '--check', '3e039408', '--', `${owned}/*.mjs`,
      `${owned}/*.py`, `${owned}/*.md`, `${owned}/drafts`, 'docs/reports/sprint04a-c-upstream.md']);
    command('archives', ['python3', `${owned}/verify-cached-archives.py`]);
    const previous = 'a795e619e528c08b5f22b0a3f8701e7284e96b52';
    receipt.historical_files_verified = 0;
    const manifest = git('show', `${previous}:${owned}/SHA256SUMS`).toString().trim().split('\n');
    for (const line of manifest) {
      const [, expected, file] = /^(\w{64})  (.+)$/.exec(line);
      if (digest(git('show', `${previous}:${file}`)) !== expected) throw new Error(`Historical mismatch: ${file}`);
      receipt.historical_files_verified++;
    }
    receipt.collection_files_verified = 0;
    const collected = JSON.parse(fs.readFileSync(`${owned}/${collection}/commands.json`));
    if (collected.tracked_status) throw new Error('Collection sources were dirty');
    for (const entry of collected.sources) {
      if (digest(git('show', `${collected.source_commit}:${entry.file}`)) !== entry.sha256) {
        throw new Error(`Launch source mismatch: ${entry.file}`);
      }
    }
    for (const row of collected.records) for (const entry of [row.body, row.stdout, row.stderr].filter(Boolean)) {
      if (digest(fs.readFileSync(entry.file)) !== entry.sha256) throw new Error(`Receipt mismatch: ${entry.file}`);
      receipt.collection_files_verified++;
    }
    command('secrets', ['flock', '/tmp/aegisgate-sprint02-fixtures.lock', 'docker', 'run', '--rm',
      '--pull', 'never', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`,
      '-v', `${root}/${owned}:/review/evidence:ro`,
      '-v', `${root}/docs/reports/sprint04a-c-upstream.md:/review/report.md:ro`,
      '-v', `${root}/.github/gitleaks.toml:/config.toml:ro`, '-v', `${root}/${output}:/reports`,
      'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f',
      'dir', '/review', '--config', '/config.toml', '--redact', '--report-format', 'json',
      '--report-path', '/reports/secrets.json', '--no-banner']);
  }
} catch (error) {
  receipt.error = error.message;
  process.exitCode = 1;
} finally {
  receipt.ended_at = new Date().toISOString();
  fs.writeFileSync(`${output}/commands.json`, `${JSON.stringify(receipt, null, 2)}\n`);
  if (receipt.records.some((row) => row.exit_code !== 0)) process.exitCode = 1;
}
