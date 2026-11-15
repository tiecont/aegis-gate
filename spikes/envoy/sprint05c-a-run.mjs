import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import https from 'node:https';
import net from 'node:net';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { assertLock, listen, until } from './wire-fixtures.mjs';
import { build, command, hash } from './sprint05c-a-build.mjs';
import { runtime, limits, write } from './sprint05c-a-runtime.mjs';

process.umask(0o077); assertLock();
const pinnedNode = '/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node';
assert.equal(fs.realpathSync(process.execPath), fs.realpathSync(pinnedNode));
const record = { argv: process.argv, cwd: process.cwd(), started: new Date().toISOString(), commands: [],
  probes: [], nativeChecks: [], limits, productionEligible: false, runtimeGO: false,
  unchangedOriginalResult: { original75: '73/75 historical, not rerun by A', original23: '19/23 historical, not rerun by A' } };
const git = async (...args) => (await command(record, ['git', ...args])).toString().trim();
assert.equal(await git('status', '--porcelain', '--untracked-files=all'), '', 'commit clean sources before proof');
assert.equal(await git('branch', '--show-current'), 'feat/sprint05c-strict-ingress');
record.sourceCommit = await git('rev-parse', 'HEAD'); record.sourceTree = await git('rev-parse', 'HEAD^{tree}');
record.node = { version: process.version, file: process.execPath, sha256: hash(fs.readFileSync(process.execPath)) };
const sourceFiles = (await git('ls-files', 'spikes/envoy/sprint05c-a-*', 'spikes/envoy/sprint05b-a-build.mjs',
  'spikes/envoy/wire-fixtures.mjs', 'spikes/edge-comparison/manifest.json',
  'scripts/sprint05b-baseline.mjs', 'evidence/sprint05a-b/source-01/sources.json', 'evidence/sprint05c-a/PLAN.md')).split('\n').filter(Boolean);
record.sources = sourceFiles.map((file) => ({ file, sha256: hash(fs.readFileSync(file)) }));
const out = process.argv[2]; assert.match(out ?? '', /^evidence\/sprint05c-a\/run-\d+$/); fs.mkdirSync(out);
const sockets = new Set(), servers = [], rows = [], handlers = [];
const track = (s) => { sockets.add(s); s.once('close', () => sockets.delete(s)); s.on('error', () => {}); return s; };
let fixture, front, addon, connections = 0, parserErrors = 0, tlsErrors = 0, rawBytes = 0, observerActive = 0;
let peakRSS = process.memoryUsage().rss;
const sampling = setInterval(() => { peakRSS = Math.max(peakRSS, process.memoryUsage().rss); }, 10);
const watchdog = setTimeout(() => { record.error ??= '90 second watchdog'; for (const s of sockets) s.destroy(); }, 90000);
try {
  record.baseline = JSON.parse((await command(record, [process.execPath, 'scripts/sprint05b-baseline.mjs'])).toString());
  await command(record, ['/usr/bin/uname', '-a']); await command(record, ['/usr/bin/openssl', 'version']);
  record.tools = ['cc', 'openssl', 'curl'].map((name) => ({ name, file: fs.realpathSync(`/usr/bin/${name}`), sha256: hash(fs.readFileSync(`/usr/bin/${name}`)) }));
  fs.mkdirSync('.local', { recursive: true }); fixture = fs.mkdtempSync(path.resolve('.local/sprint05c-a-'));
  addon = await build(fixture, record);
  const originals = JSON.parse(fs.readFileSync('spikes/edge-comparison/manifest.json')).negatives.filter((p) => /obsolete.fold/.test(p.name));
  assert.equal(originals.length, 2);
  const req = (extra = '', body = '', target = '/', host = 'edge-a.test', close = true, method = 'POST') =>
    `${method} ${target} HTTP/1.1\r\nHost: ${host}\r\n${extra}${close ? 'Connection: close\r\n' : ''}\r\n${body}`;
  const chunked = (body = 'abc', tail = '0\r\nX-End: yes\r\n\r\n', close = true) => req('Transfer-Encoding: chunked\r\nTrailer: X-End\r\n',
    `${Buffer.byteLength(body).toString(16)}\r\n${body}\r\n${tail}`, '/', 'edge-a.test', close);
  function native(parts) {
    const p = addon.createParser(); let last, used = 0, complete = 0;
    try {
      for (const input of parts) {
        let offset = 0, resume = false;
        while (offset < input.length || resume) {
          resume = false; last = p.feed(input.subarray(offset, offset + limits.readBytes));
          used += last.consumed; offset += last.consumed;
          if (last.headersReady) resume = true;
          if (last.complete) complete++;
          if (last.error !== 'HPE_OK' && !last.headersReady && !last.complete) return { last, used, complete };
          assert.ok(last.consumed || last.headersReady || last.complete || offset === input.length);
        }
      }
      const eof = p.finish(); return { last, used, complete, eof };
    } finally { p.close(); }
  }
  for (const [name, raw, valid] of [['no-body', req('Content-Length: 0\r\n'), true],
    ['trailer-valid', chunked(), true], ['fold-sp', chunked('abc', '0\r\nX-End: one\r\n two\r\n\r\n'), false],
    ['fold-tab', chunked('abc', '0\r\nX-End: one\r\n\ttwo\r\n\r\n'), false],
    ...originals.map((o) => [o.name, o.request, false])]) {
    const b = Buffer.from(raw); let splits = 0;
    for (let i = 1; i < b.length; i++) {
      const r = native([b.subarray(0, i), b.subarray(i)]);
      assert.equal(r.complete, valid ? 1 : 0); if (valid) assert.equal(r.eof.error, 'HPE_OK'); else assert.notEqual(r.last.error, 'HPE_OK'); splits++;
    }
    const one = native([...b].map((v) => Buffer.from([v]))); assert.equal(one.complete, valid ? 1 : 0);
    record.nativeChecks.push({ name, bytes: b.length, sha256: hash(b), splits, oneByte: one });
  }
  assert.equal(addon.liveParsers(), 0);
  const pkiDir = path.join(fixture, 'pki'); fs.mkdirSync(pkiDir);
  const openssl = (...args) => command(record, ['/usr/bin/openssl', ...args], { cwd: pkiDir });
  await openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '1',
    '-subj', '/CN=disposable Sprint05C A CA', '-addext', 'basicConstraints=critical,CA:TRUE');
  for (const [name, host] of [['edge-a', 'edge-a.test'], ['edge-b', 'edge-b.test'], ['origin', 'lab-origin.test']]) {
    await openssl('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.csr`, '-subj', `/CN=${host}`, '-addext', `subjectAltName=DNS:${host}`);
    await openssl('x509', '-req', '-in', `${name}.csr`, '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', `${name}.pem`, '-days', '1', '-copy_extensions', 'copy');
  }
  fs.unlinkSync(path.join(pkiDir, 'ca.key'));
  const read = (f) => fs.readFileSync(path.join(pkiDir, f));
  const serverTLS = (name) => ({ key: read(`${name}.key`), cert: read(`${name}.pem`), minVersion: 'TLSv1.2', ALPNProtocols: ['http/1.1'] });
  const clientTLS = (port, servername) => ({ host: '127.0.0.1', port, servername, ca: read('ca.pem'), rejectUnauthorized: true,
    minVersion: 'TLSv1.2', ALPNProtocols: ['http/1.1'], highWaterMark: limits.highWaterMark });
  const origin = https.createServer(serverTLS('origin'), (request, response) => {
    const digest = createHash('sha256');
    const row = { target: request.url, host: request.headers.host, method: request.method, bodyBytes: 0, ended: false, aborted: false };
    handlers.push(row);
    request.on('data', (b) => {
      row.bodyBytes += b.length; digest.update(b);
      if (request.url === '/slow-upload') { request.pause(); setTimeout(() => request.resume(), 3); }
    });
    request.on('aborted', () => { row.aborted = true; });
    request.on('end', () => {
      row.ended = true; row.bodySha256 = digest.digest('hex'); row.trailers = request.rawTrailers;
      if (request.url === '/hold') return;
      if (request.url === '/large-response') { response.writeHead(200, { 'content-length': 4 * 1024 * 1024 }); response.end(Buffer.alloc(4 * 1024 * 1024, 65)); return; }
      response.writeHead(200, { 'content-length': 2 }); response.end('OK');
    });
  });
  origin.on('connection', track); origin.on('clientError', (_e, s) => { parserErrors++; s.destroy(); });
  origin.on('tlsClientError', () => { tlsErrors++; }); servers.push(origin); const handlerPort = await listen(origin);
  // This TLS relay accounts for raw decrypted bytes before the HTTP handler.
  const observer = tls.createServer(serverTLS('origin'), (down) => {
    track(down); connections++; observerActive++; down.pause();
    const h = createHash('sha256'); const row = { bytes: 0, sha256: null, sni: down.servername, alpn: down.alpnProtocol }; rows.push(row);
    const up = track(tls.connect(clientTLS(handlerPort, 'lab-origin.test')));
    const close = () => { down.destroy(); up.destroy(); };
    down.on('data', (b) => { rawBytes += b.length; row.bytes += b.length; h.update(b); });
    down.once('close', () => { row.sha256 = h.digest('hex'); observerActive--; });
    for (const s of [down, up]) { s.on('error', close); s.once('close', close); }
    up.once('secureConnect', () => { row.authorized = up.authorized; down.pipe(up); up.pipe(down); });
  });
  observer.on('connection', track); observer.on('tlsClientError', () => { tlsErrors++; }); servers.push(observer); const originPort = await listen(observer);
  const routes = new Map(['a', 'b'].map((letter) => [`edge-${letter}.test`, { tenant: `tenant-${letter}`, enabled: true, generation: 7,
    port: originPort, ca: read('ca.pem'), originName: 'lab-origin.test', edge: serverTLS(`edge-${letter}`) }]));
  front = await runtime({ addon, edgeTLS: serverTLS('edge-a'), routes, directory: path.join(fixture, 'stage') });
  const snapshot = () => ({ bytes: rawBytes, connections, handlers: handlers.length, rows: rows.length, parserErrors, tlsErrors });
  const delta = (b) => ({ bytes: rawBytes - b.bytes, connections: connections - b.connections,
    handlers: handlers.slice(b.handlers), raw: rows.slice(b.rows), parserErrors: parserErrors - b.parserErrors, tlsErrors: tlsErrors - b.tlsErrors });
  const zero = (d) => { assert.equal(d.bytes, 0); assert.equal(d.connections, 0); assert.equal(d.handlers.length, 0); assert.equal(d.parserErrors, 0); assert.equal(d.tlsErrors, 0); };
  const settled = async () => { await until(() => observerActive === 0 && front.tcpConnections === 0 && front.metrics.activeContexts === 0); await delay(15); };
  const connect = async (name = 'edge-a.test', port = front.port) => {
    const socket = track(tls.connect(clientTLS(port, name))); await once(socket, 'secureConnect');
    assert.equal(socket.authorized, true); assert.equal(socket.alpnProtocol, 'http/1.1'); return socket;
  };
  function collect(socket) {
    const chunks = []; let size = 0; const begun = performance.now();
    socket.on('data', (b) => { size += b.length; assert.ok(size <= 8 * 1024 * 1024); chunks.push(Buffer.from(b)); });
    const done = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.destroy(); reject(new Error('test peer-close deadline')); }, 7000);
      socket.once('close', () => { clearTimeout(timer); const b = Buffer.concat(chunks); resolve({ statuses: [...b.toString().matchAll(/HTTP\/1\.1 (\d{3})/g)].map((m) => Number(m[1])), bytes: b.length, sha256: hash(b), elapsedMs: performance.now() - begun, peerClosed: true }); });
    });
    return done;
  }
  async function probe(name, raw, status, options = {}) {
    await settled(); const before = snapshot(), s = await connect(options.sni); const done = collect(s);
    if (options.parts) { for (const p of options.parts) { s.write(p); await delay(options.delay ?? 2); } }
    else s.write(raw);
    const response = await done; await settled(); const d = delta(before);
    assert.deepEqual(response.statuses, status, name);
    if (status.every((v) => v >= 400) && !options.allowOrigin) zero(d);
    if (options.exact) { assert.equal(d.bytes, Buffer.byteLength(options.exact)); assert.equal(d.raw.map((r) => r.bytes).reduce((a, n) => a + n, 0), d.bytes);
      if (d.raw.length === 1) assert.equal(d.raw[0].sha256, hash(Buffer.from(options.exact))); }
    const row = { name, inputBytes: Buffer.byteLength(raw), inputSha256: hash(Buffer.from(raw)), response, origin: d };
    if (originals.some((o) => o.request === raw)) row.originalInputHex = Buffer.from(raw).toString('hex');
    record.probes.push(row); return row;
  }

  const valid = req('Content-Length: 0\r\n');
  await probe('observer-positive-control', valid, [200], { exact: valid });
  for (const o of originals) {
    await probe(o.name, o.request, [400]);
    await probe(`${o.name}-one-byte`, o.request, [400], { parts: [...Buffer.from(o.request)].map((v) => Buffer.from([v])), delay: 1 });
  }
  for (const [name, raw, status] of [
    ['mismatch', req('', '', '/', 'edge-b.test'), 421], ['unknown', req('', '', '/', 'unknown.test'), 421],
    ['duplicate-host', req('Host: edge-a.test\r\n'), 400], ['userinfo-host', req('', '', '/', 'user@edge-a.test'), 400],
    ['host-port', req('', '', '/', 'edge-a.test:444'), 400], ['empty-host', req('', '', '/', ''), 400],
    ['missing-host', 'GET / HTTP/1.1\r\nConnection: close\r\n\r\n', 400],
    ['forwarded-host-not-binding', req('X-Forwarded-Host: edge-a.test\r\nX-Tenant-ID: tenant-a\r\n', '', '/', 'edge-b.test'), 421],
    ['duplicate-CL', req('Content-Length: 0\r\nContent-Length: 0\r\n'), 400],
    ['CL-list', req('Content-Length: 0, 0\r\n'), 400], ['CL-TE', req('Content-Length: 0\r\nTransfer-Encoding: chunked\r\n', '0\r\n\r\n'), 400],
    ['TE-repeat', req('Transfer-Encoding: chunked, chunked\r\n', '0\r\n\r\n'), 400], ['TE-gzip', req('Transfer-Encoding: gzip, chunked\r\n', '0\r\n\r\n'), 400],
    ['TE-nonfinal', req('Transfer-Encoding: chunked, gzip\r\n', '0\r\n\r\n'), 400], ['TE-identity', req('Transfer-Encoding: identity\r\n'), 400],
    ['connection-framing-token', req('Connection: content-length\r\nContent-Length: 0\r\n'), 400],
    ['expect', req('Expect: 100-continue\r\nContent-Length: 4\r\n', 'data'), 417],
    ['ftp', req('', '', 'ftp://edge-a.test/'), 400], ['absolute-mismatch', req('', '', 'https://edge-b.test/'), 400],
    ['absolute-userinfo', req('', '', 'https://user@edge-a.test/'), 400], ['fragment', req('', '', '/bad#fragment'), 400],
    ['relative', req('', '', 'relative'), 400], ['bad-percent', req('', '', '/bad%xx'), 400],
    ['raw-NUL', req('', '', '/bad\0target'), 400], ['raw-SP', req('', '', '/bad target'), 400],
    ['folded-trailer-sp', chunked('abc', '0\r\nX-End: one\r\n two\r\n\r\n'), 400],
    ['folded-trailer-tab', chunked('abc', '0\r\nX-End: one\r\n\ttwo\r\n\r\n'), 400],
    ['forbidden-trailer', chunked('abc', '0\r\nHost: edge-b.test\r\n\r\n'), 400],
    ['forbidden-trailer-declaration', req('Transfer-Encoding: chunked\r\nTrailer: Host\r\n', '0\r\n\r\n'), 400],
    ['invalid-declared-trailer', req('Transfer-Encoding: chunked\r\nTrailer: x bad\r\n', '0\r\n\r\n'), 400],
    ['undeclared-trailer', chunked('abc', '0\r\nX-Other: yes\r\n\r\n'), 400],
    ['bad-chunk', req('Transfer-Encoding: chunked\r\n', 'z\r\nabc\r\n0\r\n\r\n'), 400],
    ['declared-oversize', req(`Content-Length: ${limits.bodyBytes + 1}\r\n`), 413],
    ['header-limit', req(`X-Large: ${'a'.repeat(18000)}\r\n`), 413],
  ]) await probe(name, raw, [status]);
  for (const target of ['/bad%20target', '/bad%09target', '/bad%01target', '/bad%00target', '/bad%2Ftarget', '/a/../b?x=%23', 'https://edge-a.test/a%2Fb?x=1']) {
    const raw = req('Content-Length: 0\r\n', '', target); const r = await probe(`exact-target-${target}`, raw, [200], { exact: raw }); assert.equal(r.origin.handlers[0].target, target);
  }
  const bValid = req('Content-Length: 0\r\n', '', '/', 'edge-b.test'); await probe('tenant-b', bValid, [200], { sni: 'edge-b.test', exact: bValid });
  const canonical = req('Content-Length: 0\r\n', '', '/', 'EDGE-A.TEST:443'); await probe('canonical-host', canonical, [200], { exact: canonical });
  const first = req('Content-Length: 3\r\n', 'abc', '/first', 'edge-a.test', false), second = chunked('def', undefined, true);
  await probe('mixed-stream-disk-pipeline', first + second, [200, 200], { exact: first + second });
  const dFirst = chunked('xyz', undefined, false), sLast = req('Content-Length: 0\r\n', '', '/last');
  await probe('mixed-disk-stream-pipeline', dFirst + sLast, [200, 200], { exact: dFirst + sLast });
  await probe('valid-invalid-pipeline', first + originals[0].request + valid, [200, 400], { exact: first });
  await probe('invalid-valid-pipeline', originals[0].request + valid, [400]);
  const smuggle = req('Content-Length: 1\r\nTransfer-Encoding: chunked\r\n', '0\r\n\r\n') + valid;
  await probe('CL-TE-pipeline', smuggle, [400]);
  const wireFragment = chunked('fragmented');
  await probe('one-byte-valid-chunked', wireFragment, [200], { parts: [...Buffer.from(wireFragment)].map((v) => Buffer.from([v])), delay: 1, exact: wireFragment });
  await probe('one-byte-valid-CL', first + sLast, [200, 200], { parts: [...Buffer.from(first + sLast)].map((v) => Buffer.from([v])), delay: 1, exact: first + sLast });
  const pipelinePart = req('Content-Length: 0\r\n', '', '/pipeline-cap', 'edge-a.test', false);
  await probe('ordered-connection-message-cap', pipelinePart.repeat(limits.messages + 1), [...Array(limits.messages).fill(200), 503], { exact: pipelinePart.repeat(limits.messages) });
  const fTrailer = chunked('abc', '0\r\nX-End: first\r\n second\r\n\r\n');
  await probe('late-fold-reused-pipeline', first + fTrailer, [200, 400], { exact: first });

  // Observe upstream body progress before completing a known-length upload.
  await settled(); {
    const before = snapshot(), peers = [], finished = [];
    for (let i = 0; i < limits.stageFiles; i++) {
      const s = await connect(); peers.push(s); finished.push(collect(s)); s.write(req('Transfer-Encoding: chunked\r\nTrailer: X-End\r\n', '1000\r\n'));
    }
    await until(() => front.quota.files === limits.stageFiles);
    const s = await connect(), done = collect(s); s.write(chunked('abc', '')); const response = await done; assert.deepEqual(response.statuses, [503]);
    for (const p of peers) p.destroy(); await Promise.all(finished); await settled(); zero(delta(before));
    assert.equal(front.quota.files, 0); record.probes.push({ name: 'aggregate-stage-file-cap', response, origin: delta(before), released: true });
  }
  await settled(); {
    const before = snapshot(), s = await connect(), done = collect(s), body = Buffer.alloc(2 * 1024 * 1024, 97);
    const head = req(`Content-Length: ${body.length}\r\n`, '', '/slow-upload');
    s.write(head); s.write(body.subarray(0, 65536));
    await until(() => handlers.length > before.handlers && handlers.at(-1).bodyBytes >= 32768);
    const early = delta(before); assert.ok(early.bytes > 0); assert.equal(early.handlers[0].ended, false);
    const signal = AbortSignal.timeout(4000);
    for (let at = 65536; at < body.length; at += limits.readBytes) await write(s, body.subarray(at, at + limits.readBytes), signal);
    const response = await done; await settled(); const d = delta(before);
    assert.deepEqual(response.statuses, [200]); assert.equal(d.handlers[0].bodyBytes, body.length); assert.equal(d.handlers[0].bodySha256, hash(body));
    assert.equal(d.raw[0].sha256, hash(Buffer.concat([Buffer.from(head), body])));
    record.probes.push({ name: 'two-MiB-known-length-stream', early: { bytes: early.bytes, ended: false }, response, origin: d });
  }
  // Disk stage stays private and has no origin effects before the final trailer.
  await settled(); {
    const before = snapshot(), s = await connect(), done = collect(s), body = 'b'.repeat(1024 * 1024);
    const prefix = chunked(body, ''), tail = '0\r\nX-End: yes\r\n\r\n';
    s.write(prefix); await until(() => front.quota.bytes >= Buffer.byteLength(prefix)); await delay(75); zero(delta(before));
    const files = fs.readdirSync(path.join(fixture, 'stage'));
    assert.equal(files.length, 1); assert.equal(fs.statSync(path.join(fixture, 'stage', files[0])).mode & 0o777, 0o600);
    s.write(tail); const response = await done; await settled(); const d = delta(before);
    assert.deepEqual(response.statuses, [200]); assert.equal(d.raw[0].sha256, hash(Buffer.from(prefix + tail))); assert.equal(d.handlers[0].bodyBytes, body.length);
    record.probes.push({ name: 'one-MiB-private-stage', beforeCompletion: { bytes: 0, dials: 0, privateMode: '0600' }, response, origin: d });
  }
  for (const folded of [' ', '\t']) {
    await settled(); const before = snapshot(), s = await connect(), done = collect(s), prefix = chunked('c'.repeat(65536), '');
    s.write(prefix); await until(() => front.quota.bytes >= Buffer.byteLength(prefix)); await delay(60); zero(delta(before));
    s.write(`0\r\nX-End: one\r\n${folded}two\r\n\r\n`); const response = await done; await settled(); const d = delta(before); zero(d); assert.deepEqual(response.statuses, [400]);
    record.probes.push({ name: `delayed-folded-${folded === ' ' ? 'sp' : 'tab'}`, response, origin: d });
  }
  const oversizeStage = chunked('s'.repeat(limits.stageBytes)); await probe('per-request-disk-cap', oversizeStage, [413]);
  await settled(); {
    const before = snapshot(), peers = [], finished = [];
    for (let i = 0; i < 2; i++) { const s = await connect(); peers.push(s); finished.push(collect(s)); s.write(chunked('q'.repeat(800000), '')); }
    await until(() => front.quota.bytes > 1500000);
    const s = await connect(); peers.push(s); const last = collect(s); s.write(chunked('q'.repeat(600000), ''));
    const response = await last; assert.deepEqual(response.statuses, [503]);
    for (const p of peers) p.destroy(); await Promise.all(finished); await until(() => front.quota.bytes === 0); await settled(); const d = delta(before); zero(d);
    record.probes.push({ name: 'aggregate-disk-quota', response, origin: d, peakDisk: front.metrics.peakDisk, released: front.quota.bytes });
  }
  await settled(); {
    const before = snapshot(), s = await connect(), done = collect(s); s.write(chunked('q'.repeat(65536), ''));
    await until(() => front.quota.bytes > 0); s.destroy(); await done; await until(() => front.quota.bytes === 0); await settled(); const d = delta(before); zero(d);
    record.probes.push({ name: 'stage-cancel', origin: d, released: true });
  }
  await settled(); {
    const before = snapshot(), s = await connect(), done = collect(s); s.write(req('Content-Length: 1048576\r\n', 'u'.repeat(65536), '/hold'));
    await until(() => handlers.length > before.handlers && handlers.at(-1).bodyBytes > 0); const started = performance.now();
    s.destroy(); await done; await settled(); const d = delta(before); assert.ok(d.handlers[0].aborted); assert.ok(d.bytes > 0);
    record.probes.push({ name: 'stream-upload-cancel', cancellationMs: performance.now() - started, origin: d });
  }
  await probe('stage-idle-408', chunked('abc', ''), [408]);
  await settled(); {
    const before = snapshot(), s = await connect(), done = collect(s); s.write(req('Transfer-Encoding: chunked\r\nTrailer: X-End\r\n', 'fffff\r\n'));
    const interval = setInterval(() => s.write('x'), 150); const response = await done; clearInterval(interval); await settled(); zero(delta(before));
    assert.deepEqual(response.statuses, [408]); assert.ok(response.elapsedMs >= limits.requestMs - 20);
    record.probes.push({ name: 'stage-absolute-408-waiting-for-progress', response, origin: delta(before), progressBeforeCompletion: false });
  }
  await settled(); {
    const before = snapshot(), s = await connect(), done = collect(s); s.write('POST / HTTP/1.1\r\nHost: edge-a.test\r\nX-Slow: ');
    const interval = setInterval(() => s.write('a'), 150); const response = await done; clearInterval(interval); await settled(); const d = delta(before); zero(d);
    assert.deepEqual(response.statuses, [408]); assert.ok(response.elapsedMs >= limits.requestMs - 20); assert.ok(response.elapsedMs < limits.requestMs + 500);
    record.probes.push({ name: 'absolute-header-408', response, origin: d });
  }
  await settled(); {
    const before = snapshot(), peers = [], done = [];
    for (let i = 0; i < 4; i++) { const s = await connect(); peers.push(s); done.push(collect(s)); s.write(req('Content-Length: 0\r\n', '', '/hold')); }
    await until(() => front.slots.active === 2 && front.slots.queue.length === 2);
    const fifthBefore = snapshot(), s = await connect(), last = collect(s); s.write(valid); const response = await last; assert.deepEqual(response.statuses, [503]); zero(delta(fifthBefore));
    for (const p of peers) p.destroy(); await Promise.all(done); await until(() => front.slots.active === 0 && front.slots.queue.length === 0); await settled();
    record.probes.push({ name: 'origin-queue-503-and-cancel', response, origin: delta(before), peak: front.metrics.peakOriginQueue });
  }
  await probe('origin-timeout-504', req('Content-Length: 0\r\n', '', '/hold'), [504], { allowOrigin: true });
  await settled(); {
    const before = snapshot(), s = await connect(), done = collect(s); s.write(req('Content-Length: 0\r\n', '', '/large-response'));
    // A stalled downstream must backpressure the bounded origin response path.
    s.pause(); await delay(150); const observed = { ...front.metrics }; s.destroy(); await done; await settled();
    assert.ok(observed.writeWaits > 0); record.probes.push({ name: 'response-backpressure-cancel', observed, origin: delta(before) });
  }
  await settled(); {
    const peers = []; for (let i = 0; i < limits.connections; i++) peers.push(track(net.connect(front.port, '127.0.0.1')));
    await until(() => front.metrics.peakConnections === limits.connections);
    const extra = track(net.connect(front.port, '127.0.0.1')); await new Promise((resolve) => extra.once('close', resolve));
    assert.ok(front.metrics.connectionRejects >= 1); for (const s of peers) s.destroy();
    record.probes.push({ name: 'TCP-handshake-cap', cap: limits.connections, rejected: true });
  }
  await delay(25);
  await settled(); {
    const before = snapshot(); const s = track(tls.connect(clientTLS(front.port, 'unknown.test'))); let failed = false;
    s.on('error', () => { failed = true; }); await new Promise((resolve) => s.once('close', resolve)); assert.ok(failed); zero(delta(before));
    record.probes.push({ name: 'unknown-SNI-TLS-denial', origin: delta(before) });
  }
  const savedName = routes.get('edge-a.test').originName; routes.get('edge-a.test').originName = 'wrong.test';
  await probe('origin-hostname-verification', valid, [502], { allowOrigin: true }); routes.get('edge-a.test').originName = savedName;

  // Competing chunked streaming experiment: deliberately expose a parsed prefix,
  // then observe that strict trailer rejection cannot recall those origin bytes.
  await settled(); {
    const before = snapshot(), p = addon.createParser(), prefix = Buffer.from(chunked('x'.repeat(65536), ''));
    const up = await connect('lab-origin.test', originPort); up.resume(); let used = 0;
    try {
      while (used < prefix.length) {
        const parsed = p.feed(prefix.subarray(used, used + limits.readBytes));
        assert.ok(parsed.error === 'HPE_OK' || parsed.headersReady); up.write(prefix.subarray(used, used + parsed.consumed)); used += parsed.consumed;
      }
      await until(() => handlers.length > before.handlers && handlers.at(-1).bodyBytes >= 32768);
      const prior = delta(before), tail = Buffer.from('0\r\nX-End: first\r\n second\r\n\r\n'); const rejected = p.feed(tail);
      assert.equal(rejected.error, 'HPE_INVALID_HEADER_TOKEN'); assert.ok(prior.bytes > 0); up.destroy(); await settled();
      const d = delta(before); assert.ok(d.handlers[0].aborted);
      record.streamingStop = { scope: 'tested H1 chunked upload with late folded trailer', prefixBytes: prefix.length,
        originBeforeFinalTrailer: prior.bytes, beforeHandlers: prior.handlers.length, tailHex: tail.toString('hex'), parser: rejected,
        origin: d, zeroByteAndEarlyProgressCoexist: false, finiteStageIsIndefiniteStreaming: false };
    } finally { p.close(); up.destroy(); }
  }
  record.observer = { allConnections: rows, handlers, rawBytes, connections, parserErrors, tlsErrors };
  record.metrics = front.metrics;
  assert.ok(front.metrics.peakDisk <= limits.diskBytes); assert.ok(front.metrics.peakHeaderHeld <= limits.headerWireBytes);
  assert.ok(front.metrics.peakPending <= limits.readBytes); assert.ok(front.metrics.peakOriginQueue <= limits.originQueue);
  assert.ok(front.metrics.peakReadable <= limits.readableBytes);
  assert.ok(front.metrics.peakOriginActive <= limits.originActive);
  record.complete = true;
} catch (e) { record.error = { name: e.name, message: e.message, stack: e.stack }; process.exitCode = 1; }
finally {
  if (front) record.metrics = front.metrics;
  record.observer ??= { allConnections: rows, handlers, rawBytes, connections, parserErrors, tlsErrors };
  clearInterval(sampling); clearTimeout(watchdog);
  try {
    assertLock(); for (const s of sockets) s.destroy(); if (front) await front.close();
    for (const server of servers.reverse()) await new Promise((resolve) => server.close(resolve));
    await until(() => sockets.size === 0);
    if (fixture) fs.rmSync(fixture, { recursive: true, force: true });
    record.cleanup = { fixtureAbsent: !fixture || !fs.existsSync(fixture), sockets: sockets.size,
      nativeParsers: addon?.liveParsers() ?? 0, diskBytes: front?.quota.bytes ?? 0, stageFiles: front?.quota.files ?? 0,
      originActive: front?.slots.active ?? 0, originQueued: front?.slots.queue.length ?? 0, activeContexts: front?.metrics.activeContexts ?? 0,
      listenersClosed: servers.every((s) => !s.listening), lockHeld: true };
    assert.equal(record.cleanup.nativeParsers, 0); assert.equal(record.cleanup.activeContexts, 0);
  } catch (e) { record.cleanupError = { name: e.name, message: e.message, stack: e.stack }; process.exitCode = 1; }
  record.peakObserverProcessRSS = peakRSS; record.ended = new Date().toISOString();
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ complete: !!record.complete, error: record.error, cleanup: record.cleanup, probes: record.probes.length }));
}
