// Test-only observer layered on the unchanged verified transport relay.
import { createTlsObserver as relay } from '../edge-comparison/tls-observer.mjs';
import { createHash } from 'node:crypto';

const preface = Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n');
const names = ['DATA', 'HEADERS', 'PRIORITY', 'RST_STREAM', 'SETTINGS', 'PUSH_PROMISE', 'PING', 'GOAWAY', 'WINDOW_UPDATE', 'CONTINUATION'];

export function frame(type, flags, stream, body = Buffer.alloc(0)) {
  const header = Buffer.alloc(9);
  header.writeUIntBE(body.length, 0, 3); header[3] = type; header[4] = flags;
  header.writeUInt32BE(stream, 5);
  return Buffer.concat([header, body]);
}

export function decoder({ client = false, emit, maxBuffer = 65536 }) {
  let pending = Buffer.alloc(0); let first = client; let disabled = false;
  return (chunk) => {
    if (disabled) return;
    if (pending.length + chunk.length > maxBuffer) {
      disabled = true; pending = Buffer.alloc(0); emit({ kind: 'decode-limit' }); return;
    }
    pending = Buffer.concat([pending, chunk]);
    if (first) {
      if (pending.length < preface.length) return;
      if (pending.subarray(0, 24).equals(preface)) {
        emit({ kind: 'preface', bytes: 24 }); pending = pending.subarray(24);
      }
      first = false;
    }
    while (pending.length >= 9) {
      const length = pending.readUIntBE(0, 3);
      if (length + 9 > maxBuffer) { disabled = true; pending = Buffer.alloc(0); emit({ kind: 'decode-limit' }); return; }
      if (pending.length < 9 + length) return;
      const bytes = pending.subarray(0, 9 + length);
      const type = bytes[3];
      emit({ kind: 'frame', type, name: names[type] ?? 'UNKNOWN', flags: bytes[4],
        stream: bytes.readUInt32BE(5) & 0x7fffffff, length, bytes: length + 9,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        ...(type === 7 && length >= 8 ? { error_code: bytes.readUInt32BE(13) } : {}),
        ...(type === 3 && length === 4 ? { error_code: bytes.readUInt32BE(9) } : {}),
        // Never retain HEADERS/DATA payloads; small control frames are synthetic.
        ...([3, 4, 6, 7, 8].includes(type) && length <= 16 ? { hex: bytes.toString('hex') } : {}) });
      pending = pending.subarray(9 + length);
    }
  };
}

export function createTlsObserver(options) {
  const events = []; const connections = []; let omitted = 0; let sequence = 0;
  const push = (event) => {
    if (events.length < 4096) events.push({ sequence: ++sequence, time: new Date().toISOString(), ...event });
    else omitted++;
  };
  const server = relay(options);
  server.on('secureConnection', (socket) => {
    if (connections.length >= 64) { push({ kind: 'connection-sample-limit' }); return; }
    const id = connections.length + 1;
    const record = { id, sni: socket.servername, alpn: socket.alpnProtocol,
      tls: socket.getProtocol(), peer: socket.remoteAddress, bytes: 0, chunks: 0 };
    connections.push(record); push({ kind: 'secure', connection: id, ...record });
    const decode = decoder({ client: true, emit: (event) => push({ connection: id, ...event }) });
    socket.on('data', (chunk) => {
      record.bytes += chunk.length; record.chunks++;
      push({ kind: 'chunk', connection: id, bytes: chunk.length,
        sha256: createHash('sha256').update(chunk).digest('hex') });
      decode(chunk);
    });
    socket.on('error', (error) => push({ kind: 'transport-error', connection: id, code: error.code }));
    socket.on('close', () => push({ kind: 'close', connection: id }));
  });
  server.on('tlsClientError', (error) => push({ kind: 'tls-error', code: error.code }));
  server.wireSnapshot = () => structuredClone({ connections, events, omitted_events: omitted,
    limits: { connections: 64, events: 4096, decoder_bytes_per_connection: 65536 } });
  return server;
}
