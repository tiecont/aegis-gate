import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { compile, validateManifest, readBounded } from './sprint05a-c-config.mjs';
process.umask(0o077);
const [manifestPath, port] = process.argv.slice(2);
if (!path.isAbsolute(manifestPath ?? '') || !/^\d+$/.test(port ?? '')) throw Error('absolute manifest and port required');
const root = path.resolve(import.meta.dirname, '../..');
fs.mkdirSync(path.join(root, '.local'), { recursive: true });
const dir = fs.mkdtempSync(path.join(root, '.local/sprint05a-c-envoy-'));
const container = `aegis-envoy-sprint05a-c-${process.pid}`;
const image = JSON.parse(fs.readFileSync(new URL('./image.lock.json', import.meta.url))).image;
const atomic = (file, value) => { fs.writeFileSync(`${file}.next`, JSON.stringify(value)); fs.renameSync(`${file}.next`, file); };
let active = validateManifest(manifestPath);
let rendered = compile(active, Number(port), dir);
for (const [file, value] of Object.entries(rendered.files)) atomic(file, value);
atomic(path.join(dir, 'bootstrap.json'), rendered.bootstrap);
const child = spawn('docker', ['run', '--rm', '--name', container, '--network', 'host', '--read-only',
  '--user', `${process.getuid()}:${process.getgid()}`, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
  '--pids-limit', '64', '--memory', '256m', '--cpus', '2',
  '--mount', `type=bind,source=${dir},target=${dir},readonly`,
  '--mount', `type=bind,source=${path.dirname(manifestPath)},target=${path.dirname(manifestPath)},readonly`,
  '--entrypoint', '/usr/local/bin/envoy', image, '-c', path.join(dir, 'bootstrap.json'),
  '--concurrency', '1', '--log-level', 'warn', '--disable-hot-restart'], { stdio: ['ignore', 'inherit', 'inherit'] });
let stopping = false;
let last = readBounded(manifestPath, path.dirname(manifestPath)).toString();
const watcher = setInterval(() => {
  try {
    const bytes = readBounded(manifestPath, path.dirname(manifestPath)).toString();
    if (bytes === last) return;
    last = bytes;
    const next = validateManifest(manifestPath, active.generation);
    if (next.routes.map((r) => r.host).join() !== active.routes.map((r) => r.host).join()) throw Error('host inventory');
    rendered = compile(next, Number(port), dir);
    const clusters = path.join(dir, 'clusters.json');
    atomic(clusters, rendered.files[clusters]);
    for (const [file, value] of Object.entries(rendered.files)) if (file !== clusters) atomic(file, value);
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
function stop() {
  if (stopping) return;
  stopping = true; clearInterval(watcher); clearInterval(sampler);
  try { execFileSync('docker', ['stop', '--timeout', '2', container], { stdio: 'ignore', timeout: 4500 }); } catch {}
  child.kill('SIGTERM');
}
process.on('SIGTERM', stop); process.on('SIGINT', stop);
console.log(JSON.stringify({ adapter: 'envoy', image, resources: sampleFile, container, policy: process.env.AEGIS_SPRINT05A_C_POLICY, concurrency: 1 }));
child.on('error', () => { stop(); process.exitCode = 1; });
child.on('exit', (code) => { clearInterval(watcher); clearInterval(sampler); process.exitCode = stopping ? 0 : (code || 1); });
