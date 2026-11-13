import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import https from 'node:https';
import http2 from 'node:http2';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { frame } from './wire-observer.mjs';
import { observedOrigin, traceFrames, identity } from './sprint04b-observer.mjs';
import { assertLock, pki, listen, freePort, until } from './wire-fixtures.mjs';

const require = createRequire(new URL('../pingora/package.json', import.meta.url));
const { WebSocket, WebSocketServer } = require('ws'); const grpc = require('@grpc/grpc-js');
process.umask(0o077); assertLock();
const [output, fixture] = process.argv.slice(2); assert.ok(path.isAbsolute(output) && path.isAbsolute(fixture));
assert.ok(!fs.existsSync(output));
const result = { started_at: new Date().toISOString(), tests: [], semantic_security_pass: false,
  limits: { downstream_cases: 24, response_max_bytes: 32 * 1024 * 1024, per_operation_ms: 4000,
    origin_connections: 16, trace_control_events_per_direction: 256, container_memory_bytes: 268435456 } };
const material = pki(fixture); const ca = material.read('ca.pem');
const servers = []; const sockets = new Set(); const sessions = new Set(); const handlers = [];
let child; let observer; let port; let log; let parserErrors = 0; let transportErrors = 0; let nativeId = 0;
const nativeIds = new WeakMap();
const unavailableNativeTrace = { available: false,
  reason: 'Node native HTTP2 consumes TLSSocket internally; JavaScript data tap is not a wire observer. Use separate raw-client and origin relay evidence.' };
const preface = Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n');
const literal = (n, v) => Buffer.concat([Buffer.from([0, n.length]), Buffer.from(n), Buffer.from([v.length]), Buffer.from(v)]);
const headerBlock = (authority = 'edge-b.test', target = '/') => Buffer.concat([
  Buffer.from([0x82, 0x87, 0x04, target.length]), Buffer.from(target), literal(':authority', authority)]);
async function bound(promise, ms = 4000) {
  let timer; try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`local deadline ${ms}ms`)), ms);
  })]); } finally { clearTimeout(timer); }
}
function own(s) { sockets.add(s); s.on('error', () => {}); s.on('close', () => sockets.delete(s)); return s; }
const originCounts = () => ({ connections: observer.snapshot().records.length, bytes: observer.snapshot().bytes,
  headers: observer.snapshot().headers, data_bytes: observer.snapshot().data_bytes, handlers: handlers.length,
  parser_errors: parserErrors, transport_errors: transportErrors });
const delta = (before) => Object.fromEntries(Object.entries(originCounts()).map(([k, n]) => [k, n - before[k]]));
async function probe(name, run) {
  const start = performance.now(); const before = originCounts();
  try { result.tests.push({ name, ...(await run()), status: 'observation-complete', elapsed_ms: performance.now() - start, origin: delta(before) }); }
  catch (e) { result.tests.push({ name, status: 'failed', error: e.stack, elapsed_ms: performance.now() - start, origin: delta(before) }); process.exitCode = 1; }
  fs.writeFileSync(`${output}.progress.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(`${name}: ${result.tests.at(-1).status}`);
}
async function connect() {
  const s = own(tls.connect({ host: '127.0.0.1', port, servername: 'edge-b.test', ca,
    rejectUnauthorized: true, ALPNProtocols: ['h2'], minVersion: 'TLSv1.2' }));
  await bound(once(s, 'secureConnect')); assert.equal(s.alpnProtocol, 'h2'); return s;
}
async function nativeClient() {
  const s = await connect();
  const c = http2.connect(`https://127.0.0.1:${port}`, { createConnection: () => s });
  sessions.add(c); c.on('error', () => {}); c.on('close', () => sessions.delete(c));
  await bound(once(c, 'connect')); return { c, socket: s, tls: identity(s) };
}
async function rawCase(bytes, settled) {
  const s = await connect(); const ident = identity(s); const trace = traceFrames(); const lifecycle = []; const started = performance.now();
  let local = false; let ended = false;
  s.on('data', trace.consume);
  for (const event of ['end', 'close', 'error']) s.on(event, (e) => {
    if (event === 'close') ended = true;
    lifecycle.push({ event, ms: performance.now() - started, local_cleanup_started: local, code: e?.code });
  });
  const setup = Buffer.concat([preface, frame(4, 0, 0)]);
  try {
    if (settled) {
      s.write(setup); await until(() => trace.result.events.some((e) => e.kind === 'frame' && e.type === 4 && e.flags === 0));
      s.write(frame(4, 1, 0));
    }
    const sendMs = performance.now() - started;
    s.write(settled ? bytes : Buffer.concat([setup, bytes]));
    await until(() => ended || trace.result.events.some((e) => [3, 7].includes(e.type)), 3500);
    await delay(25);
    return { mode: settled ? 'after-server-SETTINGS-and-client-ACK' : 'coalesced-with-preface', tls: ident,
      sent_hex: Buffer.concat([setup, ...(settled ? [frame(4, 1, 0)] : []), bytes]).toString('hex'),
      malformed_sent_ms: sendMs, lifecycle, received: trace.result, peer_closed: ended,
      error_frame_observed: trace.result.events.some((e) => [3, 7].includes(e.type)), local_deadline_ms: 3500 };
  } finally { local = true; s.destroy(); }
}
function resource() {
  const name = `aegis-envoy-${child.pid}`;
  const pid = Number(execFileSync('docker', ['inspect', '--format', '{{.State.Pid}}', name], { encoding: 'utf8', timeout: 1000 }).trim());
  const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
  return { ms: performance.now(), envoy_pid: pid, rss_kib: Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1]),
    observer_process: process.memoryUsage() };
}

try {
  const origin = http2.createSecureServer({ cert: material.read('origin.pem'), key: material.read('origin.key'), minVersion: 'TLSv1.2' });
  servers.push(origin);
  origin.on('session', (s) => { nativeIds.set(s, ++nativeId); sessions.add(s); s.on('error', () => { parserErrors++; }); s.on('close', () => sessions.delete(s)); });
  origin.on('sessionError', () => { parserErrors++; }); origin.on('tlsClientError', () => { transportErrors++; });
  origin.on('stream', (s, h) => {
    const row = { id: s.id, connection: nativeIds.get(s.session), path: h[':path'], authority: h[':authority'],
      tls: identity(s.session.socket), produced: 0, received: 0, pauses: 0, closed: false, started_ms: performance.now() };
    handlers.push(row); s.on('error', () => {}); s.on('data', (b) => { row.received += b.length; });
    s.on('close', () => { row.closed = true; row.closed_ms = performance.now(); row.rst_code = s.rstCode; });
    if (h[':path'] === '/upload') return;
    s.respond({ ':status': 200 });
    if (h[':path'].startsWith('/large')) {
      const cap = h[':path'] === '/large8' ? 8 * 1024 * 1024 : 32 * 1024 * 1024;
      const chunk = Buffer.alloc(16384, 97);
      const pump = () => {
        while (!s.destroyed && row.produced < cap) {
          row.produced += chunk.length;
          if (!s.write(chunk)) { row.pauses++; row.writable_length = s.writableLength; s.once('drain', pump); return; }
        }
        if (!s.destroyed) s.end();
      }; pump();
    } else s.end(h[':path']);
  });
  const nativePort = await listen(origin);
  observer = observedOrigin({ cert: material.read('origin.pem'), key: material.read('origin.key'), ca, port: nativePort });
  servers.push(observer); const originPort = await listen(observer);

  const wsOrigin = https.createServer({ cert: material.read('origin.pem'), key: material.read('origin.key'), minVersion: 'TLSv1.2' });
  const wss = new WebSocketServer({ server: wsOrigin }); servers.push(wsOrigin);
  wss.on('connection', (ws, req) => {
    result.websocket_origin = { tls: identity(req.socket), host: req.headers.host, path: req.url, messages: [], close: null };
    ws.on('message', (b) => { result.websocket_origin.messages.push(b.toString()); ws.send(b); });
    ws.on('close', (code) => { result.websocket_origin.close = code; });
  });
  const wsPort = await listen(wsOrigin);
  port = await freePort();
  const manifest = { generation: 1, ca_file: material.file('ca.pem'), routes: [
    { host: 'edge-a.test', origin_port: wsPort, h2: false }, { host: 'edge-b.test', origin_port: originPort, h2: true },
  ].map((r) => ({ ...r, origin_name: 'lab-origin.test', cert_file: material.file(`${r.host.split('.')[0]}.pem`), key_file: material.file(`${r.host.split('.')[0]}.key`) })) };
  const manifestFile = material.file('manifest.json'); fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  log = fs.openSync(`${output}.proxy.log`, 'wx', 0o600);
  child = spawn(process.execPath, ['spikes/envoy/recovery-launcher.mjs', manifestFile, String(port)], { stdio: ['ignore', log, log] });
  for (let i = 0; i < 100; i++) { try { (await connect()).destroy(); break; } catch { if (i === 99) throw new Error('listener not ready'); await delay(50); } }

  for (const [name, bytes] of [
    ['HEADERS-stream-zero', frame(1, 5, 0, headerBlock())], ['zero-WINDOW_UPDATE', frame(8, 0, 0, Buffer.alloc(4))],
    ['uppercase-header-name', frame(1, 5, 1, Buffer.concat([headerBlock(), literal('X-Lab', 'x')]))],
    ['connection-specific-header', frame(1, 5, 1, Buffer.concat([headerBlock(), literal('connection', 'close')]))],
  ]) for (const settled of [false, true]) await probe(`${name}-${settled ? 'settled' : 'immediate'}`, async () => {
    const observed = await rawCase(bytes, settled);
    return { ...observed, historical_error_frame_expectation: observed.error_frame_observed ? 'observed; historical results unchanged' : 'FAIL retained' };
  });

  for (const combined of [true, false]) await probe(`userinfo-native-${combined ? 'after-Host-and-authority-controls' : 'independent'}`, async () => {
    const observations = [];
    for (const extra of combined ? [{ host: 'edge-a.test' }, { ':authority': 'edge-a.test' }, { ':authority': 'user@edge-b.test' }] : [{ ':authority': 'user@edge-b.test' }]) {
      const { c, socket, tls: ident } = await nativeClient(); const events = []; const started = performance.now(); let local = false;
      c.on('goaway', (code, last) => events.push({ event: 'session-goaway', code, last, ms: performance.now() - started }));
      c.on('error', (e) => events.push({ event: 'session-error', code: e.code, ms: performance.now() - started }));
      c.on('close', () => events.push({ event: 'session-close', local_cleanup_started: local, ms: performance.now() - started }));
      for (const event of ['end', 'close']) socket.on(event, () => events.push({ event: `socket-${event}`, local_cleanup_started: local, ms: performance.now() - started }));
      const s = c.request({ ':method': 'GET', ':path': '/', ':authority': 'edge-b.test', ...extra }); s.on('error', () => {});
      for (const event of ['response', 'end', 'close', 'aborted', 'error']) s.on(event, (v) => events.push({ event,
        ms: performance.now() - started, local_cleanup_started: local, status: v?.[':status'], code: v?.code, rst_code: s.rstCode }));
      s.resume(); s.end();
      await delay(3200);
      observations.push({ headers: extra, tls: ident, events, received_wire_trace: unavailableNativeTrace,
        stream_closed_before_local_cleanup: s.closed, rst_code_before_local_cleanup: s.rstCode, observation_ms: 3200,
        historical_response_and_end_expectation: events.some((e) => e.event === 'response') && events.some((e) => e.event === 'end') ? 'observed' : 'FAIL retained' });
      local = true; s.destroy(); c.destroy();
    }
    return { observations };
  });
  await probe('userinfo-raw-settled', () => rawCase(frame(1, 5, 1, headerBlock('user@edge-b.test')), true));

  for (const target of ['/large8', '/large32']) await probe(`paused-native-reader-${target.slice(1)}`, async () => {
    const { c, tls: ident } = await nativeClient(); const s = c.request({ ':path': target, ':authority': 'edge-b.test' });
    s.on('error', () => {}); s.end(); await bound(once(s, 'response')); s.pause();
    await until(() => handlers.some((r) => r.path === target)); const row = handlers.findLast((r) => r.path === target);
    const samples = [];
    for (const ms of [0, 200, 500]) {
      if (ms) await delay(ms === 200 ? 200 : 300);
      samples.push({ after_ms: ms, produced: row.produced, pauses: row.pauses, origin_last_backpressure_writable_length: row.writable_length,
        client_readable_length: s.readableLength, stream_state: s.state, session_state: c.state,
        received_wire_trace: unavailableNativeTrace, origin_wire_at_sample: observer.snapshot(), origin_closed: row.closed, resources: resource() });
    }
    const closedBeforeCancel = row.closed;
    const cancel = performance.now(); s.close(http2.constants.NGHTTP2_CANCEL); await until(() => row.closed, 2500);
    c.destroy();
    return { tls: ident, samples, origin_closed_before_client_cancel: closedBeforeCancel,
      cancel_ms: closedBeforeCancel ? null : row.closed_ms - cancel, origin_rst_code: row.rst_code,
      cancellation_proven: !closedBeforeCancel, actual_cancel_started_ms: cancel,
      historical_8MiB_expectation: target === '/large8' && samples[1].produced >= 8388608 ? 'FAIL retained' : 'not a historical PASS',
      caveat: 'producer write count, transport DATA/window state and process RSS are distinct measurements' };
  });
  await probe('partial-upload-native-cancel', async () => {
    const { c } = await nativeClient(); const s = c.request({ ':method': 'POST', ':path': '/upload', ':authority': 'edge-b.test' });
    s.on('error', () => {}); s.write(Buffer.alloc(16384));
    await until(() => handlers.some((r) => r.path === '/upload' && r.received === 16384));
    const row = handlers.findLast((r) => r.path === '/upload'); const start = performance.now();
    s.close(http2.constants.NGHTTP2_CANCEL); await until(() => row.closed, 2500); c.destroy();
    return { received: row.received, cancel_ms: row.closed_ms - start, origin_rst_code: row.rst_code, downstream_wire_trace: unavailableNativeTrace,
      origin_wire: observer.snapshot() };
  });
  await probe('WebSocket-two-messages-and-close', async () => {
    const ws = new WebSocket(`wss://127.0.0.1:${port}/ws`, { servername: 'edge-a.test', ca, rejectUnauthorized: true,
      headers: { host: 'edge-a.test' }, handshakeTimeout: 3500 });
    ws.on('error', () => {});
    try {
      await bound(once(ws, 'open')); const values = [];
      for (const text of ['first', 'second']) { const reply = once(ws, 'message'); ws.send(text); values.push((await bound(reply))[0].toString()); }
      const closed = once(ws, 'close'); ws.close(1000, 'complete'); const [code] = await bound(closed);
      assert.deepEqual(values, ['first', 'second']); assert.equal(code, 1000);
      await until(() => result.websocket_origin.close === 1000);
      return { values, close_code: code, origin: result.websocket_origin };
    } finally { ws.terminate(); }
  });

  const service = { chat: { path: '/lab.Echo/Chat', requestStream: true, responseStream: true,
    requestSerialize: (v) => Buffer.from(v), requestDeserialize: (v) => v.toString(),
    responseSerialize: (v) => Buffer.from(v), responseDeserialize: (v) => v.toString() } };
  const grpcServer = new grpc.Server(); let cancellations = 0; result.grpc_origin = [];
  grpcServer.addService(service, { chat(call) {
    const row = { values: [], cancelled_ms: null }; result.grpc_origin.push(row);
    call.on('data', (v) => { row.values.push(v); call.write(`echo:${v}`); });
    call.on('cancelled', () => { cancellations++; row.cancelled_ms = performance.now(); });
    call.on('end', () => { const trailers = new grpc.Metadata(); trailers.set('lab-trailer', 'complete'); call.end(trailers); });
  } });
  const grpcPort = await new Promise((resolve, reject) => grpcServer.bindAsync('127.0.0.1:0',
    grpc.ServerCredentials.createSsl(null, [{ private_key: material.read('origin.key'), cert_chain: material.read('origin.pem') }]),
    (e, p) => e ? reject(e) : resolve(p)));
  const grpcObserver = observedOrigin({ cert: material.read('origin.pem'), key: material.read('origin.key'), ca, port: grpcPort });
  servers.push(grpcObserver); const grpcObservedPort = await listen(grpcObserver);
  manifest.generation++; manifest.routes[1].origin_port = grpcObservedPort;
  fs.writeFileSync(`${manifestFile}.next`, JSON.stringify(manifest)); fs.renameSync(`${manifestFile}.next`, manifestFile);
  await delay(500);
  const Client = grpc.makeGenericClientConstructor(service, 'Echo');
  const gc = new Client(`127.0.0.1:${port}`, grpc.credentials.createSsl(ca), {
    'grpc.ssl_target_name_override': 'edge-b.test', 'grpc.default_authority': 'edge-b.test' });
  try {
    await probe('gRPC-streaming-trailers', async () => {
      const call = gc.chat({ deadline: Date.now() + 3500 }); call.on('error', () => {}); const status = once(call, 'status');
      const values = [];
      for (const value of ['one', 'two']) { const next = once(call, 'data'); call.write(value); values.push((await bound(next))[0]); }
      call.end(); const [end] = await bound(status);
      assert.deepEqual(values, ['echo:one', 'echo:two']); assert.equal(end.code, grpc.status.OK);
      assert.deepEqual(end.metadata.get('lab-trailer'), ['complete']);
      return { values, status: end.code, trailers: end.metadata.getMap(), origin_wire: grpcObserver.snapshot() };
    });
    await probe('gRPC-cancel-reaches-origin', async () => {
      const before = cancellations; const call = gc.chat({ deadline: Date.now() + 3500 }); call.on('error', () => {});
      const next = once(call, 'data'); call.write('cancel-me'); await bound(next); const start = performance.now(); call.cancel();
      await until(() => cancellations > before, 2500);
      return { cancel_ms: result.grpc_origin.at(-1).cancelled_ms - start, origin_wire: grpcObserver.snapshot() };
    });
  } finally { gc.close(); grpcServer.forceShutdown(); }
} catch (e) { result.fatal = e.stack; process.exitCode = 1; }
finally {
  if (child && child.exitCode === null) { const done = once(child, 'exit'); child.kill('SIGTERM'); await bound(done, 7000); }
  for (const s of sessions) s.destroy(); for (const s of sockets) s.destroy();
  for (const server of servers.reverse()) { server.closeAllConnections?.(); if (server.listening) await bound(new Promise((r) => server.close(r))); }
  if (log !== undefined) fs.closeSync(log);
  result.origin = { handlers, parser_errors: parserErrors, transport_errors: transportErrors, wire: observer?.snapshot() };
  result.completed_at = new Date().toISOString(); assertLock();
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
