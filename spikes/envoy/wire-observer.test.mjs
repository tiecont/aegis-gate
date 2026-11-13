import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import http2 from 'node:http2';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { createTlsObserver, decoder, frame } from './wire-observer.mjs';
import { assertLock, pki, listen, until } from './wire-fixtures.mjs';

test('fragmented envelopes classify controls and preserve bounded decoder state', () => {
  const events = []; const consume = decoder({ client: true, emit: (event) => events.push(event) });
  const input = Buffer.concat([Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n'), frame(4, 1, 0), frame(1, 5, 1, Buffer.from([0x82]))]);
  for (const byte of input) consume(Buffer.from([byte]));
  assert.deepEqual(events.map((e) => e.kind), ['preface', 'frame', 'frame']);
  assert.equal(events[1].hex, '000000040100000000');
  assert.equal(events[1].name, 'SETTINGS'); assert.equal(events[2].hex, undefined);
  const limited = []; const bounded = decoder({ emit: (e) => limited.push(e), maxBuffer: 32 });
  bounded(Buffer.alloc(33)); bounded(frame(4, 1, 0));
  assert.deepEqual(limited, [{ kind: 'decode-limit' }]);
});

test('native H2 direct and observed controls preserve authority, SNI, targets and reuse', { timeout: 30000 }, async () => {
  assertLock(); process.umask(0o077);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-wire-identity-'));
  const material = pki(dir); const sessions = new Set(); const servers = [];
  const samples = []; let sequence = 0; let counted = 0;
  const cert = material.read('origin.pem'); const key = material.read('origin.key'); const ca = material.read('ca.pem');
  try {
    const origin = http2.createSecureServer({ cert, key, minVersion: 'TLSv1.2' }); servers.push(origin);
    const ids = new WeakMap();
    origin.on('session', (session) => {
      ids.set(session, ++sequence); sessions.add(session); session.on('error', () => {});
      session.on('close', () => sessions.delete(session));
    });
    origin.on('stream', (stream, headers) => {
      const sample = { connection: ids.get(stream.session), stream: stream.id,
        method: headers[':method'], target: headers[':path'], authority: headers[':authority'],
        marker: headers['x-wire-probe'] ?? null, sni: stream.session.socket.servername,
        alpn: stream.session.socket.alpnProtocol, tls: stream.session.socket.getProtocol() };
      samples.push(sample); stream.on('error', () => {});
      stream.respond({ ':status': 200 }); stream.end(JSON.stringify(sample));
    });
    const nativePort = await listen(origin);
    const observer = createTlsObserver({ cert, key, ca, port: nativePort, onBytes: (n) => { counted += n; } });
    servers.push(observer); const observedPort = await listen(observer);
    const controls = [];
    for (const port of [nativePort, observedPort]) {
      const session = http2.connect(`https://127.0.0.1:${port}`, { servername: 'lab-origin.test', ca,
        rejectUnauthorized: true, minVersion: 'TLSv1.2' });
      sessions.add(session); session.on('error', () => {}); session.on('close', () => sessions.delete(session));
      session.setTimeout(3000, () => session.destroy()); await once(session, 'connect');
      assert.equal(session.socket.authorized, true); assert.equal(session.socket.alpnProtocol, 'h2');
      const start = samples.length;
      for (const [index, target] of ['/bad%20target', '/encoded%2Fsegment?value=%2520'].entries()) {
        const stream = session.request({ ':method': 'GET', ':path': target, ':authority': 'synthetic-authority.test',
          ...(index === 0 ? { 'x-wire-probe': 'first-only' } : {}) });
        stream.on('error', () => {}); const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk)); stream.end(); await once(stream, 'end');
        const sample = JSON.parse(Buffer.concat(chunks));
        assert.equal(sample.target, target); assert.equal(sample.authority, 'synthetic-authority.test');
        assert.equal(sample.sni, 'lab-origin.test'); assert.equal(sample.method, 'GET'); assert.equal(sample.alpn, 'h2');
        assert.equal(sample.marker, index === 0 ? 'first-only' : null);
      }
      const observed = samples.slice(start); assert.equal(observed.length, 2);
      assert.equal(observed[0].connection, observed[1].connection);
      assert.deepEqual(observed.map((sample) => sample.stream), [1, 3]);
      controls.push({ peer_fingerprint: session.socket.getPeerCertificate().fingerprint256,
        downstream_tls: session.socket.getProtocol(), samples: observed }); session.destroy();
    }
    assert.equal(controls[0].peer_fingerprint, controls[1].peer_fingerprint);
    assert.deepEqual(controls[0].samples.map(({ connection, ...sample }) => sample),
      controls[1].samples.map(({ connection, ...sample }) => sample));
    assert.ok(counted > 24); assert.equal(observer.wireSnapshot().total_secure_connections, 1);
    console.log(JSON.stringify({ native_h2_identity_controls: controls, observed_decrypted_bytes: counted,
      identity_scope: 'configured origin SNI preserved; HTTP authority forwarded without binding or rewriting' }));
  } finally {
    for (const session of sessions) session.destroy();
    for (const server of servers.reverse()) { server.closeAllConnections?.(); if (server.listening) await new Promise((resolve) => server.close(resolve)); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('observer preserves bytes, configured identity and verified TLS; bounds samples', { timeout: 30000 }, async () => {
  assertLock(); process.umask(0o077);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-wire-unit-'));
  const material = pki(dir); const sockets = new Set(); const servers = [];
  const cert = material.read('origin.pem'); const key = material.read('origin.key'); const ca = material.read('ca.pem');
  const seen = [];
  const origin = async (name = 'origin') => {
    const server = tls.createServer({ cert: material.read(`${name}.pem`), key: material.read(`${name}.key`),
      minVersion: 'TLSv1.2', ALPNProtocols: ['h2'] }, (socket) => {
      sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
      const sample = { sni: socket.servername, alpn: socket.alpnProtocol, tls: socket.getProtocol(), chunks: [] }; seen.push(sample);
      socket.on('data', (bytes) => { sample.chunks.push(Buffer.from(bytes)); socket.write(bytes); });
    });
    server.on('tlsClientError', () => {}); servers.push(server); return listen(server);
  };
  async function connect(port, servername = 'lab-origin.test', trust = ca) {
    const socket = tls.connect({ host: '127.0.0.1', port, servername, ca: trust,
      rejectUnauthorized: true, minVersion: 'TLSv1.2', ALPNProtocols: ['h2'] });
    sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
    socket.setTimeout(3000, () => socket.destroy()); await once(socket, 'secureConnect'); return socket;
  }
  try {
    const port = await origin(); let counted = 0;
    const observer = createTlsObserver({ cert, key, ca, port, onBytes: (n) => { counted += n; } });
    servers.push(observer); const observedPort = await listen(observer);
    const payload = Buffer.concat([Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n'), frame(4, 0, 0), frame(1, 5, 1, Buffer.from([0x82])),
      ...Array.from({ length: 4200 }, () => frame(4, 1, 0))]);
    const result = [];
    for (const destination of [port, observedPort]) {
      const socket = await connect(destination); const chunks = [];
      socket.on('data', (bytes) => chunks.push(bytes));
      socket.write(payload.subarray(0, 13)); socket.write(payload.subarray(13));
      await until(() => Buffer.concat(chunks).length === payload.length);
      assert.deepEqual(Buffer.concat(chunks), payload);
      assert.equal(socket.authorized, true); assert.equal(socket.alpnProtocol, 'h2');
      result.push({ fingerprint: socket.getPeerCertificate().fingerprint256, tls: socket.getProtocol(), alpn: socket.alpnProtocol });
      socket.destroy();
    }
    assert.deepEqual(result[0], result[1]); assert.equal(counted, payload.length);
    assert.equal(seen.length, 2);
    for (const sample of seen) {
      assert.equal(sample.sni, 'lab-origin.test'); assert.equal(sample.alpn, 'h2');
      assert.deepEqual(Buffer.concat(sample.chunks), payload);
    }
    const snapshot = observer.wireSnapshot();
    assert.equal(snapshot.connections[0].bytes, payload.length);
    assert.equal(snapshot.total_decrypted_bytes, payload.length); assert.equal(snapshot.total_secure_connections, 1);
    assert.equal(snapshot.events.length, 4096); assert.ok(snapshot.omitted_events > 0);
    for (const name of ['wrong', 'expired', 'untrusted']) {
      let bytes = 0; let errors = 0;
      const negative = createTlsObserver({ cert, key, ca, port: await origin(name), onBytes: (n) => { bytes += n; },
        onTransportError: () => { errors++; } }); servers.push(negative);
      const socket = await connect(await listen(negative));
      assert.equal(socket.destroyed, false); socket.write(payload);
      await once(socket, 'close'); assert.equal(bytes, 0); assert.ok(errors > 0);
    }
    for (const [name, trust] of [['wrong.test', ca], ['lab-origin.test', material.read('untrusted.pem')]]) {
      await assert.rejects(connect(observedPort, name, trust));
    }
    console.log(JSON.stringify({ payload_bytes: payload.length, sha256: createHash('sha256').update(payload).digest('hex'),
      direct_and_observed: result, invalid_origin_attempted_payload_bytes: payload.length,
      samples: snapshot.events.length, omitted: snapshot.omitted_events }));
  } finally {
    for (const socket of sockets) socket.destroy();
    for (const server of servers) { server.closeAllConnections?.(); if (server.listening) await new Promise((resolve) => server.close(resolve)); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
