import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertRejected, assertInventory, manifest } from './contract.mjs';
import { supplementalTestNames } from './supplemental.mjs';

const rejected = { origin_dispatches: 0, origin_inbound_bytes: 0, origin_parse_errors: 0,
  response: 'HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n', peer_closed: true, timed_out: false };
test('rejection permits explicit400 or immediate closed peer', () => {
  assertRejected(rejected);
  assertRejected({ ...rejected, response: '' });
});
test('negative: status and zero handlers cannot hide forwarded bytes or parser errors', () => {
  for (const change of [{ origin_dispatches: 1 }, { origin_inbound_bytes: 192 }, { origin_parse_errors: 2 },
    { timed_out: true }, { response: 'HTTP/1.1 502 Bad Gateway\r\n\r\n' }, { response: '', peer_closed: false }]) {
    assert.throws(() => assertRejected({ ...rejected, ...change }));
  }
});
test('negative: missing or duplicated functional and security cases cannot pass inventory', () => {
  const tests = [...manifest.baseline_tests, ...supplementalTestNames].map((name) => ({ name, status: 'pass' }));
  assertInventory(tests);
  assert.throws(() => assertInventory(tests.slice(1)));
  assert.throws(() => assertInventory([...tests, tests[0]]));
  assert.throws(() => assertInventory(tests.slice(0, 65)));
  assert.throws(() => assertInventory(tests.map((entry, index) => index ? entry : { ...entry, status: 'skip' })));
  assert.equal(manifest.baseline_failures.length, 8);
  for (const name of manifest.baseline_failures) assert.ok(manifest.negatives.some((entry) => entry.name === name));
});
