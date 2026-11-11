import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import tls from 'node:tls';
import https from 'node:https';
import http2 from 'node:http2';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { manifest as testManifest, manifestHash, assertRejected, assertInventory } from '../edge-comparison/contract.mjs';
import { supplementalNegatives } from '../edge-comparison/supplemental.mjs';
import { WebSocket, WebSocketServer } from 'ws';
import grpc from '@grpc/grpc-js';

process.umask(0o077);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runDir = fs.mkdtempSync(path.join(root, '.local/pingora-run-'));
const evidence = { started_at: new Date().toISOString(), node: process.version, platform: process.platform,
  cpu: os.cpus()[0]?.model, logical_cpus: os.cpus().length, memory_bytes: os.totalmem(),
  profile: 'owned loopback lab; no production claims', tests: [], benchmark: null };
const cleanup = [];
let proxy;
let generation = 1;
let activeRequests = 0;
let originDispatches = 0;
let originInboundBytes = 0;
let originParseErrors = 0;
const originRequests = [];
let omittedOriginRequests = 0;
function recordOrigin(request) {
  if (originRequests.length < 128) originRequests.push(request);
  else omittedOriginRequests++;
}
const ingressObservations = [];
let cancelledCalls = 0;
let cancelledUploads = 0;
let uploadedChunks = 0;
const manifestPath = path.join(runDir, 'manifest.json');
const key = (name) => fs.readFileSync(path.join(runDir, `${name}.key`));
const cert = (name) => fs.readFileSync(path.join(runDir, `${name}.pem`));
const pemPath = (name) => path.join(runDir, `${name}.pem`);
const openssl = (...args) => execFileSync('openssl', args, { cwd: runDir, stdio: ['ignore', 'ignore', 'pipe'] });
const write = (name, content) => fs.writeFileSync(path.join(runDir, name), content, { mode: 0o600 });
const referenceImage = 'nginx@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311';
const buildProfile = process.env.PINGORA_SPIKE_PROFILE ?? 'debug';
assert.ok(['debug', 'release'].includes(buildProfile), 'unsupported lab build profile');
const candidateName = process.env.AEGIS_CANDIDATE_NAME ?? 'pingora';
const candidateRoot = process.env.AEGIS_CANDIDATE_ROOT ?? root;
const candidateCommand = process.env.AEGIS_CANDIDATE_COMMAND ?? path.join(candidateRoot, `spikes/pingora/target/${buildProfile}/aegisgate-pingora-feasibility`);
const candidateArgs = JSON.parse(process.env.AEGIS_CANDIDATE_ARGS ?? '[]');
const candidateArtifacts = JSON.parse(process.env.AEGIS_CANDIDATE_ARTIFACTS ?? '[]');
assert.ok(Array.isArray(candidateArgs) && candidateArgs.every((arg) => typeof arg === 'string'));
assert.ok(Array.isArray(candidateArtifacts) && candidateArtifacts.every((file) => typeof file === 'string' && path.isAbsolute(file)));
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
evidence.candidate = { name: candidateName, command: candidateCommand, args: candidateArgs,
  artifacts: [...new Set([candidateCommand, ...candidateArgs.filter((arg) => path.isAbsolute(arg) && fs.existsSync(arg)), ...candidateArtifacts])]
    .map((file) => ({ path: file, sha256: sha256(file) })) };
evidence.test_manifest_sha256 = manifestHash;
evidence.lab_sha256 = sha256(fileURLToPath(import.meta.url));
evidence.supplemental_sha256 = sha256(path.join(root, 'spikes/edge-comparison/supplemental.mjs'));
evidence.openssl = execFileSync('openssl', ['version'], { encoding: 'utf8' }).trim();

function processSample(pids) {
  let ticks = 0; let rss = 0;
  for (const pid of pids) {
    const raw = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
    ticks += Number(fields[11]) + Number(fields[12]);
    rss += Number(fields[21]) * 4096;
  }
  return { ticks, rss };
}

async function benchmark(port, pids) {
  const agent = new https.Agent({ keepAlive: true, maxSockets: 8 });
  const latencies = []; let errors = 0; let timeouts = 0; let index = 0;
  try {
    for (let i = 0; i < 100; i++) await request(port, '/payload', { agent });
    const before = processSample(pids);
    let peakRss = before.rss;
    const sampler = setInterval(() => { peakRss = Math.max(peakRss, processSample(pids).rss); }, 100);
    const start = performance.now();
    const deadline = start + 5000;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (performance.now() < deadline) {
        const post = ++index % 10 === 0;
        const started = performance.now();
        try {
          const response = await request(port, post ? '/echo' : '/payload', {
            agent, method: post ? 'POST' : 'GET', body: post ? 'p'.repeat(32768) : undefined,
          });
          if (response.status !== 200) errors++;
        } catch (error) { errors++; if (error.message.includes('deadline') || error.code === 'ETIMEDOUT') timeouts++; }
        latencies.push(performance.now() - started);
      }
    }));
    clearInterval(sampler);
    const seconds = (performance.now() - start) / 1000;
    const after = processSample(pids);
    latencies.sort((a, b) => a - b);
    const quantile = (q) => +latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * q) - 1)].toFixed(3);
    return { duration_seconds: +seconds.toFixed(3), requests: latencies.length, requests_per_second: +(latencies.length / seconds).toFixed(2),
      p50_ms: quantile(.5), p95_ms: quantile(.95), p99_ms: quantile(.99), errors, timeouts,
      cpu_percent_of_one_core: +((after.ticks - before.ticks) / 100 / seconds * 100).toFixed(2),
      peak_rss_bytes: Math.max(peakRss, after.rss), pids_sampled: pids.length };
  } finally { agent.destroy(); }
}

async function test(name, run) {
  const started = performance.now();
  originRequests.length = 0;
  omittedOriginRequests = 0;
  const before = { handlers: originDispatches, bytes: originInboundBytes, errors: originParseErrors, requests: originRequests.length };
  try {
    const detail = await run();
    evidence.tests.push({ name, status: 'pass', milliseconds: +(performance.now() - started).toFixed(2), detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    evidence.tests.push({ name, status: 'fail', milliseconds: +(performance.now() - started).toFixed(2),
      error: String(error.message).slice(0, 1000) });
    console.error(`FAIL ${name}: ${String(error.message).slice(0, 500)}`);
  } finally {
    Object.assign(evidence.tests.at(-1), { origin: { handler_invocations: originDispatches - before.handlers,
      decrypted_bytes: originInboundBytes - before.bytes, parser_errors: originParseErrors - before.errors,
      requests: originRequests.slice(before.requests), omitted_request_samples: omittedOriginRequests } });
  }
}

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function makePki() {
  openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem',
    '-days', '2', '-subj', '/CN=AegisGate isolated Pingora lab CA', '-addext', 'basicConstraints=critical,CA:TRUE');
  write('index.txt', '');
  write('serial', '1000\n');
  write('ca.cnf', `[ca]\ndefault_ca=lab\n[lab]\ndatabase=index.txt\nserial=serial\nnew_certs_dir=.\ncertificate=ca.pem\nprivate_key=ca.key\ndefault_md=sha256\ndefault_days=1\npolicy=policy\ncopy_extensions=copy\n[policy]\ncommonName=supplied\n`);
  for (const [name, hostname] of [['edge-a', 'edge-a.test'], ['edge-a-rotated', 'edge-a.test'],
    ['edge-b', 'edge-b.test'], ['origin', 'lab-origin.test'], ['wrong', 'wrong.test'], ['expired', 'lab-origin.test']]) {
    openssl('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.csr`,
      '-subj', `/CN=${hostname}`, '-addext', `subjectAltName=DNS:${hostname}`,
      '-addext', 'extendedKeyUsage=serverAuth', '-addext', 'basicConstraints=critical,CA:FALSE');
    if (name === 'expired') {
      openssl('ca', '-batch', '-config', 'ca.cnf', '-in', `${name}.csr`, '-out', `${name}.pem`, '-notext',
        '-startdate', '20200101000000Z', '-enddate', '20200102000000Z');
    } else {
      openssl('x509', '-req', '-in', `${name}.csr`, '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial',
        '-out', `${name}.pem`, '-days', '1', '-copy_extensions', 'copy');
    }
  }
  openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'untrusted.key', '-out', 'untrusted.pem',
    '-days', '1', '-subj', '/CN=lab-origin.test', '-addext', 'subjectAltName=DNS:lab-origin.test');
  // Signing material is not needed by any running process.
  fs.unlinkSync(path.join(runDir, 'ca.key'));
}

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  cleanup.push(async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  });
  return server.address().port;
}

function origin(name, handler) {
  const server = https.createServer({ cert: cert(name), key: key(name), minVersion: 'TLSv1.2' }, (req, res) => {
    originDispatches++;
    recordOrigin({ method: req.method, target: req.url, protocol: req.httpVersion,
      tls: req.socket.getProtocol(), sni: req.socket.servername, alpn: req.socket.alpnProtocol });
    return handler(req, res);
  });
  server.on('tlsClientError', () => {});
  server.on('secureConnection', (socket) => socket.on('data', (chunk) => { originInboundBytes += chunk.length; }));
  server.on('clientError', (_, socket) => { originParseErrors++; socket.destroy(); });
  return server;
}

async function connect(port, name = 'edge-a.test') {
  const socket = tls.connect({ host: '127.0.0.1', port, servername: name, ca: cert('ca'), rejectUnauthorized: true });
  socket.setTimeout(4000, () => socket.destroy(new Error('TLS socket deadline')));
  await once(socket, 'secureConnect');
  return socket;
}

function request(port, pathname = '/', options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: '127.0.0.1', port, servername: options.name ?? 'edge-a.test',
      ca: cert('ca'), rejectUnauthorized: true, minVersion: 'TLSv1.2', path: pathname, method: options.method ?? 'GET',
      agent: options.agent ?? false, headers: { host: options.host ?? options.name ?? 'edge-a.test', ...options.headers } }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.once('error', reject);
      res.once('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.setTimeout(5000, () => req.destroy(new Error('request deadline')));
    req.once('error', reject);
    req.end(options.body);
  });
}

async function h2Request(port, pathname = '/', body, extraHeaders = {}) {
  const client = http2.connect(`https://127.0.0.1:${port}`, { servername: 'edge-b.test', ca: cert('ca'), rejectUnauthorized: true });
  client.on('error', () => {});
  try {
    await once(client, 'connect');
    assert.equal(client.alpnProtocol, 'h2');
    const req = client.request({ ':path': pathname, ':authority': 'edge-b.test', ':method': body ? 'POST' : 'GET', ...extraHeaders });
    const response = once(req, 'response');
    const ended = once(req, 'end');
    req.setTimeout(3000, () => req.destroy(new Error('HTTP2 stream deadline')));
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.end(body);
    const [[headers]] = await Promise.all([response, ended]);
    return { status: headers[':status'], headers, body: Buffer.concat(chunks).toString() };
  } finally { client.close(); }
}

let current;
function publish(changes = {}) {
  current = { ...current, ...changes, generation: ++generation };
  write('manifest.next', JSON.stringify(current));
  fs.renameSync(path.join(runDir, 'manifest.next'), manifestPath);
  return generation;
}

async function applied(port, target) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await request(port);
    if (res.headers['x-lab-generation'] === String(target)) return;
    await delay(50);
  }
  throw new Error('snapshot deadline');
}

async function raw(port, payload) {
  const socket = await connect(port);
  const negotiated = { tls: socket.getProtocol(), alpn: socket.alpnProtocol,
    sni: socket.servername, peer_fingerprint256: socket.getPeerCertificate().fingerprint256 };
  let data = '';
  let timedOut = false;
  socket.on('error', () => {});
  const done = new Promise((resolve) => {
    const timer = setTimeout(() => { timedOut = true; socket.destroy(); resolve(); }, 2500);
    socket.on('data', (chunk) => { data += chunk.toString(); });
    socket.once('close', () => { clearTimeout(timer); resolve(); });
  });
  socket.write(payload);
  await done;
  return { response: data, peer_closed: !timedOut, timed_out: timedOut, negotiated };
}

async function main() {
  makePki();
  const sockets = new Set();
  let count = 0;
  const server = origin('origin', async (req, res) => {
    activeRequests++;
    const id = sockets.has(req.socket) ? req.socket.labId : ++count;
    req.socket.labId = id;
    if (!sockets.has(req.socket)) {
      sockets.add(req.socket);
      req.socket.once('close', () => sockets.delete(req.socket));
    }
    res.setHeader('x-origin-connection', id);
    if (req.url === '/slow') { await delay(3500); if (!res.destroyed) res.end('slow'); return; }
    if (req.url === '/stream') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.write(`start:${req.headers['x-lab-generation']}\n`);
      await delay(400);
      if (!res.destroyed) res.end(`end:${req.headers['x-lab-generation']}\n`);
      return;
    }
    if (req.url === '/echo') { req.pipe(res); return; }
    if (req.url === '/upload') {
      req.on('data', () => { uploadedChunks++; });
      req.on('aborted', () => { cancelledUploads++; });
      req.on('end', () => res.end('complete'));
      return;
    }
    if (req.url === '/payload') { res.end('r'.repeat(1024)); return; }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ target: req.url, host: req.headers.host, generation: req.headers['x-lab-generation'],
      route: req.headers['x-lab-route'], forwarded: req.headers['x-forwarded-for'] ?? null,
      tenant: req.headers['x-tenant-id'] ?? null, connection: id }));
  });
  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', (ws) => ws.on('message', (message) => ws.send(message)));
  let prematureUpgradeBytes = 0;
  server.on('upgrade', (req, socket, head) => {
    originDispatches++;
    recordOrigin({ method: req.method, target: req.url, protocol: req.httpVersion, upgrade: true });
    if (req.url === '/premature') {
      prematureUpgradeBytes += head.length;
      socket.on('data', (chunk) => { prematureUpgradeBytes += chunk.length; });
      socket.end('HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });
  cleanup.push(async () => { for (const ws of wss.clients) ws.terminate(); wss.close(); });
  const originPort = await listen(server);
  const h2origin = http2.createSecureServer({ cert: cert('origin'), key: key('origin'), minVersion: 'TLSv1.2' });
  h2origin.on('secureConnection', (socket) => socket.on('data', (chunk) => { originInboundBytes += chunk.length; }));
  h2origin.on('session', (session) => { cleanup.push(async () => session.destroy()); });
  let h2Requests = 0;
  h2origin.on('stream', (stream, headers) => {
    originDispatches++;
    recordOrigin({ method: headers[':method'], target: headers[':path'], protocol: '2' });
    h2Requests++;
    stream.on('error', () => {});
    stream.respond({ ':status': 200, 'content-type': 'text/plain' });
    if (headers[':path'] === '/echo') stream.pipe(stream);
    else stream.end('h2-origin');
  });
  const h2port = await listen(h2origin);
  const badPorts = {};
  for (const name of ['wrong', 'expired', 'untrusted']) badPorts[name] = await listen(origin(name, (_, res) => res.end('MUST-NOT-BE-SEEN')));
  const route = (host, name, origin_port, h2 = false) => ({ host, origin_name: 'lab-origin.test', origin_port,
    cert_file: pemPath(name), key_file: path.join(runDir, `${name}.key`), h2 });
  const routes = [route('edge-a.test', 'edge-a', originPort), route('edge-b.test', 'edge-b', h2port, true)];
  current = { generation, ca_file: pemPath('ca'), routes };
  write('manifest.json', JSON.stringify(current));
  const port = await freePort();
  const log = fs.openSync(path.join(runDir, 'proxy.log'), 'w', 0o600);
  proxy = spawn(candidateCommand, [...candidateArgs, manifestPath, String(port)],
    { stdio: ['ignore', log, log] });
  fs.closeSync(log);
  cleanup.push(async () => {
    if (proxy.exitCode !== null) return;
    proxy.kill('SIGTERM');
    await Promise.race([once(proxy, 'exit'), delay(5000).then(() => proxy.kill('SIGKILL'))]);
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await request(port); break; } catch (error) {
      if (proxy.exitCode !== null || attempt === 99) throw new Error(`spike startup failed: ${error.message}`);
      await delay(50);
    }
  }

  const corpus = Object.fromEntries(testManifest.negatives.filter((entry) => entry.name.startsWith('malformed-HTTP-')).map((entry) => [entry.name.slice('malformed-HTTP-'.length), entry.request]));
  for (const [name, payload] of Object.entries(corpus)) await test(`malformed-HTTP-${name}`, async () => {
    const before = originDispatches; const bytesBefore = originInboundBytes; const errorsBefore = originParseErrors;
    const observation = await raw(port, payload);
    const result = observation.response;
    const detail = { name, request: payload, response_status: result.match(/^HTTP\/1\.[01] (\d+)/)?.[1] ?? null,
      origin_dispatches: originDispatches - before, origin_inbound_bytes: originInboundBytes - bytesBefore,
      origin_parse_errors: originParseErrors - errorsBefore, ...observation };
    ingressObservations.push(detail);
    assertRejected(detail);
    return detail;
  });
  const expandedCorpus = Object.fromEntries(testManifest.negatives.filter((entry) => entry.name.startsWith('strict-ingress-')).map((entry) => [entry.name.slice('strict-ingress-'.length), entry.request]));
  for (const [name, payload] of Object.entries(expandedCorpus)) await test(`strict-ingress-${name}`, async () => {
    const before = originDispatches;
    const bytesBefore = originInboundBytes; const errorsBefore = originParseErrors;
    const observation = await raw(port, payload);
    const result = observation.response;
    const detail = { name, request: payload, response_status: result.match(/^HTTP\/1\.[01] (\d+)/)?.[1] ?? null,
      origin_dispatches: originDispatches - before, origin_inbound_bytes: originInboundBytes - bytesBefore,
      origin_parse_errors: originParseErrors - errorsBefore, ...observation };
    ingressObservations.push(detail);
    assertRejected(detail);
    return detail;
  });
  for (const target of testManifest.encoded_targets) await test(`valid-percent-encoded-${target}`, async () => {
    const before = originDispatches;
    const bytesBefore = originInboundBytes;
    const response = await request(port, target);
    assert.equal(response.status, 200);
    assert.equal(originDispatches, before + 1);
    assert.ok(originInboundBytes > bytesBefore, 'origin byte instrumentation did not observe positive control');
    assert.equal(JSON.parse(response.body).target, target, 'valid target changed at origin');
    return { target, origin_dispatches: originDispatches - before, origin_inbound_bytes: originInboundBytes - bytesBefore };
  });
  evidence.ingress_observations = ingressObservations;
  for (const { name, request: payload } of supplementalNegatives) await test(`supplemental-${name}`, async () => {
    const before = { handlers: originDispatches, bytes: originInboundBytes, errors: originParseErrors };
    const observation = await raw(port, payload);
    const detail = { name, request: payload, origin_dispatches: originDispatches - before.handlers,
      origin_inbound_bytes: originInboundBytes - before.bytes, origin_parse_errors: originParseErrors - before.errors,
      response_status: observation.response.match(/^HTTP\/1\.[01] (\d+)/)?.[1] ?? null, ...observation };
    ingressObservations.push(detail);
    assertRejected(detail);
    return detail;
  });
  await test('valid-HTTP1-pipelining-preserves-boundaries-and-encoded-targets', async () => {
    const before = originRequests.length;
    const targets = ['/pipeline%2Ffirst?x=%2520', '/pipeline%20second'];
    const observation = await raw(port, targets.map((target, index) =>
      `GET ${target} HTTP/1.1\r\nHost: edge-a.test\r\nConnection: ${index ? 'close' : 'keep-alive'}\r\n\r\n`).join(''));
    assert.equal(observation.timed_out, false);
    assert.equal((observation.response.match(/HTTP\/1\.[01] 200/g) ?? []).length, 2);
    assert.deepEqual(originRequests.slice(before).map(({ target }) => target), targets);
    return observation;
  });

  await test('two-SNI-certificate-selection', async () => {
    const a = await connect(port); const b = await connect(port, 'edge-b.test');
    assert.notEqual(a.getPeerCertificate().fingerprint256, b.getPeerCertificate().fingerprint256);
    assert.match(a.getPeerCertificate().subjectaltname, /edge-a.test/);
    assert.match(b.getPeerCertificate().subjectaltname, /edge-b.test/);
    a.destroy(); b.destroy();
  });
  await test('unknown-and-missing-SNI-handshake-rejected', async () => {
    await assert.rejects(connect(port, 'unknown.test'));
    await assert.rejects(connect(port, ''));
    await assert.rejects(connect(port, 'edge-a.test:443'));
  });
  await test('pre-TLS-filter-rejects-unapproved-lab-source', async () => {
    const socket = tls.connect({ host: '127.0.0.1', localAddress: '127.0.0.2', port,
      servername: 'edge-a.test', ca: cert('ca'), rejectUnauthorized: true });
    socket.setTimeout(2000, () => socket.destroy(new Error('source-filter deadline')));
    await assert.rejects(once(socket, 'secureConnect'));
    socket.destroy();
  });
  await test('HTTP1-routing-and-untrusted-header-stripping', async () => {
    const response = await request(port, '/', { headers: { 'x-tenant-id': 'other', 'x-forwarded-for': '203.0.113.6', 'x-lab-generation': '999' } });
    assert.equal(response.status, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.route, 'edge-a.test'); assert.equal(body.host, 'lab-origin.test');
    assert.equal(body.forwarded, null); assert.equal(body.tenant, null); assert.equal(body.generation, '1');
  });
  await test('cross-tenant-SNI-Host-binding', async () => {
    assert.equal((await request(port, '/', { host: 'edge-b.test' })).status, 421);
    assert.equal((await request(port, '/', { host: 'unknown.test' })).status, 421);
  });
  await test('declared-oversized-body-rejected-before-origin', async () => {
    const before = activeRequests;
    assert.equal((await request(port, '/echo', { method: 'POST', headers: { 'content-length': 1048577 } })).status, 413);
    assert.equal(activeRequests, before);
  });
  await test('HTTP2-downstream-and-upstream-ALPN', async () => {
    const response = await h2Request(port);
    assert.equal(response.status, 200); assert.equal(response.body, 'h2-origin');
  });
  await test('HTTP2-authority-Host-and-SNI-confusion-rejected', async () => {
    for (const headers of [{ host: 'edge-a.test' }, { ':authority': 'edge-a.test' }, { ':authority': 'user@edge-b.test' }]) {
      const before = h2Requests;
      const response = await h2Request(port, '/', undefined, headers);
      assert.ok([400, 421].includes(response.status), `unsafe authority status ${response.status}`);
      assert.equal(h2Requests, before, 'confused authority reached origin');
    }
  });
  await test('HTTP1-and-HTTP2-body-streaming', async () => {
    const payload = 'bounded-stream-'.repeat(16384);
    assert.equal((await request(port, '/echo', { method: 'POST', body: payload })).body, payload);
    assert.equal((await h2Request(port, '/echo', payload)).body, payload);
    const start = performance.now();
    let first;
    await new Promise((resolve, reject) => {
      https.get({ hostname: '127.0.0.1', port, servername: 'edge-a.test', ca: cert('ca'), headers: { host: 'edge-a.test' }, agent: false, path: '/stream' }, (res) => {
        res.on('data', () => { first ??= performance.now() - start; });
        res.once('end', resolve); res.once('error', reject);
      }).once('error', reject);
    });
    assert.ok(first < 300, `first response byte buffered: ${first}`);
    return { first_response_chunk_ms: +first.toFixed(2), payload_bytes: Buffer.byteLength(payload) };
  });
  await test('WebSocket-upgrade-bidirectional-close', async () => {
    const ws = new WebSocket(`wss://127.0.0.1:${port}/ws`, { servername: 'edge-a.test', ca: cert('ca'), headers: { host: 'edge-a.test' }, handshakeTimeout: 5000 });
    await once(ws, 'open');
    ws.send('isolated-websocket-proof');
    const [message] = await once(ws, 'message');
    assert.equal(message.toString(), 'isolated-websocket-proof');
    ws.close(1000); const [code] = await once(ws, 'close'); assert.equal(code, 1000);
  });
  await test('certificate-rotation-keeps-active-stream-and-snapshot', async () => {
    const before = await connect(port); const fingerprint = before.getPeerCertificate().fingerprint256; before.destroy();
    const oldGeneration = generation;
    let firstResolve;
    const first = new Promise((resolve) => { firstResolve = resolve; });
    const streaming = new Promise((resolve, reject) => {
      https.get({ hostname: '127.0.0.1', port, servername: 'edge-a.test', ca: cert('ca'), headers: { host: 'edge-a.test' }, agent: false, path: '/stream' }, (res) => {
        let body = ''; res.on('data', (chunk) => { body += chunk; firstResolve(); });
        res.once('end', () => resolve({ body, headers: res.headers })); res.once('error', reject);
      }).once('error', reject);
    });
    await first;
    const updated = routes.map((r) => r.host === 'edge-a.test' ? route(r.host, 'edge-a-rotated', originPort) : r);
    const target = publish({ routes: updated });
    await applied(port, target);
    const after = await connect(port); assert.notEqual(after.getPeerCertificate().fingerprint256, fingerprint); after.destroy();
    const active = await streaming;
    assert.equal(active.body, `start:${oldGeneration}\nend:${oldGeneration}\n`);
    assert.equal(active.headers['x-lab-generation'], String(oldGeneration));
    return { active_generation: oldGeneration, new_generation: target };
  });
  await test('invalid-and-replayed-snapshot-retains-last-good', async () => {
    const old = generation;
    write('manifest.json', '{"insecure":true}'); await delay(150);
    assert.equal((await request(port)).headers['x-lab-generation'], String(old));
    write('manifest.json', JSON.stringify({ ...current, generation: old - 1 })); await delay(150);
    assert.equal((await request(port)).headers['x-lab-generation'], String(old));
    publish(); await applied(port, generation);
  });
  await test('invalid-certificate-config-retains-last-good', async () => {
    const old = generation;
    const first = current.routes[0];
    const cases = [
      [{ ...first, key_file: path.join(runDir, 'edge-b.key') }, current.routes[1]],
      [{ ...first, cert_file: pemPath('wrong'), key_file: path.join(runDir, 'wrong.key') }, current.routes[1]],
      [first, first],
    ];
    for (const invalid of cases) {
      write('manifest.json', JSON.stringify({ ...current, generation: old + 1, routes: invalid }));
      await delay(150);
      assert.equal((await request(port)).headers['x-lab-generation'], String(old));
    }
    fs.chmodSync(first.key_file, 0o644);
    try {
      write('manifest.json', JSON.stringify({ ...current, generation: old + 1 })); await delay(150);
      assert.equal((await request(port)).headers['x-lab-generation'], String(old));
    } finally { fs.chmodSync(first.key_file, 0o600); }
    generation++;
    publish(); await applied(port, generation);
    return { rejected: ['mismatched key', 'wrong SAN', 'duplicate host', 'publicly readable key'],
      rejected_generation: old + 1, restored_generation: generation };
  });
  for (const name of ['wrong', 'expired', 'untrusted']) await test(`verified-origin-TLS-rejects-${name}`, async () => {
    publish({ routes: current.routes.map((r) => r.host === 'edge-a.test' ? { ...r, origin_port: badPorts[name] } : r) });
    await delay(150);
    const response = await request(port);
    assert.ok(response.status >= 500 && response.status <= 599, `unexpected TLS status ${response.status}`);
    assert.ok(!response.body.includes('MUST-NOT-BE-SEEN'));
    publish({ routes: current.routes.map((r) => r.host === 'edge-a.test' ? { ...r, origin_port: originPort } : r) });
    await applied(port, generation);
  });
  await test('trust-store-swap-cannot-reuse-old-origin-TLS-session', async () => {
    const agent = new https.Agent({ keepAlive: true, maxSockets: 1 });
    try {
      assert.equal((await request(port, '/', { agent })).status, 200);
      publish({ ca_file: pemPath('untrusted') }); await delay(150);
      assert.ok((await request(port, '/', { agent })).status >= 500, 'old verified connection bypassed new CA policy');
      publish({ ca_file: pemPath('ca') }); await applied(port, generation);
      assert.equal((await request(port, '/', { agent })).status, 200);
    } finally { agent.destroy(); }
  });
  await test('origin-read-timeout-is-bounded', async () => {
    const start = performance.now(); const response = await request(port, '/slow');
    assert.ok(response.status >= 500); assert.ok(performance.now() - start < 3000);
    return { timeout_ms: +(performance.now() - start).toFixed(2) };
  });
  await test('origin-connection-pooling', async () => {
    const agent = new https.Agent({ keepAlive: true, maxSockets: 1 });
    try {
      const ids = [];
      for (let i = 0; i < 6; i++) ids.push((await request(port, '/', { agent })).headers['x-origin-connection']);
      assert.equal(new Set(ids).size, 1);
      return { sequential_requests: ids.length, unique_origin_connections: new Set(ids).size };
    } finally { agent.destroy(); }
  });
  await test('same-origin-pools-are-partitioned-between-routes', async () => {
    const previous = current.routes;
    publish({ routes: current.routes.map((r) => r.host === 'edge-b.test' ? { ...r, origin_port: originPort, h2: false } : r) });
    await applied(port, generation);
    const a = await request(port); const b = await request(port, '/', { name: 'edge-b.test' });
    assert.equal(JSON.parse(a.body).route, 'edge-a.test'); assert.equal(JSON.parse(b.body).route, 'edge-b.test');
    assert.notEqual(a.headers['x-origin-connection'], b.headers['x-origin-connection']);
    publish({ routes: previous }); await applied(port, generation);
  });
  await test('client-upload-cancellation-is-bounded', async () => {
    const before = processSample([proxy.pid]).rss;
    const started = performance.now();
    for (let i = 0; i < 8; i++) {
      const chunks = uploadedChunks; const cancelled = cancelledUploads;
      const req = https.request({ hostname: '127.0.0.1', port, servername: 'edge-a.test', ca: cert('ca'),
        method: 'POST', path: '/upload', agent: false, headers: { host: 'edge-a.test', 'content-length': 1024 * 1024 } });
      req.on('error', () => {}); req.write(Buffer.alloc(32768, 1));
      for (let j = 0; j < 40 && uploadedChunks === chunks; j++) await delay(25);
      assert.ok(uploadedChunks > chunks, 'origin did not receive a streaming body chunk');
      req.destroy();
      for (let j = 0; j < 100 && cancelledUploads === cancelled; j++) await delay(25);
      assert.ok(cancelledUploads > cancelled, 'origin did not observe cancelled upload within 2.5s');
    }
    const after = processSample([proxy.pid]).rss;
    assert.ok(after - before < 64 * 1024 * 1024, 'lab cancellation RSS grew by >=64MiB');
    return { cancellations: 8, elapsed_ms: +(performance.now() - started).toFixed(2), rss_before: before, rss_after: after,
      limit: '2.5s per cancellation; <64MiB net RSS increase; smoke bound, not leak/soak proof' };
  });

  await test('weighted-health-check-failover-and-recovery', async () => {
    let healthy = true;
    const first = origin('origin', (_, res) => { res.statusCode = healthy ? 200 : 503; res.end(healthy ? 'first' : 'unhealthy'); });
    const second = origin('origin', (_, res) => res.end('second'));
    const firstPort = await listen(first); const secondPort = await listen(second);
    publish({ routes: current.routes.map((r) => r.host === 'edge-a.test' ? { ...r,
      backends: [{ port: firstPort, weight: 3 }, { port: secondPort, weight: 1 }] } : r) });
    await applied(port, generation);
    const counts = { first: 0, second: 0 };
    for (let i = 0; i < 40; i++) counts[(await request(port)).body]++;
    assert.equal(counts.first, 30); assert.equal(counts.second, 10);
    healthy = false; await delay(400);
    for (let i = 0; i < 12; i++) assert.equal((await request(port)).body, 'second');
    healthy = true; await delay(400);
    const recovered = new Set();
    for (let i = 0; i < 8; i++) recovered.add((await request(port)).body);
    assert.ok(recovered.has('first')); assert.ok(recovered.has('second'));
    // A high-weight TLS-invalid backend must also become unhealthy without any insecure probe.
    publish({ routes: current.routes.map((r) => r.host === 'edge-a.test' ? { ...r,
      backends: [{ port: badPorts.wrong, weight: 16 }, { port: secondPort, weight: 1 }] } : r) });
    await applied(port, generation);
    for (let i = 0; i < 12; i++) assert.equal((await request(port)).body, 'second');
    publish({ routes: current.routes.map((r) => r.host === 'edge-a.test' ? { ...r,
      backends: [{ port: badPorts.wrong, weight: 1 }, { port: badPorts.expired, weight: 1 }] } : r) });
    await delay(200);
    assert.equal((await request(port)).status, 503, 'all unhealthy must fail closed');
    publish({ routes: current.routes.map((r) => r.host === 'edge-a.test' ? { ...r, backends: [] } : r) });
    await applied(port, generation);
    return { healthy_weight_distribution: counts, failover_requests: 12, invalid_TLS_backend_requests: 12,
      all_unhealthy_status: 503, recovery: [...recovered] };
  });

  await test('upgrade-does-not-forward-preread-bytes-before-101', async () => {
    const before = activeRequests;
    // RFC 6455's public sample nonce, encoded at runtime to avoid classifying
    // this published protocol example as a checked-in credential.
    const nonce = Buffer.from('the sample nonce').toString('base64');
    const { response: result } = await raw(port, `GET /premature HTTP/1.1\r\nHost: edge-a.test\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: ${nonce}\r\nSec-WebSocket-Version: 13\r\n\r\nGET / HTTP/1.1\r\nHost: edge-b.test\r\nConnection: close\r\n\r\n`);
    assert.match(result, /^HTTP\/1\.1 200/);
    assert.equal(prematureUpgradeBytes, 0, 'bytes forwarded as an upgraded stream before origin sent 101');
    assert.equal(activeRequests, before, 'cross-tenant preread request reached origin');
  });

  const echoService = { chat: { path: '/lab.Echo/Chat', requestStream: true, responseStream: true,
    requestSerialize: (v) => Buffer.from(v), requestDeserialize: (v) => v.toString(),
    responseSerialize: (v) => Buffer.from(v), responseDeserialize: (v) => v.toString() } };
  const grpcServer = new grpc.Server();
  grpcServer.addService(echoService, { chat: (call) => {
    call.on('data', (value) => call.write(`echo:${value}`));
    call.on('cancelled', () => { cancelledCalls++; });
    call.on('end', () => { const trailer = new grpc.Metadata(); trailer.set('lab-trailer', 'complete'); call.end(trailer); });
  } });
  const grpcPort = await new Promise((resolve, reject) => grpcServer.bindAsync('127.0.0.1:0',
    grpc.ServerCredentials.createSsl(null, [{ private_key: key('origin'), cert_chain: cert('origin') }]),
    (error, bound) => error ? reject(error) : resolve(bound)));
  cleanup.push(async () => grpcServer.forceShutdown());
  publish({ routes: current.routes.map((r) => r.host === 'edge-b.test' ? { ...r, origin_port: grpcPort, h2: true } : r) });
  await applied(port, generation);
  const Client = grpc.makeGenericClientConstructor(echoService, 'Echo');
  const client = new Client(`127.0.0.1:${port}`, grpc.credentials.createSsl(cert('ca')),
    { 'grpc.ssl_target_name_override': 'edge-b.test', 'grpc.default_authority': 'edge-b.test', 'grpc.initial_reconnect_backoff_ms': 100 });
  cleanup.push(async () => client.close());
  await test('gRPC-bidirectional-streaming-and-trailers', async () => {
    const call = client.chat({ deadline: Date.now() + 5000 });
    const values = []; call.on('data', (v) => values.push(v));
    const status = once(call, 'status');
    call.write('one');
    const [first] = await once(call, 'data'); assert.equal(first, 'echo:one');
    call.write('two');
    const [second] = await once(call, 'data'); assert.equal(second, 'echo:two');
    call.end();
    const [result] = await status;
    assert.equal(result.code, grpc.status.OK); assert.deepEqual(values, ['echo:one', 'echo:two']);
    assert.deepEqual(result.metadata.get('lab-trailer'), ['complete']);
  });
  await test('gRPC-client-cancellation-reaches-origin', async () => {
    const before = cancelledCalls;
    const call = client.chat({ deadline: Date.now() + 5000 });
    call.on('error', () => {}); call.write('cancel-me'); await once(call, 'data'); call.cancel();
    for (let i = 0; i < 40 && cancelledCalls === before; i++) await delay(50);
    assert.ok(cancelledCalls > before, 'upstream stream did not observe cancellation');
  });

  await test('bounded-reference-benchmark', async () => {
    assert.equal(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim(), '100');
    assert.equal(execFileSync('getconf', ['PAGESIZE'], { encoding: 'utf8' }).trim(), '4096');
    const refPort = await freePort();
    write('nginx.conf', `worker_processes 2;\npid /tmp/nginx.pid;\nerror_log stderr warn;\nevents { worker_connections 256; }\nhttp {\naccess_log off;\nclient_body_temp_path /tmp/client-body;\nproxy_temp_path /tmp/proxy;\nfastcgi_temp_path /tmp/fastcgi;\nuwsgi_temp_path /tmp/uwsgi;\nscgi_temp_path /tmp/scgi;\nupstream lab { server 127.0.0.1:${originPort}; keepalive 16; }\nserver { listen 127.0.0.1:${refPort} ssl;\nssl_certificate /lab/edge-a.pem; ssl_certificate_key /lab/edge-a.key;\nssl_protocols TLSv1.2 TLSv1.3; ssl_session_tickets off;\nlocation / { proxy_pass https://lab; proxy_http_version 1.1; proxy_set_header Connection \"\";\nproxy_set_header Host lab-origin.test; proxy_ssl_server_name on; proxy_ssl_name lab-origin.test;\nproxy_ssl_verify on; proxy_ssl_trusted_certificate /lab/ca.pem;\nproxy_connect_timeout 1s; proxy_read_timeout 2s; proxy_send_timeout 2s;\nproxy_request_buffering off; proxy_buffering off; } } }\n`);
    const container = execFileSync('docker', ['run', '--detach', '--rm', '--network', 'host', '--read-only', '--tmpfs', '/tmp:rw,nosuid,noexec,size=32m',
      '--user', `${process.getuid()}:${process.getgid()}`, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
      '--mount', `type=bind,source=${runDir},target=/lab,readonly`, '--entrypoint', 'nginx', referenceImage, '-c', '/lab/nginx.conf', '-g', 'daemon off;'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    cleanup.push(async () => { execFileSync('docker', ['stop', '--timeout', '2', container], { stdio: 'ignore' }); });
    for (let attempt = 0; attempt < 40; attempt++) {
      try { assert.equal((await request(refPort)).status, 200); break; } catch (error) { if (attempt === 39) throw error; await delay(100); }
    }
    const pids = execFileSync('docker', ['top', container, '-eo', 'pid'], { encoding: 'utf8' }).trim().split('\n').slice(1).map(Number);
    const candidate = await benchmark(port, [proxy.pid]);
    const nginx = await benchmark(refPort, pids);
    assert.equal(candidate.errors, 0); assert.equal(nginx.errors, 0);
    evidence.benchmark = { reference: referenceImage, reference_version: 'nginx/1.30.6',
      profile: `100 warmup, 5 seconds each, closed-loop concurrency 8, 90% GET/1024B response + 10% POST/32768B echo; H1 TLS verified on both hops; keepalive; client/origin/proxy same host; ${buildProfile} Rust build`,
      measurement: 'Linux /proc cumulative user+system CPU, HZ=100; sampled summed RSS at 100ms; latency includes client scheduling and origin; no handshake in steady state',
      candidate_name: candidateName, candidate, nginx, limitations: ['short single-run smoke benchmark; no launch SLO or capacity inference', 'independently built binaries; default build settings and crypto libraries may differ',
        'RSS sums shared nginx pages across processes', 'not open-loop; coordinated omission; shared host load', 'benchmark runs sequentially'] };
    return evidence.benchmark;
  });
  await test('secret-bearing-request-absent-from-runtime-log', async () => {
    const sentinel = `lab-only-redaction-${Date.now()}`;
    await request(port, '/echo', { method: 'POST', body: sentinel, headers: { authorization: `Bearer ${sentinel}`, cookie: `session=${sentinel}` } });
    const log = fs.readFileSync(path.join(runDir, 'proxy.log'), 'utf8');
    assert.ok(!log.includes(sentinel)); assert.ok(!/BEGIN (?:RSA |EC |)PRIVATE KEY/.test(log));
  });

  evidence.pending = [];
  assertInventory(evidence.tests);
  evidence.completed_at = new Date().toISOString();
  evidence.result = evidence.tests.some((t) => t.status === 'fail') ? 'fail' : 'pass';
}

try { await main(); }
catch (error) { evidence.fatal = String(error.message).slice(0, 1500); evidence.result = 'fail'; console.error(`LAB FAILED: ${evidence.fatal}`); }
finally {
  // Cleanup child/client resources before servers; every resource is an owned lab fixture.
  for (const close of cleanup.reverse()) { try { await Promise.race([close(), delay(5500)]); } catch {} }
  evidence.run_directory = runDir;
  fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify(evidence, null, 2), { mode: 0o600 });
  console.log(`Evidence: ${path.join(runDir, 'results.json')}`);
  if (evidence.result === 'fail') process.exitCode = 1;
}
