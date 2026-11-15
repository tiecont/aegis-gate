// Lab adapter only. Use the original manifest validator and public Go APIs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
import { validateManifest, readBounded } from './config.mjs';
process.umask(0o077); assertLock();
const [file, port] = process.argv.slice(2);
assert.ok(path.isAbsolute(file ?? '') && /^\d+$/.test(port ?? ''));
const binary = process.env.AEGIS_05C_B_BINARY;
assert.ok(path.isAbsolute(binary ?? ''));
assert.equal(createHash('sha256').update(fs.readFileSync(binary)).digest('hex'), process.env.AEGIS_05C_B_BINARY_SHA256);
const directory = fs.mkdtempSync(path.resolve('.local/sprint05c-b-launch-'));
const staged = path.join(directory, 'manifest.json');
const write = (value) => { fs.writeFileSync(`${staged}.next`, JSON.stringify(value)); fs.renameSync(`${staged}.next`, staged); };
let active = validateManifest(file); write(active);
let last = readBounded(file, path.dirname(file)).toString();
const child = spawn('prlimit', ['--core=0', '--nofile=1024', '--cpu=180', '--', binary, staged, port], { stdio: ['ignore', 'inherit', 'inherit'] });
console.log(JSON.stringify({ adapter: 'sprint05c-b-net-http-lab', pid: child.pid, binary,
  sha256: process.env.AEGIS_05C_B_BINARY_SHA256, resource_eligible: false,
  limits: 'native prlimit only; no memory/PID cgroups; lab adapter, not production candidate' }));
const watcher = setInterval(() => {
  try {
    const bytes = readBounded(file, path.dirname(file)).toString();
    if (bytes === last) return; last = bytes;
    const next = validateManifest(file, active.generation);
    assert.deepEqual(next.routes.map((r) => r.host), active.routes.map((r) => r.host));
    write(next); active = next;
  } catch { console.error('fixture NACK; retaining staged generation'); }
}, 25);
let stopping = false;
const stop = () => { if (stopping) return; stopping = true; clearInterval(watcher); child.kill('SIGTERM'); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
child.on('error', () => { stop(); process.exitCode = 1; });
child.on('exit', (code) => {
  clearInterval(watcher); fs.rmSync(directory, { recursive: true }); process.exitCode = stopping ? 0 : (code || 1);
});
