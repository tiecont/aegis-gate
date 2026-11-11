import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

process.umask(0o077);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shared = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const fixtures = shared.run_directory;
assert.ok(path.isAbsolute(fixtures) && fixtures.startsWith(`${root}/.local/`));
const run = fs.mkdtempSync(path.join(root, '.local/hyper-limits-'));
const binary = path.join(root, 'spikes/hyper/target/release/aegisgate-hyper-feasibility');
const ca = fs.readFileSync(path.join(fixtures, 'ca.pem'));
const results = { started_at: new Date().toISOString(), binary_sha256: createHash('sha256').update(fs.readFileSync(binary)).digest('hex'),
  source: 'additional owned loopback limit probes; shared75 unmodified', tests: [] };
const sockets = new Set();
let uploaded = 0;
let aborted = 0;
let responseClosed = 0;
let dispatches = 0;
const origin = https.createServer({ cert: fs.readFileSync(path.join(fixtures, 'origin.pem')),
  key: fs.readFileSync(path.join(fixtures, 'origin.key')), minVersion: 'TLSv1.2' }, async (req, res) => {
  dispatches++;
  if (req.url === '/upload') {
    req.on('data', (data) => { uploaded += data.length; });
    req.on('aborted', () => { aborted++; });
    req.on('end', () => res.end('complete'));
  } else if (req.url === '/large') {
    res.once('close', () => { responseClosed++; });
    for (let i = 0; i < 320 && !res.destroyed; i++) {
      if (!res.write(Buffer.alloc(32768, 1))) {
        await new Promise((resolve) => {
          const done = () => { res.off('close', done); res.off('drain', done); resolve(); };
          res.once('drain', done); res.once('close', done);
        });
      }
    }
    if (!res.destroyed) res.end();
  } else if (req.url === '/pause') {
    res.write('first');
    res.once('close', () => { responseClosed++; });
  } else { res.end('ready'); }
});
origin.on('connection', (socket) => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
origin.on('clientError', (_, socket) => socket.destroy());

async function listen(server) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); return server.address().port;
}
async function deadline(promise, milliseconds = 5500) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('probe deadline')), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
async function poll(check) {
  for (let i = 0; i < 150; i++) { if (check()) return; await delay(20); }
  assert.ok(check(), 'origin cancellation deadline');
}
const options = (port, target = '/') => ({ host: '127.0.0.1', port, servername: 'edge-a.test', ca,
  agent: false, path: target, headers: { host: 'edge-a.test' } });
async function get(port, target) {
  return deadline(new Promise((resolve, reject) => {
    https.get(options(port, target), (res) => {
      let bytes = 0;
      res.on('data', (chunk) => { bytes += chunk.length; });
      res.once('end', () => resolve({ bytes, ended: true, status: res.statusCode }));
      res.once('error', () => resolve({ bytes, ended: false, status: res.statusCode }));
    }).once('error', reject);
  }));
}
async function test(name, probe) {
  const start = performance.now();
  try { results.tests.push({ name, status: 'pass', detail: await probe(), milliseconds: performance.now() - start }); }
  catch (error) { results.tests.push({ name, status: 'fail', error: error.message, milliseconds: performance.now() - start }); }
  console.log(`${results.tests.at(-1).status.toUpperCase()} ${name}`);
}

let child;
try {
  const originPort = await listen(origin);
  const reservation = net.createServer();
  const port = await listen(reservation); await new Promise((resolve) => reservation.close(resolve));
  const manifest = path.join(run, 'manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({ generation: 1, ca_file: path.join(fixtures, 'ca.pem'), routes: [{
    host: 'edge-a.test', origin_name: 'lab-origin.test', origin_port: originPort, h2: false,
    cert_file: path.join(fixtures, 'edge-a.pem'), key_file: path.join(fixtures, 'edge-a.key'),
  }] }), { mode: 0o600 });
  const fd = fs.openSync(path.join(run, 'proxy.log'), 'w', 0o600);
  child = spawn(binary, [manifest, String(port)], { stdio: ['ignore', fd, fd] }); fs.closeSync(fd);
  for (let i = 0; i < 100; i++) {
    try { assert.equal((await get(port, '/')).status, 200); break; }
    catch (error) { if (i === 99 || child.exitCode !== null) throw error; await delay(20); }
  }

  await test('chunked-upload-enforces-decoded-1MiB-cap-and-cancels-origin', async () => {
    const before = uploaded; const cancellations = aborted;
    const req = https.request({ ...options(port, '/upload'), method: 'POST' });
    let done = false;
    const completed = new Promise((resolve) => {
      req.on('error', () => { done = true; resolve(); });
      req.on('response', (res) => { res.resume(); res.once('end', () => { done = true; resolve(); }); });
      req.once('close', () => { done = true; resolve(); });
    });
    for (let i = 0; i < 40 && !done; i++) { req.write(Buffer.alloc(32768, 1)); await delay(2); }
    req.end(); await deadline(completed); req.destroy();
    await poll(() => aborted > cancellations);
    assert.ok(uploaded - before > 0); assert.ok(uploaded - before <= 1048576);
    return { forwarded_bytes: uploaded - before, cap_bytes: 1048576, origin_cancelled: true };
  });
  await test('stalled-upload-idle-timeout-cancels-origin', async () => {
    const cancellations = aborted;
    const req = https.request({ ...options(port, '/upload'), method: 'POST', headers: { host: 'edge-a.test', 'content-length': 1048576 } });
    req.on('error', () => {}); req.on('response', (res) => res.resume());
    const start = performance.now(); req.write(Buffer.alloc(32768, 1));
    await deadline(poll(() => aborted > cancellations), 5000); req.destroy();
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 2800); return { origin_cancelled: true, elapsed_ms: elapsed };
  });
  await test('response-stream-enforces-8MiB-cap', async () => {
    const result = await get(port, '/large');
    assert.equal(result.ended, false); assert.ok(result.bytes <= 8388608); assert.ok(result.bytes > 0);
    return { ...result, cap_bytes: 8388608 };
  });
  await test('stalled-response-idle-timeout-closes-origin', async () => {
    const before = responseClosed; const start = performance.now();
    const result = await get(port, '/pause');
    await poll(() => responseClosed > before);
    assert.equal(result.ended, false); assert.equal(result.bytes, 5);
    assert.ok(performance.now() - start < 2800);
    return result;
  });
  await test('incomplete-header-deadline-stops-before-origin', async () => {
    const before = dispatches; const start = performance.now();
    const socket = tls.connect({ host: '127.0.0.1', port, servername: 'edge-a.test', ca });
    socket.on('error', () => {});
    await once(socket, 'secureConnect');
    socket.write('GET / HTTP/1.1\r\n'); socket.resume(); await deadline(once(socket, 'close'));
    assert.equal(dispatches, before); assert.ok(performance.now() - start < 2800);
    return { dispatched: 0, elapsed_ms: performance.now() - start };
  });
  await test('incomplete-TLS-handshake-deadline', async () => {
    const start = performance.now(); const socket = net.connect({ host: '127.0.0.1', port });
    socket.on('error', () => {}); await once(socket, 'connect');
    await deadline(once(socket, 'close')); assert.ok(performance.now() - start < 2800);
    return { elapsed_ms: performance.now() - start };
  });
} catch (error) { results.fatal = error.message; }
finally {
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await deadline(once(child, 'exit')); }
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => origin.close(resolve));
  results.completed_at = new Date().toISOString();
  results.result = results.fatal || results.tests.length !== 6 || results.tests.some((t) => t.status === 'fail') ? 'fail' : 'pass';
  results.proxy_log = fs.existsSync(path.join(run, 'proxy.log')) ? fs.readFileSync(path.join(run, 'proxy.log'), 'utf8') : '';
  fs.writeFileSync(path.join(root, 'evidence/sprint03a-c/limits.json'), JSON.stringify(results, null, 2));
  if (results.result === 'fail') process.exitCode = 1;
}
