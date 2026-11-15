// Loopback feasibility fixture only. No production listener or engine selection.
import tls from 'node:tls';
import assert from 'node:assert/strict';
import { assertLock, listen } from './wire-fixtures.mjs';

export const limits = Object.freeze({ connections: 4, stagingBytesPerConnection: 32768,
  stagingBytesGlobal: 131072, queuedMessages: 4, pauseAtMessages: 2,
  requestDeadlineMs: 1200, idleMs: 700, originDeadlineMs: 1000,
  socketHighWaterMark: 16384 });

export async function admission({ addon, edgeTLS, originTLS, originPort, originName = 'lab-origin.test' }) {
  assertLock();
  const clients = new Set();
  const metrics = { connections: 0, peakConnections: 0, allocatedStaging: 0, peakAllocatedStaging: 0,
    peakStagedBytes: 0, peakQueuedMessages: 0, admissions: 0, parserFeedCalls: 0, parserConsumed: 0,
    originConnections: 0, upstreamCancelled: 0, pauses: 0, responsePauses: 0,
    peakClientWritable: 0, rejections: {}, cancellations: 0 };
  const server = tls.createServer({ ...edgeTLS, minVersion: 'TLSv1.2', ALPNProtocols: ['http/1.1'],
    handshakeTimeout: limits.idleMs, highWaterMark: limits.socketHighWaterMark }, (client) => {
    if (client.servername !== 'edge-a.test') { client.destroy(); return; }
    const parser = addon.createParser();
    const slab = Buffer.alloc(limits.stagingBytesPerConnection);
    metrics.allocatedStaging += slab.length;
    metrics.peakAllocatedStaging = Math.max(metrics.peakAllocatedStaging, metrics.allocatedStaging);
    let used = 0, messageStart = 0, queue = [], running = false, stopped = false, closed = false;
    let terminalStatus = 0, upstream, deadline;
    const clearDeadline = () => { clearTimeout(deadline); deadline = undefined; };
    function armDeadline() {
      if (!deadline) deadline = setTimeout(() => reject(408, 'request-deadline'), limits.requestDeadlineMs);
    }
    function reject(status, reason) {
      if (stopped || closed) return;
      stopped = true; terminalStatus = status; clearDeadline(); parser.close();
      metrics.rejections[reason] = (metrics.rejections[reason] ?? 0) + 1;
      // Earlier complete messages may finish; the offending partial message never leaves staging.
      used = messageStart;
      client.pause();
      void drain();
    }
    function endStatus() {
      if (terminalStatus && !client.destroyed) client.end(`HTTP/1.1 ${terminalStatus} Rejected\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`);
      else client.end();
    }
    async function forward(message) {
      assertLock();
      metrics.originConnections++;
      upstream = tls.connect({ ...originTLS, host: '127.0.0.1', port: originPort,
        servername: originName, rejectUnauthorized: true, minVersion: 'TLSv1.2',
        ALPNProtocols: ['http/1.1'], highWaterMark: limits.socketHighWaterMark });
      const socket = upstream;
      await new Promise((resolve, rejectForward) => {
        let ended = false;
        const timer = setTimeout(() => socket.destroy(new Error('origin deadline')), limits.originDeadlineMs);
        socket.on('error', rejectForward);
        socket.once('end', () => { ended = true; });
        socket.once('close', () => {
          clearTimeout(timer);
          if (ended) resolve(); else rejectForward(new Error('origin closed before response EOF'));
        });
        socket.on('pause', () => { metrics.responsePauses++; });
        socket.on('data', () => { metrics.peakClientWritable = Math.max(metrics.peakClientWritable, client.writableLength); });
        socket.once('secureConnect', () => {
          socket.pipe(client, { end: false });
          socket.write(slab.subarray(message.start, message.end));
        });
      });
      upstream = undefined;
    }
    async function drain() {
      if (running || closed) return;
      running = true;
      try {
        while (queue.length && !closed) {
          const message = queue[0];
          await forward(message);
          if (closed) break;
          queue.shift();
          const count = message.end;
          slab.copy(slab, 0, count, used);
          used -= count; messageStart -= count;
          for (const pending of queue) { pending.start -= count; pending.end -= count; }
          if (!message.keepAlive) { stopped = true; parser.close(); clearDeadline(); queue = []; used = 0; break; }
          if (!stopped && queue.length < limits.pauseAtMessages) client.resume();
        }
        if (!closed && stopped && !queue.length) endStatus();
      } catch {
        queue = []; used = 0; stopped = true; parser.close(); clearDeadline();
        if (!closed) { terminalStatus = 502; endStatus(); }
      } finally { running = false; }
    }
    client.setTimeout(limits.idleMs, () => reject(408, 'idle'));
    armDeadline();
    client.on('data', (bytes) => {
      if (stopped || closed) return;
      if (used + bytes.length > slab.length) { reject(413, 'staging-bytes'); return; }
      let offset = 0;
      armDeadline();
      while (offset < bytes.length && !stopped) {
        const parsed = parser.feed(bytes.subarray(offset, offset + addon.maxFeedBytes));
        metrics.parserFeedCalls++; metrics.parserConsumed += parsed.consumed;
        bytes.copy(slab, used, offset, offset + parsed.consumed);
        used += parsed.consumed; offset += parsed.consumed;
        metrics.peakStagedBytes = Math.max(metrics.peakStagedBytes, used);
        if (parsed.complete) {
          if (queue.length >= limits.queuedMessages) { reject(429, 'queued-messages'); break; }
          queue.push({ start: messageStart, end: used, keepAlive: parsed.keepAlive });
          metrics.admissions++; messageStart = used;
          metrics.peakQueuedMessages = Math.max(metrics.peakQueuedMessages, queue.length);
          clearDeadline();
          if (offset < bytes.length) armDeadline();
          if (!parsed.keepAlive) { stopped = true; parser.close(); break; }
        } else if (parsed.error !== 'HPE_OK') {
          reject(parsed.reason.startsWith('test-only parser') ? 413 : 400, parsed.reason || parsed.error); break;
        }
        else assert.ok(parsed.consumed > 0, 'llhttp consumed the incomplete fragment');
      }
      if (queue.length >= limits.pauseAtMessages) { metrics.pauses++; client.pause(); }
      void drain();
    });
    client.on('error', () => {});
    client.on('end', () => {
      if (!stopped && !closed) {
        const result = parser.finish();
        if (result.error !== 'HPE_OK' || used > messageStart) reject(400, 'truncated');
        else { stopped = true; parser.close(); clearDeadline(); void drain(); }
      }
    });
    client.on('close', () => {
      closed = true; clearDeadline(); parser.close(); queue = []; used = 0;
      metrics.allocatedStaging -= slab.length;
      if (upstream && !upstream.destroyed) { metrics.upstreamCancelled++; upstream.destroy(); }
      metrics.cancellations++;
    });
  });
  // Count TCP sockets, including pending handshakes, before allocating parser/slab state.
  server.on('connection', (socket) => {
    if (clients.size >= limits.connections) { metrics.rejections.connections = (metrics.rejections.connections ?? 0) + 1; socket.destroy(); return; }
    clients.add(socket); metrics.connections++;
    metrics.peakConnections = Math.max(metrics.peakConnections, clients.size);
    socket.once('close', () => clients.delete(socket));
  });
  server.on('tlsClientError', () => {});
  const port = await listen(server);
  return { port, metrics, async close() {
    assertLock();
    for (const socket of clients) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  } };
}
