import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import tls from 'node:tls';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { receipt, hash } from './sprint05a-b-receipts.mjs';
import { assertLock, listen, freePort } from './wire-fixtures.mjs';

process.umask(0o077); assertLock();
const runtime = process.argv[2]; assert.ok(['envoy', 'llhttp', 'nginx'].includes(runtime));
const proof = receipt(process.argv[3]);
const pins = JSON.parse(fs.readFileSync('evidence/sprint05a-b/source-01/sources.json'));
const address = (port) => ({ socket_address: { address: '127.0.0.1', port_value: port } });
const type = (name, value = {}) => ({ '@type': `type.googleapis.com/envoy.${name}`, ...value });
const sockets = new Set(); const servers = []; const handlers = []; const wire = [];
const admissions = []; const parses = []; const logs = [];
let fixture, container, child, connections = 0, parserErrors = 0, transportErrors = 0;
const start = Date.now();
const image = runtime === 'envoy' ? JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')).image
  : 'nginx@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311';
function cmd(name, argv, options) {
  const r = proof.command(name, argv, options); assert.equal(r.status, 0, name); return r;
}
function track(socket) {
  sockets.add(socket); socket.on('close', () => sockets.delete(socket));
  socket.on('error', () => {}); return socket;
}
async function cleanup() {
  if (container) proof.command('container-stop', ['docker', 'stop', '--timeout', '1', container]);
  for (const s of sockets) s.destroy();
  for (const s of servers) if (s.listening) await new Promise((r) => s.close(r));
}
const watchdog = setTimeout(() => { proof.record.error = '90s watchdog'; void cleanup(); }, 90000);
try {
  proof.record.runtime = runtime;
  proof.record.scope = 'Targeted released strict-parser PoC only; not original75/23 or production eligibility';
  proof.record.bounds = { wall_ms: 90000, message_bytes: 32768, downstream_idle_ms: 2500,
    request_observation_ms: 3000, container_memory: '256m', container_cpus: 1, container_pids: 64 };
  proof.record.pins = pins;
  for (const entry of pins.downloads) assert.equal(hash(fs.readFileSync(entry.cache)), entry.sha256);
  cmd('openssl-version', ['openssl', 'version']);
  if (runtime !== 'llhttp') {
    cmd('docker-version', ['docker', 'version', '--format', '{{json .}}']);
    cmd('image-inspect', ['docker', 'image', 'inspect', image, '--format', '{{.Id}} {{json .RepoDigests}} {{.Os}}/{{.Architecture}}']);
    cmd('runtime-version', ['docker', 'run', '--rm', '--pull', 'never', '--network', 'none',
      '--entrypoint', runtime === 'envoy' ? '/usr/local/bin/envoy' : 'nginx', image,
      runtime === 'envoy' ? '--version' : '-V']);
  }
  fs.mkdirSync('.local', { recursive: true });
  fixture = fs.mkdtempSync(path.resolve(`.local/sprint05a-b-${runtime}-`));
  const openssl = (...argv) => cmd(`pki-${proof.record.commands.length}`, ['openssl', ...argv], { cwd: fixture });
  openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem',
    '-days', '1', '-subj', '/CN=disposable Sprint05A B CA', '-addext', 'basicConstraints=critical,CA:TRUE');
  for (const [name, host] of [['edge', 'edge-a.test'], ['origin', 'lab-origin.test']]) {
    openssl('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.csr`,
      '-subj', `/CN=${host}`, '-addext', `subjectAltName=DNS:${host}`);
    openssl('x509', '-req', '-in', `${name}.csr`, '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial',
      '-out', `${name}.pem`, '-days', '1', '-copy_extensions', 'copy');
  }
  fs.unlinkSync(`${fixture}/ca.key`);
  const read = (f) => fs.readFileSync(`${fixture}/${f}`);
  const tlsServerOptions = (name) => ({ key: read(`${name}.key`), cert: read(`${name}.pem`),
    minVersion: 'TLSv1.2', ALPNProtocols: ['http/1.1'], handshakeTimeout: 1500 });
  const tlsClientOptions = (port, servername) => ({ host: '127.0.0.1', port, servername, ca: read('ca.pem'),
    rejectUnauthorized: true, minVersion: 'TLSv1.2', ALPNProtocols: ['http/1.1'] });
  const origin = https.createServer(tlsServerOptions('origin'), (req, res) => {
    const row = { url: req.url, method: req.method, headers: req.rawHeaders, body_bytes: 0 };
    handlers.push(row); req.on('data', (b) => { row.body_bytes += b.length; });
    req.on('end', () => { row.trailers = req.rawTrailers;
      res.writeHead(200, { 'content-length': '2' }); res.end('OK'); });
  });
  origin.keepAliveTimeout = 50;
  servers.push(origin); origin.on('connection', track);
  origin.on('clientError', (_e, s) => { parserErrors++; s.destroy(); });
  origin.on('tlsClientError', () => transportErrors++);
  const handlerPort = await listen(origin);
  const observer = tls.createServer(tlsServerOptions('origin'), (down) => {
    track(down); connections++; down.pause();
    const up = track(tls.connect(tlsClientOptions(handlerPort, 'lab-origin.test')));
    const close = () => { down.destroy(); up.destroy(); };
    for (const s of [down, up]) { s.on('error', () => { transportErrors++; close(); });
      s.on('close', close); s.setTimeout(4000, close); }
    down.on('data', (b) => wire.push(Buffer.from(b)));
    up.once('secureConnect', () => { down.pipe(up); up.pipe(down); });
  });
  servers.push(observer); observer.on('tlsClientError', () => transportErrors++);
  const originPort = await listen(observer);
  const observerRequest = 'GET /observer-control HTTP/1.1\r\nHost: lab-origin.test\r\nConnection: close\r\n\r\n';
  const control = track(tls.connect(tlsClientOptions(originPort, 'lab-origin.test')));
  control.resume(); await once(control, 'secureConnect'); const controlDone = once(control, 'close');
  control.write(observerRequest); await controlDone;
  assert.equal(Buffer.concat(wire).toString(), observerRequest);
  proof.record.observer_control = { exact_match: true, bytes: Buffer.byteLength(observerRequest),
    decrypted_hex: Buffer.concat(wire).toString('hex') };
  let port = await freePort();
  let driver;
  function parse(bytes, step = 65536, mode = 'strict') {
    const r = proof.command(`parse-${parses.length}`, [driver, String(step), mode], { input: bytes });
    assert.equal(r.status, 0); const result = JSON.parse(r.stdout);
    parses.push({ input_hex: bytes.toString('hex'), step, mode, result }); return result;
  }
  if (runtime === 'llhttp') {
    cmd('cc-version', ['cc', '--version']); driver = `${fixture}/llhttp-driver`;
    const upstream = `${fixture}/upstream`; fs.mkdirSync(upstream);
    for (const f of ['include/llhttp.h', 'src/api.c', 'src/http.c', 'src/llhttp.c'])
      fs.copyFileSync(pins.downloads.find((d) => d.name === `llhttp/${f}`).cache, `${upstream}/${path.basename(f)}`);
    cmd('check-driver', ['cc', '-std=c11', '-Wall', '-Wextra', '-Werror', '-fsyntax-only', `-I${upstream}`,
      'spikes/envoy/sprint05a-b-llhttp.c']);
    cmd('build-llhttp', ['cc', '-std=c11', '-O2', '-Wall', '-Werror', `-I${upstream}`,
      'spikes/envoy/sprint05a-b-llhttp.c', `${upstream}/api.c`, `${upstream}/http.c`, `${upstream}/llhttp.c`, '-o', driver]);
    proof.record.driver_sha256 = hash(fs.readFileSync(driver));
    const front = tls.createServer(tlsServerOptions('edge'), (client) => {
      track(client); let pending = Buffer.alloc(0); let queued = Promise.resolve(); let rejected = false;
      client.setTimeout(2500, () => client.destroy());
      const forward = async (message) => {
        if (client.destroyed) return;
        const up = track(tls.connect(tlsClientOptions(originPort, 'lab-origin.test')));
        up.setTimeout(2000, () => up.destroy(new Error('origin deadline')));
        const response = []; up.on('data', (b) => response.push(b));
        await once(up, 'secureConnect'); const done = once(up, 'close');
        // Input is unmodified and admitted only at llhttp's on_message_complete.
        up.write(message); await done;
        client.write(Buffer.concat(response));
      };
      client.on('data', (b) => {
        if (rejected) return;
        pending = Buffer.concat([pending, b]);
        if (pending.length > 32768) { rejected = true; client.end('HTTP/1.1 413 Content Too Large\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'); return; }
        const parsed = parse(pending); let offset = 0;
        for (const m of parsed.messages) {
          const message = Buffer.from(pending.subarray(offset, m.end)); offset = m.end;
          admissions.push({ bytes: message.length, hex: message.toString('hex'), target_hex: m.target_hex });
          queued = queued.then(() => forward(message));
        }
        pending = pending.subarray(offset);
        if (parsed.error !== 'HPE_OK') {
          rejected = true;
          queued = queued.then(() => client.end('HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n'));
        } else if (parsed.messages.length) {
          const last = parsed.messages.at(-1);
          if (!last.keep_alive) queued = queued.then(() => client.end());
        }
        queued.catch((e) => { logs.push(Buffer.from(`${e.stack}\n`)); client.destroy(); });
      });
    });
    servers.push(front); port = await listen(front, port);
  } else {
    let config;
    if (runtime === 'envoy') {
      const hcm = { stat_prefix: 'sprint05a_b', codec_type: 'HTTP1', request_headers_timeout: '2s',
        stream_idle_timeout: '2s', max_request_headers_kb: 16,
        http_protocol_options: { enable_trailers: true, use_balsa_parser: true, allow_chunked_length: false,
          override_stream_error_on_invalid_http_message: false },
        normalize_path: false, merge_slashes: false, path_with_escaped_slashes_action: 'KEEP_UNCHANGED',
        route_config: { name: 'proof', virtual_hosts: [{ name: 'edge', domains: ['edge-a.test'],
          routes: [{ match: { prefix: '/' }, route: { cluster: 'origin', timeout: '2s' } }] }] },
        http_filters: [{ name: 'envoy.filters.http.router', typed_config: type('extensions.filters.http.router.v3.Router') }] };
      config = JSON.stringify({ layered_runtime: { layers: [{ name: 'strict', static_layer: {
        'envoy.reloadable_features.strict_chunk_parsing': true,
        'envoy.reloadable_features.http1_use_balsa_parser': true } }] },
      static_resources: { listeners: [{ name: 'sprint05a-b-loopback', address: address(port), filter_chains: [{
        transport_socket: { name: 'envoy.transport_sockets.tls', typed_config: type('extensions.transport_sockets.tls.v3.DownstreamTlsContext', {
          require_sni: true, common_tls_context: { alpn_protocols: ['http/1.1'], tls_certificates: [{
            certificate_chain: { filename: `${fixture}/edge.pem` }, private_key: { filename: `${fixture}/edge.key` } }] } }) },
        filters: [{ name: 'envoy.filters.network.http_connection_manager', typed_config: type('extensions.filters.network.http_connection_manager.v3.HttpConnectionManager', hcm) }] }] }],
      clusters: [{ name: 'origin', type: 'STATIC', connect_timeout: '1s',
        http_protocol_options: { enable_trailers: true },
        load_assignment: { cluster_name: 'origin', endpoints: [{ lb_endpoints: [{ endpoint: { address: address(originPort) } }] }] },
        transport_socket: { name: 'envoy.transport_sockets.tls', typed_config: type('extensions.transport_sockets.tls.v3.UpstreamTlsContext', {
          sni: 'lab-origin.test', common_tls_context: { validation_context: { trusted_ca: { filename: `${fixture}/ca.pem` },
            match_typed_subject_alt_names: [{ san_type: 'DNS', matcher: { exact: 'lab-origin.test' } }] } } }) } }] } }, null, 2);
    } else {
      config = `worker_processes 1;
pid /tmp/sprint05a-b-nginx.pid;
error_log stderr warn;
events { worker_connections 64; }
http {
  access_log off;
  client_body_temp_path /tmp/body;
  proxy_temp_path /tmp/proxy;
  client_max_body_size 32k;
  client_body_buffer_size 32k;
  client_header_timeout 2s;
  client_body_timeout 2s;
  keepalive_timeout 2s;
  server {
    listen 127.0.0.1:${port} ssl;
    server_name edge-a.test;
    ssl_certificate ${fixture}/edge.pem;
    ssl_certificate_key ${fixture}/edge.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    location / {
      proxy_pass https://127.0.0.1:${originPort};
      proxy_http_version 1.1;
      proxy_request_buffering on;
      proxy_buffering on;
      proxy_ssl_verify on;
      proxy_ssl_trusted_certificate ${fixture}/ca.pem;
      proxy_ssl_server_name on;
      proxy_ssl_name lab-origin.test;
      proxy_set_header Host edge-a.test;
      proxy_set_header Connection close;
      proxy_connect_timeout 1s;
      proxy_read_timeout 2s;
    }
  }
}
`;
    }
    const file = `${fixture}/bootstrap.${runtime === 'envoy' ? 'json' : 'conf'}`;
    fs.writeFileSync(file, config); proof.file('bootstrap.txt', config);
    container = `aegis-sprint05a-b-${runtime}-${process.pid}`;
    const argv = ['create', '--rm', '--pull', 'never', '--name', container, '--network', 'host', '--read-only',
      '--user', `${process.getuid()}:${process.getgid()}`, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
      '--pids-limit', '64', '--memory', '256m', '--cpus', '1', '--tmpfs', '/tmp:rw,noexec,nosuid,size=4m',
      '-v', `${fixture}:${fixture}:ro`, '--entrypoint', runtime === 'envoy' ? '/usr/local/bin/envoy' : 'nginx', image,
      '-c', file, ...(runtime === 'envoy' ? ['--concurrency', '1', '--log-level', 'warn', '--disable-hot-restart'] : ['-g', 'daemon off;'])];
    cmd('container-create', ['docker', ...argv]);
    child = spawn('docker', ['start', '--attach', container], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (b) => logs.push(b)); child.stderr.on('data', (b) => logs.push(b));
    proof.record.runtime_command = { argv: ['docker', 'start', '--attach', container], started_at: new Date().toISOString() };
  }
  const options = () => tlsClientOptions(port, 'edge-a.test');
  const readyUntil = Date.now() + 15000;
  while (true) {
    try { const s = track(tls.connect(options())); s.setTimeout(500, () => s.destroy());
      await once(s, 'secureConnect'); s.destroy(); break;
    } catch { assert.ok(Date.now() < readyUntil, 'runtime ready'); await delay(50); }
  }
  const snapshot = () => ({ bytes: Buffer.concat(wire).length, connections, handlers: handlers.length, parserErrors, transportErrors });
  async function probe(name, request, { parts, warmup } = {}) {
    let before = snapshot(); const s = track(tls.connect(options())); await once(s, 'secureConnect');
    const row = { name, request_hex: Buffer.from(request).toString('hex'), started_at: new Date().toISOString(),
      identity: { authorized: s.authorized, alpn: s.alpnProtocol, protocol: s.getProtocol(), servername: s.servername },
      client_sent_fin: false, peer_end: false, timed_out: false, error: null };
    const recv = []; s.on('data', (b) => { recv.push(b); if (Buffer.concat(recv).length > 32768) s.destroy(); });
    s.on('end', () => { row.peer_end = true; }); s.on('error', (e) => { row.error = e.message; });
    const closed = once(s, 'close');
    const timer = setTimeout(() => { row.timed_out = true; s.destroy(); }, 3000);
    if (warmup) {
      s.write('GET /warmup HTTP/1.1\r\nHost: edge-a.test\r\n\r\n');
      const deadline = Date.now() + 1500;
      while (!Buffer.concat(recv).toString().includes('\r\n\r\nOK')) {
        assert.ok(Date.now() < deadline, 'warmup response'); await delay(5);
      }
      row.warmup = { origin_bytes: snapshot().bytes - before.bytes, handlers: handlers.slice(before.handlers) };
      before = snapshot(); recv.length = 0;
    }
    if (parts) {
      s.write(parts[0]); await delay(100);
      row.before_final_fragment = { origin_bytes: snapshot().bytes - before.bytes,
        new_connections: connections - before.connections, handlers: handlers.slice(before.handlers) };
      s.write(parts[1]);
    } else s.write(request);
    await closed; clearTimeout(timer); await delay(35);
    const response = Buffer.concat(recv); const delta = Buffer.concat(wire).subarray(before.bytes);
    row.response_hex = response.toString('hex'); row.status = [...response.toString().matchAll(/HTTP\/1\.1 (\d{3})/g)].map((m) => +m[1]);
    row.origin = { bytes: delta.length, hex: delta.toString('hex'), new_connections: connections - before.connections,
      handlers: handlers.slice(before.handlers), parser_errors: parserErrors - before.parserErrors,
      transport_errors: transportErrors - before.transportErrors };
    row.ended_at = new Date().toISOString();
    row.strict_rejection = row.status.at(-1) === 400 && row.peer_end && !row.timed_out &&
      row.origin.bytes === 0 && row.origin.new_connections === 0 && row.origin.handlers.length === 0 &&
      row.origin.parser_errors === 0 && row.origin.transport_errors === 0;
    proof.record.probes.push(row); proof.save();
    console.log(`${runtime} ${name}: status=${row.status} bytes=${row.origin.bytes} peer_end=${row.peer_end}`);
  }
  proof.record.probes = [];
  const request = (headers = '', body = '', target = '/') => `POST ${target} HTTP/1.1\r\nHost: edge-a.test\r\n${headers}Connection: close\r\n\r\n${body}`;
  const folded = (space, trailer) => request(trailer ? 'Transfer-Encoding: chunked\r\nTrailer: X-Folded\r\n' : `X-Folded: first\r\n${space}second\r\nContent-Length: 0\r\n`,
    trailer ? `1\r\na\r\n0\r\nX-Folded: first\r\n${space}second\r\n\r\n` : '');
  await probe('valid-header', request('X-Folded: first second\r\nContent-Length: 0\r\n'));
  await probe('valid-trailer', request('Transfer-Encoding: chunked\r\nTrailer: X-Folded\r\n', '1\r\na\r\n0\r\nX-Folded: first second\r\n\r\n'));
  for (const trailer of [false, true]) for (const space of [' ', '\t']) {
    const name = `folded-${trailer ? 'trailer' : 'header'}-${space === ' ' ? 'sp' : 'htab'}`;
    await probe(name, folded(space, trailer));
    await probe(`${name}-reused`, folded(space, trailer), { warmup: true });
  }
  const delayed = folded(' ', true); const split = delayed.indexOf('0\r\nX-Folded:');
  await probe('delayed-folded-trailer', delayed, { parts: [delayed.slice(0, split), delayed.slice(split)] });
  const header = folded(' ', false); const headerSplit = header.indexOf('\r\n second') + 2;
  await probe('fragmented-folded-header', header, { parts: [header.slice(0, headerSplit), header.slice(headerSplit)] });
  const manifest = JSON.parse(fs.readFileSync('spikes/edge-comparison/manifest.json'));
  for (const target of manifest.encoded_targets) await probe(`encoded-${target}`, request('Content-Length: 0\r\n', '', target));
  const first = 'GET /first%2Fsegment HTTP/1.1\r\nHost: edge-a.test\r\n\r\n';
  await probe('valid-pipeline', first + request('Content-Length: 0\r\n', '', '/second?x=%2520'));
  await probe('valid-then-folded-pipeline', first + folded(' ', false));
  if (runtime === 'llhttp') {
    proof.record.fragment_checks = [];
    for (const [name, raw] of [['header', folded(' ', false)], ['trailer', folded('\t', true)],
      ['valid-trailer', request('Transfer-Encoding: chunked\r\n', '0\r\nX-Folded: first second\r\n\r\n')]])
      for (const step of [1, 2, 7, 65536]) for (const mode of ['strict', 'relaxed']) {
        const p = parse(Buffer.from(raw), step, mode);
        proof.record.fragment_checks.push({ name, step, mode, error: p.error, complete_count: p.complete_count,
          reason: Buffer.from(p.reason_hex, 'hex').toString(), consumed: p.consumed });
      }
  }
  proof.record.parses = parses; proof.record.admissions = admissions;
  const p = proof.record.probes;
  assert.ok(p.every((r) => !r.timed_out && r.peer_end), 'bounded peer closure');
  for (const target of manifest.encoded_targets) assert.equal(p.find((r) => r.name === `encoded-${target}`).origin.handlers[0]?.url, target);
  assert.deepEqual(p.find((r) => r.name === 'valid-pipeline').status, [200, 200]);
  assert.deepEqual(p.find((r) => r.name === 'valid-pipeline').origin.handlers.map((h) => h.url), ['/first%2Fsegment', '/second?x=%2520']);
  proof.record.completed_observations = true;
  proof.record.fold_rejections = p.filter((r) => /^(folded-|delayed-folded|fragmented-folded)/.test(r.name)).map((r) => ({ name: r.name, pass: r.strict_rejection }));
  if (runtime === 'llhttp') assert.ok(proof.record.fold_rejections.every((r) => r.pass));
} catch (e) { proof.record.error = e.stack; }
finally {
  clearTimeout(watchdog); assertLock(); await cleanup();
  if (child) {
    let exit = child.exitCode === null ? await Promise.race([once(child, 'exit'), delay(2000).then(() => null)]) : [child.exitCode, child.signalCode];
    if (!exit) { child.kill('SIGKILL'); exit = [null, 'SIGKILL']; proof.record.error ??= 'docker attach cleanup timeout'; }
    proof.record.runtime_command.exit_code = exit[0]; proof.record.runtime_command.signal = exit[1];
  }
  proof.file('runtime.log', Buffer.concat(logs));
  let absent = true;
  if (container) { const r = proof.command('cleanup-inspect', ['docker', 'ps', '-aq', '--filter', `name=^${container}$`]);
    absent = r.status === 0 && !r.stdout.toString().trim(); }
  if (absent && fixture) fs.rmSync(fixture, { recursive: true });
  proof.record.cleanup = { lock_held_through_hashing: true, container_absent: absent,
    fixture_removed: fixture ? !fs.existsSync(fixture) : null, wall_ms: Date.now() - start };
  if (!absent || !proof.record.completed_observations) proof.record.error ??= 'incomplete proof or cleanup';
  proof.finish();
}
