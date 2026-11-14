// Passive frame metadata for downstream TLS; payloads are never retained.
import tls from 'node:tls';
import fs from 'node:fs';
import http2 from 'node:http2';
import { decoder } from './wire-observer.mjs';
const connect = tls.connect;
const connections = []; const boundaries = []; let omitted = 0;
const native = []; const h2connect = http2.connect;
const stamp = () => process.hrtime.bigint().toString();
http2.connect = function(...args) {
  const session = h2connect.apply(this, args); const record = { streams: [], events: [] }; native.push(record);
  session.on('goaway', (code, last_stream) => record.events.push({ kind: 'peer-goaway', code, last_stream, time_ns: stamp() }));
  const request = session.request;
  session.request = function(headers, ...rest) {
    const stream = request.call(this, headers, ...rest);
    const entry = { authority: headers[':authority'], events: [] }; record.streams.push(entry);
    for (const method of ['close', 'destroy']) {
      const original = stream[method];
      stream[method] = function(...args) {
        entry.events.push({ kind: `client-${method}`, code: typeof args[0] === 'number' ? args[0] : args[0]?.code,
          time_ns: stamp(), rst_code: stream.rstCode }); return original.apply(this, args);
      };
    }
    stream.on('error', (e) => entry.events.push({ kind: 'stream-error', code: e.code, rst_code: stream.rstCode, time_ns: stamp() }));
    stream.on('close', () => entry.events.push({ kind: 'stream-close', rst_code: stream.rstCode, time_ns: stamp() }));
    return stream;
  };
  return session;
};
tls.connect = function(...args) {
  const socket = connect.apply(this, args);
  const record = { id: connections.length + 1, frames: [], closed: false };
  if (connections.length >= 512) { omitted++; return socket; }
  connections.push(record);
  const consume = (direction, client) => decoder({ client, emit(event) {
    if (record.frames.length < 256) record.frames.push({ direction, time_ns: process.hrtime.bigint().toString(), ...event });
    else omitted++;
  } });
  const incoming = consume('peer-to-client', false); const outgoing = consume('client-to-peer', true);
  const write = socket.write;
  socket.write = function(bytes, ...rest) {
    outgoing(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes));
    return write.call(this, bytes, ...rest);
  };
  socket.on('secureConnect', () => { record.port = socket.remotePort; record.sni = socket.servername; record.alpn = socket.alpnProtocol; });
  socket.on('data', incoming);
  socket.on('close', () => { record.closed = true; record.close_ns = process.hrtime.bigint().toString(); });
  return socket;
};
const log = console.log;
console.log = function(...args) {
  if (/^[\w-]+: (pass|fail)$/.test(String(args[0]))) boundaries.push({ message: String(args[0]), time_ns: process.hrtime.bigint().toString(),
    connections: connections.map((c) => ({ id: c.id, frames: c.frames.length, closed: c.closed })) });
  return log.apply(this, args);
};
process.on('exit', () => {
  if (process.env.AEGIS_05B_C_CAPTURE && connections.length) fs.writeFileSync(process.env.AEGIS_05B_C_CAPTURE,
    JSON.stringify({ scope: 'passive TLS/raw frames and native session events; native HTTP2 bypasses JS socket data/write; original assertions remain authoritative', omitted, boundaries, native, connections }, null, 2) + '\n');
});
