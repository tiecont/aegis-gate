import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
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
      await once(socket, 'close'); assert.equal(bytes, 0); assert.ok(errors > 0);
    }
    for (const [name, trust] of [['wrong.test', ca], ['lab-origin.test', material.read('untrusted.pem')]]) {
      await assert.rejects(connect(observedPort, name, trust));
    }
    console.log(JSON.stringify({ payload_bytes: payload.length, sha256: createHash('sha256').update(payload).digest('hex'),
      direct_and_observed: result, samples: snapshot.events.length, omitted: snapshot.omitted_events }));
  } finally {
    for (const socket of sockets) socket.destroy();
    for (const server of servers) { server.closeAllConnections?.(); if (server.listening) await new Promise((resolve) => server.close(resolve)); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
