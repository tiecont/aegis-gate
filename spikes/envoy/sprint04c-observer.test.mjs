// Integrates test-only Go maintained decoder tests with the existing JS unit glob.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('Sprint04-C maintained H2/HPACK attribution rejects deliberate leaks and incomplete evidence', { timeout: 90000 }, () => {
  const result = spawnSync('go', ['test', '-race', './spikes/envoy/sprint04c-attribution', '-count=1', '-v'], {
    env: { ...process.env, GOTOOLCHAIN: 'go1.27.4' }, timeout: 85000, encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /TestStatefulDynamicReference/);
  assert.match(result.stdout, /TestPartialForbiddenHeadersFailClosed/);
  console.log(result.stdout);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http2 from 'node:http2';
import { once } from 'node:events';
import { boundedCapture, observedOrigin } from './sprint04c-observer.mjs';
import { assertLock, pki, listen } from './wire-fixtures.mjs';

test('bounded capture accounts for drops and closed lifecycle', () => {
  const c = boundedCapture(true, 4); c.consume(Buffer.from('abcdef')); c.close();
  assert.deepEqual({ ...c.snapshot(), all_bytes_sha256: undefined }, {
    hex: '61626364', total_bytes: 6, dropped_bytes: 2, client_preface: true, capture_closed: true, all_bytes_sha256: undefined,
  });
});

test('new raw relay preserves verified TLS, exact synthetic payload and encoded target', { timeout: 20000 }, async () => {
  assertLock(); process.umask(0o077);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-04c-relay-'));
  const material = pki(dir); const sessions = new Set(); const servers = []; const received = [];
  try {
    const origin = http2.createSecureServer({ cert: material.read('origin.pem'), key: material.read('origin.key') }); servers.push(origin);
    origin.on('session', (s) => { sessions.add(s); s.on('error', () => {}); });
    origin.on('stream', (s, h) => { received.push({ target: h[':path'], sni: s.session.socket.servername }); s.respond({ ':status': 200 }); s.end('synthetic-ok'); });
    const port = await listen(origin);
    const observer = observedOrigin({ cert: material.read('origin.pem'), key: material.read('origin.key'), ca: material.read('ca.pem'), port }); servers.push(observer);
    const observedPort = await listen(observer);
    for (const targetPort of [port, observedPort]) {
      const c = http2.connect(`https://127.0.0.1:${targetPort}`, { servername: 'lab-origin.test', ca: material.read('ca.pem'), rejectUnauthorized: true });
      sessions.add(c); c.on('error', () => {}); await once(c, 'connect'); assert.equal(c.socket.authorized, true);
      const s = c.request({ ':path': '/encoded%2Ftarget?x=%2520' }); const chunks = [];s.on('data', (b) => chunks.push(b)); s.end(); await once(s, 'end');
      assert.equal(Buffer.concat(chunks).toString(), 'synthetic-ok'); c.destroy();
    }
    await new Promise((r) => setTimeout(r, 30));
    assert.deepEqual(received[0], received[1]);
    const captures = observer.rawCaptures(); assert.equal(captures.length, 2);
    for (const c of captures) { assert.equal(c.dropped_bytes, 0); assert.equal(c.capture_closed, true); assert.equal(c.identity_complete, false); assert.equal(c.native_tls.authorized, true); assert.equal(c.hex.length, c.total_bytes * 2); }
    console.log(JSON.stringify({ direct_and_relay: received, capture_totals: captures.map((c) => ({ direction: c.direction, bytes: c.total_bytes, sha256: c.all_bytes_sha256 })) }));
  } finally {
    for (const s of sessions) s.destroy();
    for (const s of servers.reverse()) { s.closeAllConnections?.(); if (s.listening) await new Promise((r) => s.close(r)); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
