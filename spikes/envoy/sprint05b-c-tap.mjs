// Passive frame metadata for downstream TLS; payloads are never retained.
import tls from 'node:tls';
import fs from 'node:fs';
import { decoder } from './wire-observer.mjs';
const connect = tls.connect;
const connections = []; const boundaries = []; let omitted = 0;
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
    JSON.stringify({ scope: 'passive downstream metadata; original assertions remain authoritative', omitted, boundaries, connections }, null, 2) + '\n');
});
