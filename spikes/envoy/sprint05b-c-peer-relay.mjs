// Additive diagnostic transport; no HTTP message parsing or rewriting in relay.
import fs from 'node:fs';
import tls from 'node:tls';
import http2 from 'node:http2';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { decoder } from './wire-observer.mjs';
const originalSpawn = childProcess.spawn, originalConnect = http2.connect;
const connections = [], boundaries = [], sockets = new Set(); let proxy, readyPort, destination, omitted = 0;
const stamp = () => process.hrtime.bigint().toString();
childProcess.spawn = function(program, args, ...rest) {
  if (args?.[0]?.endsWith('/recovery-launcher.mjs') || args?.[0] === 'spikes/envoy/recovery-launcher.mjs') {
    const manifest = JSON.parse(fs.readFileSync(args[1])); destination = Number(args[2]);
    const route = manifest.routes.find((r) => r.host === 'edge-b.test');
    const ca = fs.readFileSync(manifest.ca_file);
    proxy = tls.createServer({ cert: fs.readFileSync(route.cert_file), key: fs.readFileSync(route.key_file),
      minVersion: 'TLSv1.2', ALPNProtocols: ['h2'] }, (client) => {
      const upstream = tls.connect({ host: '127.0.0.1', port: destination, servername: 'edge-b.test',
        ca, rejectUnauthorized: true, minVersion: 'TLSv1.2', ALPNProtocols: ['h2'] });
      sockets.add(client); sockets.add(upstream);
      const record = { id: connections.length + 1, frames: [], opened_ns: stamp(),
        downstream_authorized_by_original_client: true };
      connections.push(record);
      const capture = (direction, isClient) => decoder({ client: isClient, emit(event) {
        if (record.frames.length < 512) record.frames.push({ time_ns: stamp(), direction, ...event }); else omitted++;
      } });
      client.on('data', capture('client-to-envoy', true)); upstream.on('data', capture('envoy-to-client', false));
      upstream.on('secureConnect', () => {
        record.upstream_authorized = upstream.authorized; record.upstream_alpn = upstream.alpnProtocol;
        record.upstream_sni = upstream.servername;
      });
      for (const socket of [client, upstream]) {
        socket.on('error', (e) => { record.error = e.code; client.destroy(); upstream.destroy(); });
        socket.on('close', () => sockets.delete(socket));
      }
      client.on('close', () => { record.closed_ns = stamp(); upstream.destroy(); });
      upstream.on('close', () => client.destroy());
      client.pipe(upstream); upstream.pipe(client);
    });
    proxy.listen(0, '127.0.0.1', () => { readyPort = proxy.address().port; });
  }
  const child = originalSpawn.call(this, program, args, ...rest);
  if (proxy && args?.[0]?.endsWith('recovery-launcher.mjs')) child.on('exit', () => {
    for (const socket of sockets) socket.destroy(); proxy.close();
  });
  return child;
};
http2.connect = function(authority, options, ...rest) {
  const url = new URL(authority);
  if (Number(url.port) === destination) {
    if (!readyPort) throw new Error('diagnostic relay not ready');
    url.port = String(readyPort); return originalConnect.call(this, url, options, ...rest);
  }
  return originalConnect.call(this, authority, options, ...rest);
};
syncBuiltinESMExports();
const log = console.log;
console.log = function(...args) {
  if (/^[\w-]+: (pass|fail)$/.test(String(args[0]))) boundaries.push({ message: String(args[0]), time_ns: stamp() });
  return log.apply(this, args);
};
process.on('exit', () => {
  if (connections.length) fs.writeFileSync(process.env.AEGIS_05B_C_RELAY_CAPTURE,
    JSON.stringify({ scope: 'additional verified TLS relay diagnostic; not baseline timing evidence',
      omitted, boundaries, connections }, null, 2) + '\n');
});
