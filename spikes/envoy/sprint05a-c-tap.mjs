// Test-only passive duplicate capture. Original observer/counters stay intact.
import tls from 'node:tls';
import fs from 'node:fs';
const createServer = tls.createServer;
const connections = [];
const boundaries = [];
let total = 0;
let incomplete = false;
tls.createServer = function(options, ...args) {
  const server = createServer.call(this, options, ...args);
  if (JSON.stringify(options?.ALPNProtocols) === '["h2"]') {
    server.on('secureConnection', (socket) => {
      const entry = { id: connections.length + 1, chunks: [], closed: false };
      connections.push(entry);
      socket.on('data', (bytes) => {
        total += bytes.length;
        if (total <= 4 * 1024 * 1024) entry.chunks.push({ time_ns: process.hrtime.bigint().toString(), hex: bytes.toString('hex') });
        else incomplete = true;
      });
      socket.on('close', () => { entry.closed = true; });
    });
  }
  return server;
};
for (const method of ['log', 'error']) {
  const original = console[method];
  console[method] = function(...args) {
    if (/^(PASS|FAIL) /.test(String(args[0]))) boundaries.push({ message: String(args[0]), time_ns: process.hrtime.bigint().toString(),
      offsets: connections.map((c) => ({ id: c.id, bytes: c.chunks.reduce((n, b) => n + b.hex.length / 2, 0) })) });
    return original.apply(this, args);
  };
}
process.on('exit', () => {
  if (process.env.AEGIS_SPRINT05A_C_TAP) fs.writeFileSync(process.env.AEGIS_SPRINT05A_C_TAP,
    JSON.stringify({ scope: 'passive H2 relay capture; test-end boundaries are diagnostic, original counters remain authoritative', incomplete, total, boundaries, connections }, null, 2) + '\n');
});
