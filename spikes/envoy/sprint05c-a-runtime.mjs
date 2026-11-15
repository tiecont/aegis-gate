// Loopback-only H1 feasibility runtime, not an approved product ingress.
import fs from 'node:fs/promises';
import path from 'node:path';
import tls from 'node:tls';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertLock, listen } from './wire-fixtures.mjs';

export const limits = Object.freeze({ connections: 6, originActive: 2, originQueue: 2,
  stageFiles: 3, diskBytes: 2 * 1024 * 1024, stageBytes: 1536 * 1024,
  bodyBytes: 4 * 1024 * 1024, headerWireBytes: 24576, messageWireBytes: 6 * 1024 * 1024,
  readBytes: 16384, messages: 64, requestMs: 2500, idleMs: 700, originMs: 1800,
  handshakeMs: 700, highWaterMark: 16384 });

export class Rejection extends Error {
  constructor(status, reason) { super(reason); this.status = status; }
}
const fail = (status, reason) => { throw new Rejection(status, reason); };
const check = (signal) => { if (signal.aborted) throw signal.reason; };
function event(socket, name, signal) {
  check(signal);
  return new Promise((resolve, reject) => {
    const done = (error) => {
      socket.off(name, yes); socket.off('error', no); socket.off('close', closed);
      signal.removeEventListener('abort', abort); error ? reject(error) : resolve();
    };
    const yes = () => done(), no = (e) => done(e), closed = () => done(new Error('socket closed'));
    const abort = () => done(signal.reason);
    socket.once(name, yes); socket.once('error', no); socket.once('close', closed);
    signal.addEventListener('abort', abort, { once: true });
    if (socket.destroyed) closed();
  });
}
export class Reader {
  constructor(socket, metrics = {}) { this.socket = socket; this.pending = Buffer.alloc(0); this.metrics = metrics; }
  async next(signal) {
    check(signal);
    if (this.pending.length) { const b = this.pending; this.pending = Buffer.alloc(0); return b; }
    for (;;) {
      const n = Math.min(limits.readBytes, this.socket.readableLength);
      if (n) {
        this.metrics.peakReadable = Math.max(this.metrics.peakReadable ?? 0, this.socket.readableLength);
        return this.socket.read(n);
      }
      if (this.socket.readableEnded) return null;
      await event(this.socket, 'readable', signal);
    }
  }
  unread(b) { assert.equal(this.pending.length, 0); assert.ok(b.length <= limits.readBytes); this.pending = b; }
}
export async function write(socket, b, signal, metrics = {}) {
  check(signal); if (!b.length) return;
  const accepted = socket.write(b);
  metrics.peakWritable = Math.max(metrics.peakWritable ?? 0, socket.writableLength);
  if (!accepted) { metrics.writeWaits = (metrics.writeWaits ?? 0) + 1; await event(socket, 'drain', signal); }
}
const forbiddenTrailers = new Set(['host', 'content-length', 'transfer-encoding', 'connection', 'trailer',
  'te', 'upgrade', 'expect', 'authorization', 'proxy-authorization', 'cookie', 'content-type', 'content-encoding']);
function authority(raw) {
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?(?::443)?$/.test(raw)) fail(400, 'authority syntax');
  const host = raw.toLowerCase().replace(/:443$/, '');
  if (host.includes('..') || host.split('.').some((label) => label.startsWith('-') || label.endsWith('-'))) fail(400, 'authority label');
  return host;
}
export function identify(info, sni, routes) {
  if (info.major !== 1 || info.minor !== 1 || info.upgrade || info.method === 'CONNECT') fail(400, 'H1.1 only');
  const map = new Map();
  for (const [name, value] of info.headers) {
    const key = name.toLowerCase(); if (!map.has(key)) map.set(key, []); map.get(key).push(value);
  }
  const hosts = map.get('host'); if (hosts?.length !== 1) fail(400, 'one Host required');
  const host = authority(hosts[0]);
  if (host !== sni || !routes.has(host)) fail(421, 'verified identity mismatch');
  const route = routes.get(host);
  if (!route.enabled || !route.tenant || !route.generation) fail(421, 'inactive identity');
  if (map.has('expect')) fail(417, 'expect unsupported');
  if (map.has('upgrade') || (map.get('connection') ?? []).some((v) => /(?:^|,)\s*(?:host|content-length|transfer-encoding|upgrade)\s*(?:,|$)/i.test(v))) fail(400, 'connection ambiguity');
  if (map.has('content-length') && map.has('transfer-encoding')) fail(400, 'ambiguous framing');
  if ((map.get('transfer-encoding') ?? []).length > 1 ||
      (map.has('transfer-encoding') && (map.get('transfer-encoding')[0].toLowerCase() !== 'chunked' || !info.chunked))) fail(400, 'unsupported transfer coding');
  if ((map.get('content-length') ?? []).length > 1) fail(400, 'duplicate length');
  if (info.contentLength > limits.bodyBytes && !info.chunked) fail(413, 'declared body size');
  const target = info.target;
  if (/[\x00-\x20\x7f-\xff#\\]/.test(target) || /%(?![a-fA-F0-9]{2})/.test(target)) fail(400, 'target bytes');
  if (target === '*') { if (info.method !== 'OPTIONS') fail(400, 'asterisk method'); }
  else if (target.startsWith('/')) { if (target.startsWith('//')) fail(400, 'network path'); }
  else {
    let u; try { u = new URL(target); } catch { fail(400, 'target form'); }
    if (!target.startsWith('https://') || u.protocol !== 'https:' || u.username || u.password || u.hash ||
        authority(target.slice('https://'.length).split('/')[0]) !== host || !target.slice('https://'.length).includes('/')) fail(400, 'absolute target identity');
  }
  const declared = new Set((map.get('trailer') ?? []).flatMap((v) => v.split(',').map((n) => n.trim().toLowerCase())));
  if (declared.size && (!info.chunked || [...declared].some((n) => !/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(n) || forbiddenTrailers.has(n)))) fail(400, 'trailer declaration');
  return { ...route, host, declared, mode: info.chunked ? 'disk' : 'stream', method: info.method };
}
function validateTrailers(info, identity) {
  for (const [name] of info.trailers) {
    const key = name.toLowerCase();
    if (forbiddenTrailers.has(key) || !identity.declared.has(key)) fail(400, 'forbidden or undeclared trailer');
  }
}

class Quota {
  constructor(metrics) { this.metrics = metrics; this.bytes = 0; this.files = 0; }
  allocate(n) {
    if (n > limits.diskBytes - this.bytes) fail(503, 'aggregate disk quota');
    this.bytes += n; this.metrics.peakDisk = Math.max(this.metrics.peakDisk, this.bytes);
  }
}
class Stage {
  static async open(directory, quota) {
    if (quota.files >= limits.stageFiles) fail(503, 'stage file quota');
    quota.files++;
    const s = new Stage(); s.quota = quota; s.size = 0;
    s.file = path.join(directory, `sprint05c-a-stage-${randomUUID()}`);
    try { s.handle = await fs.open(s.file, 'wx+', 0o600); return s; }
    catch (e) { quota.files--; throw e; }
  }
  async append(b, signal) {
    check(signal);
    if (b.length > limits.stageBytes - this.size) fail(413, 'stage request quota');
    this.quota.allocate(b.length);
    this.size += b.length;
    let offset = 0;
    while (offset < b.length) {
      const r = await this.handle.write(b, offset, b.length - offset, null);
      if (!r.bytesWritten) throw new Error('zero disk write'); offset += r.bytesWritten; check(signal);
    }
  }
  async replay(socket, signal, metrics) {
    for (let at = 0; at < this.size;) {
      check(signal); const b = Buffer.alloc(Math.min(limits.readBytes, this.size - at));
      const r = await this.handle.read(b, 0, b.length, at); if (!r.bytesRead) throw new Error('short stage');
      at += r.bytesRead; await write(socket, b.subarray(0, r.bytesRead), signal, metrics);
    }
  }
  async close() {
    if (!this.handle) return;
    await this.handle.close(); this.handle = null; await fs.unlink(this.file);
    this.quota.bytes -= this.size; this.quota.files--;
  }
}
class Slots {
  constructor(metrics) { this.metrics = metrics; this.active = 0; this.queue = []; }
  async acquire(signal) {
    check(signal);
    if (this.active < limits.originActive) this.active++;
    else {
      if (this.queue.length >= limits.originQueue) fail(503, 'origin queue quota');
      await new Promise((resolve, reject) => {
        const item = { resolve: () => { signal.removeEventListener('abort', abort); resolve(); } };
        const abort = () => { this.queue.splice(this.queue.indexOf(item), 1); reject(signal.reason); };
        signal.addEventListener('abort', abort, { once: true }); this.queue.push(item);
        this.metrics.peakOriginQueue = Math.max(this.metrics.peakOriginQueue, this.queue.length);
      });
    }
    this.metrics.peakOriginActive = Math.max(this.metrics.peakOriginActive, this.active);
    let released = false;
    return () => {
      if (released) return; released = true;
      const item = this.queue.shift(); if (item) item.resolve(); else this.active--;
    };
  }
}

export async function runtime({ addon, edgeTLS, routes, directory }) {
  assertLock(); await fs.mkdir(directory, { mode: 0o700 });
  assert.equal((await fs.stat(directory)).mode & 0o777, 0o700);
  const sockets = new Set(), tasks = new Set();
  const metrics = { peakDisk: 0, peakOriginActive: 0, peakOriginQueue: 0, peakConnections: 0,
    requests: 0, stream: 0, disk: 0, originDials: 0, rejections: {}, cancellations: 0,
    peakHeaderHeld: 0, peakPending: 0, activeContexts: 0, peakContexts: 0 };
  const quota = new Quota(metrics), slots = new Slots(metrics);
  async function serve(client) {
    metrics.activeContexts++; metrics.peakContexts = Math.max(metrics.peakContexts, metrics.activeContexts);
    const controller = new AbortController(), signal = controller.signal;
    const abort = (e) => { if (!signal.aborted) controller.abort(e); };
    client.on('timeout', () => abort(new Rejection(408, 'idle deadline')));
    client.on('error', () => {}); client.once('close', () => { metrics.cancellations++; abort(new Error('client cancelled')); });
    const reader = new Reader(client, metrics), parser = addon.createParser();
    let timer, originTimer, upstream, stage, release, responseStarted = false;
    const cancelOrigin = () => upstream?.destroy(); signal.addEventListener('abort', cancelOrigin);
    try {
      if (!routes.has(client.servername) || !client.authorized && edgeTLS.requestCert) fail(421, 'SNI identity');
      for (let number = 0; number < limits.messages; number++) {
        timer = setTimeout(() => abort(new Rejection(408, 'absolute request deadline')), limits.requestMs);
        client.setTimeout(limits.idleMs);
        let header = [], headerSize = 0, wire = 0, identity, completed = false, keepAlive = true;
        responseStarted = false;
        const connect = async () => {
          release = await slots.acquire(signal); check(signal);
          originTimer = setTimeout(() => abort(new Rejection(504, 'origin deadline')), limits.originMs);
          metrics.originDials++;
          upstream = tls.connect({ host: '127.0.0.1', port: identity.port, ca: identity.ca,
            servername: identity.originName, rejectUnauthorized: true, minVersion: 'TLSv1.2',
            ALPNProtocols: ['http/1.1'], highWaterMark: limits.highWaterMark });
          upstream.on('error', () => {}); await event(upstream, 'secureConnect', signal);
          assert.equal(upstream.authorized, true); assert.equal(upstream.alpnProtocol, 'http/1.1');
        };
        while (!completed) {
          const b = await reader.next(signal);
          if (b === null) {
            const eof = parser.finish();
            if (!wire && eof.error === 'HPE_OK') return;
            fail(400, 'truncated request');
          }
          let offset = 0, resumeHeader = false;
          while ((offset < b.length || resumeHeader) && !completed) {
            resumeHeader = false;
            const parsed = parser.feed(b.subarray(offset));
            const part = b.subarray(offset, offset + parsed.consumed); offset += parsed.consumed; wire += part.length;
            if (wire > limits.messageWireBytes || parsed.bodyBytes > limits.bodyBytes) fail(413, 'message size');
            if (!parsed.complete && !parsed.headersReady && parsed.error !== 'HPE_OK') fail(parsed.error === 'HPE_USER' ? 413 : 400, parsed.reason || parsed.error);
            if (!identity) {
              headerSize += part.length;
              if (headerSize > limits.headerWireBytes) fail(413, 'wire header size');
              header.push(Buffer.from(part)); metrics.peakHeaderHeld = Math.max(metrics.peakHeaderHeld, headerSize);
              if (parsed.headersReady) {
                identity = identify(parsed, client.servername, routes);
                if (!parsed.chunked && parsed.totalConsumed + parsed.contentLength + limits.readBytes > addon.maxWireBytes) fail(413, 'connection wire reservation');
                resumeHeader = true;
                metrics[identity.mode]++;
                if (identity.mode === 'disk') {
                  stage = await Stage.open(directory, quota);
                  for (const h of header) await stage.append(h, signal);
                } else {
                  await connect(); for (const h of header) await write(upstream, h, signal, metrics);
                }
                header = [];
              }
            } else if (identity.mode === 'disk') await stage.append(part, signal);
            else await write(upstream, part, signal, metrics);
            if (parsed.complete) {
              assert.ok(identity); validateTrailers(parsed, identity);
              completed = true; keepAlive = parsed.keepAlive;
            } else assert.ok(parsed.consumed || parsed.headersReady || offset === b.length, 'llhttp made progress');
          }
          if (offset < b.length) { reader.unread(b.subarray(offset)); metrics.peakPending = Math.max(metrics.peakPending, b.length - offset); }
        }
        client.setTimeout(0);
        if (stage) { await connect(); await stage.replay(upstream, signal, metrics); await stage.close(); stage = undefined; }
        const response = addon.createResponseParser(identity.method === 'HEAD');
        try {
          const originReader = new Reader(upstream, metrics); let ended = false;
          while (!ended) {
            const b = await originReader.next(signal);
            if (b === null) fail(502, 'origin incomplete response');
            let offset = 0;
            while (offset < b.length) {
              const parsed = response.feed(b.subarray(offset));
              if (parsed.error !== 'HPE_OK' && !parsed.complete) fail(502, 'origin response framing');
              const part = b.subarray(offset, offset + parsed.consumed); offset += parsed.consumed;
              responseStarted = true; await write(client, part, signal, metrics);
              if (parsed.complete && parsed.status >= 200) { ended = true; break; }
              if (!parsed.consumed) fail(502, 'origin no progress');
            }
          }
        } finally { response.close(); }
        upstream.destroy(); upstream = undefined; clearTimeout(originTimer); originTimer = undefined;
        release(); release = undefined; clearTimeout(timer); timer = undefined;
        metrics.requests++;
        if (!keepAlive) return;
      }
      fail(503, 'connection request quota');
    } catch (error) {
      const status = error.status ?? (signal.aborted ? signal.reason.status : undefined) ??
        (['ENOSPC', 'EDQUOT', 'EMFILE', 'ENFILE'].includes(error.code) ? 503 : 502);
      metrics.rejections[error.message] = (metrics.rejections[error.message] ?? 0) + 1;
      metrics.lastError = { name: error.name, message: error.message, code: error.code, stack: error.stack };
      upstream?.destroy();
      if (!client.destroyed && !responseStarted) client.end(`HTTP/1.1 ${status} Rejected\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`);
    } finally {
      clearTimeout(timer); clearTimeout(originTimer); client.setTimeout(0); parser.close();
      signal.removeEventListener('abort', cancelOrigin); upstream?.destroy(); release?.();
      if (stage) await stage.close();
      if (!client.destroyed) client.end();
      metrics.activeContexts--;
    }
  }
  const contexts = new Map([...routes].map(([name, route]) => [name, tls.createSecureContext(route.edge)]));
  const server = tls.createServer({ ...edgeTLS, minVersion: 'TLSv1.2', ALPNProtocols: ['http/1.1'],
    handshakeTimeout: limits.handshakeMs, highWaterMark: limits.highWaterMark,
    SNICallback(name, cb) { const context = contexts.get(name); cb(context ? null : new Error('unknown SNI'), context); } }, (client) => {
    const task = serve(client).catch((e) => { metrics.cleanupError = e.message; client.destroy(); });
    tasks.add(task); task.finally(() => tasks.delete(task));
  });
  server.on('connection', (socket) => {
    if (sockets.size >= limits.connections) { metrics.connectionRejects = (metrics.connectionRejects ?? 0) + 1; socket.destroy(); return; }
    sockets.add(socket); socket.once('close', () => sockets.delete(socket));
    metrics.peakConnections = Math.max(metrics.peakConnections, sockets.size);
  });
  server.on('tlsClientError', () => {});
  const port = await listen(server);
  return { port, metrics, quota, slots, async close() {
    assertLock(); for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve)); await Promise.all(tasks);
    assert.equal(metrics.cleanupError, undefined);
    assert.equal(quota.bytes, 0); assert.equal(quota.files, 0); assert.equal(slots.active, 0); assert.equal(slots.queue.length, 0);
    assert.equal((await fs.readdir(directory)).length, 0); await fs.rmdir(directory);
  } };
}
