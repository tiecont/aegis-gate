// Synthetic local probe transport only. No HTTP interpretation or rewriting.
import tls from 'node:tls';
import { decoder } from './wire-observer.mjs';

export function traceFrames(client = false) {
  const result = { bytes: 0, frames: 0, data_bytes: 0, headers: 0, streams: {}, events: [], omitted: 0 };
  const decode = decoder({ client, emit: (event) => {
    if (event.kind === 'frame') {
      result.frames++;
      if (event.type === 0) result.data_bytes += event.length;
      if (event.type === 1) result.headers++;
      if (event.stream && (Object.hasOwn(result.streams, event.stream) || Object.keys(result.streams).length < 32)) {
        const s = result.streams[event.stream] ??= { frames: 0, data_bytes: 0, headers: 0, resets: [] };
        s.frames++;
        if (event.type === 0) s.data_bytes += event.length;
        if (event.type === 1) s.headers++;
        if (event.type === 3) s.resets.push(event.error_code);
      }
    }
    if (event.kind !== 'frame' || event.type !== 0) {
      if (result.events.length < 256) result.events.push({ ms: performance.now(), ...event });
      else result.omitted++;
    }
  } });
  return { result, consume(chunk) {
    result.bytes += chunk.length;
    // The old decoder rejects a single large coalesced chunk before draining it.
    for (let i = 0; i < chunk.length; i += 16384) decode(chunk.subarray(i, i + 16384));
  } };
}

export const identity = (s) => ({ sni: s.servername, alpn: s.alpnProtocol,
  tls: s.getProtocol(), authorized: s.authorized, authorization_error: s.authorizationError,
  peer_fingerprint256: s.getPeerCertificate().fingerprint256,
  local_fingerprint256: s.getCertificate()?.fingerprint256 });

export function observedOrigin({ cert, key, ca, port }) {
  const records = []; const pairs = new Set(); let errors = 0; let omitted = 0;
  const server = tls.createServer({ cert, key, minVersion: 'TLSv1.2', ALPNProtocols: ['h2'], handshakeTimeout: 2000 }, (down) => {
    if (pairs.size >= 16 || records.length >= 32) { omitted++; down.destroy(); return; }
    down.pause();
    const up = tls.connect({ host: '127.0.0.1', port, servername: 'lab-origin.test', ca,
      rejectUnauthorized: true, minVersion: 'TLSv1.2', ALPNProtocols: ['h2'] });
    const forward = traceFrames(true); const reverse = traceFrames();
    const row = { id: records.length + 1, opened_ms: performance.now(), candidate_tls: identity(down),
      candidate_to_origin: forward.result, origin_to_candidate: reverse.result, lifecycle: [] };
    records.push(row); const pair = { down, up }; pairs.add(pair);
    const stop = () => { down.destroy(); up.destroy(); pairs.delete(pair); };
    for (const [name, s] of [['candidate', down], ['native', up]]) {
      s.on('error', (e) => { errors++; row.lifecycle.push({ name, event: 'error', code: e.code, ms: performance.now() }); stop(); });
      s.on('close', () => { row.lifecycle.push({ name, event: 'close', ms: performance.now() }); stop(); });
      s.setTimeout(5000, stop);
    }
    down.on('data', forward.consume); up.on('data', reverse.consume);
    up.once('secureConnect', () => {
      row.native_tls = identity(up);
      if (down.alpnProtocol !== 'h2' || up.alpnProtocol !== 'h2') { errors++; stop(); return; }
      down.pipe(up); up.pipe(down);
    });
  });
  server.on('tlsClientError', () => { errors++; });
  server.snapshot = () => structuredClone({ records, errors, omitted,
    bytes: records.reduce((n, r) => n + r.candidate_to_origin.bytes, 0),
    headers: records.reduce((n, r) => n + r.candidate_to_origin.headers, 0),
    data_bytes: records.reduce((n, r) => n + r.candidate_to_origin.data_bytes, 0) });
  server.closeAllConnections = () => { for (const { down, up } of pairs) { down.destroy(); up.destroy(); } pairs.clear(); };
  return server;
}
