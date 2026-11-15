// Additive bounded protocol/counterexample fixture, never an original oracle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http2 from 'node:http2';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { assertLock, pki, listen, freePort, until } from './wire-fixtures.mjs';
import { createTlsObserver } from '../edge-comparison/tls-observer.mjs';
import { sha, git } from './sprint05c-b-lib.mjs';
const grpc = createRequire(new URL('../pingora/package.json', import.meta.url))('@grpc/grpc-js');
process.umask(0o077); assertLock();
const [output, runRoot] = process.argv.slice(2);
assert.ok(path.isAbsolute(output) && path.isAbsolute(runRoot) && !fs.existsSync(output));
const fixture = fs.mkdtempSync(path.join(runRoot, 'sprint05c-b-matrix-'));
const r = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'), argv: process.argv,
  scope: 'supplemental protocol/causal observations only; original75/23 remain authoritative',
  started_at: new Date().toISOString(), tests: [], security_pass: false };
const save = () => fs.writeFileSync(output, JSON.stringify(r, null, 2)+'\n');
const clients = new Set(), sessions = new Set(), servers = [], relaySockets = new Set();
const handlers = [], events = []; let bytes = 0, accepts = 0, connectionId = 0, omitted = 0;
let child, log, grpcServer, native, material, manifest, file, edgePort, cancelled = 0;
const bounds = { bytes: 2 << 20, events: 4096 };
let kept = 0;
async function bound(promise, ms = 5000) {
  let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('bounded matrix deadline')), ms); })]); }
  finally { clearTimeout(timer); }
}
async function test(name, fn) {
  const started_at = new Date().toISOString(), before = snapshot();
  try { r.tests.push({ name, started_at, status: 'pass', detail: await fn(), before, after: snapshot() }); }
  catch (error) { r.tests.push({ name, started_at, status: 'fail', error: error.stack, before, after: snapshot() }); }
  console.log(`${r.tests.at(-1).status.toUpperCase()} ${name}`); save();
}
function snapshot() { return { bytes, accepts, handlers: handlers.length, events: events.length }; }
function capture(event) {
  const size = event.hex ? event.hex.length/2 : 0;
  if (events.length >= bounds.events || kept + size > bounds.bytes) { omitted++; return; }
  kept += size; events.push({ sequence: events.length+1, time_ns: process.hrtime.bigint().toString(), ...event });
}
async function relay(port) {
  const server = createTlsObserver({ cert: material.read('origin.pem'), key: material.read('origin.key'), ca: material.read('ca.pem'), port,
    onBytes: (n) => { bytes += n; }, onTransportError: () => capture({ kind: 'transport-error' }) });
  servers.push(server); let id = 0;
  server.on('connection', () => { accepts++; });
  server.on('secureConnection', (s) => {
    id++; const connection = `${port}:${id}`; relaySockets.add(s); s.on('close', () => relaySockets.delete(s));
    capture({ kind: 'secure', connection, sni: s.servername, alpn: s.alpnProtocol,
      local: { address: s.localAddress, port: s.localPort }, remote: { address: s.remoteAddress, port: s.remotePort } });
    s.on('data', (b) => capture({ kind: 'bytes', direction: 'proxy_to_origin', connection, hex: b.toString('hex') }));
    const write = s.write;
    s.write = function(b, encoding) {
      capture({ kind: 'bytes', direction: 'origin_to_proxy', connection, hex: Buffer.from(b, typeof encoding === 'string' ? encoding : undefined).toString('hex') });
      return write.apply(this, arguments);
    };
  });
  return listen(server);
}
async function connect(host = 'edge-b.test') {
  const c = http2.connect(`https://127.0.0.1:${edgePort}`, { servername: host, ca: material.read('ca.pem'), rejectUnauthorized: true, ALPNProtocols: ['h2'] });
  clients.add(c); c.on('close', () => clients.delete(c)); c.on('error', () => {});
  await bound(once(c, 'connect')); assert.equal(c.socket.authorized, true); assert.equal(c.alpnProtocol, 'h2'); c.proofHost = host; return c;
}
function request(c, extra = {}) {
  const stream = c.request({ ':method': 'GET', ':authority': c.proofHost, ':path': '/', ...extra });
  let headers, error; const chunks = []; stream.on('response', (h) => { headers = h; });
  stream.on('data', (b) => chunks.push(b)); stream.on('error', (e) => { error = e.code; }); stream.end();
  return bound(new Promise((resolve) => stream.on('close', () => resolve({ status: headers?.[':status'] ?? null,
    rst_code: stream.rstCode, error: error ?? null, connection: headers?.['x-origin-connection'],
    generation: headers?.['x-origin-generation'], body: Buffer.concat(chunks).toString() }))));
}
function publish(changes = {}) {
  manifest = { ...manifest, ...changes, generation: manifest.generation+1 };
  fs.writeFileSync(`${file}.next`, JSON.stringify(manifest)); fs.renameSync(`${file}.next`, file);
}
async function applied(c) {
  for (let i=0; i<40; i++) { const response = await request(c); if (response.generation === String(manifest.generation)) return response; await delay(25); }
  throw Error('generation deadline');
}
function rawSince(index) { return events.slice(index).filter((e) => e.kind === 'bytes' && e.direction === 'proxy_to_origin').map((e) => e.hex).join(''); }
try {
  material = pki(fixture);
  native = http2.createSecureServer({ cert: material.read('origin.pem'), key: material.read('origin.key'), minVersion: 'TLSv1.2' });
  servers.push(native);
  native.on('session', (s) => {
    s.proofId = ++connectionId; s.initialAck = once(s, 'localSettings');
    sessions.add(s); s.on('error', () => {}); s.on('close', () => sessions.delete(s));
  });
  native.on('stream', (s, h) => {
    handlers.push({ connection: s.session.proofId, stream: s.id, route: h['x-lab-route'], generation: h['x-lab-generation'],
      protocol: 'h2', path: h[':path'] });
    s.on('error', () => {});
    const reply = () => {
      if (s.destroyed) return;
      s.respond({ ':status': 200, 'x-origin-connection': String(s.session.proofId), 'x-origin-generation': h['x-lab-generation'] }); s.end('h2-origin');
    };
    if (h[':path'] === '/slow') setTimeout(reply, 150);
    else if (h[':path'] === '/cancel') {
      s.respond({ ':status': 200 }); s.write(Buffer.alloc(4096, 120));
      const ticker = setInterval(() => { if (!s.destroyed) s.write(Buffer.alloc(4096, 120)); }, 20);
      s.once('close', () => { clearInterval(ticker); cancelled++; });
    } else reply();
  });
  const originPort = await relay(await listen(native)); edgePort = await freePort();
  const route = (host, name) => ({ host, origin_name: 'lab-origin.test', origin_port: originPort, h2: true, cert_file: material.file(`${name}.pem`), key_file: material.file(`${name}.key`) });
  manifest = { generation: 1, ca_file: material.file('ca.pem'), routes: [route('edge-a.test', 'edge-a'), route('edge-b.test', 'edge-b')] };
  file = material.file('manifest.json'); fs.writeFileSync(file, JSON.stringify(manifest));
  log = fs.openSync(`${output}.proxy.log`, 'wx');
  child = spawn(process.execPath, ['spikes/envoy/sprint05c-b-launcher.mjs', file, String(edgePort)], { stdio: ['ignore', log, log] });
  r.launcher_pid = child.pid;
  const ready = Date.now()+10000;
  while (true) { try { const c = await connect(); c.destroy(); break; } catch { assert.ok(child.exitCode === null && Date.now()<ready, 'matrix startup'); await delay(50); } }
  await test('cold-host-mismatch-zero-origin', async () => {
    const before = snapshot(), c = await connect(), response = await request(c, { host: 'edge-a.test' }); c.destroy();
    assert.equal(response.status, 421); assert.equal(bytes, before.bytes); assert.equal(accepts, before.accepts); assert.equal(handlers.length, before.handlers); return response;
  });
  const c = await connect(); let pooled;
  await test('valid-cold-warm-sequential-h2-reuse', async () => {
    const rows = []; for (let i=0; i<6; i++) rows.push(await request(c));
    assert.ok(rows.every((x) => x.status===200 && x.body==='h2-origin')); assert.equal(new Set(rows.map((x) => x.connection)).size, 1);
    pooled = [...sessions].find((s) => String(s.proofId) === rows[0].connection); await bound(pooled.initialAck);
    return rows;
  });
  await test('concurrent-eight-streams-one-h2-pool', async () => {
    const rows = await Promise.all(Array.from({ length: 8 }, () => request(c, { ':path': '/slow' })));
    assert.ok(rows.every((x) => x.status===200)); assert.equal(new Set(rows.map((x) => x.connection)).size, 1); return rows;
  });
  await test('warm-original-authority-status-requirements', async () => {
    const rows = [];
    for (const h of [{ host: 'edge-a.test' }, { ':authority': 'edge-a.test' }, { ':authority': 'user@edge-b.test' }]) {
      const before = snapshot(), response = await request(c, h), after = snapshot(); rows.push({ headers: h, response, before, after });
    }
    r.authority_observations = rows; save();
    assert.ok(rows.every((x) => [400,421].includes(x.response.status)), JSON.stringify(rows));
    assert.ok(rows.every((x) => x.after.bytes===x.before.bytes && x.after.handlers===x.before.handlers && x.after.accepts===x.before.accepts)); return rows;
  });
  await test('independent-origin-settings-cause-exact-nine-byte-ack', async () => {
    const before = snapshot();
    await bound(new Promise((resolve, reject) => pooled.settings({ maxConcurrentStreams: 31 }, (e) => e ? reject(e) : resolve())));
    const raw = rawSince(before.events); assert.equal(raw, '000000040100000000'); assert.equal(bytes-before.bytes, 9);
    assert.equal(handlers.length, before.handlers); assert.equal(accepts, before.accepts);
    return { raw_hex: raw, sha256: sha(Buffer.from(raw, 'hex')), downstream_requests: 0, peer_settings: { maxConcurrentStreams: 31 } };
  });
  await test('settings-during-421-is-all-byte-counterexample', async () => {
    const before = snapshot();
    const ack = bound(new Promise((resolve, reject) => pooled.settings({ maxConcurrentStreams: 29 }, (e) => e ? reject(e) : resolve())));
    const [response] = await Promise.all([request(c, { host: 'edge-a.test' }), ack]);
    const raw = rawSince(before.events); assert.equal(response.status, 421); assert.equal(raw, '000000040100000000');
    assert.equal(bytes-before.bytes, 9); assert.equal(handlers.length, before.handlers); assert.equal(accepts, before.accepts);
    return { response, raw_hex: raw, original_all_byte_property: 'FAIL', scope: 'controlled overlapping peer SETTINGS; not an original75 measurement or repair' };
  });
  await test('tenant-pools-do-not-cross-reuse', async () => {
    const a = await connect('edge-a.test'), ar = await request(a), br = await request(c); a.destroy();
    assert.equal(ar.status, 200); assert.equal(br.status, 200); assert.notEqual(ar.connection, br.connection); return { a: ar, b: br };
  });
  await test('generation-swap-preserves-inflight-and-retires-pool', async () => {
    const before = handlers.length, pending = request(c, { ':path': '/slow' });
    await until(() => handlers.length>before); publish();
    const next = await applied(c), old = await pending;
    assert.equal(old.generation, '1'); assert.equal(next.generation, '2'); assert.notEqual(old.connection, next.connection); return { old, next };
  });
  await test('trust-retirement-fails-closed-and-restores-new-pool', async () => {
    const old = await request(c); publish({ ca_file: material.file('untrusted.pem') });
    let rejected; for (let i=0;i<40;i++) { rejected = await request(c); if (rejected.status===503) break; await delay(25); }
    const before = handlers.length; assert.equal(rejected.status, 503); const again = await request(c); assert.equal(again.status,503); assert.equal(handlers.length,before);
    publish({ ca_file: material.file('ca.pem') }); const restored = await applied(c);
    assert.equal(restored.status,200); assert.notEqual(old.connection, restored.connection); return { old, rejected, restored };
  });
  await test('h2-stream-cancellation-reaches-origin', async () => {
    const before = cancelled; const s = c.request({ ':path': '/cancel', ':authority': 'edge-b.test' }); s.on('error',()=>{}); s.end();
    const [chunk] = await bound(once(s, 'data')); s.close(http2.constants.NGHTTP2_CANCEL); s.resume();
    await until(() => cancelled>before); return { first_chunk_bytes: chunk.length, origin_stream_closed: true, upstream_protocol: 'h2' };
  });
  await test('grpc-bidi-streaming-and-trailers-h2', async () => {
    const method = { path: '/lab.Echo/Chat', requestStream: true, responseStream: true,
      requestSerialize: (s)=>Buffer.from(s), requestDeserialize: (b)=>b.toString(), responseSerialize: (s)=>Buffer.from(s), responseDeserialize: (b)=>b.toString() };
    grpcServer = new grpc.Server(); const seen = [];
    grpcServer.addService({ chat: method }, { chat: (call) => {
      call.on('data', (value) => { seen.push(value); call.write('echo:'+value); });
      call.on('end', () => { const trailer = new grpc.Metadata(); trailer.set('lab-trailer','complete'); call.end(trailer); });
    } });
    const port = await new Promise((resolve,reject)=>grpcServer.bindAsync('127.0.0.1:0',grpc.ServerCredentials.createSsl(null,[{ private_key: material.read('origin.key'),cert_chain: material.read('origin.pem') }]),(e,p)=>e?reject(e):resolve(p)));
    const grpcPort = await relay(port); publish({ routes: manifest.routes.map((x)=>x.host==='edge-b.test'?{ ...x, origin_port: grpcPort }:x) });
    // Generation is exposed on the public response for a deterministic config barrier.
    await delay(100);
    const Client = grpc.makeGenericClientConstructor({ chat: method }, 'Echo');
    const client = new Client(`127.0.0.1:${edgePort}`,grpc.credentials.createSsl(material.read('ca.pem')),
      { 'grpc.ssl_target_name_override':'edge-b.test','grpc.default_authority':'edge-b.test' });
    try {
      const call = client.chat({ deadline: Date.now()+5000 }), values=[];
      call.on('error',()=>{}); call.on('data',(v)=>values.push(v)); const status = once(call,'status');
      call.write('one'); await until(()=>values.length===1); call.write('two'); await until(()=>values.length===2); call.end();
      const [result] = await bound(status); assert.equal(result.code,grpc.status.OK); assert.deepEqual(values,['echo:one','echo:two']);
      assert.equal(result.metadata.get('lab-trailer')[0],'complete'); assert.deepEqual(seen,['one','two']);
      return { values, status:result.code, trailer:result.metadata.get('lab-trailer'), upstream_alpn:'h2' };
    } finally { client.close(); }
  });
  await test('drain-completes-established-h2-response', async () => {
    publish({ routes: manifest.routes.map((x)=>x.host==='edge-b.test'?{ ...x, origin_port: originPort }:x) }); await applied(c);
    const before = handlers.length, pending = request(c, { ':path':'/slow' }); await until(()=>handlers.length>before);
    const exited = once(child,'exit'); child.kill('SIGTERM'); const response = await pending; const [code,signal]=await bound(exited);
    assert.equal(response.status,200); assert.equal(response.body,'h2-origin'); assert.equal(code,0); return { response, code, signal };
  });
} catch(error) { r.error = error.stack; }
finally {
  assertLock(); for(const c of clients)c.destroy(); for(const s of sessions)s.destroy(); for(const s of relaySockets)s.destroy();
  grpcServer?.forceShutdown();
  if(child && child.exitCode===null) { child.kill('SIGTERM'); try { await bound(once(child,'exit')); } catch { child.kill('SIGKILL'); await bound(once(child,'exit')); r.cleanup_error='forced launcher kill'; } }
  for(const server of servers.reverse()) { server.closeAllConnections?.(); if(server.listening) await bound(new Promise((resolve)=>server.close(resolve))); }
  if(log!==undefined)fs.closeSync(log);
  fs.rmSync(fixture,{recursive:true,force:true});
  r.capture = { bounds, kept, omitted, events, handlers }; r.cleanup_complete=!fs.existsSync(fixture)&&child?.exitCode!==null&&!r.cleanup_error;
  r.lock_held_through_cleanup=true; r.ended_at=new Date().toISOString(); save();
  process.exitCode=r.error||r.tests.length!==12||r.tests.some((x)=>x.status!=='pass')||omitted||!r.cleanup_complete?1:0;
}
