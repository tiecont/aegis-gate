// Recover only this isolated worktree's abandoned synthetic fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertLock } from './wire-fixtures.mjs';
process.umask(0o077); assertLock();
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05b-b\/cleanup-[a-z0-9-]+$/);
assert.ok(!fs.existsSync(output)); fs.mkdirSync(output, { recursive: true });
const sha = (b) => createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
const receipt = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  argv: process.argv, node: process.version, started_at: new Date().toISOString(), commands: [], removed: [] };
function command(args, expected = [0]) {
  const r = spawnSync('docker', args, { timeout: 20000 });
  receipt.commands.push({ program: 'docker', args, exit_code: r.status, signal: r.signal,
    stdout: r.stdout?.toString(), stderr: r.stderr?.toString(), error: r.error?.message });
  assert.ok(expected.includes(r.status)); return r.stdout.toString().trim();
}
try {
  const ids = command(['ps', '-aq', '--filter', 'name=^/aegis-envoy-', '--filter', 'name=^/aegis-sprint05a-a-']).split('\n').filter(Boolean);
  for (const id of ids) {
    const mounts = JSON.parse(command(['inspect', '--format', '{{json .Mounts}}', id]));
    if (!mounts.some((m) => m.Source.startsWith(path.resolve('.local') + '/'))) continue;
    command(['rm', '-f', id]); command(['inspect', '--format', '{{.Id}}', id], [1]);
  }
  for (const entry of fs.readdirSync('.local')) if (/^(sprint05b-b-|sprint05a-a-envoy-)/.test(entry)) {
    fs.rmSync(path.join('.local', entry), { recursive: true }); receipt.removed.push(entry);
  }
  receipt.exit_code = 0;
} catch (error) { receipt.error = error.stack; receipt.exit_code = 1; process.exitCode = 1; }
assertLock(); receipt.lock_held_through_hash_cleanup = true; receipt.ended_at = new Date().toISOString();
fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
fs.writeFileSync(`${output}/SHA256.json`, JSON.stringify([{ file: 'receipt.json',
  sha256: sha(fs.readFileSync(`${output}/receipt.json`)) }], null, 2) + '\n');
