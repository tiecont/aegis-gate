import test from 'node:test';
import assert from 'node:assert/strict';
import { traceFrames } from './sprint04b-observer.mjs';
import { frame } from './wire-observer.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http2 from 'node:http2';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { observedOrigin } from './sprint04b-observer.mjs';
import { assertLock, pki, listen } from './wire-fixtures.mjs';

test('trace drains coalesced input over old decoder chunk bound', () => {
  const bytes = Buffer.concat([Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n'),
    ...Array.from({ length: 10 }, () => frame(0, 0, 1, Buffer.alloc(16384))), frame(3, 0, 1, Buffer.from([0, 0, 0, 8]))]);
  const trace = traceFrames(true); trace.consume(bytes);
  assert.equal(trace.result.bytes, bytes.length); assert.equal(trace.result.data_bytes, 163840);
  assert.equal(trace.result.frames, 11); assert.equal(trace.result.events.at(-1).error_code, 8);
  assert.ok(!trace.result.events.some((e) => e.kind === 'decode-limit'));
});
test('fragmented control and bounded control samples preserve totals', () => {
  const trace = traceFrames(); const bytes = Buffer.concat(Array.from({ length: 300 }, () => frame(4, 1, 0)));
  for (let i = 0; i < bytes.length; i += 7) trace.consume(bytes.subarray(i, i + 7));
  assert.equal(trace.result.frames, 300); assert.equal(trace.result.events.length, 256); assert.equal(trace.result.omitted, 44);
});

test('new relay preserves native H2 body, response, configured TLS identity and encoded target', { timeout: 20000 }, async () => {
  assertLock(); process.umask(0o077);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-sprint04b-relay-'));
  const m = pki(dir); const sessions = new Set(); const servers = []; const received = [];
  const payload = Buffer.alloc(262144, 97); const hash = (b) => createHash('sha256').update(b).digest('hex');
  try {
    const origin = http2.createSecureServer({ cert: m.read('origin.pem'), key: m.read('origin.key'), minVersion: 'TLSv1.2' }); servers.push(origin);
    origin.on('session', (s) => { sessions.add(s); s.on('error', () => {}); s.on('close', () => sessions.delete(s)); });
    origin.on('stream', (s, h) => {
      s.on('error', () => {}); const chunks = [];
      s.on('data', (b) => chunks.push(b)); s.on('end', () => {
        const body = Buffer.concat(chunks); received.push({ path: h[':path'], authority: h[':authority'],
          sni: s.session.socket.servername, bytes: body.length, sha256: hash(body) });
        s.respond({ ':status': 200 }); s.end(body);
      });
    });
    const nativePort = await listen(origin); const observer = observedOrigin({ cert: m.read('origin.pem'), key: m.read('origin.key'), ca: m.read('ca.pem'), port: nativePort });
    servers.push(observer); const observedPort = await listen(observer); const peers = [];
    for (const port of [nativePort, observedPort]) {
      const c = http2.connect(`https://127.0.0.1:${port}`, { servername: 'lab-origin.test', ca: m.read('ca.pem'), rejectUnauthorized: true });
      sessions.add(c); c.on('error', () => {}); c.on('close', () => sessions.delete(c));
      c.setTimeout(3000, () => c.destroy()); await once(c, 'connect');
      assert.equal(c.socket.authorized, true); peers.push(c.socket.getPeerCertificate().fingerprint256);
      const s = c.request({ ':method': 'POST', ':path': '/encoded%2Ftarget?x=%2520', ':authority': 'synthetic.test' });
      s.on('error', () => {}); const chunks = []; s.on('data', (b) => chunks.push(b)); s.end(payload); await once(s, 'end');
      assert.deepEqual(Buffer.concat(chunks), payload); c.destroy();
    }
    assert.deepEqual(received[0], received[1]); assert.equal(peers[0], peers[1]);
    const wire = observer.snapshot(); const row = wire.records[0];
    assert.equal(row.native_tls.authorized, true); assert.equal(row.native_tls.sni, 'lab-origin.test');
    assert.equal(row.candidate_to_origin.data_bytes, payload.length); assert.equal(row.origin_to_candidate.data_bytes, payload.length);
    assert.equal(wire.errors, 0); assert.equal(wire.omitted, 0);
    console.log(JSON.stringify({ direct_and_observed: received, peer_fingerprint256: peers[0], wire }));
  } finally {
    for (const s of sessions) s.destroy();
    for (const s of servers.reverse()) { s.closeAllConnections?.(); if (s.listening) await new Promise((r) => s.close(r)); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
