// Single-instance loopback research spool. The enclosing shared flock owns its lifecycle.
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'node:crypto';
import { assertLock } from './wire-fixtures.mjs';
import { Rejection, limits, write } from './sprint05c-a-runtime.mjs';

const sessionName = /^sprint05d-a-session-[0-9a-f-]{36}$/;
const stageName = /^sprint05d-a-stage-[0-9a-f-]{36}$/;
const check = (signal) => { if (signal.aborted) throw signal.reason; };
const reject = (status, reason) => { throw new Rejection(status, reason); };
async function privateStat(file, directory) {
  const st = await fs.lstat(file);
  assert.equal(st.uid, process.getuid());
  assert.equal(st.mode & 0o777, directory ? 0o700 : 0o600);
  assert.ok(directory ? st.isDirectory() : st.isFile() && st.nlink === 1);
}
async function entries(directory, bound) {
  const names = [];
  for await (const entry of await fs.opendir(directory)) {
    if (names.length >= bound) reject(503, 'orphan enumeration limit');
    names.push(entry.name);
  }
  return names;
}
export class Spool {
  static async open(root, metrics) {
    assertLock();
    try { await fs.mkdir(root, { mode: 0o700 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    await privateStat(root, true);
    const spool = new Spool();
    Object.assign(spool, { root, metrics, bytes: 0, files: 0, stages: new Set(), reclaimedFiles: 0, reclaimedBytes: 0 });
    // Only validated private orphan names are removed; unknown objects fail startup closed.
    for (const name of await entries(root, 16)) {
      assert.match(name, sessionName); const directory = path.join(root, name);
      await privateStat(directory, true);
      const files = await entries(directory, limits.stageFiles);
      for (const name of files) {
        assert.match(name, stageName); const file = path.join(directory, name);
        await privateStat(file, false);
        const stat = await fs.stat(file); assert.ok(stat.size <= limits.stageBytes);
        await fs.unlink(file); spool.reclaimedFiles++; spool.reclaimedBytes += stat.size;
      }
      await fs.rmdir(directory);
    }
    spool.directory = path.join(root, `sprint05d-a-session-${randomUUID()}`);
    await fs.mkdir(spool.directory, { mode: 0o700 }); return spool;
  }
  async create() {
    if (this.files >= limits.stageFiles) reject(503, 'stage file quota');
    this.files++;
    const stage = new Stage(this);
    try {
      stage.handle = await fs.open(stage.file, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
      this.stages.add(stage); return stage;
    } catch (e) { this.files--; stage.erase(); throw e; }
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
    this.file = path.join(spool.directory, `sprint05d-a-stage-${randomUUID()}`);
  }
  erase() { this.key?.fill(0); this.iv?.fill(0); this.key = null; this.iv = null; this.cipher = null; this.tag = null; }
  async append(bytes, signal) {
    check(signal); assert.equal(this.sealed, false);
    if (bytes.length > limits.stageBytes - this.size) reject(413, 'stage request quota');
    if (bytes.length > limits.diskBytes - this.spool.bytes) reject(503, 'aggregate disk quota');
    this.spool.bytes += bytes.length; this.size += bytes.length;
    this.spool.metrics.peakDisk = Math.max(this.spool.metrics.peakDisk, this.spool.bytes);
    const encrypted = this.cipher.update(bytes); assert.equal(encrypted.length, bytes.length);
    for (let at = 0; at < encrypted.length;) {
      const { bytesWritten } = await this.handle.write(encrypted, at, encrypted.length - at, null);
      if (!bytesWritten) throw new Error('short spool write'); at += bytesWritten; check(signal);
    }
  }
  async decrypt(signal, consume) {
    const decipher = createDecipheriv('aes-256-gcm', this.key, this.iv); decipher.setAuthTag(this.tag);
    try {
      for (let at = 0; at < this.size;) {
        check(signal); const encrypted = Buffer.alloc(Math.min(limits.readBytes, this.size - at));
        const { bytesRead } = await this.handle.read(encrypted, 0, encrypted.length, at);
        if (bytesRead !== encrypted.length) reject(503, 'short encrypted stage'); at += bytesRead;
        const plain = decipher.update(encrypted);
        try { if (consume) await consume(plain); } finally { plain.fill(0); }
      }
      decipher.final();
    } catch (e) { if (signal.aborted || e.status) throw e; reject(503, 'encrypted stage authentication'); }
  }
  async seal(signal) {
    assert.equal(this.sealed, false); assert.equal(this.cipher.final().length, 0);
    this.tag = this.cipher.getAuthTag(); this.cipher = null; this.sealed = true;
    await this.handle.sync();
    // Authentication consumes no origin resource and retains no plaintext message.
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
