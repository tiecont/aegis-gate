// Test-only raw HTTP/2 frames. This file is never an ingress parser.
import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash } from 'node:crypto';
process.umask(0o077);
const root = process.cwd();
const [manifestPath, output] = process.argv.slice(2);
assert.ok(path.isAbsolute(manifestPath) && path.isAbsolute(output));
assert.ok(!fs.existsSync(output), 'never overwrite evidence');
const inode = fs.statSync('/tmp/aegisgate-sprint02-fixtures.lock').ino;
assert.ok(fs.readFileSync('/proc/locks', 'utf8').split('\n').some((line) => {
  const f = line.trim().split(/\s+/); return f[1] === 'FLOCK' && f[3] === 'WRITE' && f[4] === String(process.ppid) && f[5]?.endsWith(`:${inode}`);
}), 'invoke directly under flock');
const manifest = JSON.parse(fs.readFileSync(manifestPath));
const ca = fs.readFileSync(manifest.ca_file);
const portServer = net.createServer(); portServer.listen(0, '127.0.0.1'); await once(portServer, 'listening');
const port = portServer.address().port; await new Promise((resolve) => portServer.close(resolve));
const log = fs.openSync(`${output}.proxy.log`, 'wx', 0o600);
const child = spawn(process.execPath, [path.join(root, 'spikes/envoy/recovery-launcher.mjs'), manifestPath, String(port)], { stdio: ['ignore', log, log] });
const sockets = new Set();
let originConnections = 0;
const origins = [];
for (const originPort of new Set(manifest.routes.map((r) => r.origin_port))) {
  const server = net.createServer((socket) => { originConnections++; socket.destroy(); });
  server.listen(originPort, '127.0.0.1'); await once(server, 'listening'); origins.push(server);
}
const result = { started_at: new Date().toISOString(), source_sha256: createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),
  image: JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')).image, tests: [] };
async function connect(alpn = 'h2') {
  return await new Promise((resolve, reject) => {
    const socket = tls.connect({ host: '127.0.0.1', port, servername: 'edge-a.test', ca, ALPNProtocols: [alpn], rejectUnauthorized: true });
    socket.setTimeout(4000, () => socket.destroy(new Error('bounded socket deadline')));
    socket.once('error', reject); socket.once('secureConnect', () => { assert.equal(socket.alpnProtocol, alpn); sockets.add(socket); socket.once('close', () => sockets.delete(socket)); resolve(socket); });
  });
}
function frame(type, flags, stream, body = Buffer.alloc(0)) {
  const h = Buffer.alloc(9); h.writeUIntBE(body.length, 0, 3); h[3] = type; h[4] = flags; h.writeUInt32BE(stream, 5); return Buffer.concat([h, body]);
}
try {
  let ready = false;
  for (let i = 0; i < 80; i++) { try { const s = await connect(); s.destroy(); ready = true; break; } catch { await delay(50); } }
  assert.ok(ready, 'owned listener never ready');
  for (const [name, bytes, expected] of [
    ['SETTINGS-ack-with-payload', frame(4, 1, 0, Buffer.alloc(6)), 6],
    ['PING-seven-byte-payload', frame(6, 0, 0, Buffer.alloc(7)), 6],
    ['DATA-on-stream-zero', frame(0, 0, 0), 1],
  ]) {
    const socket = await connect();
    let received = Buffer.alloc(0); let errorCode;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.destroy(); reject(new Error('no bounded GOAWAY')); }, 3000);
      socket.on('data', (chunk) => {
        received = Buffer.concat([received, chunk]);
        while (received.length >= 9) {
          const n = received.readUIntBE(0, 3); if (received.length < 9 + n) break;
          if (received[3] === 7 && n >= 8) { errorCode = received.readUInt32BE(13); clearTimeout(timer); socket.destroy(); resolve(); }
          received = received.subarray(9 + n);
        }
      });
      socket.once('error', (error) => { clearTimeout(timer); reject(error); });
      socket.write(Buffer.concat([Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n'), frame(4, 0, 0), bytes]));
    });
    assert.equal(errorCode, expected); assert.equal(originConnections, 0);
    result.tests.push({ name, status: 'pass', goaway_error: errorCode, origin_connections: originConnections });
  }
  const held = await Promise.all(Array.from({ length: 32 }, () => connect('http/1.1')));
  for (const socket of held) socket.write('G');
  const start = Date.now(); const closed = held.map((s) => once(s, 'close'));
  child.kill('SIGTERM');
  await Promise.race([Promise.all([once(child, 'exit'), ...closed]), delay(6000).then(() => { throw new Error('drain exceeded six-second bound'); })]);
  result.tests.push({ name: '32-admitted-partial-header-connections-drained', status: 'pass', connections: held.length, elapsed_ms: Date.now() - start, origin_connections: originConnections });
  assert.equal(originConnections, 0);
} catch (error) { result.failure = error.message; process.exitCode = 1; }
finally {
  child.kill('SIGTERM'); for (const socket of sockets) socket.destroy();
  for (const server of origins) await new Promise((resolve) => server.close(resolve));
  fs.closeSync(log); result.completed_at = new Date().toISOString(); fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
}
