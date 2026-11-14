// Additive causal diagnostic. Never a timing replacement for original75/23.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http2 from 'node:http2';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { assertLock, pki, listen, freePort } from './wire-fixtures.mjs';
import { createTlsObserver } from '../edge-comparison/tls-observer.mjs';
process.umask(0o077); assertLock();
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05b-b\/cause-[a-z0-9-]+$/);
assert.ok(!fs.existsSync(output)); fs.mkdirSync(output, { recursive: true });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const record = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  argv: process.argv, node: process.version, node_binary_sha256: sha(fs.readFileSync(process.execPath)),
  started_at: new Date().toISOString(), tests: [], commands: [], scope: 'additional causal fixture only; no oracle exemptions' };
fs.mkdirSync('.local', { recursive: true }); const initial = new Set(fs.readdirSync('.local'));
const fixture = fs.mkdtempSync(path.resolve('.local/sprint05b-b-cause-'));
const save = () => fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(record, null, 2) + '\n');
const clients = new Set(), sessions = new Set(); let origin, relay, child, log;
let bytes = 0, handlers = 0, accepts = 0, sessionId = 0, peer, initialAck;
const chunks = [];
async function bound(promise, ms = 5000) {
  let timer; try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error('bounded diagnostic deadline')), ms);
  })]); } finally { clearTimeout(timer); }
}
async function test(name, fn) {
  try { const detail = await fn(); record.tests.push({ name, status: 'pass', detail }); }
  catch (error) { record.tests.push({ name, status: 'fail', error: error.stack }); }
  console.log(`${record.tests.at(-1).status.toUpperCase()} ${name}`); save();
}
try {
  const material = pki(fixture), ca = material.read('ca.pem');
  origin = http2.createSecureServer({ cert: material.read('origin.pem'), key: material.read('origin.key'), minVersion: 'TLSv1.2' });
  origin.on('session', (s) => {
    s.proofId = ++sessionId; sessions.add(s); peer = s;
    initialAck = once(s, 'localSettings');
    s.on('error', () => {}); s.on('close', () => sessions.delete(s));
  });
  origin.on('stream', (s) => {
    handlers++; s.on('error', () => {});
    s.respond({ ':status': 200, 'x-origin-connection': String(s.session.proofId) }); s.end('h2-origin');
  });
  relay = createTlsObserver({ cert: material.read('origin.pem'), key: material.read('origin.key'), ca,
    port: await listen(origin), onBytes: (n) => { bytes += n; } });
  relay.on('connection', () => { accepts++; });
  relay.on('secureConnection', (s) => s.on('data', (b) => {
    assert.ok(chunks.length < 1024 && bytes <= 1048576); chunks.push(b.toString('hex'));
  }));
  const originPort = await listen(relay), edgePort = await freePort();
  const route = (host, name) => ({ host, h2: true, origin_port: originPort, origin_name: 'lab-origin.test',
    cert_file: material.file(`${name}.pem`), key_file: material.file(`${name}.key`) });
  const manifest = material.file('manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({ generation: 1, ca_file: material.file('ca.pem'),
    routes: [route('edge-a.test', 'edge-a'), route('edge-b.test', 'edge-b')] }));
  const environment = { AEGIS_05A_D_POLICY: 'stream-errors',
    NODE_OPTIONS: `--import=${path.resolve('spikes/envoy/sprint05a-combined-select.mjs')}` };
  record.environment = environment;
  log = fs.openSync(`${output}/proxy.log`, 'wx');
  const args = ['spikes/envoy/sprint05a-a-launcher.mjs', manifest, String(edgePort)];
  child = spawn(process.execPath, args, { env: { ...process.env, ...environment }, stdio: ['ignore', log, log] });
  record.commands.push({ program: process.execPath, args, environment });
  const connect = async () => {
    const c = http2.connect(`https://127.0.0.1:${edgePort}`, { servername: 'edge-b.test', ca,
      rejectUnauthorized: true, ALPNProtocols: ['h2'] });
    clients.add(c); c.on('error', () => {}); c.on('close', () => clients.delete(c));
    await bound(once(c, 'connect')); assert.equal(c.socket.authorized, true); return c;
  };
  const request = async (c, extra = {}) => {
    const s = c.request({ ':path': '/', ':authority': 'edge-b.test', ...extra });
    let headers; const data = []; s.on('response', (h) => { headers = h; }); s.on('data', (b) => data.push(b)); s.end();
    await bound(once(s, 'end')); return { status: headers?.[':status'], connection: headers?.['x-origin-connection'], body: Buffer.concat(data).toString() };
  };
  const deadline = Date.now() + 15000;
  while (true) { try { const c = await connect(); c.destroy(); break; } catch { assert.ok(Date.now() < deadline); await delay(50); } }
  await test('cold-host-denial-no-origin-accept-bytes-handler', async () => {
    const c = await connect(); const r = await request(c, { host: 'edge-a.test' }); c.destroy();
    assert.equal(r.status, 421); assert.equal(accepts, 0); assert.equal(bytes, 0); assert.equal(handlers, 0); return r;
  });
  const c = await connect();
  await test('valid-sequential-and-concurrent-h2-pool-reuse', async () => {
    const rows = [await request(c), await request(c), ...await Promise.all(Array.from({ length: 4 }, () => request(c)))];
    assert.ok(rows.every((r) => r.status === 200 && r.body === 'h2-origin'));
    assert.equal(new Set(rows.map((r) => r.connection)).size, 1); await bound(initialAck);
    return { responses: rows, accepts, handlers, initial_settings_ack_received: true };
  });
  await test('idle-origin-settings-alone-cause-exact-nine-byte-ack', async () => {
    const before = { bytes, handlers, accepts, chunks: chunks.length };
    const started_ns = process.hrtime.bigint().toString();
    await bound(new Promise((resolve, reject) => peer.settings({ maxConcurrentStreams: 31 }, (error) => error ? reject(error) : resolve())));
    const raw = chunks.slice(before.chunks).join('');
    assert.equal(raw, '000000040100000000'); assert.equal(bytes - before.bytes, 9);
    assert.equal(handlers, before.handlers); assert.equal(accepts, before.accepts);
    return { started_ns, ended_ns: process.hrtime.bigint().toString(), raw_hex: raw,
      origin_bytes: bytes - before.bytes, handlers: handlers - before.handlers, accepts: accepts - before.accepts,
      downstream_requests_during_interval: 0, peer_setting: { maxConcurrentStreams: 31 } };
  });
  await test('same-h2-pool-usable-after-peer-settings-ack', async () => {
    const r = await request(c); assert.equal(r.status, 200); assert.equal(r.connection, '1'); return r;
  });
} catch (error) { record.error = error.stack; }
finally {
  assertLock(); for (const c of clients) c.destroy(); for (const s of sessions) s.destroy(); relay?.closeAllConnections();
  if (child) {
    const container = `aegis-sprint05a-a-${child.pid}`;
    const r = spawnSync('docker', ['rm', '-f', container], { timeout: 15000 });
    record.commands.push({ program: 'docker', args: ['rm', '-f', container], exit_code: r.status,
      stdout: r.stdout?.toString(), stderr: r.stderr?.toString() }); child.kill('SIGTERM');
    if (child.exitCode === null) { try { await bound(once(child, 'exit')); } catch { child.kill('SIGKILL'); record.error ??= 'launcher cleanup deadline'; } }
    record.launcher_exit = child.exitCode;
    record.container_absent = spawnSync('docker', ['inspect', container], { stdio: 'ignore', timeout: 15000 }).status === 1;
  }
  for (const server of [relay, origin]) if (server?.listening) await bound(new Promise((resolve) => server.close(resolve)));
  if (log !== undefined) fs.closeSync(log);
  for (const entry of fs.readdirSync('.local')) if (!initial.has(entry) && /^(sprint05b-b-cause-|sprint05a-a-envoy-)/.test(entry)) fs.rmSync(`.local/${entry}`, { recursive: true });
  record.fixture_removed = !fs.existsSync(fixture); record.lock_held_through_cleanup = true;
  record.exit_code = record.error || record.tests.length !== 4 || record.tests.some((t) => t.status !== 'pass') || !record.container_absent ? 1 : 0;
  record.ended_at = new Date().toISOString(); save();
  fs.writeFileSync(`${output}/SHA256.json`, JSON.stringify(fs.readdirSync(output).sort()
    .map((file) => ({ file, sha256: sha(fs.readFileSync(`${output}/${file}`)) })), null, 2) + '\n');
  process.exitCode = record.exit_code;
}
