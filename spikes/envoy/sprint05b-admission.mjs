// Test-only whole-message staging; framing and boundaries come only from llhttp.
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';

export const bounds = Object.freeze({ memory: 32768, disk: 131072 });

export class Stage {
  constructor(mode, dir) {
    this.mode = mode; this.dir = dir; this.size = 0; this.peak = 0;
    this.cap = bounds[mode];
    if (!this.cap) throw new Error('unsupported staging mode');
    this.memory = mode === 'memory' ? Buffer.alloc(this.cap) : null;
  }
  append(bytes) {
    if (bytes.length > this.cap - this.size) throw new Error('staging limit');
    if (this.memory) bytes.copy(this.memory, this.size);
    else {
      if (this.fd === undefined) {
        this.file = path.join(fs.mkdtempSync(path.join(this.dir, 'stage-')), 'request');
        this.fd = fs.openSync(this.file, 'wx', 0o600);
      }
      let offset = 0;
      while (offset < bytes.length) {
        const written = fs.writeSync(this.fd, bytes, offset, bytes.length - offset);
        if (!written) throw new Error('staging write made no progress');
        offset += written;
      }
    }
    this.size += bytes.length; this.peak = Math.max(this.peak, this.size);
  }
  async send(socket, signal) {
    const write = async (bytes) => {
      if (signal.aborted) throw new Error('cancelled');
      if (!socket.write(bytes)) await once(socket, 'drain', { signal });
    };
    if (this.memory) await write(this.memory.subarray(0, this.size));
    else {
      const stream = fs.createReadStream(this.file, { highWaterMark: 16384, signal });
      for await (const bytes of stream) await write(bytes);
    }
  }
  reset() {
    if (this.memory) this.memory.fill(0, 0, this.size);
    if (this.fd !== undefined) { fs.closeSync(this.fd); this.fd = undefined; }
    if (this.file) {
      fs.unlinkSync(this.file); fs.rmdirSync(path.dirname(this.file)); this.file = undefined;
    }
    this.size = 0;
  }
  close() { this.reset(); this.memory = null; }
}

export class Admission {
  constructor(addon, mode, dir) {
    this.addon = addon; this.parser = addon.createParser(); this.stage = new Stage(mode, dir);
    this.closed = false; this.feeds = 0; this.messages = 0;
  }
  async feed(bytes, dispatch) {
    let offset = 0;
    while (offset < bytes.length) {
      if (this.closed) throw new Error('cancelled');
      const part = bytes.subarray(offset, offset + this.addon.maxFeedBytes);
      const parsed = this.parser.feed(part); this.feeds++;
      if (parsed.error !== 'HPE_OK' && !(parsed.error === 'HPE_PAUSED' && parsed.complete))
        throw new Error(`${parsed.error}: ${parsed.reason}`);
      if (parsed.consumed === 0) throw new Error('parser made no progress');
      this.stage.append(part.subarray(0, parsed.consumed));
      offset += parsed.consumed;
      if (parsed.complete) {
        this.messages++;
        await dispatch(this.stage, parsed);
        this.stage.reset();
        if (!parsed.keepAlive) { this.close(); return; }
      }
    }
  }
  finish() {
    if (!this.closed) {
      const parsed = this.parser.finish();
      if (parsed.error !== 'HPE_OK') throw new Error(parsed.error);
    }
  }
  close() {
    if (!this.closed) {
      this.closed = true; this.parser.close(); this.stage.close();
    }
  }
}
