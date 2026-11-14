import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import tls from 'node:tls';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { assertLock, listen, freePort } from './wire-fixtures.mjs';
import { receipt } from './sprint04c-repro-receipts.mjs';

process.umask(0o077); assertLock();
const proof = receipt(process.argv[2]);
const image = JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json'));
const type = (name, value = {}) => ({ '@type': `type.googleapis.com/envoy.${name}`, ...value });
const address = (port) => ({ socket_address: { address: '127.0.0.1', port_value: port } });
let fixture, container, docker, origin, observer;
const sockets = new Set(); const handlers = []; const decrypted = [];
let connections = 0; let transportErrors = 0; let parserErrors = 0;
const containerLog = []; const started = Date.now();
const watchdog = setTimeout(() => { process.exitCode = 1; void stop(); }, 90000);
const openssl = (...args) => {
  const result = proof.command(`openssl-${proof.record.commands.length}`, ['openssl', ...args], { cwd: fixture });
  assert.equal(result.status, 0);
};
async function stop() {
  if (container) proof.command('container-stop', ['docker', 'stop', '--timeout', '1', container]);
  for (const socket of sockets) socket.destroy();
  if (observer?.listening) await new Promise((resolve) => observer.close(resolve));
  if (origin?.listening) await new Promise((resolve) => origin.close(resolve));
}
process.on('SIGTERM', () => { proof.record.error = 'SIGTERM'; void stop(); });
process.on('SIGINT', () => { proof.record.error = 'SIGINT'; void stop(); });
try {
  proof.record.scope = 'Standalone H1 parser/partial mapper reproduction; not a full candidate or immutable75 execution';
  proof.record.bounds = { wall_ms: 90000, request_deadline_ms: 2500, response_bytes: 32768,
    docker_memory: '256m', docker_cpus: '1', docker_pids: 64, maximum_requests: 40 };
  proof.record.image = image;
  assert.equal(proof.command('openssl-version', ['openssl', 'version']).status, 0);
  assert.equal(proof.command('docker-version', ['docker', 'version', '--format', '{{json .}}']).status, 0);
  assert.equal(proof.command('image-inspect', ['docker', 'image', 'inspect', image.image,
    '--format', '{{.Id}} {{.Os}}/{{.Architecture}} {{json .RepoDigests}}']).status, 0);
  assert.equal(proof.command('envoy-version', ['docker', 'run', '--rm', '--pull', 'never', '--network', 'none',
    '--entrypoint', '/usr/local/bin/envoy', image.image, '--version']).status, 0);
  fs.mkdirSync('.local', { recursive: true });
  fixture = fs.mkdtempSync(path.resolve('.local/sprint04c-b-'));
  proof.record.fixture = fixture;
  openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem',
    '-days', '1', '-subj', '/CN=disposable Sprint04-C repro CA', '-addext', 'basicConstraints=critical,CA:TRUE');
  for (const [name, host] of [['edge', 'edge-a.test'], ['origin', 'lab-origin.test']]) {
    openssl('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.csr`,
      '-subj', `/CN=${host}`, '-addext', `subjectAltName=DNS:${host}`);
    openssl('x509', '-req', '-in', `${name}.csr`, '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial',
      '-out', `${name}.pem`, '-days', '1', '-copy_extensions', 'copy');
  }
  fs.unlinkSync(path.join(fixture, 'ca.key'));
  const read = (file) => fs.readFileSync(path.join(fixture, file));
  origin = https.createServer({ key: read('origin.key'), cert: read('origin.pem'), minVersion: 'TLSv1.2' }, (req, res) => {
    const entry = { at: new Date().toISOString(), url: req.url, method: req.method, headers: req.rawHeaders };
    handlers.push(entry); req.resume();
    req.on('end', () => { entry.trailers = req.rawTrailers; res.writeHead(req.url === '/origin501' ? 501 : 200,
      { 'content-length': '2' }); res.end('OK'); });
  });
  origin.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  origin.on('tlsClientError', () => transportErrors++);
  origin.on('clientError', (_error, socket) => { parserErrors++; socket.destroy(); });
  const handlerPort = await listen(origin);
  // Observe bytes in a TLS relay before the native HTTP parser consumes them.
  observer = tls.createServer({ key: read('origin.key'), cert: read('origin.pem'),
    minVersion: 'TLSv1.2', ALPNProtocols: ['http/1.1'], handshakeTimeout: 1500 }, (downstream) => {
    connections++; downstream.pause(); sockets.add(downstream);
    const upstream = tls.connect({ host: '127.0.0.1', port: handlerPort, servername: 'lab-origin.test',
      ca: read('ca.pem'), rejectUnauthorized: true, minVersion: 'TLSv1.2', ALPNProtocols: ['http/1.1'] });
    sockets.add(upstream);
    const stopPair = () => { downstream.destroy(); upstream.destroy(); sockets.delete(downstream); sockets.delete(upstream); };
    for (const socket of [downstream, upstream]) {
      socket.on('error', () => { transportErrors++; stopPair(); }); socket.on('close', stopPair);
      socket.setTimeout(4000, stopPair);
    }
    downstream.on('data', (bytes) => decrypted.push(Buffer.from(bytes)));
    upstream.once('secureConnect', () => { downstream.pipe(upstream); upstream.pipe(downstream); });
  });
  observer.on('tlsClientError', () => transportErrors++);
  const originPort = await listen(observer);
  const control = 'GET /observer-control HTTP/1.1\r\nHost: lab-origin.test\r\nConnection: close\r\n\r\n';
  const controlSocket = tls.connect({ host: '127.0.0.1', port: originPort, servername: 'lab-origin.test',
    ca: read('ca.pem'), rejectUnauthorized: true, ALPNProtocols: ['http/1.1'] });
  controlSocket.on('error', () => {}); await once(controlSocket, 'secureConnect');
  controlSocket.resume(); const controlClosed = once(controlSocket, 'close'); controlSocket.write(control); await controlClosed;
  assert.equal(Buffer.concat(decrypted).toString(), control);
  assert.equal(handlers.at(-1)?.url, '/observer-control');
  proof.record.observer_control = { raw_hex: Buffer.from(control).toString('hex'),
    observed_bytes: Buffer.concat(decrypted).length, sent_bytes: Buffer.byteLength(control), exact_match: true };
  const ports = [await freePort(), await freePort()];
  assert.notEqual(...ports);
  const listeners = ports.map((port, i) => {
    const hcm = { stat_prefix: `repro_${i}`, codec_type: 'HTTP1', request_headers_timeout: '2s',
      stream_idle_timeout: '2s', max_request_headers_kb: 16,
      http_protocol_options: { enable_trailers: true, allow_chunked_length: false,
        override_stream_error_on_invalid_http_message: false },
      normalize_path: false, merge_slashes: false, path_with_escaped_slashes_action: 'KEEP_UNCHANGED',
      route_config: { name: 'repro', virtual_hosts: [{ name: 'verified-edge', domains: ['edge-a.test'],
        routes: [{ match: { prefix: '/' }, route: { cluster: 'origin', timeout: '2s' } }] }] },
      http_filters: [{ name: 'envoy.filters.http.router', typed_config: type('extensions.filters.http.router.v3.Router') }] };
    if (i) hcm.local_reply_config = { mappers: [{ filter:
      { status_code_filter: { comparison: { op: 'EQ', value: { default_value: 501, runtime_key: 'repro_501' } } } },
      status_code: 400 }] };
    return { name: `loopback-${i}`, address: address(port),
      listener_filters: [{ name: 'envoy.filters.listener.tls_inspector', typed_config: type('extensions.filters.listener.tls_inspector.v3.TlsInspector') }],
      filter_chains: [{ filter_chain_match: { server_names: ['edge-a.test'] },
        transport_socket: { name: 'envoy.transport_sockets.tls', typed_config: type('extensions.transport_sockets.tls.v3.DownstreamTlsContext',
          { require_sni: true, common_tls_context: { tls_params: { tls_minimum_protocol_version: 'TLSv1_2' },
            alpn_protocols: ['http/1.1'], tls_certificates: [{ certificate_chain: { filename: `${fixture}/edge.pem` },
              private_key: { filename: `${fixture}/edge.key` } }] } }) },
        filters: [{ name: 'envoy.filters.network.http_connection_manager', typed_config: type('extensions.filters.network.http_connection_manager.v3.HttpConnectionManager', hcm) }] }] };
  });
  const config = { static_resources: { listeners, clusters: [{ name: 'origin', type: 'STATIC', connect_timeout: '1s',
    load_assignment: { cluster_name: 'origin', endpoints: [{ lb_endpoints: [{ endpoint: { address: address(originPort) } }] }] },
    transport_socket: { name: 'envoy.transport_sockets.tls', typed_config: type('extensions.transport_sockets.tls.v3.UpstreamTlsContext',
      { sni: 'lab-origin.test', common_tls_context: { tls_params: { tls_minimum_protocol_version: 'TLSv1_2' },
        validation_context: { trusted_ca: { filename: `${fixture}/ca.pem` },
          match_typed_subject_alt_names: [{ san_type: 'DNS', matcher: { exact: 'lab-origin.test' } }] } } }) } }] } };
  fs.writeFileSync(`${fixture}/bootstrap.json`, JSON.stringify(config));
  proof.file('bootstrap.json', JSON.stringify(config, null, 2) + '\n');
  container = `aegis-sprint04c-b-${process.pid}`;
  const dockerArgs = ['create', '--rm', '--pull', 'never', '--name', container, '--network', 'host', '--read-only',
    '--user', `${process.getuid()}:${process.getgid()}`, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
    '--pids-limit', '64', '--memory', '256m', '--cpus', '1', '-v', `${fixture}:${fixture}:ro`,
    '--entrypoint', '/usr/local/bin/envoy', image.image, '-c', `${fixture}/bootstrap.json`,
    '--concurrency', '1', '--log-level', 'warn', '--disable-hot-restart'];
  assert.equal(proof.command('container-create', ['docker', ...dockerArgs]).status, 0);
  const startArgs = ['start', '--attach', container];
  proof.record.container_command = { argv: ['docker', ...startArgs], cwd: process.cwd(), started_at: new Date().toISOString() };
  docker = spawn('docker', startArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  docker.stdout.on('data', (b) => containerLog.push(b)); docker.stderr.on('data', (b) => containerLog.push(b));
  const options = (port) => ({ host: '127.0.0.1', port, servername: 'edge-a.test', ca: read('ca.pem'),
    rejectUnauthorized: true, ALPNProtocols: ['http/1.1'], minVersion: 'TLSv1.2' });
  for (const port of ports) {
    const deadline = Date.now() + 30000;
    while (true) {
      try { const socket = tls.connect(options(port)); socket.on('error', () => {});
        socket.setTimeout(500, () => socket.destroy(new Error('readiness timeout')));
        await once(socket, 'secureConnect'); socket.destroy(); break;
      } catch { assert.ok(Date.now() < deadline, 'Envoy readiness'); await delay(40); }
    }
  }
  async function probe(name, port, request, expected, afterFirst = false) {
    const snapshot = () => ({ bytes: Buffer.concat(decrypted).length, connections, handlers: handlers.length, parserErrors, transportErrors });
    let before = snapshot(); let warmup = null;
    const at = new Date().toISOString(); const socket = tls.connect(options(port));
    socket.on('error', () => {}); await once(socket, 'secureConnect');
    const identity = { authorized: socket.authorized, servername: socket.servername, alpn: socket.alpnProtocol,
      protocol: socket.getProtocol(), peer_fingerprint256: socket.getPeerCertificate().fingerprint256 };
    const received = []; let timedOut = false; let peerEnd = false; let error = null;
    socket.on('data', (bytes) => { received.push(bytes); if (Buffer.concat(received).length > 32768) socket.destroy(new Error('response limit')); });
    socket.on('end', () => { peerEnd = true; }); socket.on('error', (e) => { error = e.message; });
    const closed = once(socket, 'close');
    const timer = setTimeout(() => { timedOut = true; socket.destroy(); }, 2500);
    if (afterFirst) {
      socket.write('GET /warmup HTTP/1.1\r\nHost: edge-a.test\r\n\r\n');
      const deadline = Date.now() + 1500;
      while (!Buffer.concat(received).toString().includes('\r\n\r\nOK')) {
        assert.ok(Date.now() < deadline, 'warmup response'); await delay(5);
      }
      warmup = { request_utf8: 'GET /warmup HTTP/1.1\r\nHost: edge-a.test\r\n\r\n',
        origin_decrypted_bytes: Buffer.concat(decrypted).length - before.bytes,
        handlers: handlers.slice(before.handlers), new_connections: connections - before.connections };
      before = snapshot();
    }
    socket.write(request); // Never send client FIN: distinguish response header from actual peer closure.
    await closed; clearTimeout(timer); await delay(30);
    const response = Buffer.concat(received); const bytes = Buffer.concat(decrypted).subarray(before.bytes);
    const status = [...response.toString().matchAll(/HTTP\/1\.1 (\d{3})/g)].map((m) => Number(m[1]));
    const row = { name, started_at: at, ended_at: new Date().toISOString(), listener: ports.indexOf(port) ? 'local-reply-501-to-400' : 'default',
      request_utf8: request, request_hex: Buffer.from(request).toString('hex'), after_valid_request: afterFirst, warmup,
      identity, response_utf8: response.toString(), response_hex: response.toString('hex'), status,
      client_sent_fin: false, peer_end: peerEnd, timed_out: timedOut, error,
      origin: { decrypted_bytes: bytes.length, decrypted_hex: bytes.toString('hex'),
        new_connections: connections - before.connections, handlers: handlers.slice(before.handlers),
        parser_errors: parserErrors - before.parserErrors, transport_errors: transportErrors - before.transportErrors }, expected };
    row.matches_observation = !timedOut && peerEnd && status.at(-1) === expected &&
      (name.startsWith('strict-ingress-TE-') || name.startsWith('malformed-HTTP-invalid-transfer-encoding') ||
        name.startsWith('supplemental-repeated-transfer-encoding-fields')
        ? bytes.length === 0 && row.origin.handlers.length === 0 && row.origin.new_connections === 0 : true);
    proof.record.probes.push(row); proof.save(); console.log(`${name}: ${JSON.stringify(status)} peer_end=${peerEnd} bytes=${bytes.length}`);
  }
  proof.record.probes = [];
  const request = (method, target, headers = '', body = '') => `${method} ${target} HTTP/1.1\r\nHost: edge-a.test\r\n${headers}Connection: close\r\n\r\n${body}`;
  await probe('unfolded-header', ports[0], request('GET', '/', 'X-Folded: first second\r\n'), 200);
  await probe('folded-header', ports[0], request('GET', '/', 'X-Folded: first\r\n second\r\n'), 200);
  for (const folded of [false, true]) await probe(`${folded ? 'folded' : 'unfolded'}-trailer`, ports[0],
    request('POST', '/trailers', 'Transfer-Encoding: chunked\r\nTrailer: X-Folded\r\n',
      `0\r\nX-Folded: first${folded ? '\r\n ' : ' '}second\r\n\r\n`), 200);
  const field = (raw) => raw[raw.findIndex((s) => s.toLowerCase() === 'x-folded') + 1];
  assert.equal(field(proof.record.probes[0].origin.handlers[0].headers), 'first second');
  assert.equal(field(proof.record.probes[1].origin.handlers[0].headers), 'first second');
  // Trailer delivery is observational: empty native maps do not prove wire normalization.
  proof.record.trailer_delivery_proven = proof.record.probes.slice(2, 4).every((p) =>
    field(p.origin.handlers[0].trailers) === 'first second');
  assert.ok(proof.record.probes.slice(0, 4).every((p) => p.origin.decrypted_bytes > 0));
  const manifest = JSON.parse(fs.readFileSync('spikes/edge-comparison/manifest.json'));
  const teCases = manifest.negatives.filter((r) => /invalid-transfer-encoding|TE-repeated-chunked|TE-not-final-chunked/.test(r.name));
  assert.equal(teCases.length, 3);
  teCases.push({ name: 'supplemental-repeated-transfer-encoding-fields',
    request: request('POST', '/', 'Transfer-Encoding: chunked\r\nTransfer-Encoding: chunked\r\n', '0\r\n\r\n') });
  for (const [i, port] of ports.entries()) {
    for (const entry of teCases) for (const afterFirst of [false, true]) await probe(`${entry.name}-${i}-${afterFirst ? 'reused' : 'fresh'}`, port,
      entry.request.replace('Connection: close', 'Connection: keep-alive'), i ? 400 : 501, afterFirst);
    await probe(`origin-501-control-${i}`, port, request('GET', '/origin501'), 501);
  }
  for (const target of manifest.encoded_targets) await probe(`encoded-${target}`, ports[1], request('GET', target), 200);
  await probe('ordered-pipeline', ports[1], 'GET /first%2Fsegment HTTP/1.1\r\nHost: edge-a.test\r\n\r\n' +
    request('GET', '/second?x=%2520'), 200);
  const pipeline = proof.record.probes.at(-1);
  assert.deepEqual(pipeline.status, [200, 200]);
  assert.deepEqual(pipeline.origin.handlers.map((h) => h.url), ['/first%2Fsegment', '/second?x=%2520']);
  for (const target of manifest.encoded_targets) assert.equal(proof.record.probes.find((p) =>
    p.name === `encoded-${target}`).origin.handlers[0]?.url, target);
  assert.equal(proof.record.probes.length, 29);
  proof.record.completed_observations = proof.record.probes.every((p) => p.matches_observation);
  proof.record.security_acceptance = 'NO-GO: observing normalization/partial hooks does not grant a security pass';
} catch (error) { proof.record.error = error.stack; }
finally {
  clearTimeout(watchdog); assertLock(); await stop();
  if (docker) {
    let exit = docker.exitCode === null ? await Promise.race([
      once(docker, 'exit'), delay(3000).then(() => null),
    ]) : [docker.exitCode, docker.signalCode];
    if (exit === null) {
      proof.record.cleanup_cli_timeout = true;
      docker.kill('SIGTERM');
      exit = await Promise.race([once(docker, 'exit'), delay(1000).then(() => null)]);
      if (exit === null) { docker.kill('SIGKILL'); exit = [null, 'SIGKILL']; }
      proof.record.error ??= 'Attached Docker CLI exceeded cleanup deadline';
    }
    proof.record.container_command.ended_at = new Date().toISOString();
    proof.record.container_command.exit_code = exit[0]; proof.record.container_command.signal = exit[1];
  }
  proof.file('envoy.log', Buffer.concat(containerLog));
  const remaining = proof.command('cleanup-inspect', ['docker', 'ps', '-aq', '--filter', `name=^aegis-sprint04c-b-${process.pid}$`]);
  const clean = remaining.status === 0 && !remaining.stdout.toString().trim();
  if (clean && fixture) fs.rmSync(fixture, { recursive: true });
  proof.record.cleanup = { lock_held_through_cleanup: true, container_absent: clean,
    fixture_removed: fixture ? !fs.existsSync(fixture) : null, wall_ms: Date.now() - started };
  if (!clean || proof.record.completed_observations !== true) process.exitCode = 1;
  proof.finish();
}
