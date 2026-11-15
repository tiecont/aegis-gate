// Independent fixture probes. Maintained llhttp and Node HTTPS own all parsing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import https from 'node:https';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const [source, output] = process.argv.slice(2);
const load = (file) => import(pathToFileURL(path.join(source, file)));
const { assertLock, listen, until, pki } = await load('spikes/envoy/wire-fixtures.mjs');
const { build } = await load('spikes/envoy/sprint05c-a-build.mjs');
const { runtime } = await load('spikes/envoy/sprint05c-a-runtime.mjs');
assertLock(); process.umask(0o077);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const r = { argv: process.argv, started_at: new Date().toISOString(), commands: [], probes: [], security_pass: false,
  script_sha256: sha(fs.readFileSync(import.meta.filename)) };
const dir = fs.mkdtempSync(path.join(source, '.local/sprint05c-f-ingress-'));
const sockets = new Set();
const track = (s) => { sockets.add(s); s.on('error', () => {}); s.once('close', () => sockets.delete(s)); return s; };
let origin, front, addon, bytes = 0;
const handlers = [], wire = [];
try {
  addon = await build(dir, r);
  const keys = pki(path.join(dir, 'pki'));
  const serverTLS = (name) => ({ key: keys.read(`${name}.key`), cert: keys.read(`${name}.pem`), minVersion: 'TLSv1.2', ALPNProtocols: ['http/1.1'] });
  origin = https.createServer(serverTLS('origin'), (request, response) => {
    const row = { target: request.url, bodyBytes: 0, ended: false, aborted: false };
    handlers.push(row);
    request.on('data', (b) => { row.bodyBytes += b.length; });
    request.on('aborted', () => { row.aborted = true; });
    request.on('end', () => { row.ended = true; response.writeHead(200, { 'content-length': 2 }); response.end('OK'); });
  });
  origin.on('connection', track);
  origin.on('secureConnection', (socket) => { socket.on('data', (b) => { bytes += b.length; wire.push(Buffer.from(b)); }); });
  origin.on('clientError', (_e, socket) => socket.destroy());
  const port = await listen(origin);
  const route = { tenant: 'tenant-a', enabled: true, generation: 7, port, ca: keys.read('ca.pem'), originName: 'lab-origin.test', edge: serverTLS('edge-a') };
  front = await runtime({ addon, edgeTLS: serverTLS('edge-a'), routes: new Map([['edge-a.test', route]]), directory: path.join(dir, 'stage') });
  async function probe(name, raw, waitForOrigin = false) {
    const beforeBytes = bytes, beforeHandlers = handlers.length, beforeWire = wire.length;
    const s = track(tls.connect({ host: '127.0.0.1', port: front.port, servername: 'edge-a.test', ca: keys.read('ca.pem'), rejectUnauthorized: true,
      minVersion: 'TLSv1.2', ALPNProtocols: ['http/1.1'] }));
    await once(s, 'secureConnect'); assert.ok(s.authorized); assert.equal(s.alpnProtocol, 'http/1.1');
    const response = [];
    s.on('data', (b) => response.push(Buffer.from(b)));
    const closed = once(s, 'close');
    const timer = setTimeout(() => s.destroy(), 4500);
    if (waitForOrigin) {
      s.write(raw);
      await until(() => handlers.length > beforeHandlers && handlers.at(-1).bodyBytes >= 3);
      s.end();
    } else s.end(raw);
    await closed; clearTimeout(timer);
    await until(() => front.tcpConnections === 0 && front.metrics.activeContexts === 0);
    const outputBytes = Buffer.concat(response), originBytes = Buffer.concat(wire.slice(beforeWire));
    const row = { name, request_hex: Buffer.from(raw).toString('hex'), request_sha256: sha(Buffer.from(raw)),
      response_hex: outputBytes.toString('hex'), statuses: [...outputBytes.toString().matchAll(/HTTP\/1\.1 (\d{3})/g)].map((m) => Number(m[1])),
      origin: { bytes: bytes - beforeBytes, raw_hex: originBytes.toString('hex'), sha256: sha(originBytes), handlers: handlers.slice(beforeHandlers) } };
    r.probes.push(row); return row;
  }
  const valid = await probe('complete-known-length-half-close-control', 'POST /valid HTTP/1.1\r\nHost: edge-a.test\r\nContent-Length: 3\r\nConnection: close\r\n\r\nabc');
  assert.deepEqual(valid.statuses, [200]); assert.equal(valid.origin.handlers[0].ended, true);
  const truncated = await probe('truncated-known-length-after-stream-admission', 'POST /truncated HTTP/1.1\r\nHost: edge-a.test\r\nContent-Length: 10\r\nConnection: close\r\n\r\nabc', true);
  assert.deepEqual(truncated.statuses, [400]); assert.ok(truncated.origin.bytes > 0); assert.equal(truncated.origin.handlers.length, 1);
  assert.equal(truncated.origin.handlers[0].ended, false);
  r.conclusion = 'Known-length stream admission can still be invalidated by premature EOF after origin bytes/handler; conditional streaming proof is not complete syntax-before-origin admission.';
  r.complete = true;
} catch (error) { r.error = error.stack; process.exitCode = 1; }
finally {
  assertLock(); for (const s of sockets) s.destroy();
  if (front) await front.close();
  if (origin) await new Promise((resolve) => origin.close(resolve));
  await until(() => sockets.size === 0);
  fs.rmSync(dir, { recursive: true });
  r.cleanup = { fixture_absent: !fs.existsSync(dir), sockets: sockets.size, parsers: addon?.liveParsers(), origin_listener_closed: !origin?.listening };
  r.ended_at = new Date().toISOString();
  fs.writeFileSync(output, JSON.stringify(r, null, 2) + '\n');
}
