import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http2 from 'node:http2';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

process.umask(0o077);
const fixture = JSON.parse(fs.readFileSync('evidence/sprint03a-e/pingora/results.json')).run_directory;
assert.ok(fixture.startsWith(`${process.cwd()}/.local/pingora/`));
const read = (file) => fs.readFileSync(path.join(fixture, file));
const credentials = { key: read('origin.key'), cert: read('origin.pem'), minVersion: 'TLSv1.2' };
const clientOptions = { ca: read('ca.pem'), servername: 'lab-origin.test', rejectUnauthorized: true };
const output = { started_at: new Date().toISOString(), node: process.version,
  purpose: 'Calibrate the shared H1/H2 origin data-listener observation against known valid requests', observations: [] };
for (const protocol of ['h1', 'h2']) {
  let bytes = 0; let handlers = 0; let negotiated;
  const server = protocol === 'h1' ? https.createServer(credentials, (_, res) => { handlers++; res.end('calibration'); })
    : http2.createSecureServer(credentials);
  if (protocol === 'h2') server.on('stream', (stream) => { handlers++; stream.respond({ ':status': 200 }); stream.end('calibration'); });
  server.on('secureConnection', (socket) => {
    negotiated = { tls: socket.getProtocol(), sni: socket.servername, alpn: socket.alpnProtocol };
    socket.on('data', (chunk) => { bytes += chunk.length; });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port;
  let response = '';
  if (protocol === 'h1') await new Promise((resolve, reject) => {
    https.get({ hostname: '127.0.0.1', port, path: '/calibration', agent: false, ...clientOptions }, (res) => {
      res.on('data', (chunk) => { response += chunk; }); res.on('end', resolve); res.on('error', reject);
    }).on('error', reject);
  });
  else {
    const client = http2.connect(`https://127.0.0.1:${port}`, clientOptions);
    await once(client, 'connect');
    const req = client.request({ ':path': '/calibration' });
    req.on('data', (chunk) => { response += chunk; }); req.end(); await once(req, 'end');
    client.close(); await once(client, 'close');
  }
  await delay(50);
  assert.equal(handlers, 1); assert.equal(response, 'calibration');
  output.observations.push({ protocol, handler_invocations: handlers, data_listener_bytes: bytes, negotiated });
  await new Promise((resolve) => server.close(resolve));
}
output.completed_at = new Date().toISOString();
fs.writeFileSync('evidence/sprint03a-e/origin-calibration.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
