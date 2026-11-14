// Additive H2 lifecycle diagnostics; never a replacement for original75.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http2 from 'node:http2';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { assertLock, pki, listen, freePort } from './wire-fixtures.mjs';
import { createTlsObserver } from '../edge-comparison/tls-observer.mjs';
process.umask(0o077); assertLock();
const output = path.resolve(process.argv[2]);
assert.ok(!fs.existsSync(output));
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim(), '');
fs.mkdirSync(output, { recursive: true });
const record = { source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  started_at: new Date().toISOString(), node: process.version, argv: process.argv, tests: [],
  policy: process.env.AEGIS_SPRINT05A_C_POLICY ?? 'windows', scope: 'bounded loopback lifecycle; original gate remains separate' };
const save = () => fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(record, null, 2) + '\n');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-sprint05a-c-'));
const clients = new Set(); const sessions = new Set(); const sockets = new Set();
const captures = []; let handlers = []; let parserErrors = 0; let transportErrors = 0;
let child, observer, origin, material, log;
const bound = async (promise, ms = 5000) => {
  let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('deadline')), ms); })]); }
  finally { clearTimeout(timer); }
};
async function test(name, fn) {
  const before = captures.length;
  try { const detail = await fn(); record.tests.push({ name, status: 'pass', detail, raw_chunks: captures.slice(before) }); }
  catch (e) { record.tests.push({ name, status: 'fail', error: e.stack, raw_chunks: captures.slice(before) }); }
  save(); console.log(`${record.tests.at(-1).status} ${name}`);
}
try {
  material = pki(fixture); const ca = material.read('ca.pem');
  origin = http2.createSecureServer({ cert: material.read('origin.pem'), key: material.read('origin.key'), minVersion: 'TLSv1.2' });
  let connectionId = 0;
  origin.on('session', (s) => { s.proofId = ++connectionId; sessions.add(s); s.on('error', () => { parserErrors++; }); s.on('close', () => sessions.delete(s)); });
  origin.on('sessionError', () => { parserErrors++; });
  origin.on('stream', (s, headers) => {
    const id = s.session.proofId;
    handlers.push({ connection: id, stream: s.id, generation: headers['x-lab-generation'], route: headers['x-lab-route'] });
    s.on('error', () => {});
    const respond = () => { if (!s.destroyed) { s.respond({ ':status': 200, 'x-origin-connection': String(id), 'x-origin-generation': headers['x-lab-generation'] }); s.end('h2-origin'); } };
    if (headers[':path'] === '/slow') setTimeout(respond, 150); else respond();
  });
  const nativePort = await listen(origin);
  observer = createTlsObserver({ cert: material.read('origin.pem'), key: material.read('origin.key'), ca, port: nativePort,
    onBytes: () => {}, onTransportError: () => { transportErrors++; } });
  let relayId = 0;
  observer.on('secureConnection', (socket) => { const id = ++relayId; sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.on('data', (bytes) => captures.push({ connection: id, hex: bytes.toString('hex') })); });
  const originPort = await listen(observer); const edgePort = await freePort();
  const route = (host, name) => ({ host, h2: true, origin_port: originPort, origin_name: 'lab-origin.test', cert_file: material.file(`${name}.pem`), key_file: material.file(`${name}.key`) });
  let manifest = { generation: 1, ca_file: material.file('ca.pem'), routes: [route('edge-a.test', 'edge-a'), route('edge-b.test', 'edge-b')] };
  const file = material.file('manifest.json');
  const publish = (changes = {}) => { manifest = { ...manifest, ...changes, generation: manifest.generation + 1 }; fs.writeFileSync(`${file}.next`, JSON.stringify(manifest)); fs.renameSync(`${file}.next`, file); };
  fs.writeFileSync(file, JSON.stringify(manifest));
  log = fs.openSync(path.join(output, 'proxy.log'), 'wx');
  child = spawn(process.execPath, ['spikes/envoy/sprint05a-c-launcher.mjs', file, String(edgePort)], { stdio: ['ignore', log, log] });
  record.launcher_pid = child.pid;
  const connect = async (host = 'edge-b.test') => {
    const c = http2.connect(`https://127.0.0.1:${edgePort}`, { servername: host, ca, rejectUnauthorized: true, ALPNProtocols: ['h2'] });
    clients.add(c); c.on('error', () => {}); c.on('close', () => clients.delete(c));
    await bound(once(c, 'connect')); assert.equal(c.socket.authorized, true); c.proofHost = host; return c;
  };
  const ready = Date.now() + 15000;
  while (true) { try { const c = await connect(); c.destroy(); break; } catch { assert.ok(Date.now() < ready); await delay(50); } }
  const request = async (c, extra = {}) => {
    const s = c.request({ ':path': '/', ':authority': c.proofHost, ...extra }); let headers; const data = [];
    s.on('response', (h) => { headers = h; }); s.on('data', (b) => data.push(b)); s.end();
    await bound(once(s, 'end')); return { status: headers[':status'], connection: headers['x-origin-connection'], generation: headers['x-origin-generation'], body: Buffer.concat(data).toString() };
  };
  await test('cold-denials-no-origin-dial-or-bytes', async () => {
    const details = [];
    for (const extra of [{ host: 'edge-a.test' }, { ':authority': 'edge-a.test' }, { ':authority': 'user@edge-b.test' }]) {
      const before = { relays: relayId, chunks: captures.length, handlers: handlers.length };
      const c = await connect(); const r = await request(c, extra); c.destroy();
      assert.ok([400, 421].includes(r.status)); assert.equal(relayId, before.relays); assert.equal(captures.length, before.chunks); assert.equal(handlers.length, before.handlers);
      details.push({ extra, ...r });
    } return details;
  });
  let pooled;
  await test('valid-cold-warm-sequential-reuse', async () => {
    pooled = await connect(); const responses = [];
    for (let i = 0; i < 6; i++) responses.push(await request(pooled));
    assert.ok(responses.every((r) => r.status === 200 && r.body === 'h2-origin'));
    assert.equal(new Set(responses.map((r) => r.connection)).size, 1); return responses;
  });
  await test('concurrent-streams-share-valid-pool', async () => {
    const responses = await Promise.all(Array.from({ length: 8 }, () => request(pooled, { ':path': '/slow' })));
    assert.ok(responses.every((r) => r.status === 200)); assert.equal(new Set(responses.map((r) => r.connection)).size, 1); return responses;
  });
  await test('warm-denials-retain-all-origin-bytes', async () => {
    const details = [];
    for (const extra of [{ host: 'edge-a.test' }, { ':authority': 'edge-a.test' }, { ':authority': 'user@edge-b.test' }]) {
      const before = { chunks: captures.length, handlers: handlers.length };
      const c = await connect(); const response = await request(c, extra); c.destroy();
      const raw = captures.slice(before.chunks).map((x) => x.hex).join('');
      details.push({ extra, response, raw_hex: raw, handlers: handlers.length - before.handlers });
      assert.ok([400, 421].includes(response.status)); assert.equal(handlers.length, before.handlers);
    } return details;
  });
  await test('route-pools-partitioned', async () => {
    const a = await connect('edge-a.test'); const ar = await request(a); const br = await request(pooled);
    assert.notEqual(ar.connection, br.connection); a.destroy(); return { a: ar, b: br };
  });
  await test('generation-swap-retains-inflight-and-retires-pool', async () => {
    const pending = request(pooled, { ':path': '/slow' }); await delay(30); publish();
    const old = await pending; await delay(350); const next = await request(pooled);
    assert.equal(old.generation, '1'); assert.equal(next.generation, '2'); assert.notEqual(old.connection, next.connection); return { old, next };
  });
  await test('trust-retirement-cannot-reuse-old-pool', async () => {
    const old = await request(pooled); publish({ ca_file: material.file('untrusted.pem') }); await delay(350);
    const before = handlers.length; const rejected = await request(pooled);
    assert.equal(rejected.status, 503); assert.equal(handlers.length, before);
    publish({ ca_file: material.file('ca.pem') }); await delay(350); const restored = await request(pooled);
    assert.equal(restored.status, 200); assert.notEqual(old.connection, restored.connection); return { old, rejected, restored };
  });
  record.origin = { connections: connectionId, relays: relayId, handlers, parser_errors: parserErrors, transport_errors: transportErrors };
} catch (e) { record.error = e.stack; }
finally {
  assertLock(); for (const c of clients) c.destroy(); for (const s of sessions) s.destroy(); for (const s of sockets) s.destroy();
  if (child) {
    const container = `aegis-envoy-sprint05a-c-${child.pid}`;
    const stopped = spawnSync('docker', ['stop', '--timeout', '2', container], { encoding: 'utf8' });
    child.kill('SIGTERM'); if (child.exitCode === null) { try { await bound(once(child, 'exit')); } catch { child.kill('SIGKILL'); record.error ??= 'launcher cleanup deadline'; } }
    record.cleanup = { stop_exit: stopped.status, container_absent: !execFileSync('docker', ['ps', '-aq', '--filter', `name=^${container}$`], { encoding: 'utf8' }).trim(), lock_held: true };
  }
  observer?.closeAllConnections();
  for (const server of [observer, origin]) if (server?.listening) await bound(new Promise((resolve) => server.close(resolve)));
  if (log !== undefined) {
    fs.closeSync(log);
    const first = fs.readFileSync(path.join(output, 'proxy.log'), 'utf8').split('\n').find((l) => l.startsWith('{'));
    if (first) { const dir = path.dirname(JSON.parse(first).resources); assert.ok(dir.startsWith(path.resolve('.local/sprint05a-c-envoy-'))); fs.rmSync(dir, { recursive: true }); }
  }
  fs.rmSync(fixture, { recursive: true, force: true });
  record.cleanup = { ...record.cleanup, fixture_removed: !fs.existsSync(fixture) };
  record.ended_at = new Date().toISOString(); save();
  const hashes = fs.readdirSync(output).sort().map((file) => ({ file, sha256: createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex') }));
  fs.writeFileSync(path.join(output, 'SHA256.json'), JSON.stringify(hashes, null, 2) + '\n');
  if (record.error || record.tests.some((t) => t.status !== 'pass') || !record.cleanup.container_absent) process.exitCode = 1;
}
