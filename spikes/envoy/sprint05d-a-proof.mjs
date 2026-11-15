import fs from 'node:fs';
import assert from 'node:assert/strict';
import { assertLock } from './wire-fixtures.mjs';
import { rawCommand, hash } from './sprint05d-a-build.mjs';
assertLock();
const out = process.argv[2]; assert.match(out ?? '', /^evidence\/sprint05d-a\/run-\d+$/); assert.ok(!fs.existsSync(out));
const started = new Date().toISOString();
const result = await rawCommand([process.execPath, 'spikes/envoy/sprint05d-a-run.mjs', out], { timeout: 180000 });
assertLock(); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/run.stdout`, result.stdout); fs.writeFileSync(`${out}/run.stderr`, result.stderr);
fs.writeFileSync(`${out}/command.json`, JSON.stringify({ ...result, started, ended: new Date().toISOString(),
  nodeSha256: hash(fs.readFileSync(process.execPath)), flockSha256: hash(fs.readFileSync('/usr/bin/flock')),
  lock: '/tmp/aegisgate-sprint02-fixtures.lock', lockHeldThroughHashes: true }, null, 2) + '\n');
fs.writeFileSync(`${out}/SHA256SUMS`, ['command.json', 'receipt.json', 'run.stdout', 'run.stderr'].filter((name) => fs.existsSync(`${out}/${name}`))
  .map((name) => `${hash(fs.readFileSync(`${out}/${name}`))}  ${out}/${name}\n`).join(''));
console.log(JSON.stringify({ exit: result.exit, signal: result.signal, error: result.error, stdout: result.stdout, stderr: result.stderr }));
process.exitCode = result.exit === 0 && !result.error ? 0 : 1;
