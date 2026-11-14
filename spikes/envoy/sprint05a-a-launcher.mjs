import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
import { compile, validateManifest, readBounded } from './sprint05a-a-config.mjs';

process.umask(0o077);
assertLock();
const [manifest, port] = process.argv.slice(2);
if (!path.isAbsolute(manifest ?? '') || !/^\d+$/.test(port ?? '')) throw new Error('usage: absolute-manifest port');
const root = path.resolve(import.meta.dirname, '../..');
const dir = fs.mkdtempSync(path.join(root, '.local/sprint05a-a-envoy-'));
const container = `aegis-sprint05a-a-${process.pid}`;
const image = JSON.parse(fs.readFileSync(new URL('./image.lock.json', import.meta.url))).image;
const atomic = (file, data) => { fs.writeFileSync(`${file}.next`, JSON.stringify(data)); fs.renameSync(`${file}.next`, file); };
let active = validateManifest(manifest);
let rendered = compile(active, Number(port), dir);
for (const [file, data] of Object.entries(rendered.files)) atomic(file, data);
atomic(path.join(dir, 'bootstrap.json'), rendered.bootstrap);
const child = spawn('docker', ['run', '--rm', '--pull', 'never', '--name', container, '--network', 'host', '--read-only',
  '--user', `${process.getuid()}:${process.getgid()}`, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
  '--pids-limit', '64', '--memory', '256m', '--cpus', '2', '--mount', `type=bind,source=${dir},target=${dir},readonly`,
  '--mount', `type=bind,source=${path.dirname(manifest)},target=${path.dirname(manifest)},readonly`,
  '--entrypoint', '/usr/local/bin/envoy', image, '-c', path.join(dir, 'bootstrap.json'),
  '--concurrency', '1', '--log-level', 'warn', '--disable-hot-restart'], { stdio: ['ignore', 'inherit', 'inherit'] });
let stopping = false;
let last = readBounded(manifest, path.dirname(manifest)).toString();
const watcher = setInterval(() => {
  try {
    const bytes = readBounded(manifest, path.dirname(manifest)).toString();
    if (bytes === last) return;
    last = bytes;
    const next = validateManifest(manifest, active.generation);
    if (next.routes.map((r) => r.host).join() !== active.routes.map((r) => r.host).join()) throw new Error('host inventory');
    rendered = compile(next, Number(port), dir);
    const clusters = path.join(dir, 'clusters.json');
    atomic(clusters, rendered.files[clusters]);
    for (const [file, data] of Object.entries(rendered.files)) if (file !== clusters) atomic(file, data);
    active = next;
    console.log(`adapter staged generation=${active.generation}`);
  } catch { console.error('adapter NACK: invalid fixture snapshot; retaining last staged generation'); }
}, 25);
let envoyPid;
const resources = path.join(dir, 'resources.jsonl');
const sampler = setInterval(() => {
  try {
    const pid = envoyPid ?? Number(execFileSync('docker', ['inspect', '--format', '{{.State.Pid}}', container],
      { encoding: 'utf8', timeout: 1000, stdio: ['ignore', 'pipe', 'ignore'] }).trim());
    if (!pid) return;
    envoyPid = pid;
    const raw = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
    fs.appendFileSync(resources, JSON.stringify({ time_ms: Date.now(), pid,
      ticks: Number(fields[11]) + Number(fields[12]), rss_bytes: Number(fields[21]) * 4096 }) + '\n');
  } catch {}
}, 100);
function stop() {
  if (stopping) return;
  stopping = true; clearInterval(watcher); clearInterval(sampler);
  try { execFileSync('docker', ['stop', '--timeout', '2', container], { stdio: 'ignore', timeout: 4500 }); } catch {}
  child.kill('SIGTERM');
}
process.on('SIGTERM', stop); process.on('SIGINT', stop);
console.log(JSON.stringify({ adapter: 'envoy-sprint05a-a-te', container, image, resources, concurrency: 1 }));
child.on('error', () => { stop(); process.exitCode = 1; });
child.on('exit', (code) => {
  clearInterval(watcher); clearInterval(sampler);
  // The outer locked runner captures resources then removes this owned directory.
  process.exitCode = stopping ? 0 : (code || 1);
});
