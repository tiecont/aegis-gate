import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { supplementalTestNames } from './supplemental.mjs';

const raw = fs.readFileSync(new URL('./manifest.json', import.meta.url));
export const manifest = JSON.parse(raw);
export const manifestHash = createHash('sha256').update(raw).digest('hex');

export function assertRejected(detail) {
  assert.equal(detail.origin_dispatches, 0, 'malformed request reached an owned origin');
  assert.equal(detail.origin_inbound_bytes, 0, 'malformed bytes reached an owned origin');
  assert.equal(detail.origin_parse_errors, 0, 'origin parser rejected bytes that must stop at ingress');
  assert.equal(detail.timed_out, false, 'rejection exceeded connection deadline');
  assert.ok((detail.response === '' && detail.peer_closed) || /^HTTP\/1\.[01] 4\d\d/.test(detail.response),
    `unsafe rejection response: ${detail.response.slice(0, 100)}`);
}

export function assertInventory(tests, includeSupplemental = true) {
  const names = tests.map(({ name }) => name);
  assert.equal(new Set(names).size, names.length, 'duplicate test ID');
  for (const name of manifest.baseline_tests) assert.ok(names.includes(name), `missing mandatory baseline test: ${name}`);
  if (includeSupplemental) for (const name of supplementalTestNames) assert.ok(names.includes(name), `missing mandatory supplemental test: ${name}`);
}
