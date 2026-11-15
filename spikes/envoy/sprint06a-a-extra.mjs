import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { Spool } from './sprint06a-a-spool.mjs';
import { runtime, limits } from './sprint06a-a-runtime.mjs';
import { listen, until } from './sprint06a-a-fixtures.mjs';
import { rawCommand } from './sprint05b-a-build.mjs';

export async function exercise(c) {
  const { record, front, fixture, addon, routes, edgeTLS, faultIO, probe, cl, clPrefix, chunkPrefix, req,
    snap, delta, zero, settled, connect, collect, send, sockets } = c;
  const row = (name, details) => record.probes.push({ name, ...details });
  {
    const quota = await Spool.open(path.join(fixture, 'exact-quota-spool'), { peakDisk: 0 }), stages = [];
    const signal = AbortSignal.timeout(15000);
    try {
      for (let i = 0; i < limits.stageFiles; i++) stages.push(await quota.create());
      await assert.rejects(quota.create(), { status: 503 });
      await stages[0].append(Buffer.alloc(limits.stageBytes, 1), signal);
      await assert.rejects(stages[0].append(Buffer.alloc(1), signal), { status: 413 });
      await stages[1].append(Buffer.alloc(limits.diskBytes - limits.stageBytes, 2), signal);
      assert.equal(quota.bytes, limits.diskBytes);
      await assert.rejects(stages[2].append(Buffer.alloc(1), signal), { status: 503 });
      await stages[0].seal(signal); const { key, iv, tag } = stages[0]; await stages[0].close();
      assert.ok([key, iv, tag].every((bytes) => bytes.every((b) => b === 0)));
      row('exact-stage-aggregate-file-quotas-key-tag-wiping', { stageBytes: limits.stageBytes, aggregateBytes: limits.diskBytes, files: limits.stageFiles, keyIVTagZero: true });
    } finally { for (const stage of stages) await stage.close(); await quota.close(); }
  }
  for (const mode of ['partial', 'zero', 'EIO']) {
    faultIO.mode = mode; const calls = faultIO.writeCalls;
    try {
      const valid = cl('fault-positive');
      const result = await probe(`FileHandle-${mode}-write`, valid, [mode === 'partial' ? 200 : 503], mode === 'partial' ? { parts: [valid] } : {});
      result.actualFileWriteCalls = faultIO.writeCalls - calls;
      if (mode === 'partial') assert.ok(result.actualFileWriteCalls > 10);
      assert.equal(front.quota.bytes, 0); assert.equal(front.quota.files, 0);
    } finally { faultIO.mode = 'normal'; }
  }
  for (const kind of ['truncate', 'hardlink', 'symlink-replace', 'mode']) {
    await settled(); const before = snap(), peer = await connect(), done = collect(peer);
    await send(peer, clPrefix); await until(() => front.quota.bytes === Buffer.byteLength(clPrefix));
    const stage = [...front.quota.stages][0], key = stage.key, iv = stage.iv, file = stage.file;
    const other = path.join(fixture, `attack-${kind}`);
    if (kind === 'truncate') fs.truncateSync(file, 1);
    if (kind === 'hardlink') fs.linkSync(file, other);
    if (kind === 'symlink-replace') { fs.renameSync(file, other); fs.symlinkSync(other, file); }
    if (kind === 'mode') fs.chmodSync(file, 0o644);
    peer.write('1234567'); const response = await done; await settled();
    assert.ok([502, 503].includes(response.statuses[0])); zero(delta(before));
    assert.equal(stage.key, null); assert.ok(key.every((b) => b === 0)); assert.ok(iv.every((b) => b === 0));
    assert.equal(fs.existsSync(file), false); assert.equal(front.quota.bytes, 0); assert.equal(front.quota.files, 0);
    fs.rmSync(other, { force: true });
    row(`pre-admission-${kind}-rejected`, { response, origin: delta(before), keyBuffersZero: true, stagePathRemoved: true });
  }
  // Retain references only to assert explicit JS-buffer wiping; never serialize key bytes.
  await settled(); {
    const before = snap(), peer = await connect(), done = collect(peer); peer.write(clPrefix);
    await until(() => front.quota.bytes === Buffer.byteLength(clPrefix));
    const stage = [...front.quota.stages][0], key = stage.key, iv = stage.iv, file = stage.file;
    peer.destroy(); await done; await settled(); zero(delta(before));
    assert.ok(key.every((b) => b === 0)); assert.ok(iv.every((b) => b === 0)); assert.equal(stage.key, null);
    assert.equal(fs.existsSync(file), false);
    row('cancel-erases-key-buffers-and-ciphertext', { keyBuffersZero: true, ciphertextAbsent: true, origin: delta(before) });
  }
  const startupCases = ['root-symlink', 'root-mode', 'session-symlink', 'session-mode', 'unknown-session',
    'stage-symlink', 'stage-hardlink', 'stage-mode', 'unknown-stage', 'stage-oversize', 'session-overflow', 'stage-overflow'];
  for (const kind of startupCases) {
    const root = path.join(fixture, `startup-${kind}`), outside = `${root}-outside`;
    fs.mkdirSync(outside, { mode: 0o700 });
    if (kind === 'root-symlink') fs.symlinkSync(outside, root); else fs.mkdirSync(root, { mode: 0o700 });
    if (kind === 'root-mode') fs.chmodSync(root, 0o755);
    const session = path.join(root, `sprint06a-a-session-${randomUUID()}`);
    if (kind === 'session-symlink') fs.symlinkSync(outside, session); else fs.mkdirSync(session, { mode: 0o700 });
    if (kind === 'session-mode') fs.chmodSync(session, 0o755);
    if (kind === 'unknown-session') fs.mkdirSync(path.join(root, 'unknown'), { mode: 0o700 });
    const file = path.join(session, `sprint06a-a-stage-${randomUUID()}`), target = path.join(outside, 'target');
    fs.writeFileSync(target, 'outside-integrity-canary', { mode: 0o600 });
    if (kind === 'stage-symlink') fs.symlinkSync(target, file);
    else if (kind === 'stage-hardlink') fs.linkSync(target, file);
    else fs.writeFileSync(file, 'encrypted-orphan-placeholder', { mode: 0o600 });
    if (kind === 'stage-mode') fs.chmodSync(file, 0o644);
    if (kind === 'unknown-stage') fs.writeFileSync(path.join(session, 'unknown'), '', { mode: 0o600 });
    if (kind === 'stage-oversize') fs.truncateSync(file, limits.stageBytes + 1);
    if (kind === 'session-overflow') for (let i = 0; i < 16; i++) fs.mkdirSync(path.join(root, `sprint06a-a-session-${randomUUID()}`), { mode: 0o700 });
    if (kind === 'stage-overflow') for (let i = 0; i < 3; i++) fs.writeFileSync(path.join(session, `sprint06a-a-stage-${randomUUID()}`), '', { mode: 0o600 });
    let started;
    try {
      await assert.rejects(async () => { started = await runtime({ addon, edgeTLS, routes, directory: root }); });
      assert.equal(started, undefined);
      assert.equal(fs.readFileSync(target, 'utf8'), 'outside-integrity-canary');
      row(`startup-${kind}-closed`, { listenerCreated: false, outsideUnchanged: true });
    } finally { await started?.close(); fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true }); }
  }
  // Three admitted requests hold two real origin slots and one queue entry.
  await settled(); {
    const before = snap(), peers = [], dones = [];
    for (let i = 0; i < 3; i++) { const peer = await connect(); peers.push(peer); dones.push(collect(peer)); await send(peer, cl('held', true, '/hold')); }
    await until(() => front.slots.active === 2 && front.slots.queue.length === 1);
    assert.equal(delta(before).dials, 2);
    const peak = { active: front.slots.active, queue: front.slots.queue.length };
    peers[2].destroy(); await dones[2]; await until(() => front.slots.queue.length === 0);
    peers[0].destroy(); peers[1].destroy(); await Promise.all(dones); await settled();
    assert.equal(front.slots.active, 0); assert.equal(front.slots.queue.length, 0);
    row('actual-origin-slots-queue-cancel', { peak, origin: delta(before), released: true });
  }
  await settled(); {
    const before = snap(), peers = [], dones = [];
    try {
      for (let i = 0; i < limits.connections; i++) { const peer = await connect(); peers.push(peer); dones.push(collect(peer)); }
      await until(() => front.tcpConnections === limits.connections);
      const refused = tls.connect({ host: '127.0.0.1', port: front.port, servername: 'edge-a.test',
        ca: fs.readFileSync(path.join(fixture, 'pki/ca.pem')), rejectUnauthorized: true, ALPNProtocols: ['http/1.1'] });
      sockets.add(refused); refused.on('error', () => {}); refused.once('close', () => sockets.delete(refused));
      const closed = once(refused, 'close').catch(() => {}); await closed; zero(delta(before));
      row('actual-TCP-connection-cap', { occupied: limits.connections, extraClosed: true, origin: delta(before) });
    } finally { peers.forEach((p) => p.destroy()); await Promise.all(dones); await settled(); }
  }
  await probe('actual-origin-absolute-deadline', cl('deadline', true, '/hold'), [504], { allowOrigin: true });
  const ca = fs.readFileSync(path.join(fixture, 'pki/ca.pem'));
  for (const [name, originName] of [['origin', 'wrong.test'], ['expired', 'lab-origin.test'], ['untrusted', 'lab-origin.test']]) {
    await settled(); let bytes = 0, connected = 0; const accepted = new Set();
    const server = tls.createServer({ key: fs.readFileSync(path.join(fixture, `pki/${name}.key`)),
      cert: fs.readFileSync(path.join(fixture, `pki/${name}.pem`)), ALPNProtocols: ['http/1.1'] }, (peer) => {
      accepted.add(peer); connected++; peer.on('data', (b) => { bytes += b.length; }); peer.on('error', () => {});
      peer.once('close', () => accepted.delete(peer));
    });
    server.on('tlsClientError', (_e, peer) => peer.destroy());
    const port = await listen(server), route = routes.get('edge-a.test'), saved = { port: route.port, originName: route.originName };
    try {
      Object.assign(route, { port, originName });
      const peer = await connect(), done = collect(peer); await send(peer, cl());
      const response = await done; await settled(); assert.deepEqual(response.statuses, [502]); assert.equal(bytes, 0);
      row(`verified-origin-TLS-${name}-${originName}`, { response, decryptedOriginBytes: bytes, secureConnections: connected, originDialExpected: true });
    } finally { Object.assign(route, saved); for (const peer of accepted) peer.destroy(); await new Promise((resolve) => server.close(resolve)); }
  }
  await probe('Host-SNI-identity-reject', cl().replace('Host: edge-a.test', 'Host: edge-b.test'), [421]);
  await settled(); {
    const before = snap(), peer = tls.connect({ host: '127.0.0.1', port: front.port, servername: 'unknown.test', ca, rejectUnauthorized: true });
    peer.on('error', () => {}); const closed = new Promise((resolve) => peer.once('close', resolve));
    await closed; await settled(); zero(delta(before)); row('unknown-SNI-handshake-denied', { origin: delta(before) });
  }
  if (process.env.AEGIS06A_CONTAINER === '1') {
    const read = (name) => fs.readFileSync(`/sys/fs/cgroup/${name}`, 'utf8').trim();
    const stats = (name) => Object.fromEntries(read(name).split('\n').map((line) => { const [k, v] = line.split(' '); return [k, Number(v)]; }));
    const controls = { memoryMax: read('memory.max'), swapMax: read('memory.swap.max'), cpuMax: read('cpu.max'), pidsMax: read('pids.max') };
    assert.equal(controls.memoryMax, String(384 * 1024 * 1024)); assert.equal(controls.swapMax, '0');
    assert.equal(controls.cpuMax, '75000 100000'); assert.equal(controls.pidsMax, '64');
    const cpuBefore = stats('cpu.stat'), begun = performance.now();
    while (performance.now() - begun < 1000) Math.sqrt(Math.random());
    const cpuAfter = stats('cpu.stat'); assert.ok(cpuAfter.nr_throttled > cpuBefore.nr_throttled);
    row('kernel-CPU-quota-enforced', { controls, before: cpuBefore, after: cpuAfter });
    await probe('healthy-after-CPU-throttle', cl('cpu'), [200], { parts: [cl('cpu')] });
    const pidsBefore = stats('pids.events'), workers = [], exited = [];
    try {
      for (let i = 0; i < 80; i++) {
        const child = spawn('/usr/bin/sleep', ['10'], { stdio: 'ignore' }); workers.push(child);
        exited.push(new Promise((resolve) => child.once('close', (exit, signal) => resolve({ exit, signal }))));
        const started = await new Promise((resolve) => { child.once('spawn', () => resolve(true)); child.once('error', (e) => resolve(e.code)); });
        if (started !== true) { assert.equal(started, 'EAGAIN'); break; }
      }
      assert.ok(stats('pids.events').max > pidsBefore.max);
      row('kernel-PID-cap-enforced', { before: pidsBefore, after: stats('pids.events'), peak: read('pids.current'), attemptedChildren: workers.length });
    } finally { workers.forEach((child) => child.kill('SIGKILL')); await Promise.all(exited); }
    await probe('healthy-after-PID-exhaustion', cl('pids'), [200], { parts: [cl('pids')] });
    const memoryBefore = stats('memory.events');
    const hog = await rawCommand([process.execPath, '--max-old-space-size=16', '--eval',
      'const blocks=[]; for(let i=0;i<90;i++) blocks.push(Buffer.alloc(8*1024*1024,1)); setTimeout(()=>{},5000)'], { timeout: 15000 });
    record.resourceChild = hog;
    const memoryAfter = stats('memory.events'); assert.ok(memoryAfter.oom_kill > memoryBefore.oom_kill);
    assert.equal(hog.signal, 'SIGKILL');
    row('kernel-memory-OOM-killed-child-ingress-survived', { controls, before: memoryBefore, after: memoryAfter, peak: read('memory.peak'), childSignal: hog.signal });
    await probe('healthy-after-cgroup-OOM', cl('memory'), [200], { parts: [cl('memory')] });
    await settled(); const before = snap(), filler = path.join(process.env.AEGIS06A_SPOOL_ROOT, 'diskfull-fill');
    const fd = fs.openSync(filler, 'wx', 0o600); let written = 0, failure;
    try {
      for (;;) { fs.writeSync(fd, Buffer.alloc(65536)); written += 65536; }
    } catch (e) { failure = e.code; assert.equal(failure, 'ENOSPC'); } finally { fs.closeSync(fd); }
    try {
      const result = await probe('actual-tmpfs-ENOSPC-before-origin', cl('full'), [503]); zero(delta(before));
      result.tmpfs = { flags: fs.readFileSync('/proc/mounts', 'utf8').split('\n').filter((l) => l.includes(process.env.AEGIS06A_SPOOL_ROOT)), fillerBytes: written, failure };
    } finally { fs.rmSync(filler); }
    await probe('healthy-after-actual-ENOSPC', cl('disk'), [200], { parts: [cl('disk')] });
    record.cgroupFinal = { controls, memoryCurrent: read('memory.current'), memoryPeak: read('memory.peak'), cpu: stats('cpu.stat'), pids: read('pids.current') };
  }
  assert.ok(front.metrics.keyBuffersErased > 0);
}
