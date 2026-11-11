import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { validateManifest, compile, readBounded } from './recovery-config.mjs';

process.umask(0o077);
const [manifestPath, portText] = process.argv.slice(2);
if (!manifestPath || !path.isAbsolute(manifestPath) || !/^\d+$/.test(portText ?? '')) throw new Error('usage: launch absolute-manifest-path port');
const lock = JSON.parse(fs.readFileSync(new URL('./image.lock.json', import.meta.url)));
const worktree = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
fs.mkdirSync(path.join(worktree, '.local'), { recursive: true });
const dir = fs.mkdtempSync(path.join(worktree, '.local/envoy-run-'));
const container = `aegis-envoy-${process.pid}`;
const atomic = (filename, value) => { fs.writeFileSync(`${filename}.next`, JSON.stringify(value)); fs.renameSync(`${filename}.next`, filename); };
let active = validateManifest(manifestPath);
let rendered = compile(active, Number(portText), dir);
for (const [filename, value] of Object.entries(rendered.files)) atomic(filename, value);
atomic(path.join(dir, 'bootstrap.json'), rendered.bootstrap);
const child = spawn('docker', ['run', '--rm', '--name', container, '--network', 'host', '--read-only',
  '--user', `${process.getuid()}:${process.getgid()}`, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
  '--pids-limit', '64', '--memory', '256m', '--cpus', '2', '--mount', `type=bind,source=${dir},target=${dir},readonly`,
  '--mount', `type=bind,source=${path.dirname(manifestPath)},target=${path.dirname(manifestPath)},readonly`,
  '--entrypoint', '/usr/local/bin/envoy', lock.image, '-c', path.join(dir, 'bootstrap.json'), '--concurrency', '1',
  '--log-level', 'warn', '--disable-hot-restart'], { stdio: ['ignore', 'inherit', 'inherit'] });
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(watcher); clearInterval(sampler);
  try { execFileSync('docker', ['stop', '--timeout', '2', container], { stdio: 'ignore', timeout: 4500 }); } catch {}
  child.kill('SIGTERM');
}
process.on('SIGTERM', stop); process.on('SIGINT', stop);
let last = readBounded(manifestPath, path.dirname(manifestPath)).toString();
const watcher = setInterval(() => {
  try {
    const bytes = readBounded(manifestPath, path.dirname(manifestPath)).toString();
    if (bytes === last) return;
    last = bytes;
    const next = validateManifest(manifestPath, active.generation);
    if (next.routes.map((r) => r.host).join() !== active.routes.map((r) => r.host).join()) throw new Error('host inventory requires listener update');
    rendered = compile(next, Number(portText), dir);
    // CDS is published first. RDS references immutable generation-specific clusters.
    const clusters = path.join(dir, 'clusters.json');
    atomic(clusters, rendered.files[clusters]);
    for (const [filename, value] of Object.entries(rendered.files)) if (filename !== clusters) atomic(filename, value);
    active = next;
    console.log(`adapter staged generation=${active.generation}`);
  } catch { console.error('adapter NACK: invalid fixture snapshot; retaining last staged generation'); }
}, 25);
const sampleFile = path.join(dir, 'resources.jsonl');
let envoyPid;
const sampler = setInterval(() => {
  try {
    const pid = envoyPid ?? Number(execFileSync('docker', ['inspect', '--format', '{{.State.Pid}}', container], { encoding: 'utf8', timeout: 1000, stdio: ['ignore', 'pipe', 'ignore'] }).trim());
    if (!pid) return;
    envoyPid = pid;
    const raw = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
    fs.appendFileSync(sampleFile, JSON.stringify({ time_ms: Date.now(), pid, ticks: Number(fields[11]) + Number(fields[12]), rss_bytes: Number(fields[21]) * 4096 }) + '\n');
  } catch {}
}, 100);
console.log(JSON.stringify({ adapter: 'envoy', image: lock.image, resources: sampleFile, concurrency: 1, host: os.hostname() }));
child.on('error', () => { stop(); process.exitCode = 1; });
child.on('exit', (code) => { clearInterval(watcher); clearInterval(sampler); process.exitCode = stopping ? 0 : (code || 1); });
