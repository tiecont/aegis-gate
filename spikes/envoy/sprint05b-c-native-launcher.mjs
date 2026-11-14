// Test-only execution of root's exact image-extracted binary; no cgroup proof.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertLock } from './wire-fixtures.mjs';
const { compile, validateManifest, readBounded } = await import(
  ['baseline', 'untapped'].includes(process.env.AEGIS_05B_C_MODE) ? './sprint05a-combined-config.mjs' : './sprint05b-c-config.mjs');
assertLock(); process.umask(0o077);
const [manifest, port] = process.argv.slice(2);
assert.ok(path.isAbsolute(manifest ?? '') && /^\d+$/.test(port ?? ''));
const binary = process.env.AEGIS_05B_NATIVE_BINARY, digest = process.env.AEGIS_05B_NATIVE_SHA256;
assert.ok(path.isAbsolute(binary ?? '') && /^[a-f0-9]{64}$/.test(digest ?? ''));
assert.equal(createHash('sha256').update(fs.readFileSync(binary)).digest('hex'), digest);
const dir = fs.mkdtempSync(path.resolve('.local/sprint05b-c-native-'));
const atomic = (file, data) => { fs.writeFileSync(`${file}.next`, JSON.stringify(data)); fs.renameSync(`${file}.next`, file); };
let active = validateManifest(manifest), rendered = compile(active, Number(port), dir);
for (const [file, data] of Object.entries(rendered.files)) atomic(file, data);
atomic(path.join(dir, 'bootstrap.json'), rendered.bootstrap);
const child = spawn('prlimit', ['--core=0', '--nofile=1024', '--cpu=180', '--', binary,
  '-c', path.join(dir, 'bootstrap.json'), '--concurrency', '1', '--log-level', 'warn', '--disable-hot-restart'],
{ stdio: ['ignore', 'inherit', 'inherit'] });
console.log(JSON.stringify({ adapter: 'test-only-native-envoy', binary, sha256: digest, pid: child.pid,
  limits: 'prlimit core0 nofile1024 cpu180; no container cgroup memory/pid isolation; not a resource eligibility proof' }));
let last = readBounded(manifest, path.dirname(manifest)).toString(), stopping = false;
const watcher = setInterval(() => {
  try {
    const bytes = readBounded(manifest, path.dirname(manifest)).toString();
    if (bytes === last) return; last = bytes;
    const next = validateManifest(manifest, active.generation);
    assert.equal(next.routes.map((r) => r.host).join(), active.routes.map((r) => r.host).join());
    rendered = compile(next, Number(port), dir);
    const clusters = path.join(dir, 'clusters.json'); atomic(clusters, rendered.files[clusters]);
    for (const [file, data] of Object.entries(rendered.files)) if (file !== clusters) atomic(file, data);
    active = next; console.log(`adapter staged generation=${active.generation}`);
  } catch { console.error('adapter NACK: invalid fixture snapshot; retaining last staged generation'); }
}, 25);
const sampler = setInterval(() => {
  try {
    const raw = fs.readFileSync(`/proc/${child.pid}/stat`, 'utf8');
    const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
    fs.appendFileSync(path.join(dir, 'resources.jsonl'), JSON.stringify({ time_ms: Date.now(), pid: child.pid,
      ticks: Number(fields[11]) + Number(fields[12]), rss_bytes: Number(fields[21]) * 4096 }) + '\n');
  } catch {}
}, 100);
const stop = () => { if (!stopping) { stopping = true; clearInterval(watcher); clearInterval(sampler); child.kill('SIGTERM'); } };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
child.on('error', () => { stop(); process.exitCode = 1; });
child.on('exit', (code) => { clearInterval(watcher); clearInterval(sampler); process.exitCode = stopping ? 0 : (code || 1); });
