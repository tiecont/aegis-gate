import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import http2 from 'node:http2';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createTlsObserver } from './tls-observer.mjs';

test('H2 observer counts decrypted preface without handler dispatch and preserves valid frames', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-observer-'));
  fs.chmodSync(dir, 0o700);
  let upstream; let observer; let client; const sessions = new Set();
  let bytes = 0; let handlers = 0;
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-subj', '/CN=lab-origin.test', '-addext', 'subjectAltName=DNS:lab-origin.test',
      '-keyout', path.join(dir, 'key'), '-out', path.join(dir, 'cert')], { stdio: 'ignore' });
    fs.chmodSync(path.join(dir, 'key'), 0o600);
    const cert = fs.readFileSync(path.join(dir, 'cert')); const key = fs.readFileSync(path.join(dir, 'key'));
    upstream = http2.createSecureServer({ cert, key });
    upstream.on('session', (session) => { sessions.add(session); session.on('close', () => sessions.delete(session)); });
    upstream.on('stream', (stream, headers) => {
      handlers++; assert.equal(headers[':path'], '/encoded%2Fcontrol');
      stream.respond({ ':status': 200 }); stream.end('observed');
    });
    upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
    observer = createTlsObserver({ cert, key, ca: cert, port: upstream.address().port,
      onBytes: (size) => { bytes += size; } });
    observer.listen(0, '127.0.0.1'); await once(observer, 'listening');
    const socket = tls.connect({ host: '127.0.0.1', port: observer.address().port,
      servername: 'lab-origin.test', ca: cert, rejectUnauthorized: true, ALPNProtocols: ['h2'] });
    await once(socket, 'secureConnect');
    socket.write('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n');
    for (let i = 0; bytes === 0 && i < 100; i++) await delay(10);
    assert.equal(bytes, 24); assert.equal(handlers, 0);
    socket.destroy();
    const before = bytes;
    client = http2.connect(`https://127.0.0.1:${observer.address().port}`, {
      servername: 'lab-origin.test', ca: cert, rejectUnauthorized: true });
    const req = client.request({ ':path': '/encoded%2Fcontrol' });
    const body = []; req.on('data', (chunk) => body.push(chunk)); req.end(); await once(req, 'end');
    assert.equal(Buffer.concat(body).toString(), 'observed');
    assert.equal(handlers, 1); assert.ok(bytes > before);
  } finally {
    client?.destroy(); observer?.closeAllConnections();
    for (const session of sessions) session.destroy();
    for (const server of [observer, upstream]) if (server?.listening) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
