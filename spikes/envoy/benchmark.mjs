import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import https from 'node:https';
import { once } from 'node:events';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

process.umask(0o077);
const [resultFile, output] = process.argv.slice(2);
if (!resultFile || !output) throw new Error('usage: benchmark.mjs shared-results.json output.json');
const fixture = JSON.parse(fs.readFileSync(resultFile)).run_directory;
const read = (name) => fs.readFileSync(path.join(fixture, name));
const ca = read('ca.pem');
const reference = 'nginx@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311';
const cleanup = [];
const report = { started_at: new Date().toISOString(), cpu: os.cpus()[0]?.model, logical_cpus: os.cpus().length,
  memory_bytes: os.totalmem(), profile: '100 warmup; 5 seconds; closed-loop concurrency8; 90% GET/1024B and10% POST/32768B echo; verified TLS both hops; H1 keepalive; same host',
  limitations: ['single short run, shared host, sequential candidates, coordinated omission; no capacity/SLO/ranking claim',
    'Envoy concurrency1 versus Nginx workers2; RSS sums shared pages', 'resource sampler includes actual container PIDs; launcher is recorded separately'],
  reference, image: JSON.parse(fs.readFileSync(new URL('./image.lock.json', import.meta.url))).image };

async function listen(server) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return server.address().port;
}
async function freePort() {
  const s = net.createServer(); const p = await listen(s); await new Promise((r) => s.close(r)); return p;
}
function request(port, agent, post = false) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host: '127.0.0.1', port, servername: 'edge-a.test', ca, rejectUnauthorized: true,
      agent, path: post ? '/echo' : '/payload', method: post ? 'POST' : 'GET', headers: { host: 'edge-a.test' } }, (res) => {
      let size = 0; res.on('data', (chunk) => { size += chunk.length; }); res.on('error', reject);
      res.on('end', () => resolve(res.statusCode === 200 && size === (post ? 32768 : 1024)));
    });
    req.setTimeout(5000, () => req.destroy(new Error('request deadline')));
    req.on('error', reject); req.end(post ? 'p'.repeat(32768) : undefined);
  });
}
function sample(pids) {
  return pids.reduce((sum, pid) => {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const values = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return { ticks: sum.ticks + Number(values[11]) + Number(values[12]), rss: sum.rss + Number(values[21]) * 4096 };
  }, { ticks: 0, rss: 0 });
}
async function bench(port, pids, launcherPids = []) {
  const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });
  let timer;
  try {
    for (let i = 0; i < 100; i++) assert.ok(await request(port, agent));
    const before = sample(pids); const adapterBefore = sample(launcherPids);
    let peak = before.rss; const samples = [];
    timer = setInterval(() => { const s = sample(pids); peak = Math.max(peak, s.rss); samples.push({ at: Date.now(), ...s }); }, 100);
    const started_at = new Date().toISOString();
    const start = performance.now(); const deadline = start + 5000;
    let index = 0; let errors = 0; let timeouts = 0; const latencies = [];
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (performance.now() < deadline) {
        const post = ++index % 10 === 0; const begin = performance.now();
        try { if (!await request(port, agent, post)) errors++; }
        catch (e) { errors++; if (e.message.includes('deadline')) timeouts++; }
        latencies.push(performance.now() - begin);
      }
    }));
    const seconds = (performance.now() - start) / 1000;
    clearInterval(timer); const after = sample(pids); const adapterAfter = sample(launcherPids);
    latencies.sort((a, b) => a - b);
    const q = (fraction) => +latencies[Math.ceil(latencies.length * fraction) - 1].toFixed(3);
    return { started_at, completed_at: new Date().toISOString(), duration_seconds: seconds, requests: latencies.length,
      requests_per_second: latencies.length / seconds, errors, timeouts, p50_ms: q(.5), p95_ms: q(.95), p99_ms: q(.99),
      cpu_percent_one_core: (after.ticks - before.ticks) / seconds, peak_rss_bytes: Math.max(peak, after.rss),
      pids, launcher_pids: launcherPids, launcher_cpu_percent_one_core: (adapterAfter.ticks - adapterBefore.ticks) / seconds,
      launcher_rss_bytes: adapterAfter.rss, raw_samples: samples };
  } finally { clearInterval(timer); agent.destroy(); }
}

try {
  assert.equal(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim(), '100');
  assert.equal(execFileSync('getconf', ['PAGESIZE'], { encoding: 'utf8' }).trim(), '4096');
  const origin = https.createServer({ key: read('origin.key'), cert: read('origin.pem'), minVersion: 'TLSv1.2' }, (req, res) => {
    if (req.url === '/echo') req.pipe(res); else res.end('r'.repeat(1024));
  });
  const originPort = await listen(origin);
  cleanup.push(async () => { origin.closeAllConnections(); await new Promise((r) => origin.close(r)); });
  const port = await freePort(); const nginxPort = await freePort();
  const manifest = path.join(fixture, 'benchmark-manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({ generation: 1, ca_file: path.join(fixture, 'ca.pem'), routes: [{
    host: 'edge-a.test', origin_name: 'lab-origin.test', origin_port: originPort, h2: false,
    cert_file: path.join(fixture, 'edge-a.pem'), key_file: path.join(fixture, 'edge-a.key'),
  }] }));
  const log = fs.openSync(path.join(fixture, 'benchmark-proxy.log'), 'w');
  const child = spawn(fileURLToPath(new URL('./launch', import.meta.url)), [manifest, String(port)], { stdio: ['ignore', log, log] });
  fs.closeSync(log);
  cleanup.push(async () => { child.kill('SIGTERM'); await Promise.race([once(child, 'exit'), delay(5000).then(() => child.kill('SIGKILL'))]); });
  for (let i = 0; i < 100; i++) {
    try { assert.ok(await request(port, false)); break; }
    catch (e) { if (i === 99 || child.exitCode !== null) throw e; await delay(50); }
  }
  const nginxConfig = path.join(fixture, 'benchmark-nginx.conf');
  fs.writeFileSync(nginxConfig, `worker_processes 2;
pid /tmp/nginx.pid;
error_log stderr warn;
events { worker_connections 256; }
http {
  access_log off;
  client_body_temp_path /tmp/body;
  proxy_temp_path /tmp/proxy;
  fastcgi_temp_path /tmp/fastcgi;
  uwsgi_temp_path /tmp/uwsgi;
  scgi_temp_path /tmp/scgi;
  upstream lab { server 127.0.0.1:${originPort}; keepalive 16; }
  server {
    listen 127.0.0.1:${nginxPort} ssl;
    ssl_certificate ${fixture}/edge-a.pem;
    ssl_certificate_key ${fixture}/edge-a.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_tickets off;
    location / {
      proxy_pass https://lab;
      proxy_http_version 1.1;
      proxy_set_header Connection "";
      proxy_set_header Host lab-origin.test;
      proxy_ssl_server_name on;
      proxy_ssl_name lab-origin.test;
      proxy_ssl_verify on;
      proxy_ssl_trusted_certificate ${fixture}/ca.pem;
      proxy_connect_timeout 1s;
      proxy_read_timeout 2s;
      proxy_send_timeout 2s;
      proxy_request_buffering off;
      proxy_buffering off;
    }
  }
}
`);
  const nginx = execFileSync('docker', ['run', '--detach', '--rm', '--network', 'host', '--read-only',
    '--tmpfs', '/tmp:rw,nosuid,noexec,size=32m', '--user', `${process.getuid()}:${process.getgid()}`, '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges:true', '--mount', `type=bind,source=${fixture},target=${fixture},readonly`,
    '--entrypoint', 'nginx', reference, '-c', nginxConfig, '-g', 'daemon off;'], { encoding: 'utf8' }).trim();
  cleanup.push(async () => execFileSync('docker', ['stop', '--timeout', '2', nginx], { stdio: 'ignore' }));
  for (let i = 0; i < 40; i++) {
    try { assert.ok(await request(nginxPort, false)); break; }
    catch (e) { if (i === 39) throw e; await delay(100); }
  }
  const pids = (name) => execFileSync('docker', ['top', name, '-eo', 'pid'], { encoding: 'utf8' }).trim().split('\n').slice(1).map(Number);
  report.envoy = await bench(port, pids(`aegis-envoy-${child.pid}`), [child.pid]);
  report.nginx = await bench(nginxPort, pids(nginx));
  assert.equal(report.envoy.errors, 0); assert.equal(report.nginx.errors, 0);
  report.result = 'pass';
} catch (error) { report.result = 'fail'; report.error = error.message; process.exitCode = 1; }
finally {
  for (const close of cleanup.reverse()) { try { await close(); } catch {} }
  report.completed_at = new Date().toISOString();
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ result: report.result, error: report.error, output }));
}
