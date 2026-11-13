import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

// Read-only upstream collection. This script never starts a fixture or proxy.
const output = process.argv[2];
assert.ok(output && !fs.existsSync(output), 'choose a fresh evidence directory');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'commit sources first');
fs.mkdirSync(output, { recursive: true });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inputs = git('ls-files', 'spikes/envoy', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs').split('\n');
const receipt = {
  started_at: new Date().toISOString(), source_commit: git('rev-parse', 'HEAD'),
  source_clean: true, cwd: process.cwd(), argv: process.argv,
  node_version: process.version, commands: [],
  source_hashes: inputs.map((file) => ({ file, sha256: hash(fs.readFileSync(file)) })),
};
const save = () => fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(receipt, null, 2) + '\n');
function capture(name, program, args) {
  const started_at = new Date().toISOString();
  const result = spawnSync(program, args, { timeout: 40000, maxBuffer: 8 * 1024 * 1024 });
  const stdout = result.stdout ?? Buffer.alloc(0);
  const stderr = result.stderr ?? Buffer.alloc(0);
  fs.writeFileSync(path.join(output, `${name}.stdout`), stdout);
  fs.writeFileSync(path.join(output, `${name}.stderr`), stderr);
  receipt.commands.push({ name, program, args, started_at, ended_at: new Date().toISOString(),
    exit_code: result.status, signal: result.signal, error: result.error?.message ?? null,
    stdout_sha256: hash(stdout), stderr_sha256: hash(stderr), stdout_bytes: stdout.length });
  save();
  console.log(`${name}: exit=${result.status} bytes=${stdout.length}`);
  return result.status === 0 ? stdout.toString('utf8') : null;
}
function fetchSource(name, url) {
  return capture(name, 'curl', ['--fail-with-body', '--silent', '--show-error', '--location',
    '--proto', '=https', '--tlsv1.2', '--connect-timeout', '10', '--max-time', '30',
    '--max-filesize', '8388608', '--user-agent', 'AegisGate-local-source-review', url]);
}
try {
  capture('curl-version', 'curl', ['--version']);
  const release = JSON.parse(assertValue(fetchSource('release', 'https://api.github.com/repos/envoyproxy/envoy/releases/latest')));
  assert.match(release.tag_name, /^v\d+\.\d+\.\d+$/);
  const commit = JSON.parse(assertValue(fetchSource('release-commit', `https://api.github.com/repos/envoyproxy/envoy/commits/${release.tag_name}`)));
  assert.match(commit.sha, /^[a-f0-9]{40}$/);
  receipt.upstream = { tag: release.tag_name, sha: commit.sha, published_at: release.published_at };
  const files = [
    ['release-policy', 'RELEASES.md'],
    ['balsa-parser', 'source/common/http/http1/balsa_parser.cc'],
    ['balsa-parser-header', 'source/common/http/http1/balsa_parser.h'],
    ['h1-codec', 'source/common/http/http1/codec_impl.cc'],
    ['h1-codec-header', 'source/common/http/http1/codec_impl.h'],
    ['legacy-parser', 'source/common/http/http1/legacy_parser_impl.cc'],
    ['h2-codec', 'source/common/http/http2/codec_impl.cc'],
    ['validator-api', 'envoy/http/header_validator.h'],
    ['validator-config', 'api/envoy/extensions/http/header_validators/envoy_default/v3/header_validator.proto'],
    ['h1-validator', 'source/extensions/http/header_validators/envoy_default/http1_header_validator.cc'],
    ['h2-validator', 'source/extensions/http/header_validators/envoy_default/http2_header_validator.cc'],
    ['hcm-api', 'api/envoy/extensions/filters/network/http_connection_manager/v3/http_connection_manager.proto'],
    ['protocol-api', 'api/envoy/config/core/v3/protocol.proto'],
    ['runtime-features', 'source/common/runtime/runtime_features.cc'],
    ['local-reply', 'source/common/local_reply/local_reply.cc'],
    ['parser-api', 'source/common/http/http1/parser.h'],
    ['legacy-parser-source', 'bazel/external/http_parser/http_parser.c'],
    ['legacy-parser-header', 'bazel/external/http_parser/http_parser.h'],
    ['legacy-parser-readme', 'bazel/external/http_parser/README.md'],
    ['hcm-codec-calls', 'source/common/http/conn_manager_impl.cc'],
    ['hcm-config', 'source/extensions/filters/network/http_connection_manager/config.cc'],
    ['balsa-tests', 'test/common/http/http1/balsa_parser_test.cc'],
    ['legacy-tests', 'test/common/http/http1/codec_impl_test.cc'],
  ];
  for (const [name, file] of files) fetchSource(name, `https://raw.githubusercontent.com/envoyproxy/envoy/${commit.sha}/${file}`);
  for (const entry of receipt.source_hashes) assert.equal(hash(fs.readFileSync(entry.file)), entry.sha256, `input changed: ${entry.file}`);
} catch (error) {
  receipt.error = error.stack;
  process.exitCode = 1;
} finally {
  receipt.ended_at = new Date().toISOString();
  receipt.failed_commands = receipt.commands.filter((command) => command.exit_code !== 0).map((command) => command.name);
  if (receipt.failed_commands.length) process.exitCode = 1;
  save();
}
function assertValue(value) {
  assert.ok(value !== null, 'metadata retrieval failed; retain this attempt');
  return value;
}
