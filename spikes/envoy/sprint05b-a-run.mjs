import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import tls from 'node:tls';
import https from 'node:https';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { assertLock, listen, until } from './wire-fixtures.mjs';
import { build, hash, command } from './sprint05b-a-build.mjs';
import { admission, limits } from './sprint05b-a-admission.mjs';
import { Admission, Stage, bounds } from './sprint05b-admission.mjs';

process.umask(0o077);
assertLock();
const exec = promisify(execFile);
const git = async (...args) => (await exec('git', args, { encoding: 'utf8', timeout: 10000 })).stdout.trim();
assert.equal(await git('branch', '--show-current'), 'feat/sprint05b-llhttp-admission');
assert.equal(fs.realpathSync(process.execPath), fs.realpathSync('.local/toolchains/node/bin/node'));
assert.equal(await git('status', '--porcelain', '--untracked-files=no'), '', 'commit exact sources before evidence');
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05b-a\/[a-z]+-\d+$/);
fs.mkdirSync(output, { recursive: false });
const sources = (await git('ls-files', 'spikes/envoy/sprint05b*', 'spikes/envoy/wire-fixtures.mjs',
  'spikes/edge-comparison/manifest.json', 'evidence/sprint05a-b/source-01/sources.json',
  'evidence/sprint05b-a/PLAN.md')).split('\n').filter(Boolean);
assert.ok(sources.includes('spikes/envoy/sprint05b-llhttp-addon.c'));
const record = { sourceCommit: await git('rev-parse', 'HEAD'), sourceTree: await git('rev-parse', 'HEAD^{tree}'),
  trackedClean: true, startedAt: new Date().toISOString(), argv: process.argv, cwd: process.cwd(),
  node: { version: process.version, executable: process.execPath, sha256: hash(fs.readFileSync(process.execPath)) },
  sources: sources.map((file) => ({ file, sha256: hash(fs.readFileSync(file)) })), limits,
  fixtureLock: '/tmp/aegisgate-sprint02-fixtures.lock', commands: [], nativeChecks: [], probes: [] };
const sockets = new Set(), servers = [];
const track = (socket) => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); socket.on('error', () => {}); return socket; };
let fixture, front, addon;
const started = Date.now();
const watchdog = setTimeout(() => { record.error ??= '90s watchdog'; for (const s of sockets) s.destroy(); }, 90000);
try {
  await command(record, ['git', 'diff', '--exit-code', '8758b1c84b4186449cd79fabae461ca53ee05100', '--', 'spikes/edge-comparison']);
  await command(record, ['uname', '-a']); await command(record, ['openssl', 'version']);
  record.tools = ['cc', 'openssl', 'curl'].map((name) => {
    const file = fs.realpathSync(`/usr/bin/${name}`);
    return { name, file, sha256: hash(fs.readFileSync(file)) };
  });
  fs.mkdirSync('.local', { recursive: true });
  fixture = fs.mkdtempSync(path.resolve('.local/sprint05b-a-'));
  addon = await build(fixture, record);
  const manifest = JSON.parse(fs.readFileSync('spikes/edge-comparison/manifest.json'));
  const originals = manifest.negatives.filter((p) => /obsolete.fold/.test(p.name));
  const original = originals.find((p) => p.name === 'malformed-HTTP-obsolete-folded-header');
  assert.ok(original);
  assert.equal(originals.length, 2);
  const request = (headers = '', body = '', target = '/', close = true) =>
    `POST ${target} HTTP/1.1\r\nHost: edge-a.test\r\n${headers}${close ? 'Connection: close\r\n' : ''}\r\n${body}`;
  const good = request('Content-Length: 4\r\n', 'test', '/one%2Ftwo?x=%2520');
  const trailer = (fold = '') => request('Transfer-Encoding: chunked\r\nTrailer: X-Folded\r\n',
    `4\r\ntest\r\n0\r\nX-Folded: first${fold ? `\r\n${fold}second` : ' second'}\r\n\r\n`);
  function nativeCheck(name, bytes, parts, expected) {
    const parser = addon.createParser(); let total = 0, calls = 0, complete = 0, error;
    try {
      for (const part of parts) {
        let offset = 0;
        do {
          const r = parser.feed(part.subarray(offset)); calls++; total += r.consumed; offset += r.consumed;
          assert.equal(r.totalConsumed, total); assert.equal(r.feedCalls, calls);
          if (r.complete) { complete++; assert.equal(r.messages, complete); }
          error = r.error;
          if (error !== 'HPE_OK' && error !== 'HPE_PAUSED') break;
          if (!r.complete) assert.equal(offset, part.length);
        } while (offset < part.length);
        if (error !== 'HPE_OK' && error !== 'HPE_PAUSED') break;
      }
      if (expected === 'valid') { assert.equal(complete, 1); assert.equal(total, bytes.length); }
      else { assert.equal(complete, 0); assert.notEqual(error, 'HPE_OK'); assert.notEqual(error, 'HPE_PAUSED'); }
      return { calls, total, complete, error };
    } finally { parser.close(); parser.close(); assert.throws(() => parser.feed(Buffer.from('x'))); }
  }
  for (const [name, raw, expected] of [['valid', good, 'valid'], ['original-obs-fold', original.request, 'reject'],
    ['original-TE-fold', originals[1].request, 'reject'],
    ['valid-trailer', trailer(), 'valid'], ['folded-trailer-sp', trailer(' '), 'reject'],
    ['folded-trailer-tab', trailer('\t'), 'reject']]) {
    const bytes = Buffer.from(raw); let splitChecks = 0;
    for (let split = 1; split < bytes.length; split++) {
      nativeCheck(name, bytes, [Buffer.from(bytes.subarray(0, split)), Buffer.from(bytes.subarray(split))], expected);
      splitChecks++;
    }
    const oneByte = nativeCheck(name, bytes, [...bytes].map((b) => Buffer.from([b])), expected);
    record.nativeChecks.push({ name, inputSha256: hash(bytes), bytes: bytes.length, splitChecks, oneByte });
  }
  const first = addon.createParser(), second = addon.createParser();
  try {
    assert.equal(first.feed(Buffer.from('POST / HTTP/1.1\r\nHost: edge-a.test\r\nContent-Length: 4\r\n\r\nte')).complete, false);
    assert.equal(second.feed(Buffer.from(good)).complete, true);
    assert.equal(first.feed(Buffer.from('st')).complete, true);
    assert.equal(first.finish().error, 'HPE_OK');
  } finally { first.close(); second.close(); }
  const truncated = addon.createParser(); truncated.feed(Buffer.from(good.slice(0, -1)));
  assert.equal(truncated.finish().error, 'HPE_INVALID_EOF_STATE'); truncated.close();
  const oversized = addon.createParser(); assert.throws(() => oversized.feed(Buffer.alloc(32769)), RangeError); oversized.close();
  assert.equal(addon.liveParsers(), 0);
  record.nativeIsolationAndEOF = true;

  record.nativeBounds = { maxWireBytes: addon.maxWireBytes, maxBodyBytes: addon.maxBodyBytes,
    maxMetadataBytes: addon.maxMetadataBytes, maxTargetBytes: addon.maxTargetBytes, maxMessages: addon.maxMessages };
  const longBody = 'x'.repeat(1 << 20), longRaw = request(`Content-Length: ${longBody.length}\r\n`, longBody);
  const longBytes = Buffer.from(longRaw), longParts = [];
  for (let offset = 0; offset < longBytes.length; offset += 16384) longParts.push(Buffer.from(longBytes.subarray(offset, offset + 16384)));
  record.nativeLongBody = nativeCheck('one-MiB-separate-feeds', longBytes, longParts, 'valid');
  for (const [name, raw] of [['target', request('', '', '/' + 'a'.repeat(addon.maxTargetBytes))],
    ['metadata', request(`X-Large: ${'a'.repeat(addon.maxMetadataBytes)}\r\n`)],
    ['body', request(`Content-Length: ${addon.maxBodyBytes + 1}\r\n`, 'b'.repeat(addon.maxBodyBytes + 1))],
    ['messages', request('Content-Length: 0\r\n', '', '/', false).repeat(addon.maxMessages + 1)]]) {
    const parser = addon.createParser(); const bytes = Buffer.from(raw); let last;
    try {
      for (let offset = 0; offset < bytes.length;) {
        last = parser.feed(Buffer.from(bytes.subarray(offset, offset + 16384))); offset += last.consumed;
        if (last.error !== 'HPE_OK' && !last.complete) break;
        assert.ok(last.consumed > 0);
      }
      assert.notEqual(last.error, 'HPE_OK'); assert.notEqual(last.error, 'HPE_PAUSED');
      record.nativeChecks.push({ name: `${name}-limit`, inputSha256: hash(bytes), bytes: bytes.length, last });
    } finally { parser.close(); }
  }
  // Wire lifetime also bounds framing overhead, independently of payload bytes.
  {
    const parser = addon.createParser(); let last;
    parser.feed(Buffer.from('POST / HTTP/1.1\r\nHost: edge-a.test\r\nTransfer-Encoding: chunked\r\n\r\n'));
    const chunk = Buffer.from('1\r\nx\r\n'.repeat(2000));
    try {
      for (let sent = 0; sent <= addon.maxWireBytes; sent += chunk.length) {
        last = parser.feed(chunk); if (last.error !== 'HPE_OK') break;
      }
      assert.equal(last.error, 'HPE_USER');
      record.nativeChecks.push({ name: 'wire-lifetime-limit', last });
    } finally { parser.close(); }
  }
  const pkiDir = path.join(fixture, 'pki'); fs.mkdirSync(pkiDir);
  const openssl = (...argv) => command(record, ['openssl', ...argv], { cwd: pkiDir });
  await openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem',
    '-days', '1', '-subj', '/CN=disposable Sprint05B A CA', '-addext', 'basicConstraints=critical,CA:TRUE');
  for (const [name, host] of [['edge-a', 'edge-a.test'], ['origin', 'lab-origin.test']]) {
    await openssl('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.csr`,
      '-subj', `/CN=${host}`, '-addext', `subjectAltName=DNS:${host}`);
    await openssl('x509', '-req', '-in', `${name}.csr`, '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial',
      '-out', `${name}.pem`, '-days', '1', '-copy_extensions', 'copy');
  }
  fs.unlinkSync(`${pkiDir}/ca.key`);
  const cert = { read: (name) => fs.readFileSync(path.join(pkiDir, name)) };
  const serverTLS = (name) => ({ key: cert.read(`${name}.key`), cert: cert.read(`${name}.pem`), minVersion: 'TLSv1.2',
    ALPNProtocols: ['http/1.1'], handshakeTimeout: 700 });
  const clientTLS = (port, servername) => ({ host: '127.0.0.1', port, servername, ca: cert.read('ca.pem'),
    rejectUnauthorized: true, minVersion: 'TLSv1.2', ALPNProtocols: ['http/1.1'] });
  const wire = [], handlers = [], verifiedOrigins = [];
  let connections = 0, parserErrors = 0, transportErrors = 0, originClosed = 0;
  const origin = https.createServer(serverTLS('origin'), (req, res) => {
    const row = { url: req.url, method: req.method, headers: req.rawHeaders, bodyBytes: 0, ended: false, aborted: false };
    handlers.push(row);
    req.on('data', (b) => { row.bodyBytes += b.length; });
    req.on('aborted', () => { row.aborted = true; });
    res.on('close', () => { originClosed++; });
    req.on('end', () => {
      row.ended = true; row.trailers = req.rawTrailers;
      if (req.url === '/hold') return;
      if (req.url === '/large') { res.writeHead(200, { 'content-length': String(8 << 20) }); res.end(Buffer.alloc(8 << 20, 65)); return; }
      res.writeHead(200, { 'content-length': '2', connection: 'close' }); res.end('OK');
    });
  });
  origin.on('connection', track); origin.on('clientError', (_e, s) => { parserErrors++; s.destroy(); });
  origin.on('tlsClientError', () => { transportErrors++; });
  servers.push(origin); const handlerPort = await listen(origin);
  const observer = tls.createServer(serverTLS('origin'), (down) => {
    track(down); connections++; down.pause();
    const up = track(tls.connect(clientTLS(handlerPort, 'lab-origin.test')));
    const close = () => { down.destroy(); up.destroy(); };
    down.on('data', (b) => wire.push(Buffer.from(b)));
    for (const s of [down, up]) { s.on('error', () => { transportErrors++; close(); }); s.on('close', close); }
    up.once('secureConnect', () => {
      verifiedOrigins.push({ authorized: up.authorized, servername: up.servername, alpn: up.alpnProtocol });
      down.pipe(up); up.pipe(down);
    });
  });
  observer.on('connection', track); observer.on('tlsClientError', () => { transportErrors++; });
  servers.push(observer); const originPort = await listen(observer);
  const controlBytes = 'GET /observer-control HTTP/1.1\r\nHost: lab-origin.test\r\nConnection: close\r\n\r\n';
  const control = track(tls.connect(clientTLS(originPort, 'lab-origin.test'))); control.resume();
  await once(control, 'secureConnect'); const controlClosed = once(control, 'close'); control.write(controlBytes); await controlClosed;
  assert.equal(Buffer.concat(wire).toString(), controlBytes);
  record.observerControl = { exact: true, bytes: Buffer.byteLength(controlBytes), sha256: hash(Buffer.concat(wire)) };
  front = await admission({ addon, edgeTLS: serverTLS('edge-a'), originTLS: { ca: cert.read('ca.pem') }, originPort });
  const snapshot = () => ({ bytes: Buffer.concat(wire).length, connections, handlers: handlers.length, parserErrors, transportErrors });
  const delta = (before) => ({ bytes: Buffer.concat(wire).length - before.bytes, connections: connections - before.connections,
    handlers: handlers.slice(before.handlers), parserErrors: parserErrors - before.parserErrors, transportErrors: transportErrors - before.transportErrors });
  const zero = (d) => { assert.equal(d.bytes, 0); assert.equal(d.connections, 0); assert.equal(d.handlers.length, 0);
    assert.equal(d.parserErrors, 0); assert.equal(d.transportErrors, 0); };
  async function connect() {
    const socket = track(tls.connect(clientTLS(front.port, 'edge-a.test')));
    await once(socket, 'secureConnect'); assert.equal(socket.authorized, true); assert.equal(socket.alpnProtocol, 'http/1.1');
    return socket;
  }
  async function probe(name, raw, { parts, gap = 50, expected = [200], warmup = false, cancel = false } = {}) {
    let before = snapshot(); const socket = await connect();
    const response = []; let peerEnd = false;
    socket.on('data', (b) => response.push(Buffer.from(b))); socket.on('end', () => { peerEnd = true; });
    let timedOut = false; const timer = setTimeout(() => { timedOut = true; socket.destroy(); }, 2500);
    const closed = once(socket, 'close');
    const row = { name, requestBytes: Buffer.byteLength(raw), requestSha256: hash(Buffer.from(raw)),
      identity: { authorized: socket.authorized, protocol: socket.getProtocol(), alpn: socket.alpnProtocol } };
    if (warmup) {
      socket.write(request('Content-Length: 0\r\n', '', '/warmup', false));
      await until(() => Buffer.concat(response).toString().endsWith('\r\n\r\nOK'));
      await until(() => front.metrics.allocatedStaging === 32768);
      row.warmup = delta(before); before = snapshot(); response.length = 0;
    }
    if (parts) {
      socket.write(parts[0]); await delay(gap); row.beforeFinalFragment = delta(before); zero(row.beforeFinalFragment);
      if (cancel) socket.destroy(); else socket.write(parts[1]);
    } else socket.write(raw);
    await closed; clearTimeout(timer); await delay(30);
    row.peerEnd = peerEnd; row.timedOut = timedOut;
    row.status = [...Buffer.concat(response).toString().matchAll(/HTTP\/1\.1 (\d{3})/g)].map((m) => +m[1]);
    row.origin = delta(before); const observed = Buffer.concat(wire).subarray(before.bytes);
    row.origin.sha256 = hash(observed);
    if (observed.length <= 512) row.origin.hex = observed.toString('hex');
    if (!cancel) { assert.deepEqual(row.status, expected, name); assert.equal(peerEnd, true, name); }
    assert.equal(timedOut, false, name);
    if (!expected.includes(200)) zero(row.origin);
    if (expected.every((status) => status === 200)) {
      assert.equal(row.origin.bytes, Buffer.byteLength(raw), name);
      assert.equal(row.origin.sha256, hash(Buffer.from(raw)), name);
    }
    if (originals.some((p) => p.request === raw)) row.originalInputHex = Buffer.from(raw).toString('hex');
    record.probes.push(row);
    console.log(`${name}: ${row.status.join(',') || 'cancelled'} origin=${row.origin.bytes}`);
    return row;
  }
  await probe('valid-original-bytes', good);
  await probe('valid-trailer', trailer());
  await probe(`original-${original.name}`, original.request, { expected: [400] });
  await probe(`original-${originals[1].name}`, originals[1].request, { expected: [400] });
  for (const entry of manifest.negatives.filter((p) => /(?:^|-)(?:CL|TE)-|content-length|transfer-encoding/.test(p.name) && !/obsolete.fold/.test(p.name)))
    await probe(entry.name, entry.request, { expected: [400] });
  await probe('original-obs-fold-reused', original.request, { warmup: true, expected: [400] });
  const headerSplit = original.request.indexOf(' second');
  await probe('fragmented-original-obs-fold', original.request, { parts: [original.request.slice(0, headerSplit), original.request.slice(headerSplit)], expected: [400] });
  for (const fold of [' ', '\t']) {
    const raw = trailer(fold), split = raw.indexOf('0\r\nX-Folded');
    await probe(`late-folded-trailer-${fold === ' ' ? 'sp' : 'tab'}`, raw,
      { parts: [raw.slice(0, split), raw.slice(split)], expected: [400] });
    await probe(`late-folded-trailer-reused-${fold === ' ' ? 'sp' : 'tab'}`, raw,
      { parts: [raw.slice(0, split), raw.slice(split)], expected: [400], warmup: true });
  }
  const validTrailer = trailer(), trailerSplit = validTrailer.indexOf('0\r\nX-Folded');
  await probe('late-valid-trailer-staged', validTrailer, { parts: [validTrailer.slice(0, trailerSplit), validTrailer.slice(trailerSplit)] });
  for (const target of manifest.encoded_targets) {
    const row = await probe(`encoded-${target}`, request('Content-Length: 0\r\n', '', target));
    assert.equal(row.origin.handlers[0].url, target);
  }
  const pipelineFirst = request('Content-Length: 0\r\n', '', '/first', false);
  await probe('valid-pipeline', pipelineFirst + good, { expected: [200, 200] });
  const pipelineBad = await probe('valid-then-original-fold', pipelineFirst + original.request, { expected: [200, 400] });
  assert.equal(pipelineBad.origin.bytes, Buffer.byteLength(pipelineFirst)); assert.equal(pipelineBad.origin.handlers.length, 1);
  await probe('content-length-stream-staged', good, { parts: [good.slice(0, -2), good.slice(-2)] });
  const incomplete = request('Content-Length: 1024\r\n', 'partial', '/cancel');
  await probe('client-cancel-before-complete', incomplete, { parts: [incomplete, ''], cancel: true, expected: [] });
  await probe('oversized-body', request('Content-Length: 40000\r\n', 'a'.repeat(40000)), { expected: [413] });
  await probe('oversized-header', request(`X-Large: ${'a'.repeat(33000)}\r\nContent-Length: 0\r\n`), { expected: [413] });
  await probe('slow-client-idle', incomplete, { expected: [408] });
  const beforeSlow = snapshot(), slow = await connect(); const slowResponse = [];
  slow.on('data', (b) => slowResponse.push(b)); const slowClosed = once(slow, 'close');
  slow.write(incomplete);
  const trickle = setInterval(() => { if (!slow.destroyed) slow.write('x'); }, 150);
  await slowClosed; clearInterval(trickle);
  assert.match(Buffer.concat(slowResponse).toString(), /HTTP\/1.1 408/); zero(delta(beforeSlow));
  record.absoluteDeadline = { observedMs: limits.requestDeadlineMs, zeroOrigin: true };

  // A client waiting for origin progress before sending its final trailer cannot progress.
  const beforeWait = snapshot(), waiting = await connect(); const waitingResponse = [];
  waiting.on('data', (b) => waitingResponse.push(b)); const waitingClosed = once(waiting, 'close');
  waiting.write(validTrailer.slice(0, trailerSplit)); await delay(100);
  zero(delta(beforeWait)); assert.equal(waitingResponse.length, 0);
  await waitingClosed; assert.match(Buffer.concat(waitingResponse).toString(), /HTTP\/1.1 408/);
  record.streamingCounterexample = { prefixBytes: trailerSplit, originAt100ms: delta(beforeWait),
    status: 408, result: 'full-message admission prevents upload streaming and origin progress before final trailers' };

  const beforeCancel = front.metrics.upstreamCancelled;
  const held = await connect(); held.write(request('Content-Length: 0\r\n', '', '/hold'));
  await until(() => handlers.at(-1)?.url === '/hold'); const heldClosed = once(held, 'close'); held.destroy(); await heldClosed;
  await until(() => front.metrics.upstreamCancelled > beforeCancel);
  await delay(30); record.upstreamCancellation = { cancelled: true, originResponseClosures: originClosed };

  const paused = await connect(); paused.pause(); paused.write(request('Content-Length: 0\r\n', '', '/large'));
  await until(() => handlers.at(-1)?.url === '/large'); await delay(150);
  const pausedClosed = once(paused, 'close'); paused.destroy(); await pausedClosed; await delay(40);
  assert.ok(front.metrics.responsePauses > 0); record.slowResponse = { pauses: front.metrics.responsePauses,
    peakWritableBytes: front.metrics.peakClientWritable, cancelled: true };

  const queueBefore = front.metrics.pauses;
  await probe('queue-overflow', pipelineFirst.repeat(8), { expected: [200, 200, 200, 200, 429] });
  assert.ok(front.metrics.pauses > queueBefore);
  const holders = [];
  for (let i = 0; i < limits.connections; i++) holders.push(await connect());
  const extra = track(net.connect({ host: '127.0.0.1', port: front.port })); const extraClosed = once(extra, 'close');
  extra.resume(); await extraClosed;
  assert.equal(front.metrics.rejections.connections, 1);
  for (const s of holders) s.destroy();
  await until(() => front.metrics.allocatedStaging === 0 && addon.liveParsers() === 0);
  assert.ok(front.metrics.peakConnections <= limits.connections);
  assert.ok(front.metrics.peakAllocatedStaging <= limits.stagingBytesGlobal);
  assert.ok(front.metrics.peakStagedBytes <= limits.stagingBytesPerConnection);
  assert.ok(front.metrics.peakQueuedMessages <= limits.queuedMessages);
  record.metrics = front.metrics;
  const badFront = await admission({ addon, edgeTLS: serverTLS('edge-a'), originTLS: { ca: cert.read('ca.pem') },
    originPort, originName: 'wrong.test' });
  const bad = track(tls.connect(clientTLS(badFront.port, 'edge-a.test'))); const badResponse = [];
  bad.on('data', (b) => badResponse.push(b)); await once(bad, 'secureConnect');
  const badClosed = once(bad, 'close'); const beforeBad = snapshot(); bad.write(good); await badClosed;
  assert.match(Buffer.concat(badResponse).toString(), /HTTP\/1.1 502/);
  assert.equal(delta(beforeBad).bytes, 0); await badFront.close();
  record.originTLSMismatch = { status: 502, requestBytes: 0, verificationEnabled: true };

  // Disk staging raises the finite upload cap without admitting a prefix.
  // It still cannot provide origin progress before the final trailer arrives.
  record.staging = [];
  for (const mode of ['memory', 'disk']) {
    const stage = new Stage(mode, fixture);
    stage.append(Buffer.alloc(bounds[mode]));
    assert.throws(() => stage.append(Buffer.alloc(1)), /staging limit/);
    stage.close(); assert.equal(stage.size, 0);
    record.staging.push({ mode, exactCap: bounds[mode], capPlusOneRejected: true });
  }
  async function stagedCase(name, raw, { cancel = false, reject = false } = {}) {
    const before = snapshot(), adapter = new Admission(addon, 'disk', fixture);
    const signal = new AbortController(); let up;
    const dispatch = async (stage) => {
      up = track(tls.connect(clientTLS(originPort, 'lab-origin.test'))); up.resume();
      await once(up, 'secureConnect'); assert.equal(up.authorized, true);
      const done = once(up, 'close');
      await stage.send(up, signal.signal); await done;
    };
    const bytes = Buffer.from(raw); let error;
    try {
      const split = Math.min(bytes.length - 1, 60000);
      for (let offset = 0; offset < split; offset += 16384)
        await adapter.feed(Buffer.from(bytes.subarray(offset, Math.min(split, offset + 16384))), dispatch);
      await delay(100); const prefix = delta(before); zero(prefix);
      if (!cancel) {
        for (let offset = split; offset < bytes.length; offset += 16384)
          await adapter.feed(Buffer.from(bytes.subarray(offset, offset + 16384)), dispatch);
      }
    } catch (e) { error = e.message; }
    finally { signal.abort(); up?.destroy(); adapter.close(); }
    await delay(30);
    const row = { name, inputBytes: bytes.length, inputSha256: hash(bytes),
      cancelled: cancel, error, peakStagedBytes: adapter.stage.peak, feeds: adapter.feeds, origin: delta(before) };
    if (cancel || reject) zero(row.origin);
    else {
      assert.equal(error, undefined); assert.equal(row.origin.bytes, bytes.length);
      assert.equal(hash(Buffer.concat(wire).subarray(before.bytes)), hash(bytes));
    }
    if (reject) assert.match(error, /staging limit|HPE_INVALID_HEADER_TOKEN/);
    assert.equal(fs.readdirSync(fixture).filter((f) => f.startsWith('stage-')).length, 0);
    record.staging.push(row);
  }
  const diskBody = 'd'.repeat(96 * 1024);
  await stagedCase('disk-96KiB-valid-body', request(`Content-Length: ${diskBody.length}\r\n`, diskBody));
  await stagedCase('disk-cancel-before-admission', request('Content-Length: 100000\r\n', 'x'.repeat(64000)), { cancel: true });
  await stagedCase('disk-folded-trailer', trailer(' '), { reject: true });
  await stagedCase('disk-over-128KiB', request('Content-Length: 140000\r\n', 'x'.repeat(140000)), { reject: true });

  // Explicit competing policy: stream a valid prefix, then discover obs-fold.
  const conflictBefore = snapshot(), streaming = addon.createParser();
  const malformed = trailer(' '), split = malformed.indexOf('0\r\nX-Folded');
  const prefix = Buffer.from(malformed.slice(0, split)), suffix = Buffer.from(malformed.slice(split));
  const streamed = track(tls.connect(clientTLS(originPort, 'lab-origin.test'))); streamed.resume();
  try {
    await once(streamed, 'secureConnect'); assert.equal(streamed.authorized, true);
    const parsedPrefix = streaming.feed(Buffer.from(prefix)); assert.equal(parsedPrefix.error, 'HPE_OK');
    streamed.write(prefix); await until(() => delta(conflictBefore).bytes === prefix.length);
    const beforeTrailer = delta(conflictBefore);
    const parsedSuffix = streaming.feed(Buffer.from(suffix));
    assert.equal(parsedSuffix.error, 'HPE_INVALID_HEADER_TOKEN');
    record.prefixStreamingCounterexample = { prefixBytes: prefix.length,
      beforeTrailer, parserError: parsedSuffix.error, strictZeroByteContract: false,
      explanation: 'The origin has received the valid prefix before malformed trailers are available.' };
  } finally { streaming.close(); streamed.destroy(); }
  await delay(40);
  assert.ok(record.prefixStreamingCounterexample.beforeTrailer.bytes > 0);
  record.verifiedObserverOrigins = { count: verifiedOrigins.length,
    all: verifiedOrigins.every((r) => r.authorized && r.servername === 'lab-origin.test' && r.alpn === 'http/1.1') };
  assert.equal(record.verifiedObserverOrigins.all, true);
  record.completed = true;
} catch (error) {
  record.error = error.stack; process.exitCode = 1;
} finally {
  clearTimeout(watchdog); assertLock();
  if (front) await front.close();
  for (const socket of sockets) socket.destroy();
  for (const server of servers) if (server.listening) await new Promise((resolve) => server.close(resolve));
  await delay(30);
  if (fixture) fs.rmSync(fixture, { recursive: true, force: true });
  record.cleanup = { fixtureAbsent: !fixture || !fs.existsSync(fixture), remainingSockets: sockets.size,
    listeners: servers.filter((server) => server.listening).length,
    allocatedStaging: front?.metrics.allocatedStaging,
    liveNativeParsers: addon?.liveParsers(), lockHeldThroughCleanup: true, elapsedMs: Date.now() - started };
  assertLock();
  for (const source of record.sources) assert.equal(hash(fs.readFileSync(source.file)), source.sha256);
  assert.equal(await git('rev-parse', 'HEAD'), record.sourceCommit);
  record.endedAt = new Date().toISOString();
  const serialized = JSON.stringify(record, null, 2) + '\n';
  fs.writeFileSync(`${output}/receipt.json`, serialized, { flag: 'wx' });
  fs.writeFileSync(`${output}/SHA256SUMS`, `${hash(serialized)}  ${output}/receipt.json\n`, { flag: 'wx' });
  assertLock();
  console.log(JSON.stringify({ completed: record.completed ?? false, error: record.error, cleanup: record.cleanup }));
}
