import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from '../spikes/envoy/wire-fixtures.mjs';

assertLock(); process.umask(0o077);
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05a-f-final\/scan-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
fs.mkdirSync(output, { recursive: true });
const sha = (b) => createHash('sha256').update(b).digest('hex');
const files = git('ls-files', 'scripts/sprint05a-f-final-*', 'docs/reports/sprint05a-f-integration-review.md',
  'evidence/sprint05a-f-final').split('\n').filter(Boolean);
const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
const name = `aegisgate-05a-final-scan-${process.pid}`;
const argv = ['docker', 'run', '--rm', '--pull', 'never', '--network', 'none', '--name', name,
  ...files.flatMap((f) => ['-v', `${path.resolve(f)}:/scan/${f}:ro`]),
  '-v', `${path.resolve('.github/gitleaks.toml')}:/gitleaks.toml:ro`, scanner, 'dir', '/scan',
  '--config', '/gitleaks.toml', '--redact', '--no-banner'];
const receipt = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  argv, started_at: new Date().toISOString(), node: process.version,
  sources: files.map((f) => ({ file: f, sha256: sha(fs.readFileSync(f)) })) };
try {
  const p = spawnSync(argv[0], argv.slice(1), { timeout: 60000, maxBuffer: 8 << 20 });
  receipt.exit_code = p.status; receipt.signal = p.signal;
  receipt.streams = ['stdout', 'stderr'].map((s) => {
    const b = p[s] ?? Buffer.alloc(0), file = `${output}/${s}.log`;
    fs.writeFileSync(file, b); return { file, sha256: sha(b), bytes: b.length };
  });
  assert.equal(p.status, 0);
} catch (error) { receipt.error = error.stack; process.exitCode = 1; }
finally {
  const remaining = spawnSync('docker', ['ps', '-aq', '--filter', `name=^/${name}$`], { encoding: 'utf8' });
  assert.equal(remaining.status, 0); assert.equal(remaining.stdout.trim(), '');
  receipt.container_absent = true; assertLock(); receipt.lock_held_through_cleanup_hashing = true;
  receipt.ended_at = new Date().toISOString();
  fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
  const files = fs.readdirSync(output).sort();
  fs.writeFileSync(`${output}/SHA256SUMS`, files.map((f) => `${sha(fs.readFileSync(`${output}/${f}`))}  ${output}/${f}\n`).join(''));
}
console.log(JSON.stringify({ exit_code: receipt.exit_code, evidence: output, files: files.length }));
