// Synthetic loopback lab only. Duplicate bytes; preserve relay, counters and writes.
import tls from 'node:tls';
import fs from 'node:fs';
const createServer = tls.createServer;
const events = [];
const connections = [];
let kept = 0;
let omitted = 0;
const push = (event) => {
  if (events.length < 16000) events.push({ sequence: events.length + 1,
    time_ns: process.hrtime.bigint().toString(), ...event });
  else omitted++;
};
tls.createServer = function(options, ...args) {
  const server = createServer.call(this, options, ...args);
  if (JSON.stringify(options?.ALPNProtocols) !== '["h2"]') return server;
  server.on('secureConnection', (socket) => {
    if (connections.length >= 64) { omitted++; return; }
    const id = connections.length + 1;
    const row = { id, sni: socket.servername, alpn: socket.alpnProtocol,
      local: { address: socket.localAddress, port: socket.localPort },
      remote: { address: socket.remoteAddress, port: socket.remotePort },
      envoy_to_origin: 0, origin_to_envoy: 0 };
    connections.push(row);
    push({ kind: 'relay-secure', connection: id, ...row });
    function capture(direction, bytes, encoding) {
      const copy = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, encoding);
      const offset = row[direction]; row[direction] += copy.length;
      if (kept + copy.length <= 4 * 1024 * 1024) {
        kept += copy.length;
        push({ kind: 'bytes', connection: id, direction, offset, hex: copy.toString('hex') });
      } else omitted++;
    }
    socket.on('data', (bytes) => capture('envoy_to_origin', bytes));
    const write = socket.write;
    socket.write = function(bytes, encoding, callback) {
      capture('origin_to_envoy', bytes, typeof encoding === 'string' ? encoding : undefined);
      return write.apply(this, arguments);
    };
    socket.on('close', () => push({ kind: 'relay-close', connection: id }));
  });
  return server;
};
for (const method of ['log', 'error']) {
  const original = console[method];
  console[method] = function(...args) {
    if (/^(PASS|FAIL) /.test(String(args[0]))) push({ kind: 'test-end', message: String(args[0]),
      offsets: connections.map(({ id, envoy_to_origin, origin_to_envoy }) => ({ id, envoy_to_origin, origin_to_envoy })) });
    return original.apply(this, args);
  };
}
process.on('exit', () => {
  if (process.env.AEGIS_05B_B_TAP) fs.writeFileSync(process.env.AEGIS_05B_B_TAP,
    JSON.stringify({ scope: 'passive duplicate of unchanged TLS relay data events and writes; synthetic lab only',
      limits: { bytes: 4194304, connections: 64, events: 16000 }, omitted, kept,
      connections, events }, null, 2) + '\n');
});
