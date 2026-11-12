// Bounded local diagnostics, not production HTTP framing or admission code.
import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import http2 from 'node:http2';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createTlsObserver, decoder, frame } from './wire-observer.mjs';
import { assertLock, pki, listen, freePort, until } from './wire-fixtures.mjs';

process.umask(0o077); assertLock();
const [output, fixtureDir] = process.argv.slice(2);
assert.ok(path.isAbsolute(output) && path.isAbsolute(fixtureDir));
assert.ok(!fs.existsSync(output));
const result = { started_at: new Date().toISOString(), tests: [], failures: [] };
const sockets = new Set(); const sessions = new Set(); const servers = [];
const handlers = []; let parserErrors = 0; let transportErrors = 0;
let child; let childExit; let log; let observer; let port;
const material = pki(fixtureDir);
const ca = material.read('ca.pem');
async function bounded(promise, ms = 3500) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('explicit operation deadline')), ms); })]); }
  finally { clearTimeout(timer); }
}
const preface = Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n');
const literal = (name, value) => Buffer.concat([Buffer.from([0, name.length]), Buffer.from(name), Buffer.from([value.length]), Buffer.from(value)]);
const headers = (target = '/') => Buffer.concat([Buffer.from([0x82, 0x87, 0x04, target.length]), Buffer.from(target), literal(':authority', 'edge-b.test')]);
const snapshot = () => ({ connections: observer.wireSnapshot().connections.length,
  bytes: observer.wireSnapshot().connections.reduce((n, c) => n + c.bytes, 0), handlers: handlers.length,
  parser_errors: parserErrors, transport_errors: transportErrors, events: observer.wireSnapshot().events.length });
const difference = (before) => Object.fromEntries(Object.entries(snapshot()).map(([key, n]) => [key, n - before[key]]));
async function probe(name, fn) {
  const before = observer ? snapshot() : undefined; const started_at = new Date().toISOString();
  try { result.tests.push({ name, started_at, ...(await fn()), status: 'pass', ...(before ? { origin: difference(before) } : {}) }); }
  catch (error) { result.tests.push({ name, started_at, status: 'fail', error: error.stack,
    ...(before ? { origin: difference(before) } : {}) }); result.failures.push(name); }
  console.log(`${name}: ${result.tests.at(-1).status}`);
  fs.writeFileSync(`${output}.progress.json`, JSON.stringify(result, null, 2) + '\n');
}
function own(socket) {
  sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
  return socket;
}
async function connect(alpn = 'h2') {
  const socket = own(tls.connect({ host: '127.0.0.1', port, servername: alpn === 'h2' ? 'edge-b.test' : 'edge-a.test',
    ca, rejectUnauthorized: true, ALPNProtocols: [alpn], minVersion: 'TLSv1.2' }));
  socket.setTimeout(4500, () => socket.destroy()); await bounded(once(socket, 'secureConnect'));
  assert.equal(socket.alpnProtocol, alpn); return socket;
}
async function client() {
  const session = http2.connect(`https://127.0.0.1:${port}`, { servername: 'edge-b.test', ca, rejectUnauthorized: true });
  sessions.add(session); session.on('error', () => {}); session.on('close', () => sessions.delete(session));
  session.setTimeout(4500, () => session.destroy()); await bounded(once(session, 'connect')); return session;
}
async function request(session, extra = {}, target = '/') {
  const stream = session.request({ ':method': 'GET', ':path': target, ':authority': 'edge-b.test', ...extra });
  stream.on('error', () => {}); stream.setTimeout(3000, () => stream.destroy(new Error('request deadline')));
  const response = once(stream, 'response'); const ended = once(stream, 'end'); const chunks = [];
  stream.on('data', (c) => chunks.push(c)); stream.end();
  try { const [[h]] = await bounded(Promise.all([response, ended])); return { status: h[':status'], body: Buffer.concat(chunks).toString() }; }
  finally { stream.destroy(); }
}
async function raw(bytes, expectedCode) {
  const socket = await connect(); const frames = []; let terminal = false;
  const consume = decoder({ emit: (event) => {
    frames.push(event);
    if (event.kind === 'frame' && [3, 7].includes(event.type)) terminal = true;
  } });
  socket.on('data', consume);
  socket.write(Buffer.concat([preface, frame(4, 0, 0), bytes]));
  try {
    await until(() => terminal || socket.destroyed, 3000);
    const errors = frames.filter((f) => f.kind === 'frame' && [3, 7].includes(f.type)).map((f) => ({
      ...f, code: f.error_code }));
    assert.ok(errors.length, 'no protocol error frame');
    if (expectedCode !== undefined) assert.ok(errors.some((e) => e.code === expectedCode), JSON.stringify(errors));
    return errors;
  } finally { socket.destroy(); }
}

try {
  const origin = http2.createSecureServer({ cert: material.read('origin.pem'), key: material.read('origin.key'), minVersion: 'TLSv1.2' });
  servers.push(origin);
  origin.on('session', (session) => { sessions.add(session); session.on('error', () => { parserErrors++; }); session.on('close', () => sessions.delete(session)); });
  origin.on('sessionError', () => { parserErrors++; }); origin.on('tlsClientError', () => { transportErrors++; });
  origin.on('stream', (stream, h) => {
    const sample = { id: stream.id, path: h[':path'], authority: h[':authority'], sni: stream.session.socket.servername,
      alpn: stream.session.socket.alpnProtocol, tls: stream.session.socket.getProtocol(), produced: 0, pauses: 0, received: 0, closed: false };
    handlers.push(sample); stream.on('error', () => {});
    stream.on('close', () => { sample.closed = true; sample.rst_code = stream.rstCode; });
    stream.on('data', (bytes) => { sample.received += bytes.length; });
    if (h[':path'] === '/hold') return;
    if (h[':path'] === '/upload') { stream.on('end', () => { if (!stream.destroyed) { stream.respond({ ':status': 200 }); stream.end('done'); } }); return; }
    stream.respond({ ':status': 200 });
    if (h[':path'] === '/large') {
      const chunk = Buffer.alloc(16384, 0x61); const total = 8 * 1024 * 1024;
      const pump = () => {
        while (!stream.destroyed && sample.produced < total) {
          sample.produced += chunk.length;
          if (!stream.write(chunk)) { sample.pauses++; stream.once('drain', pump); return; }
        }
        if (!stream.destroyed) stream.end();
      }; pump();
    } else stream.end(h[':path']);
  });
  const nativePort = await listen(origin);
  observer = createTlsObserver({ cert: material.read('origin.pem'), key: material.read('origin.key'), ca, port: nativePort,
    onBytes: () => {}, onTransportError: () => { transportErrors++; } });
  servers.push(observer); const originPort = await listen(observer); port = await freePort();
  const manifest = { generation: 1, ca_file: material.file('ca.pem'), routes: ['edge-a', 'edge-b'].map((name) => ({
    host: `${name}.test`, origin_name: 'lab-origin.test', origin_port: originPort,
    cert_file: material.file(`${name}.pem`), key_file: material.file(`${name}.key`), h2: true })) };
  const manifestPath = material.file('manifest.json'); fs.writeFileSync(manifestPath, JSON.stringify(manifest), { mode: 0o600 });
  log = fs.openSync(`${output}.proxy.log`, 'wx', 0o600);
  child = spawn(process.execPath, ['spikes/envoy/recovery-launcher.mjs', manifestPath, String(port)], { stdio: ['ignore', log, log] });
  childExit = once(child, 'exit');
  let ready = false;
  for (let i = 0; i < 80; i++) { try { const s = await connect(); s.destroy(); ready = true; break; } catch { await delay(50); } }
  assert.ok(ready, 'owned listener readiness');

  await probe('cold-Host-authority-denial-zero-byte', async () => {
    const before = snapshot(); const session = await client();
    try { assert.ok([400, 421].includes((await request(session, { host: 'edge-a.test' })).status)); await delay(100); }
    finally { session.destroy(); }
    const delta = difference(before); assert.equal(delta.bytes, 0); assert.equal(delta.handlers, 0); return delta;
  });
  await probe('warm-valid-then-Host-denial-observation', async () => {
    const session = await client();
    try {
      assert.equal((await request(session, {}, '/encoded%2Fcontrol?x=%2520')).status, 200);
      const before = snapshot(); const denied = await request(session, { host: 'edge-a.test' });
      const delta = difference(before); const events = observer.wireSnapshot().events.slice(before.events);
      assert.ok([400, 421].includes(denied.status)); assert.equal(delta.handlers, 0);
      return { status_code: denied.status, rejection_interval: delta, frames: events.filter((e) => e.kind === 'frame'),
        zero_byte_contract: delta.bytes === 0 ? 'pass for this interval' : 'FAIL: nonzero bytes; classification does not waive contract' };
    } finally { session.destroy(); }
  });
  await probe('settled-reuse-identity-and-three-authority-negatives', async () => {
    const session = await client(); const observations = [];
    try {
      for (const target of ['/bad%20target', '/encoded%2Fsegment?value=%2520']) assert.equal((await request(session, {}, target)).body, target);
      await delay(150);
      for (const extra of [{ host: 'edge-a.test' }, { ':authority': 'edge-a.test' }, { ':authority': 'user@edge-b.test' }]) {
        // Reopen after each denial because the policy drains the downstream connection.
        const c = await client(); const before = snapshot();
        try { const response = await request(c, extra); assert.ok([400, 421].includes(response.status));
          await delay(50); const delta = difference(before); assert.equal(delta.handlers, 0);
          observations.push({ headers: extra, status: response.status, origin: delta }); }
        finally { c.destroy(); }
      }
      for (const h of handlers) { assert.equal(h.authority, 'lab-origin.test'); assert.equal(h.sni, 'lab-origin.test'); assert.equal(h.alpn, 'h2'); }
      return { observations, identities: handlers.map(({ path, authority, sni, alpn, tls }) => ({ path, authority, sni, alpn, tls })) };
    } finally { session.destroy(); }
  });
  for (const [name, bytes, expected] of [
    ['SETTINGS-ACK-payload', frame(4, 1, 0, Buffer.alloc(6)), 6],
    ['PING-seven-bytes', frame(6, 0, 0, Buffer.alloc(7)), 6],
    ['DATA-stream-zero', frame(0, 0, 0), 1],
    ['HEADERS-stream-zero', frame(1, 5, 0, headers()), 1],
    ['unexpected-CONTINUATION', frame(9, 4, 1), 1],
    ['zero-WINDOW_UPDATE', frame(8, 0, 0, Buffer.alloc(4)), 1],
    ['invalid-HPACK-index-zero', frame(1, 5, 1, Buffer.from([0x80])), 9],
    ['uppercase-header-name', frame(1, 5, 1, Buffer.concat([headers(), literal('X-Lab', 'x')])), undefined],
    ['connection-specific-header', frame(1, 5, 1, Buffer.concat([headers(), literal('connection', 'close')])), undefined],
  ]) await probe(`raw-H2-${name}`, async () => {
    const before = snapshot(); const errors = await raw(bytes, expected); await delay(30);
    const delta = difference(before); assert.equal(delta.bytes, 0); assert.equal(delta.handlers, 0);
    return { error_frames: errors, sent_sha256_note: 'exact bytes generated by committed source' };
  });
  await probe('slow-reader-backpressure-and-response-cancellation', async () => {
    const session = await client(); const stream = session.request({ ':path': '/large', ':authority': 'edge-b.test' });
    stream.on('error', () => {}); stream.end(); await bounded(once(stream, 'response')); stream.pause();
    await until(() => handlers.some((h) => h.path === '/large'));
    const sample = handlers.findLast((h) => h.path === '/large'); await delay(200);
    const paused = { produced: sample.produced, pauses: sample.pauses };
    assert.ok(paused.produced < 8 * 1024 * 1024); assert.ok(paused.pauses > 0);
    const started = Date.now(); stream.close(http2.constants.NGHTTP2_CANCEL);
    await until(() => sample.closed, 2500); session.destroy();
    return { response_limit_bytes: 8 * 1024 * 1024, paused_after_ms: 200, ...paused,
      origin_cancel_ms: Date.now() - started, origin_rst_code: sample.rst_code };
  });
  await probe('partial-upload-cancellation', async () => {
    const session = await client(); const stream = session.request({ ':method': 'POST', ':path': '/upload', ':authority': 'edge-b.test' });
    stream.on('error', () => {}); stream.write(Buffer.alloc(16384));
    await until(() => handlers.some((h) => h.path === '/upload' && h.received > 0));
    const sample = handlers.findLast((h) => h.path === '/upload'); const start = Date.now();
    stream.close(http2.constants.NGHTTP2_CANCEL); await until(() => sample.closed, 2500); session.destroy();
    return { origin_received: sample.received, origin_cancel_ms: Date.now() - start, origin_rst_code: sample.rst_code };
  });
  await probe('raw-65-concurrent-stream-cap', async () => {
    const socket = await connect(); const received = []; socket.on('data', decoder({ emit: (e) => received.push(e) }));
    const before = handlers.length;
    socket.write(Buffer.concat([preface, frame(4, 0, 0), ...Array.from({ length: 65 }, (_, i) => frame(1, 5, 1 + 2 * i, headers('/hold')))]));
    await delay(200);
    const accepted = handlers.length - before;
    assert.ok(accepted <= 64); assert.ok(accepted > 0);
    assert.ok(received.some((e) => e.kind === 'frame' && [3, 7].includes(e.type)), 'excess stream had no refusal');
    socket.destroy(); await until(() => handlers.slice(before).every((h) => h.closed));
    return { attempted: 65, origin_handlers: accepted, refusal_frames: received.filter((e) => [3, 7].includes(e.type)) };
  });
  await probe('eight-partial-header-timeouts', async () => {
    const before = snapshot(); const held = await Promise.all(Array.from({ length: 8 }, () => connect('http/1.1')));
    const start = Date.now();
    for (const s of held) { s.on('data', () => {}); s.write('GET / HTTP/1.1\r\nHost: edge-a.test\r\nX-Partial:'); }
    await until(() => held.every((s) => s.destroyed), 4200);
    assert.equal(difference(before).bytes, 0); assert.equal(difference(before).handlers, 0);
    return { connections: held.length, elapsed_ms: Date.now() - start };
  });
  await probe('270-connection-admission-cap', async () => {
    const before = snapshot(); const opened = [];
    const outcomes = await Promise.all(Array.from({ length: 270 }, async () => {
      try { const s = await connect('http/1.1'); opened.push(s); return 'admitted'; } catch { return 'refused'; }
    }));
    const admitted = outcomes.filter((s) => s === 'admitted').length;
    for (const s of opened) s.destroy();
    assert.ok(admitted <= 256); assert.ok(admitted >= 240, `only ${admitted} admitted`); assert.ok(admitted < outcomes.length);
    assert.equal(difference(before).bytes, 0); assert.equal(difference(before).handlers, 0);
    return { attempted: outcomes.length, admitted, refused: outcomes.length - admitted, configured_cap: 256 };
  });
  await probe('32-partial-header-connections-termination-drain', async () => {
    await delay(100);
    const before = snapshot(); const held = await Promise.all(Array.from({ length: 32 }, () => connect('http/1.1')));
    for (const s of held) { s.on('data', () => {}); s.write('G'); }
    const start = Date.now(); child.kill('SIGTERM');
    await until(() => held.every((s) => s.destroyed) && child.exitCode !== null, 6000);
    assert.equal(difference(before).bytes, 0); assert.equal(difference(before).handlers, 0);
    return { connections: held.length, elapsed_ms: Date.now() - start, child_exit: child.exitCode };
  });
} catch (error) { result.fatal = error.stack; process.exitCode = 1; }
finally {
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await childExit; }
  for (const session of sessions) session.destroy();
  for (const socket of sockets) socket.destroy();
  for (const server of servers.reverse()) { server.closeAllConnections?.(); if (server.listening) await new Promise((resolve) => server.close(resolve)); }
  if (log !== undefined) fs.closeSync(log);
  result.origin = { handlers, parser_errors: parserErrors, transport_errors: transportErrors, wire: observer?.wireSnapshot() };
  result.completed_at = new Date().toISOString();
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  if (result.failures.length) process.exitCode = 1;
}
