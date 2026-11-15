// Test-only finite ingress spool; one process and enclosing shared flock own this root.
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'node:crypto';
import { assertLock } from './sprint06a-a-fixtures.mjs';
import { Rejection, limits, write } from './sprint05c-a-runtime.mjs';

const sessionName = /^sprint06a-a-session-[0-9a-f-]{36}$/;
const stageName = /^sprint06a-a-stage-[0-9a-f-]{36}$/;
const check = (signal) => { if (signal.aborted) throw signal.reason; };
const reject = (reason) => { throw new Rejection(503, reason); };
async function privateStat(file, directory) {
  const st = await fs.lstat(file);
  assert.equal(st.uid, process.getuid());
  assert.equal(st.mode & 0o7777, directory ? 0o700 : 0o600);
  assert.ok(directory ? st.isDirectory() : st.isFile() && st.nlink === 1);
  return st;
}
async function entries(directory, bound) {
  const names = [];
  for await (const entry of await fs.opendir(directory)) {
    if (names.length >= bound) reject('orphan enumeration limit');
    names.push(entry.name);
  }
  return names;
}
export class Spool {
  static async open(root, metrics, io = {}) {
    assertLock();
    try { await fs.mkdir(root, { mode: 0o700 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    await privateStat(root, true);
    const spool = new Spool();
    Object.assign(spool, { root, metrics, io, bytes: 0, files: 0, stages: new Set(), reclaimedFiles: 0, reclaimedBytes: 0 });
    const orphans = [];
    // Validate the complete bounded inventory before deleting any orphan.
    for (const name of await entries(root, 16)) {
      assert.match(name, sessionName); const directory = path.join(root, name);
      await privateStat(directory, true);
      const files = [];
      for (const name of await entries(directory, limits.stageFiles)) {
        assert.match(name, stageName); const file = path.join(directory, name);
        const stat = await privateStat(file, false); assert.ok(stat.size <= limits.stageBytes);
        files.push({ file, size: stat.size });
      }
      orphans.push({ directory, files });
    }
    for (const { directory, files } of orphans) {
      for (const { file, size } of files) {
        await fs.unlink(file); spool.reclaimedFiles++; spool.reclaimedBytes += size;
      }
      await fs.rmdir(directory);
    }
    spool.directory = path.join(root, `sprint06a-a-session-${randomUUID()}`);
    await fs.mkdir(spool.directory, { mode: 0o700 }); return spool;
  }
  async create() {
    if (this.files >= limits.stageFiles) reject('stage file quota');
    this.files++;
    const stage = new Stage(this);
    try {
      stage.handle = await fs.open(stage.file, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
      stage.identity = await stage.handle.stat();
      this.stages.add(stage); return stage;
    } catch (e) { await stage.handle?.close(); this.files--; stage.erase(); throw e; }
  }
  async close() {
    assertLock(); assert.equal(this.stages.size, 0); assert.equal(this.bytes, 0); assert.equal(this.files, 0);
    await fs.rmdir(this.directory); assert.deepEqual(await entries(this.root, 16), []); await fs.rmdir(this.root);
  }
}
class Stage {
  constructor(spool) {
    this.spool = spool; this.size = 0; this.sealed = false;
    this.key = randomBytes(32); this.iv = randomBytes(12);
    this.cipher = createCipheriv('aes-256-gcm', this.key, this.iv);
    this.file = path.join(spool.directory, `sprint06a-a-stage-${randomUUID()}`);
  }
  erase() {
    this.key?.fill(0); this.iv?.fill(0); this.tag?.fill(0);
    this.spool.metrics.keyBuffersErased = (this.spool.metrics.keyBuffersErased ?? 0) + 1;
    this.key = null; this.iv = null; this.cipher = null; this.tag = null;
  }
  async append(bytes, signal) {
    check(signal); assert.equal(this.sealed, false);
    if (bytes.length > limits.stageBytes - this.size) throw new Rejection(413, 'stage request quota');
    if (bytes.length > limits.diskBytes - this.spool.bytes) reject('aggregate disk quota');
    this.spool.bytes += bytes.length; this.size += bytes.length;
    this.spool.metrics.peakDisk = Math.max(this.spool.metrics.peakDisk, this.spool.bytes);
    const encrypted = this.cipher.update(bytes);
    try {
      assert.equal(encrypted.length, bytes.length);
      for (let at = 0; at < encrypted.length;) {
        const writeFile = this.spool.io.write ?? ((handle, ...args) => handle.write(...args));
        const { bytesWritten } = await writeFile(this.handle, encrypted, at, encrypted.length - at, null);
        if (!Number.isInteger(bytesWritten) || bytesWritten <= 0 || bytesWritten > encrypted.length - at) reject('short spool write');
        at += bytesWritten; check(signal);
      }
    } finally { encrypted.fill(0); }
  }
  async decrypt(signal, consume) {
    const decipher = createDecipheriv('aes-256-gcm', this.key, this.iv); decipher.setAuthTag(this.tag);
    try {
      for (let at = 0; at < this.size;) {
        check(signal); const encrypted = Buffer.alloc(Math.min(limits.readBytes, this.size - at));
        const { bytesRead } = await this.handle.read(encrypted, 0, encrypted.length, at);
        if (bytesRead !== encrypted.length) reject('short encrypted stage'); at += bytesRead;
        const plain = decipher.update(encrypted); encrypted.fill(0);
        try { if (consume) await consume(plain); } finally { plain.fill(0); }
      }
      decipher.final();
    } catch (e) { if (signal.aborted || e.status) throw e; reject('encrypted stage authentication'); }
  }
  async seal(signal) {
    assert.equal(this.sealed, false); assert.equal(this.cipher.final().length, 0);
    this.tag = this.cipher.getAuthTag(); this.cipher = null; this.sealed = true;
    const st = await privateStat(this.file, false), opened = await this.handle.stat();
    if (st.dev !== opened.dev || st.ino !== opened.ino || opened.ino !== this.identity.ino || opened.nlink !== 1 || opened.size !== this.size) reject('stage identity changed');
    await this.handle.sync();
    await this.decrypt(signal);
  }
  async replay(socket, signal, metrics) {
    assert.equal(this.sealed, true);
    await this.decrypt(signal, (bytes) => write(socket, Buffer.from(bytes), signal, metrics));
  }
  async close() {
    if (!this.handle) return;
    const handle = this.handle; this.handle = null;
    try { await handle.close(); await fs.unlink(this.file); }
    finally { this.erase(); this.spool.bytes -= this.size; this.spool.files--; this.spool.stages.delete(this); }
  }
}
