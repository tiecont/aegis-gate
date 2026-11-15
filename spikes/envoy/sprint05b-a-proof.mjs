import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assertLock } from './wire-fixtures.mjs';
import { rawCommand } from './sprint05b-a-build.mjs';

assertLock();
const out = process.argv[2]; assert.match(out, /^evidence\/sprint05b-a\/run-\d+$/);
const argv = [process.execPath, 'spikes/envoy/sprint05b-a-run.mjs', out];
const started = new Date().toISOString();
const source = await rawCommand(['git', 'rev-parse', 'HEAD']); assert.equal(source.exit, 0);
const r = await rawCommand(argv, { timeout: 100000 });
assertLock();
const raw = { ...r, source_commit: source.stdout.trim(),
  started_at: started, ended_at: new Date().toISOString(),
  shared_flock_held_after_child: true };
if (!fs.existsSync(out)) fs.mkdirSync(out);
fs.writeFileSync(`${out}/command.json`, JSON.stringify(raw, null, 2) + '\n');
const files = ['command.json', 'receipt.json'].filter((f) => fs.existsSync(`${out}/${f}`));
fs.writeFileSync(`${out}/SHA256SUMS`, files.map((f) => {
  const digest = createHash('sha256').update(fs.readFileSync(`${out}/${f}`)).digest('hex');
  return `${digest}  ${out}/${f}\n`;
}).join(''));
console.log(JSON.stringify(raw));
process.exitCode = r.exit === 0 && !r.error ? 0 : 1;
