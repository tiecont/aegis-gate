import fs from 'node:fs';
import assert from 'node:assert/strict';
import { receipt, hash } from './sprint04c-repro-receipts.mjs';

const proof = receipt(process.argv[2]);
function fetch(name, url, retained) {
  const argv = url.startsWith('https://api.github.com/')
    ? ['gh', 'api', '--hostname', 'github.com', url.slice(23)]
    : ['curl', '--fail-with-body', '--silent', '--show-error', '--location', '--proto', '=https',
      '--proto-redir', '=https', '--tlsv1.2', '--connect-timeout', '10', '--max-time', '30',
      '--max-filesize', '8388608', '--user-agent', 'AegisGate-read-only-source-review', url];
  const result = proof.command(name, argv);
  assert.equal(result.status, 0, name);
  const row = proof.record.commands.at(-1);
  if (retained && fs.existsSync(retained) && hash(result.stdout) === hash(fs.readFileSync(retained))) {
    fs.unlinkSync(row.stdout.file);
    row.stdout = { file: retained, bytes: result.stdout.length, sha256: hash(result.stdout),
      retained_immutable_output: true };
    proof.save();
  }
  return result.stdout;
}
try {
  proof.command('curl-version', ['curl', '--version']);
  proof.command('gh-version', ['gh', '--version']);
  proof.command('git-version', ['git', '--version']);
  proof.record.projects = [];
  for (const [name, repo, files] of [
    ['envoy', 'envoyproxy/envoy', ['RELEASES.md', 'source/common/http/http1/balsa_parser.cc',
      'source/common/http/http1/balsa_parser.h', 'envoy/http/header_validator.h',
      'source/common/http/http1/codec_impl.cc', 'source/common/http/http2/codec_impl.cc',
      'source/common/runtime/runtime_features.cc', 'api/envoy/config/core/v3/protocol.proto',
      'api/envoy/extensions/http/header_validators/envoy_default/v3/header_validator.proto',
      'api/envoy/extensions/filters/network/http_connection_manager/v3/http_connection_manager.proto',
      'api/envoy/config/accesslog/v3/accesslog.proto', 'source/common/local_reply/local_reply.cc',
      'test/common/http/http1/balsa_parser_test.cc']],
    ['pingora', 'cloudflare/pingora', ['pingora-core/src/protocols/http/v1/server.rs',
      'pingora-core/src/apps/mod.rs', 'pingora-core/src/protocols/http/server.rs', 'pingora-core/Cargo.toml']],
    ['hyper', 'hyperium/hyper', ['src/proto/h1/role.rs', 'src/server/conn/http1.rs']],
  ]) {
    const priorRoot = `evidence/sprint04b-b/upstream-02/${name}`;
    const release = JSON.parse(fetch(`${name}/release`, `https://api.github.com/repos/${repo}/releases/latest`));
    assert.equal(release.draft, false); assert.equal(release.prerelease, false);
    const revision = JSON.parse(fetch(`${name}/commit`, `https://api.github.com/repos/${repo}/commits/${release.tag_name}`)).sha;
    assert.match(revision, /^[a-f0-9]{40}$/);
    const prior = JSON.parse(fs.readFileSync(`${priorRoot}/commit.stdout`));
    const row = { name, repo, tag: release.tag_name, published_at: release.published_at, revision,
      prior_revision: prior.sha, same_release_revision: prior.sha === revision, files: [] };
    proof.record.projects.push(row);
    for (const file of files) {
      const retained = `${priorRoot}/released/${file}.stdout`;
      const bytes = fetch(`${name}/released/${file}`, `https://raw.githubusercontent.com/${repo}/${revision}/${file}`, retained);
      row.files.push({ file, sha256: hash(bytes), same_retained_bytes: fs.existsSync(retained)
        && hash(fs.readFileSync(retained)) === hash(bytes), retained });
    }
    const repository = JSON.parse(fetch(`${name}/repository`, `https://api.github.com/repos/${repo}`));
    const head = JSON.parse(fetch(`${name}/head`, `https://api.github.com/repos/${repo}/commits/${repository.default_branch}`));
    row.default_branch = repository.default_branch; row.unreleased_revision = head.sha;
    row.prior_unreleased_revision = JSON.parse(fs.readFileSync(`${priorRoot}/head.stdout`)).sha;
    const headFiles = name === 'envoy' ? ['source/common/http/http1/balsa_parser.cc', 'source/common/http/http1/balsa_parser.h']
      : name === 'pingora' ? ['pingora-core/src/protocols/http/v1/server.rs'] : ['src/proto/h1/role.rs', 'src/server/conn/http1.rs'];
    for (const file of headFiles) fetch(`${name}/unreleased/${file}`,
      `https://raw.githubusercontent.com/${repo}/${head.sha}/${file}`, `${priorRoot}/unreleased/${file}.stdout`);
  }
  proof.record.scope = 'Official HTTPS source/API refresh; unchanged raw source outputs referenced by exact existing hashes, not duplicated. No runtime or publication.';
} catch (error) { proof.record.error = error.stack; }
finally { proof.finish(); }
