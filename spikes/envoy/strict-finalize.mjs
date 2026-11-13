import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = 'evidence/sprint04a-a';
assert.ok(!fs.existsSync(`${root}/SHA256SUMS`), 'immutable manifest already exists');
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim(), '', 'commit sources first');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const started_at = new Date().toISOString();
const receipts = [];
for (const attempt of ['checks-01', 'checks-02', 'checks-03']) {
  const receipt = JSON.parse(fs.readFileSync(`${root}/${attempt}/commands.json`));
  assert.ok(!receipt.error);
  for (const command of receipt.commands) {
    assert.equal(command.exit_code, 0);
    for (const stream of ['stdout', 'stderr']) {
      assert.equal(hash(fs.readFileSync(`${root}/${attempt}/${command.name}.${stream}`)), command[`${stream}_sha256`]);
    }
  }
  receipts.push({ attempt, source_commit: receipt.source_commit, verified_commands: receipt.commands.length });
}
fs.writeFileSync(`${root}/finalization.json`, JSON.stringify({
  argv: process.argv, cwd: process.cwd(), node_version: process.version,
  source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  source_clean: true, started_at, ended_at: new Date().toISOString(),
  verified_receipts: receipts, exit_code: 0, lost_attempt_is_proof_eligible: false,
}, null, 2) + '\n');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
const inventory = [...files(root), 'docs/reports/sprint04a-a-envoy.md',
  ...['strict-research.mjs', 'strict-check.mjs', 'strict-finalize.mjs'].map((file) => `spikes/envoy/${file}`)];
fs.writeFileSync(`${root}/SHA256SUMS`, inventory.sort().map((file) => `${hash(fs.readFileSync(file))}  ${file}\n`).join(''));
console.log(`PASS ${inventory.length} files bound; all retained check receipts verified`);
