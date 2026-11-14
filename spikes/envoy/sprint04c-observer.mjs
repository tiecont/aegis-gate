// Test-only synthetic wire capture; never enable on customer traffic.
import tls from 'node:tls';
import { createHash } from 'node:crypto';
import { traceFrames, identity } from './sprint04b-observer.mjs';
export { traceFrames, identity };

export function boundedCapture(clientPreface = false, limit = 128 * 1024) {
  const chunks = []; const hash = createHash('sha256'); let kept = 0; let total = 0; let closed = false;
  return { consume(bytes) {
    total += bytes.length; hash.update(bytes);
    const take = Math.min(bytes.length, limit - kept);
    if (take > 0) { chunks.push(Buffer.from(bytes.subarray(0, take))); kept += take; }
  }, close() { closed = true; }, snapshot() {
    return { hex: Buffer.concat(chunks).toString('hex'), total_bytes: total, dropped_bytes: total - kept,
      client_preface: clientPreface, capture_closed: closed, all_bytes_sha256: hash.copy().digest('hex') };
  } };
}

export function observedOrigin({ cert, key, ca, port }) {
  const records = []; const pairs = new Set(); let errors = 0; let omitted = 0;
  const server = tls.createServer({ cert, key, minVersion: 'TLSv1.2', ALPNProtocols: ['h2'], handshakeTimeout: 2000 }, (down) => {
    if (pairs.size >= 16 || records.length >= 32) { omitted++; down.destroy(); return; }
    down.pause();
    const up = tls.connect({ host: '127.0.0.1', port, servername: 'lab-origin.test', ca,
      rejectUnauthorized: true, minVersion: 'TLSv1.2', ALPNProtocols: ['h2'] });
    const forward = traceFrames(true); const reverse = traceFrames();
    const rawForward = boundedCapture(true); const rawReverse = boundedCapture();
    const row = { id: records.length + 1, opened_ms: performance.now(), candidate_tls: identity(down),
      candidate_to_origin: forward.result, origin_to_candidate: reverse.result, lifecycle: [] };
    records.push({ row, rawForward, rawReverse }); const pair = { down, up }; pairs.add(pair);
    const stop = () => { down.destroy(); up.destroy(); pairs.delete(pair); };
    for (const [name, s, capture] of [['candidate', down, rawForward], ['native', up, rawReverse]]) {
      s.on('error', (e) => { errors++; row.lifecycle.push({ name, event: 'error', code: e.code, ms: performance.now() }); stop(); });
      s.on('close', () => { capture.close(); row.lifecycle.push({ name, event: 'close', ms: performance.now() }); stop(); });
      s.setTimeout(5000, stop);
    }
    down.on('data', (b) => { forward.consume(b); rawForward.consume(b); });
    up.on('data', (b) => { reverse.consume(b); rawReverse.consume(b); });
    up.once('secureConnect', () => {
      row.native_tls = identity(up);
      if (down.alpnProtocol !== 'h2' || up.alpnProtocol !== 'h2') { errors++; stop(); return; }
      down.pipe(up); up.pipe(down);
    });
  });
  server.on('tlsClientError', () => { errors++; });
  server.snapshot = () => structuredClone({ records: records.map(({ row }) => row), errors, omitted,
    bytes: records.reduce((n, { row }) => n + row.candidate_to_origin.bytes, 0),
    headers: records.reduce((n, { row }) => n + row.candidate_to_origin.headers, 0),
    data_bytes: records.reduce((n, { row }) => n + row.candidate_to_origin.data_bytes, 0) });
  server.rawCaptures = () => records.flatMap(({ row, rawForward, rawReverse }) =>
    [['candidate-to-origin', rawForward], ['origin-to-candidate', rawReverse]].map(([direction, raw]) => ({
      direction, connection: `origin-${row.id}`, native_tls: row.native_tls,
      ...raw.snapshot(), identity_complete: false, dial_observed: true, new_connection: true,
      links: [], caveat: 'No authenticated downstream/proxy dispatch map, tenant or captured signed generation; diagnostic INCONCLUSIVE.' })));
  server.closeAllConnections = () => { for (const { down, up } of pairs) { down.destroy(); up.destroy(); } pairs.clear(); };
  return server;
}
