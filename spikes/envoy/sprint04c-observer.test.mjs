// Integrates test-only Go maintained decoder tests with the existing JS unit glob.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('Sprint04-C maintained H2/HPACK attribution rejects deliberate leaks and incomplete evidence', { timeout: 90000 }, () => {
  const result = spawnSync('go', ['test', '-race', './spikes/envoy/sprint04c-attribution', '-count=1', '-v'], {
    env: { ...process.env, GOTOOLCHAIN: 'go1.27.4' }, timeout: 85000, encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /TestStatefulDynamicReference/);
  assert.match(result.stdout, /TestPartialForbiddenHeadersFailClosed/);
  console.log(result.stdout);
});
