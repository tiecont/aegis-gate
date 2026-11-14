// Independent test-only admission experiment; not an ingress runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import tls from 'node:tls';
import https from 'node:https';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { assertLock, listen, pki, until } from './wire-fixtures.mjs';

assertLock(); process.umask(0o077);
const [addonFile, output, buildReceipt] = process.argv.slice(2);
assert.ok(addonFile && output && buildReceipt);
assert.ok(!fs.existsSync(output));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
const addon = createRequire(import.meta.url)(path.resolve(addonFile));
assert.equal(addon.llhttpVersion, '9.4.4');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisgate-05b-d-'));
fs.mkdirSync(output, { recursive: true });
const record = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  argv: process.argv, started_at: new Date().toISOString(), node: process.version,
  node_binary_sha256: sha(fs.readFileSync(process.execPath)), addon_sha256: sha(fs.readFileSync(addonFile)),
  build_receipt: { file: buildReceipt, sha256: sha(fs.readFileSync(buildReceipt)) },
  scope: 'Independent test-only admission ordering counterexample; no original75/23 replacement or complete runtime claim',
  limits: { feed_bytes: 16384, staged_wire_bytes: 2 << 20, body_bytes: 1 << 20, wall_ms: 30000 }, tests: [] };
const sockets = new Set(); const servers = []; let originBytes = 0, dials = 0, handlers = 0, bodyBytes = 0, aborted = 0;
const time = () => process.hrtime.bigint().toString();
const snapshot = () => ({ origin_bytes: originBytes, origin_dials: dials, handlers, body_bytes: bodyBytes, aborted });
const track = (s) => { sockets.add(s); s.on('error', () => {}); s.on('close', () => sockets.delete(s)); return s; };
let watchdog;
try {
  watchdog = setTimeout(() => { for (const s of sockets) s.destroy(); }, 30000);
  const material = pki(fixture);
  const origin = https.createServer({ cert: material.read('origin.pem'), key: material.read('origin.key'),
    minVersion: 'TLSv1.2' }, (req, res) => {
    handlers++;
    req.on('data', (b) => { bodyBytes += b.length; req.pause(); setTimeout(() => req.resume(), 2); });
    req.on('aborted', () => aborted++);
    req.on('end', () => res.end('OK'));
  });
  origin.on('connection', track); servers.push(origin);
  const nativePort = await listen(origin);
  const observer = tls.createServer({ cert: material.read('origin.pem'), key: material.read('origin.key'), minVersion: 'TLSv1.2' }, (down) => {
    track(down); dials++; down.pause();
    const up = track(tls.connect({ host: '127.0.0.1', port: nativePort, servername: 'lab-origin.test',
      ca: material.read('ca.pem'), rejectUnauthorized: true, minVersion: 'TLSv1.2' }));
    down.on('data', (b) => { originBytes += b.length; });
    up.once('secureConnect', () => { down.pipe(up); up.pipe(down); });
    down.on('close', () => up.destroy()); up.on('close', () => down.destroy());
  });
  observer.on('connection', track); servers.push(observer); const port = await listen(observer);
  async function scenario(mode, invalid, cancel = false) {
    const before = snapshot(), events = [], parser = addon.create(); let up, fd;
    const stage = path.join(fixture, `stage-${record.tests.length}`); let staged = 0, pauses = 0;
    const event = (name, extra = {}) => events.push({ name, time_ns: time(), ...snapshot(), ...extra });
    const connect = async () => {
      if (up) return;
      event('origin-dial-start');
      up = track(tls.connect({ host: '127.0.0.1', port, servername: 'lab-origin.test',
        ca: material.read('ca.pem'), rejectUnauthorized: true, minVersion: 'TLSv1.2' }));
      await once(up, 'secureConnect'); assert.equal(up.authorized, true); up.resume(); event('origin-tls-verified');
    };
    const send = async (b) => { await connect(); if (!up.write(b)) { pauses++; await once(up, 'drain'); } };
    if (mode === 'stage') fd = fs.openSync(stage, 'wx', 0o600);
    const header = Buffer.from('POST /upload HTTP/1.1\r\nHost: lab-origin.test\r\nTransfer-Encoding: chunked\r\nTrailer: X-Proof\r\nConnection: close\r\n\r\n');
    const chunk = Buffer.concat([Buffer.from('4000\r\n'), Buffer.alloc(16384, 97), Buffer.from('\r\n')]);
    const suffix = Buffer.from(invalid ? '0\r\nX-Proof: first\r\n second\r\n\r\n' : '0\r\nX-Proof: first second\r\n\r\n');
    let last, maximumRss = process.memoryUsage().rss;
    async function feed(bytes) {
      for (let pos = 0; pos < bytes.length; pos += 16384) {
        const piece = bytes.subarray(pos, pos + 16384); last = addon.feed(parser, piece);
        event(last.complete ? 'message-complete' : 'parser-feed', { parser: last });
        if (last.error !== 'HPE_OK') return false;
        if (mode === 'stage') {
          assert.ok(staged + piece.length <= record.limits.staged_wire_bytes, 'bounded disk staging');
          fs.writeSync(fd, piece); staged += piece.length;
        } else if (last.headers) await send(piece);
        maximumRss = Math.max(maximumRss, process.memoryUsage().rss);
      }
      return true;
    }
    try {
      assert.equal(await feed(header), true); event('headers-accepted');
      for (let i = 0; i < (cancel ? 2 : 64); i++) assert.equal(await feed(chunk), true);
      if (mode === 'stream') await until(() => bodyBytes > before.body_bytes);
      event('before-trailer'); const prefix = snapshot();
      if (cancel) { up?.destroy(); event('client-upload-cancelled'); if (up) await until(() => aborted > before.aborted); }
      else {
        const accepted = await feed(suffix); event(accepted ? 'trailer-accepted' : 'trailer-rejected', { error: last.error });
        assert.equal(accepted, !invalid);
        if (mode === 'stage' && accepted) {
          fs.closeSync(fd); fd = undefined; const buffer = Buffer.alloc(16384), input = fs.openSync(stage, 'r');
          try { let n; while ((n = fs.readSync(input, buffer)) > 0) await send(buffer.subarray(0, n)); } finally { fs.closeSync(input); }
        }
        if (up) { if (invalid) up.destroy(); else await once(up, 'close'); }
      }
      await delay(30);
      const after = snapshot();
      const row = { mode, invalid, cancel, header_sha256: sha(header), body_chunk_sha256: sha(chunk),
        trailer_hex: suffix.toString('hex'), prefix, before, after, events, staged, write_pauses: pauses,
        peak_rss_bytes: maximumRss, parser_state: addon.stats(), parser_result: last,
        zero_origin_on_rejection: after.origin_bytes === before.origin_bytes,
        streamed_before_completion: prefix.body_bytes > before.body_bytes };
      if (mode === 'stage') assert.equal(prefix.origin_bytes, before.origin_bytes);
      else assert.ok(prefix.body_bytes > before.body_bytes);
      if (invalid && mode === 'stage') assert.equal(after.origin_bytes, before.origin_bytes);
      if (invalid && mode === 'stream') assert.ok(after.origin_bytes > before.origin_bytes);
      record.tests.push(row);
    } finally { up?.destroy(); if (fd !== undefined) fs.closeSync(fd); addon.close(parser); fs.rmSync(stage, { force: true }); }
  }
  for (const mode of ['stream', 'stage']) {
    await scenario(mode, false); await scenario(mode, true); await scenario(mode, false, true);
  }
  record.complete = true;
} catch (error) { record.error = error.stack; }
finally {
  clearTimeout(watchdog); assertLock();
  for (const socket of sockets) socket.destroy();
  for (const server of servers) if (server.listening) await new Promise((resolve) => server.close(resolve));
  fs.rmSync(fixture, { recursive: true, force: true });
  record.cleanup = { fixture_removed: !fs.existsSync(fixture), active_parsers: addon.stats().active, lock_held: true };
  record.ended_at = new Date().toISOString();
  fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(record, null, 2) + '\n');
  fs.writeFileSync(`${output}/SHA256SUMS`, `${sha(fs.readFileSync(`${output}/receipt.json`))}  ${output}/receipt.json\n`);
}
process.exitCode = record.complete && record.cleanup.active_parsers === 0 ? 0 : 1;
