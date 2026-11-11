import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { assertInventory, assertRejected, manifest, manifestHash } from './contract.mjs';
import { supplementalNegatives } from './supplemental.mjs';

export function evaluate(result) {
  assert.equal(result.test_manifest_sha256, manifestHash, 'wrong immutable corpus');
  assert.ok(!result.fatal, `incomplete proof: ${result.fatal}`);
  assertInventory(result.tests);
  const negatives = [
    ...manifest.negatives.map(({ name, request }) => ({ name: name.replace(/^(malformed-HTTP-|strict-ingress-)/, ''), request })),
    ...supplementalNegatives,
  ];
  assert.equal(result.ingress_observations.length, negatives.length);
  for (const { name, request } of negatives) {
    const observations = result.ingress_observations.filter((entry) => entry.name === name);
    assert.equal(observations.length, 1, `missing or duplicate observation: ${name}`);
    assert.equal(observations[0].request, request, `mutated input: ${name}`);
  }
  const failures = result.tests.filter(({ status }) => status === 'fail').map(({ name }) => name);
  const forwarded = [];
  for (const observation of result.ingress_observations) {
    try { assertRejected(observation); }
    catch (error) { forwarded.push({ name: observation.name, reason: error.message }); }
  }
  assert.equal(result.result, failures.length ? 'fail' : 'pass', 'summary disagrees with tests');
  return { candidate: result.candidate.name, mandatory_tests: result.tests.length,
    passed: result.tests.length - failures.length, failed: failures,
    unsafe_or_unproven_rejections: forwarded,
    protocol_proof_pass: failures.length === 0 && forwarded.length === 0,
    architecture_approval: 'requires independent dependency/security review and human architecture decision' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = evaluate(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.protocol_proof_pass) process.exitCode = 1;
}
