// Bounded test-only raw H2 requests. No production codec or replacement gate.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import tls from 'node:tls';
import http2 from 'node:http2';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { frame } from './wire-observer.mjs';
import { observedOrigin, traceFrames, identity } from './sprint04b-observer.mjs';
import { assertLock, pki, listen, freePort } from './wire-fixtures.mjs';
import { receipt, hash } from './sprint04c-repro-receipts.mjs';

process.umask(0o077); assertLock();
const proof = receipt(process.argv[2]);
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-sprint04c-b-h2-'));
const sessions = new Set(); const sockets = new Set(); const raw = []; const handlers = [];
let native, observer, child, log, port, parserErrors = 0, transportErrors = 0, connections = 0, rawBytes = 0;
const started = Date.now();
const bound = async (promise, ms = 3500) => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`deadline ${ms}`)), ms); })]); }
  finally { clearTimeout(timer); }
};
const own = (socket) => { sockets.add(socket); socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket)); return socket; };
const literal = (name, value) => Buffer.concat([Buffer.from([0, name.length]), Buffer.from(name), Buffer.from([value.length]), Buffer.from(value)]);
const block = (authority, host) => Buffer.concat([Buffer.from([0x82, 0x87, 0x84]), literal(':authority', authority), ...(host ? [literal('host', host)] : [])]);
const snapshot = () => ({ ...observer.snapshot(), handlers: handlers.length, native_connections: connections, parser_errors: parserErrors, transport_errors: transportErrors });
try {
  proof.record.scope = 'Minimal raw H2 identity side-effect reproduction on the existing released pin. Frame envelopes only, no HPACK attribution proof or security acceptance.';
  proof.record.bounds = { maximum_requests: 5, max_raw_origin_bytes: 32768, deadline_ms: 3500, listener: '127.0.0.1', container_memory: '256m' };
  proof.command('openssl-version', ['openssl', 'version']);
  proof.command('docker-version', ['docker', 'version', '--format', '{{json .}}']);
  const image = JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')); proof.record.image = image;
  assert.equal(proof.command('image-inspect', ['docker', 'image', 'inspect', image.image, '--format', '{{.Id}} {{json .RepoDigests}}']).status, 0);
  const material = pki(fixture); const ca = material.read('ca.pem');
  native = http2.createSecureServer({ cert: material.read('origin.pem'), key: material.read('origin.key'), minVersion: 'TLSv1.2' });
  native.on('session', (s) => { connections++; sessions.add(s); s.on('error', () => { parserErrors++; }); s.on('close', () => sessions.delete(s)); });
  native.on('sessionError', () => { parserErrors++; }); native.on('tlsClientError', () => { transportErrors++; });
  native.on('stream', (s, h) => { handlers.push({ stream: s.id, headers: h, origin_tls: identity(s.session.socket) }); s.on('error', () => {}); s.respond({ ':status': 200 }); s.end('h2-origin'); });
  const nativePort = await listen(native);
  observer = observedOrigin({ cert: material.read('origin.pem'), key: material.read('origin.key'), ca, port: nativePort });
  observer.on('secureConnection', (socket) => socket.on('data', (bytes) => {
    rawBytes += bytes.length;
    if (rawBytes <= 32768) raw.push(Buffer.from(bytes));
    else { proof.record.capture_incomplete = true; socket.destroy(); }
  }));
  const originPort = await listen(observer); port = await freePort();
  const manifest = { generation: 1, ca_file: material.file('ca.pem'), routes: [{ host: 'edge-b.test', h2: true,
    origin_port: originPort, origin_name: 'lab-origin.test', cert_file: material.file('edge-b.pem'), key_file: material.file('edge-b.key') }] };
  fs.writeFileSync(material.file('manifest.json'), JSON.stringify(manifest));
  proof.record.manifest_sha256 = hash(JSON.stringify(manifest));
  log = fs.openSync(`${process.argv[2]}/proxy.log`, 'wx');
  child = spawn(process.execPath, ['spikes/envoy/recovery-launcher.mjs', material.file('manifest.json'), String(port)], { stdio: ['ignore', log, log] });
  proof.record.launcher = { argv: [process.execPath, 'spikes/envoy/recovery-launcher.mjs', material.file('manifest.json'), String(port)], pid: child.pid, started_at: new Date().toISOString() };
  const connect = async () => {
    const s = own(tls.connect({ host: '127.0.0.1', port, servername: 'edge-b.test', ca, rejectUnauthorized: true, ALPNProtocols: ['h2'] }));
    await bound(once(s, 'secureConnect')); assert.equal(s.authorized, true); assert.equal(s.alpnProtocol, 'h2'); return s;
  };
  const readyBy = Date.now() + 15000;
  while (true) { try { (await connect()).destroy(); break; } catch { assert.ok(Date.now() < readyBy, 'listener readiness'); await delay(50); } }
  proof.record.probes = [];
  for (const [name, authority, host] of [['valid-warmup', 'edge-b.test'], ['Host-mismatch', 'edge-b.test', 'edge-a.test'],
    ['authority-mismatch', 'edge-a.test'], ['authority-userinfo', 'user@edge-b.test'], ['valid-reuse-control', 'edge-b.test']]) {
    const before = snapshot(); const rawStart = Buffer.concat(raw).length;
    const s = await connect(); const ident = identity(s); const trace = traceFrames(); const received = []; const lifecycle = [];
    let localCleanup = false, timedOut = false;
    s.on('data', (b) => { received.push(Buffer.from(b)); trace.consume(b); });
    for (const event of ['end', 'close', 'error']) s.on(event, (e) => lifecycle.push({ event, code: e?.code, local_cleanup: localCleanup, at: new Date().toISOString() }));
    const sent = Buffer.concat([Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n'), frame(4, 0, 0), frame(1, 5, 1, block(authority, host))]);
    s.write(sent);
    const deadline = Date.now() + 3500;
    while (!s.destroyed && !trace.result.events.some((e) => e.kind === 'frame' && e.stream === 1 && (e.flags & 1) && [0, 1].includes(e.type))) {
      if (Date.now() >= deadline) { timedOut = true; break; } await delay(2);
    }
    // Keep this diagnostic interval fixed and retain all bytes. Original gate timing is untouched.
    const after = snapshot(); const bytes = Buffer.concat(raw).subarray(rawStart);
    const counts = Object.fromEntries(['bytes', 'headers', 'data_bytes', 'handlers', 'native_connections', 'parser_errors', 'transport_errors']
      .map((k) => [k, after[k] - before[k]]));
    proof.record.probes.push({ name, authority, host: host ?? null, tls: ident, sent_hex: sent.toString('hex'), sent_sha256: hash(sent),
      received_hex: Buffer.concat(received).toString('hex'), frame_observation: trace.result, lifecycle, timed_out: timedOut,
      origin: { ...counts, raw_hex: bytes.toString('hex'), raw_sha256: hash(bytes), handlers: handlers.slice(before.handlers) },
      aggregate_zero_byte_observed: counts.bytes === 0, observer_complete_security_attribution: false });
    proof.save(); localCleanup = true; s.destroy();
    console.log(`${name}: origin bytes=${counts.bytes}, headers=${counts.headers}, handlers=${counts.handlers}, timeout=${timedOut}`);
  }
  proof.record.origin_wire = observer.snapshot();
  assert.ok(proof.record.probes[0].origin.bytes > 0 && proof.record.probes[0].origin.handlers.length === 1, 'positive origin byte/handler control');
  assert.equal(proof.record.probes.at(-1).origin.handlers.length, 1, 'valid H2 control');
  assert.equal(proof.record.capture_incomplete ?? false, false);
  proof.record.completed_observations = true;
  proof.record.security_acceptance = 'NO-GO unchanged; this diagnostic does not replace the original75 or prove HPACK/request attribution';
} catch (error) { proof.record.error = error.stack; }
finally {
  assertLock();
  for (const socket of sockets) socket.destroy(); for (const s of sessions) s.destroy();
  if (child) {
    const container = `aegis-envoy-${child.pid}`;
    proof.command('container-stop', ['docker', 'stop', '--timeout', '2', container]); child.kill('SIGTERM');
    if (child.exitCode === null) { try { await bound(once(child, 'exit'), 5000); } catch { child.kill('SIGKILL'); proof.record.error ??= 'launcher cleanup deadline'; } }
    const remaining = proof.command('container-absence', ['docker', 'ps', '-aq', '--filter', `name=^${container}$`]);
    proof.record.container_absent = remaining.status === 0 && !remaining.stdout.toString().trim();
    assert.ok(proof.record.container_absent);
    proof.record.launcher.ended_at = new Date().toISOString(); proof.record.launcher.exit_code = child.exitCode; proof.record.launcher.signal = child.signalCode;
  }
  observer?.closeAllConnections();
  for (const server of [observer, native]) if (server?.listening) await bound(new Promise((resolve) => server.close(resolve)));
  if (log !== undefined) fs.closeSync(log);
  fs.rmSync(fixture, { recursive: true, force: true });
  proof.record.cleanup = { lock_held_through_cleanup: true, fixture_removed: !fs.existsSync(fixture), wall_ms: Date.now() - started };
  proof.finish();
}
