import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const baseline = '3e03940848c81751c87bbcec131238abb7d28e1b';
const historical = '4d2d0c7';
const root = 'evidence/sprint04a-a';
const upstream = process.argv[2];
const output = process.argv[3];
assert.ok(upstream && output && !fs.existsSync(output), 'supply fresh evidence/output directories');
const git = (...args) => execFileSync('git', args);
assert.equal(git('status', '--porcelain', '--untracked-files=no').toString().trim(), '', 'commit sources first');
git('merge-base', '--is-ancestor', baseline, 'HEAD');
fs.mkdirSync(output, { recursive: true });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJSON = (file) => JSON.parse(fs.readFileSync(file));
const record = { started_at: new Date().toISOString(), argv: process.argv, cwd: process.cwd(),
  source_commit: git('rev-parse', 'HEAD').toString().trim(), baseline,
  historical_commit: git('rev-parse', historical).toString().trim(), source_clean: true,
  node_version: process.version, source_hashes: [], commands: [] };
const save = () => fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(record, null, 2) + '\n');
function capture(name, program, args) {
  const started_at = new Date().toISOString();
  // flock must cover the complete container lifetime; do not time out its parent.
  const child = spawnSync(program, args, { ...(program === 'flock' ? {} : { timeout: 60000 }),
    maxBuffer: 8 * 1024 * 1024 });
  const streams = {};
  for (const stream of ['stdout', 'stderr']) {
    const bytes = child[stream] ?? Buffer.alloc(0);
    fs.writeFileSync(path.join(output, `${name}.${stream}`), bytes);
    streams[`${stream}_sha256`] = hash(bytes);
    streams[`${stream}_bytes`] = bytes.length;
  }
  record.commands.push({ name, program, args, started_at, ended_at: new Date().toISOString(),
    exit_code: child.status, signal: child.signal, error: child.error?.message ?? null, ...streams });
  save();
  console.log(`${name}: exit=${child.status}`);
  assert.equal(child.status, 0, `${name} failed; retain attempt`);
}
function verifyReceipt(directory) {
  const receipt = readJSON(`${directory}/commands.json`);
  assert.equal(receipt.source_clean, true);
  assert.deepEqual(receipt.failed_commands, []);
  for (const command of receipt.commands) {
    assert.equal(command.exit_code, 0);
    for (const stream of ['stdout', 'stderr']) {
      assert.equal(hash(fs.readFileSync(`${directory}/${command.name}.${stream}`)), command[`${stream}_sha256`]);
    }
  }
  for (const source of receipt.source_hashes) {
    assert.equal(hash(git('show', `${receipt.source_commit}:${source.file}`)), source.sha256);
  }
  return receipt;
}
try {
  for (const file of git('ls-files', 'spikes/envoy', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs',
    'docs/reports/sprint04a-a-envoy.md').toString().trim().split('\n')) {
    record.source_hashes.push({ file, sha256: hash(fs.readFileSync(file)) });
  }
  const oldManifest = fs.readFileSync(`${root}/SHA256SUMS`);
  assert.deepEqual(oldManifest, git('show', `${historical}:${root}/SHA256SUMS`));
  const historicalFiles = [];
  for (const line of oldManifest.toString().trim().split('\n')) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.ok(match, 'invalid historical manifest entry');
    const [, expected, file] = match;
    assert.equal(hash(git('show', `${historical}:${file}`)), expected, `historical object: ${file}`);
    const currentMatches = fs.existsSync(file) && hash(fs.readFileSync(file)) === expected;
    if (file.startsWith(`${root}/`)) assert.ok(currentMatches, `historical evidence changed: ${file}`);
    historicalFiles.push({ file, sha256: expected, historical_object_verified: true,
      current_file_matches: currentMatches });
  }
  const loss = readJSON(`${root}/attempt-loss.json`);
  assert.equal(loss.proof_eligible, false);
  assert.equal(loss.retained_raw_files, false);
  const protectedFiles = git('ls-files', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs')
    .toString().trim().split('\n');
  for (const file of protectedFiles) {
    const actual = hash(fs.readFileSync(file));
    assert.equal(actual, hash(git('show', `${baseline}:${file}`)), `current baseline contract: ${file}`);
    assert.equal(actual, hash(git('show', `e5adeb4:${file}`)), `original75 contract: ${file}`);
  }
  const previous = verifyReceipt(`${root}/upstream-03`);
  const current = verifyReceipt(upstream);
  assert.deepEqual(current.upstream, previous.upstream, 'upstream release changed: review APIs before continuing');
  assert.equal(current.node_version, process.version);
  const comparedSources = [];
  for (const command of previous.commands.filter((entry) => entry.args.at(-1).startsWith('https://raw.githubusercontent.com/'))) {
    const fresh = current.commands.find((entry) => entry.name === command.name);
    assert.ok(fresh, `missing refreshed source: ${command.name}`);
    assert.deepEqual(fresh.args, command.args);
    assert.equal(fresh.stdout_sha256, command.stdout_sha256, `source changed: ${command.name}`);
    comparedSources.push({ name: command.name, url: fresh.args.at(-1), sha256: fresh.stdout_sha256 });
  }
  const readSource = (name) => fs.readFileSync(`${upstream}/${name}.stdout`, 'utf8');
  assert.ok(readSource('balsa-parser').includes('http_validation_policy.disallow_header_continuation_lines = false;'));
  assert.ok(readSource('balsa-parser').includes('void BalsaParser::OnHeaderInput(absl::string_view /*input*/) {}'));
  assert.ok(readSource('validator-api').includes('validateRequestHeaders(const RequestHeaderMap& header_map)'));
  fs.writeFileSync(path.join(output, 'integrity.json'), JSON.stringify({
    historical_manifest_sha256: hash(oldManifest), historical_files: historicalFiles,
    known_lost_attempt: loss, immutable_contract_files: protectedFiles,
    fresh_receipt_sha256: hash(fs.readFileSync(`${upstream}/commands.json`)),
    upstream: current.upstream, compared_sources: comparedSources,
    candidate_count: 0, new_runtime_proofs: 0, zero_byte_contract_changed: false,
    stop: 'Released Balsa normalizes folding before public map validation; no new maintained path in the unchanged inspected APIs.',
  }, null, 2) + '\n');
  capture('node-version', process.execPath, ['--version']);
  capture('git-version', 'git', ['--version']);
  for (const file of git('ls-files', 'spikes/envoy/strict-*.mjs').toString().trim().split('\n')) {
    capture(`syntax-${path.basename(file, '.mjs')}`, process.execPath, ['--check', file]);
  }
  capture('immutable-baseline', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']);
  capture('source-whitespace', 'git', ['diff', '--check', baseline, '--', 'spikes/envoy/strict-*.mjs',
    'docs/reports/sprint04a-a-envoy.md']);
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  capture('scanner-version', 'flock', ['/tmp/aegisgate-sprint02-fixtures.lock', 'docker', 'run', '--rm',
    '--pull=never', '--network', 'none', scanner, 'version']);
  for (const [name, target] of [['source', 'spikes/envoy'], ['evidence', root],
    ['report', 'docs/reports/sprint04a-a-envoy.md']]) {
    capture(`${name}-secrets`, 'flock', ['/tmp/aegisgate-sprint02-fixtures.lock', 'docker', 'run', '--rm',
      '--pull=never', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`,
      '-v', `${process.cwd()}:/repo:ro`, scanner, 'dir', `/repo/${target}`,
      '--config', '/repo/.github/gitleaks.toml', '--redact', '--no-banner']);
  }
  for (const source of record.source_hashes) assert.equal(hash(fs.readFileSync(source.file)), source.sha256);
} catch (error) {
  record.error = error.stack;
  process.exitCode = 1;
} finally {
  record.ended_at = new Date().toISOString();
  record.exit_code = process.exitCode ?? 0;
  save();
}
