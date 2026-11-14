import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertLock } from './wire-fixtures.mjs';

assertLock();
const out = process.argv[2]; assert.match(out, /^evidence\/sprint05b-a\/run-\d+$/);
const argv = [process.execPath, 'spikes/envoy/sprint05b-a-run.mjs', out];
const started = new Date().toISOString();
const r = spawnSync(argv[0], argv.slice(1), { timeout: 100000, maxBuffer: 2 << 20 });
assertLock();
const raw = { argv, source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  started_at: started, ended_at: new Date().toISOString(), exit: r.status, signal: r.signal,
  error: r.error?.message, stdout: r.stdout?.toString(), stderr: r.stderr?.toString(),
  shared_flock_held_after_child: true };
if (!fs.existsSync(out)) fs.mkdirSync(out);
fs.writeFileSync(`${out}/command.json`, JSON.stringify(raw, null, 2) + '\n');
const files = ['command.json', 'receipt.json'].filter((f) => fs.existsSync(`${out}/${f}`));
fs.writeFileSync(`${out}/SHA256SUMS`, files.map((f) => {
  const digest = createHash('sha256').update(fs.readFileSync(`${out}/${f}`)).digest('hex');
  return `${digest}  ${out}/${f}\n`;
}).join(''));
console.log(JSON.stringify(raw));
process.exitCode = r.status === 0 ? 0 : 1;
