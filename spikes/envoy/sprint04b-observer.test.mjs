import test from 'node:test';
import assert from 'node:assert/strict';
import { traceFrames } from './sprint04b-observer.mjs';
import { frame } from './wire-observer.mjs';

test('trace drains coalesced input over old decoder chunk bound', () => {
  const bytes = Buffer.concat([Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n'),
    ...Array.from({ length: 10 }, () => frame(0, 0, 1, Buffer.alloc(16384))), frame(3, 0, 1, Buffer.from([0, 0, 0, 8]))]);
  const trace = traceFrames(true); trace.consume(bytes);
  assert.equal(trace.result.bytes, bytes.length); assert.equal(trace.result.data_bytes, 163840);
  assert.equal(trace.result.frames, 11); assert.equal(trace.result.events.at(-1).error_code, 8);
  assert.ok(!trace.result.events.some((e) => e.kind === 'decode-limit'));
});
test('fragmented control and bounded control samples preserve totals', () => {
  const trace = traceFrames(); const bytes = Buffer.concat(Array.from({ length: 300 }, () => frame(4, 1, 0)));
  for (let i = 0; i < bytes.length; i += 7) trace.consume(bytes.subarray(i, i + 7));
  assert.equal(trace.result.frames, 300); assert.equal(trace.result.events.length, 256); assert.equal(trace.result.omitted, 44);
});
