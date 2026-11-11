import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const output = 'evidence/sprint03a-e';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fileHash = (file) => hash(fs.readFileSync(file));
const historicalCommit = 'dbbdf3e036da49b1e5cd00fe237100c78e21d674';
const report = 'docs/reports/sprint03a-e-independent-review.md';
const receipt = `${output}/historical-verification.json`;
const inventoryFile = `${output}/FOLLOWUP-SHA256SUMS`;
assert.ok(!fs.existsSync(receipt) && !fs.existsSync(inventoryFile), 'never overwrite a closed inventory');
const historicalInventory = fs.readFileSync(`${output}/SHA256SUMS`, 'utf8');
assert.equal(historicalInventory, execFileSync('git', ['show', `${historicalCommit}:${output}/SHA256SUMS`], { encoding: 'utf8' }));
const checked = [];
for (const line of historicalInventory.trimEnd().split('\n')) {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  assert.ok(match, 'invalid historical inventory line');
  const [, expected, file] = match;
  const actual = file === report ? hash(execFileSync('git', ['show', `${historicalCommit}:${file}`])) : fileHash(file);
  assert.equal(actual, expected, `historical artifact changed: ${file}`);
  checked.push({ file, sha256: actual, source: file === report ? historicalCommit : 'unchanged working file' });
}
fs.writeFileSync(receipt, JSON.stringify({ verified_at: new Date().toISOString(), historical_commit: historicalCommit,
  historical_inventory_sha256: fileHash(`${output}/SHA256SUMS`), files: checked }, null, 2) + '\n');
const entries = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else entries.push(`${fileHash(file)}  ${file}`);
  }
}
for (const mode of ['observed-units', 'observed-pingora', 'observed-hyper', 'observed-envoy',
  'observed-integration-review', 'observed-final-check']) collect(`${output}/${mode}`);
for (const file of [receipt, `${output}/SHA256SUMS`, `${output}/followup-run.mjs`,
  `${output}/followup-inventory.mjs`, report, 'docs/reports/sprint03a-e-observer-followup.md'])
  entries.push(`${fileHash(file)}  ${file}`);
fs.writeFileSync(inventoryFile, entries.sort().join('\n') + '\n');
console.log(`Historical ${checked.length} bindings verified; follow-up ${entries.length} files bound; inventory excludes itself.`);
