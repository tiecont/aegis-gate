import fs from 'node:fs';
import assert from 'node:assert/strict';
import { receipt, hash } from './sprint04b-receipts.mjs';

const proof = receipt(process.argv[2]);
function fetch(name, url) {
  const argv = url.startsWith('https://api.github.com/')
    ? ['gh', 'api', '--hostname', 'github.com', url.slice('https://api.github.com/'.length)]
    : ['curl', '--fail-with-body', '--silent', '--show-error',
    '--location', '--proto', '=https', '--proto-redir', '=https', '--tlsv1.2',
    '--connect-timeout', '10', '--max-time', '30', '--max-filesize', '8388608',
    '--user-agent', 'AegisGate-read-only-source-review', url];
  const result = proof.command(name, argv);
  assert.equal(result.status, 0, `retain failed fetch: ${name}`);
  return result.stdout;
}
try {
  proof.command('curl-version', ['curl', '--version']);
  proof.command('git-version', ['git', '--version']);
  proof.command('gh-version', ['gh', '--version']);
  proof.record.releases = [];
  const projects = [
    ['envoy', 'envoyproxy/envoy', [
      'RELEASES.md', 'source/common/http/http1/balsa_parser.cc', 'source/common/http/http1/balsa_parser.h',
      'envoy/http/header_validator.h', 'source/common/http/http1/codec_impl.cc',
      'source/common/http/http2/codec_impl.cc', 'source/common/runtime/runtime_features.cc',
      'api/envoy/config/core/v3/protocol.proto',
      'api/envoy/extensions/http/header_validators/envoy_default/v3/header_validator.proto',
      'api/envoy/extensions/filters/network/http_connection_manager/v3/http_connection_manager.proto',
      'api/envoy/config/accesslog/v3/accesslog.proto', 'source/common/local_reply/local_reply.cc',
      'test/common/http/http1/balsa_parser_test.cc',
    ], ['source/common/http/http1/balsa_parser.cc', 'source/common/http/http1/balsa_parser.h']],
    ['pingora', 'cloudflare/pingora', [
      'pingora-core/src/protocols/http/v1/server.rs', 'pingora-core/src/apps/mod.rs',
      'pingora-core/src/protocols/http/server.rs', 'pingora-core/Cargo.toml',
    ], ['pingora-core/src/protocols/http/v1/server.rs']],
    ['hyper', 'hyperium/hyper', ['src/proto/h1/role.rs', 'src/server/conn/http1.rs'],
      ['src/proto/h1/role.rs', 'src/server/conn/http1.rs']],
  ];
  for (const [name, repo, files, headFiles] of projects) {
    const release = JSON.parse(fetch(`${name}/release`, `https://api.github.com/repos/${repo}/releases/latest`));
    assert.equal(release.draft, false); assert.equal(release.prerelease, false);
    const commit = JSON.parse(fetch(`${name}/commit`, `https://api.github.com/repos/${repo}/commits/${release.tag_name}`));
    assert.match(commit.sha, /^[0-9a-f]{40}$/);
    const prior = JSON.parse(fs.readFileSync(`evidence/sprint04a-c/upstream/${name}/commit.json`));
    const comparison = { project: name, repo, tag: release.tag_name, published_at: release.published_at,
      revision: commit.sha, previous_revision: prior.sha, same_revision: commit.sha === prior.sha, files: [] };
    proof.record.releases.push(comparison);
    for (const file of files) {
      const bytes = fetch(`${name}/released/${file}`, `https://raw.githubusercontent.com/${repo}/${commit.sha}/${file}`);
      const previousFile = `evidence/sprint04a-c/upstream/${name}/${file}`;
      comparison.files.push({ path: file, sha256: hash(bytes), same_retained_bytes: fs.existsSync(previousFile)
        ? hash(fs.readFileSync(previousFile)) === hash(bytes) : null });
    }
    const repository = JSON.parse(fetch(`${name}/repository`, `https://api.github.com/repos/${repo}`));
    const head = JSON.parse(fetch(`${name}/head`, `https://api.github.com/repos/${repo}/commits/${repository.default_branch}`));
    comparison.default_branch = repository.default_branch; comparison.unreleased_revision = head.sha;
    for (const file of headFiles) fetch(`${name}/unreleased/${file}`,
      `https://raw.githubusercontent.com/${repo}/${head.sha}/${file}`);
  }
  proof.record.activity = 'Read-only official HTTPS metadata/source fetches; no traffic probes, builds or publication';
} catch (error) { proof.record.error = error.stack; }
finally { proof.finish(); }
