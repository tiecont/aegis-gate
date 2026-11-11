import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluate } from './evaluate.mjs';
import { manifest, manifestHash } from './contract.mjs';
import { supplementalNegatives, supplementalTestNames } from './supplemental.mjs';

// Synthetic evaluator fixtures test result validation only, never a proxy proof.
function fixture() {
  return { test_manifest_sha256: manifestHash, candidate: { name: 'synthetic-unit-fixture' },
    result: 'pass', tests: [...manifest.baseline_tests, ...supplementalTestNames].map((name) => ({ name, status: 'pass' })),
    ingress_observations: [...manifest.negatives.map(({ name, request }) => ({
      name: name.replace(/^(malformed-HTTP-|strict-ingress-)/, ''), request })), ...supplementalNegatives]
      .map((entry) => ({ ...entry, origin_dispatches: 0, origin_inbound_bytes: 0, origin_parse_errors: 0,
        response: 'HTTP/1.1 400 Bad Request\r\n\r\n', peer_closed: true, timed_out: false })) };
}
test('evaluator checks original wire bytes even when every test is labeled pass', () => {
  const result = fixture();
  assert.equal(evaluate(result).protocol_proof_pass, true);
  result.ingress_observations[0].request += ' ';
  assert.throws(() => evaluate(result), /mutated input/);
});
test('negative: claimed pass cannot conceal forwarded bytes or origin parser errors', () => {
  for (const change of [{ origin_inbound_bytes: 192 }, { origin_parse_errors: 2 }, { origin_dispatches: 1 }]) {
    const result = fixture();
    Object.assign(result.ingress_observations[0], change);
    const decision = evaluate(result);
    assert.equal(decision.protocol_proof_pass, false);
    assert.equal(decision.unsafe_or_unproven_rejections.length, 1);
  }
});
test('negative: wrong manifest, fatal setup, skipped cases and dishonest summary fail closed', () => {
  for (const mutate of [
    (r) => { r.test_manifest_sha256 = '0'.repeat(64); },
    (r) => { r.fatal = 'startup failure'; },
    (r) => { r.tests.pop(); },
    (r) => { r.tests[0].status = 'skip'; },
    (r) => { r.tests[0].status = 'fail'; },
    (r) => { r.ingress_observations.pop(); },
  ]) {
    const result = fixture(); mutate(result);
    assert.throws(() => evaluate(result));
  }
});
