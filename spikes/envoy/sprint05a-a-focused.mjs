import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import https from 'node:https';
import tls from 'node:tls';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { assertLock, pki, listen, freePort } from './wire-fixtures.mjs';
import { manifest, assertRejected } from '../edge-comparison/contract.mjs';
import { supplementalNegatives } from '../edge-comparison/supplemental.mjs';

process.umask(0o077); assertLock();
const [output, fixture] = process.argv.slice(2);
const record = { started_at: new Date().toISOString(), probes: [], completed: false };
const sockets = new Set(); const handlers = []; const decrypted = [];
let connections = 0; let parserErrors = 0; let transportErrors = 0;
let origin, relay, child;
const logs = [];
const snapshot = () => ({ bytes: Buffer.concat(decrypted).length, connections,
  handlers: handlers.length, parserErrors, transportErrors });
const request = (method, target, headers = '', body = '', close = true) =>
  `${method} ${target} HTTP/1.1\r\nHost: edge-a.test\r\n${headers}${close ? 'Connection: close\r\n' : ''}\r\n${body}`;
async function stop() {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit'); child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 6000);
  await exited; clearTimeout(timer);
}
try {
  const certs = pki(fixture);
  origin = https.createServer({ key: certs.read('origin.key'), cert: certs.read('origin.pem'), minVersion: 'TLSv1.2' }, (req, res) => {
    const row = { method: req.method, url: req.url, headers: req.rawHeaders, body: '' }; handlers.push(row);
    req.on('data', (b) => { row.body += b.toString(); });
    req.on('end', () => { row.trailers = req.rawTrailers;
      res.writeHead(req.url === '/origin501' ? 501 : 200, { 'content-length': '2' }); res.end('OK'); });
  });
  origin.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  origin.on('clientError', (_e, s) => { parserErrors++; s.destroy(); });
  origin.on('tlsClientError', () => transportErrors++);
  const nativePort = await listen(origin);
  relay = tls.createServer({ key: certs.read('origin.key'), cert: certs.read('origin.pem'),
    ALPNProtocols: ['http/1.1'], minVersion: 'TLSv1.2' }, (downstream) => {
    connections++; downstream.pause(); sockets.add(downstream);
    const upstream = tls.connect({ host: '127.0.0.1', port: nativePort, servername: 'lab-origin.test',
      ca: certs.read('ca.pem'), rejectUnauthorized: true, ALPNProtocols: ['http/1.1'], minVersion: 'TLSv1.2' });
    sockets.add(upstream);
    const close = () => { downstream.destroy(); upstream.destroy(); sockets.delete(downstream); sockets.delete(upstream); };
    for (const s of [downstream, upstream]) {
      s.on('error', () => { transportErrors++; close(); }); s.on('close', close); s.setTimeout(5000, close);
    }
    downstream.on('data', (bytes) => decrypted.push(Buffer.from(bytes)));
    upstream.once('secureConnect', () => { assert.equal(upstream.authorized, true); downstream.pipe(upstream); upstream.pipe(downstream); });
  });
  relay.on('tlsClientError', () => transportErrors++);
  const originPort = await listen(relay);
  const manifestFile = path.join(fixture, 'manifest.json');
  fs.writeFileSync(manifestFile, JSON.stringify({ generation: 1, ca_file: certs.file('ca.pem'), routes: [{
    host: 'edge-a.test', origin_name: 'lab-origin.test', origin_port: originPort,
    cert_file: certs.file('edge-a.pem'), key_file: certs.file('edge-a.key'), h2: false,
  }] }));
  const options = (port, servername = 'edge-a.test') => ({ host: '127.0.0.1', port, servername,
    ca: certs.read('ca.pem'), rejectUnauthorized: true, minVersion: 'TLSv1.2', ALPNProtocols: ['http/1.1'] });
  async function probe(name, port, raw, reused = false) {
    const socket = tls.connect(options(port)); socket.on('error', () => {});
    let before = snapshot(); const received = []; let peerEnd = false; let peerClose = false; let timedOut = false;
    let localDestroy = false; let error = null; let warmup = null;
    socket.on('data', (b) => received.push(b)); socket.on('end', () => { peerEnd = true; });
    socket.on('error', (e) => { error = e.message; });
    const closed = new Promise((resolve) => socket.once('close', () => { peerClose = !localDestroy; resolve(); }));
    const timer = setTimeout(() => { timedOut = true; localDestroy = true; socket.destroy(); }, 2500);
    await once(socket, 'secureConnect');
    const identity = { authorized: socket.authorized, sni: socket.servername, alpn: socket.alpnProtocol,
      tls: socket.getProtocol(), peer_fingerprint256: socket.getPeerCertificate().fingerprint256 };
    let responseStart = 0;
    if (reused) {
      const rawWarmup = request('GET', '/warmup', '', '', false); socket.write(rawWarmup);
      const deadline = Date.now() + 1500;
      while (!Buffer.concat(received).toString().endsWith('\r\n\r\nOK')) {
        assert.ok(Date.now() < deadline && !peerClose, 'warmup completed on open connection'); await delay(5);
      }
      warmup = { request: rawWarmup, origin_bytes: snapshot().bytes - before.bytes,
        handlers: handlers.slice(before.handlers), connections: connections - before.connections };
      assert.equal(warmup.handlers.length, 1); assert.ok(warmup.origin_bytes > 0);
      responseStart = Buffer.concat(received).length; before = snapshot();
    }
    const sent = performance.now(); socket.write(raw); // No client FIN; closure must be observed from the peer.
    await closed; clearTimeout(timer); await delay(40);
    const response = Buffer.concat(received).subarray(responseStart);
    const bytes = Buffer.concat(decrypted).subarray(before.bytes);
    const row = { name, reused, request: raw, request_hex: Buffer.from(raw).toString('hex'), warmup, identity,
      response: response.toString(), response_hex: response.toString('hex'), statuses:
      [...response.toString().matchAll(/HTTP\/1\.1 (\d{3})/g)].map((m) => Number(m[1])),
      elapsed_ms: performance.now() - sent, peer_end: peerEnd, peer_closed: peerClose,
      client_sent_fin: false, local_destroy: localDestroy, timed_out: timedOut, error,
      origin_dispatches: handlers.length - before.handlers, origin_inbound_bytes: bytes.length,
      origin_parse_errors: parserErrors - before.parserErrors, origin_transport_errors: transportErrors - before.transportErrors,
      origin_new_connections: connections - before.connections, origin_hex: bytes.toString('hex'),
      origin_handlers: handlers.slice(before.handlers) };
    record.probes.push(row); fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n');
    assert.equal(timedOut, false); assert.equal(peerEnd, true); assert.equal(peerClose, true); assert.equal(error, null);
    return row;
  }
  // Calibrate the relay with a verified direct request before any parser sees the bytes.
  const direct = request('GET', '/observer-control').replace('edge-a.test', 'lab-origin.test');
  const control = tls.connect(options(originPort, 'lab-origin.test')); control.on('error', () => {});
  await once(control, 'secureConnect'); control.resume(); const ended = once(control, 'end'); control.write(direct); await ended;
  await delay(40); assert.equal(Buffer.concat(decrypted).toString(), direct);
  record.observer_control = { request_hex: Buffer.from(direct).toString('hex'), observed_bytes: snapshot().bytes,
    authorized: control.authorized, expected_bytes: Buffer.byteLength(direct) };
  const historical = [...manifest.negatives.filter((r) => /invalid-transfer-encoding|TE-repeated-chunked|TE-not-final-chunked/.test(r.name)),
    { ...supplementalNegatives.find((r) => r.name === 'repeated-transfer-encoding-fields'), name: 'supplemental-repeated-transfer-encoding-fields' }];
  assert.equal(historical.length, 4);
  for (const mapped of [false, true]) {
    const launcher = path.resolve('spikes/envoy', mapped ? 'sprint05a-a-launcher.mjs' : 'recovery-launcher.mjs');
    const port = await freePort();
    child = spawn(process.execPath, [launcher, manifestFile, String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (b) => logs.push(b)); child.stderr.on('data', (b) => logs.push(b));
    const deadline = Date.now() + 15000;
    while (true) {
      try { const s = tls.connect(options(port)); s.on('error', () => {}); s.setTimeout(500, () => s.destroy());
        await once(s, 'secureConnect'); s.destroy(); break;
      } catch { assert.ok(Date.now() < deadline && child.exitCode === null, 'candidate readiness'); await delay(50); }
    }
    for (const vector of historical) for (const keepalive of [false, true]) for (const reused of [false, true]) {
      const raw = keepalive ? vector.request.replace('Connection: close', 'Connection: keep-alive') : vector.request;
      const row = await probe(`${mapped ? 'candidate' : 'baseline'}:${vector.name}:${keepalive ? 'keepalive' : 'exact'}`, port, raw, reused);
      row.historical_name = vector.name; row.exact_historical_input = !keepalive;
      row.expected_original = '4xx or empty peer close; zero origin bytes/dispatches/errors';
      row.original_assertion_pass = false;
      try { assertRejected(row); row.original_assertion_pass = true; } catch (e) { row.original_assertion_failure = e.message; }
      assert.deepEqual(row.statuses, [mapped ? 400 : 501]);
      assert.equal(row.origin_inbound_bytes, 0); assert.equal(row.origin_dispatches, 0);
      assert.equal(row.origin_new_connections, 0); assert.equal(row.origin_parse_errors, 0); assert.equal(row.origin_transport_errors, 0);
      assert.equal(row.original_assertion_pass, mapped);
    }
    const upstream = await probe(`${mapped ? 'candidate' : 'baseline'}:origin501`, port, request('GET', '/origin501'));
    assert.deepEqual(upstream.statuses, [501]); assert.equal(upstream.origin_dispatches, 1); assert.ok(upstream.origin_inbound_bytes > 0);
    if (mapped) {
      for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
        const row = await probe(`valid-method:${method}`, port, request(method, `/method-${method}`));
        assert.deepEqual(row.statuses, [200]); assert.equal(row.origin_handlers[0].method, method);
      }
      for (const method of ['POST', 'PUT', 'PATCH']) {
        const row = await probe(`valid-chunked:${method}`, port, request(method, '/chunked', 'Transfer-Encoding: chunked\r\n', '3\r\nabc\r\n0\r\n\r\n'));
        assert.deepEqual(row.statuses, [200]); assert.equal(row.origin_handlers[0].body, 'abc');
      }
      for (const target of manifest.encoded_targets) {
        const row = await probe(`encoded:${target}`, port, request('GET', target));
        assert.deepEqual(row.statuses, [200]); assert.equal(row.origin_handlers[0].url, target);
      }
      const row = await probe('pipeline', port, request('GET', '/first%2Fsegment', '', '', false) + request('GET', '/second?x=%2520'));
      assert.deepEqual(row.statuses, [200, 200]); assert.deepEqual(row.origin_handlers.map((r) => r.url), ['/first%2Fsegment', '/second?x=%2520']);
    }
    await stop(); child = null;
  }
  record.completed = true;
} catch (e) { record.error = e.stack; process.exitCode = 1; }
finally {
  await stop(); for (const s of sockets) s.destroy();
  for (const server of [relay, origin]) if (server?.listening) await new Promise((resolve) => server.close(resolve));
  record.ended_at = new Date().toISOString();
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n');
  fs.writeFileSync(`${output}.envoy.log`, Buffer.concat(logs));
  assertLock();
}
