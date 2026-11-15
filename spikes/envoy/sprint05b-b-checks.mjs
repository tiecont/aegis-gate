import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
assertLock(); process.umask(0o077);
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05b-b\/checks-[a-z0-9-]+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
fs.mkdirSync(output, { recursive: true });
const sha = (b) => createHash('sha256').update(b).digest('hex');
const sources = git('ls-files', 'spikes/envoy/sprint05b-b-*', 'docs/reports/sprint05b-b-h2-lifecycle.md').split('\n');
const receipt = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  argv: process.argv, node: process.version, started_at: new Date().toISOString(), commands: [],
  sources: sources.map((file) => ({ file, sha256: sha(fs.readFileSync(file)) })) };
function run(label, program, args) {
  const started_at = new Date().toISOString();
  const c = spawnSync(program, args, { timeout: 60000, maxBuffer: 4 << 20 });
  for (const stream of ['stdout', 'stderr']) fs.writeFileSync(`${output}/${label}.${stream}`, c[stream] ?? '');
  receipt.commands.push({ label, program, args, started_at, ended_at: new Date().toISOString(),
    exit_code: c.status, signal: c.signal, error: c.error?.message,
    stdout_sha256: sha(c.stdout ?? ''), stderr_sha256: sha(c.stderr ?? '') });
  assert.equal(c.status, 0, label);
}
try {
  run('whitespace', 'git', ['diff', '--check', '8758b1c', '--', ...sources]);
  run('checks-syntax', process.execPath, ['--check', 'spikes/envoy/sprint05b-b-checks.mjs']);
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  run('scanner-image', 'docker', ['image', 'inspect', scanner, '--format', '{{.Id}} {{json .RepoDigests}}']);
  for (const [label, target] of [['source', 'spikes/envoy'], ['evidence', 'evidence/sprint05b-b'],
    ['report', 'docs/reports/sprint05b-b-h2-lifecycle.md']]) {
    run(`secrets-${label}`, 'docker', ['run', '--rm', '--network', 'none',
      '--name', `aegis-sprint05b-b-scan-${process.pid}-${label}`, '--user', `${process.getuid()}:${process.getgid()}`,
      '-v', `${process.cwd()}:/repo:ro`, '-v', `${path.resolve(output)}:/reports`, scanner, 'dir', `/repo/${target}`,
      '--config', '/repo/.github/gitleaks.toml', '--redact', '--report-format', 'json',
      '--report-path', `/reports/${label}-secrets.json`, '--no-banner']);
  }
  receipt.exit_code = 0;
} catch (error) { receipt.error = error.stack; receipt.exit_code = 1; process.exitCode = 1; }
assertLock(); receipt.lock_held_through_hashes = true; receipt.ended_at = new Date().toISOString();
fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
fs.writeFileSync(`${output}/SHA256.json`, JSON.stringify(fs.readdirSync(output).sort()
  .map((file) => ({ file, sha256: sha(fs.readFileSync(`${output}/${file}`)) })), null, 2) + '\n');
const files = [];
function collect(dir) { for (const name of fs.readdirSync(dir).sort()) {
  const file = `${dir}/${name}`; if (file === 'evidence/sprint05b-b/SHA256.json') continue;
  if (fs.statSync(file).isDirectory()) collect(file); else files.push(file);
} }
collect('evidence/sprint05b-b');
fs.writeFileSync('evidence/sprint05b-b/SHA256.json', JSON.stringify([...sources, ...files].sort()
  .map((file) => ({ file, sha256: sha(fs.readFileSync(file)) })), null, 2) + '\n');
console.log(`checks exit=${receipt.exit_code}`);
