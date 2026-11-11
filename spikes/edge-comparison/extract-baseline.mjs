import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const baseline = '668b8d998d8a39f3a554a9e42ad6a1a270049d27';
const sourcePath = 'spikes/pingora/lab.mjs';
const evidencePath = 'evidence/sprint02-d/pingora-results.json';
const source = execFileSync('git', ['show', `${baseline}:${sourcePath}`], { encoding: 'utf8' });
const rawEvidence = execFileSync('git', ['show', `${baseline}:${evidencePath}`], { encoding: 'utf8' });
const evidence = JSON.parse(rawEvidence);
const hash = (value) => createHash('sha256').update(value).digest('hex');
// Evaluate only literal fixture declarations from the pinned, trusted source.
function literal(start, end, prelude = '') {
  const begin = source.indexOf(start);
  assert.ok(begin >= 0);
  const finish = source.indexOf(end, begin);
  assert.ok(finish > begin);
  return vm.runInNewContext(`${prelude}\n${source.slice(begin, finish)}; JSON.stringify(${start.match(/const (\w+)/)[1]})`, {}, { timeout: 1000 });
}
const corpus = JSON.parse(literal('const corpus = {', '\n  for (const [name, payload] of Object.entries(corpus))'));
const requestLine = "const requestLine = (target, headers = 'Host: edge-a.test', method = 'GET') => `${method} ${target} HTTP/1.1\\r\\n${headers}\\r\\nConnection: close\\r\\n\\r\\n`;";
const expanded = JSON.parse(literal('const expandedCorpus = {', '\n  for (const [name, payload] of Object.entries(expandedCorpus))', requestLine));
const manifest = {
  schema_version: 1, baseline_commit: baseline,
  source: { path: sourcePath, sha256: hash(source) },
  evidence: { path: evidencePath, sha256: hash(rawEvidence) },
  baseline_tests: evidence.tests.map(({ name }) => name),
  baseline_failures: evidence.tests.filter(({ status }) => status === 'fail').map(({ name }) => name),
  rejection_contract: { origin_dispatches: 0, origin_inbound_bytes: 0, origin_parse_errors: 0,
    response: 'HTTP/1.x 4xx or peer closes with no response; no deadline expiry' },
  negatives: [
    ...Object.entries(corpus).map(([name, request]) => ({ name: `malformed-HTTP-${name}`, request })),
    ...Object.entries(expanded).map(([name, request]) => ({ name: `strict-ingress-${name}`, request })),
  ],
  encoded_targets: ['/bad%20target', '/bad%09target', '/bad%01target', '/bad%00target',
    '/encoded%2Fsegment?value=%2520', '/caf%C3%A9?x=a%20b'],
};
assert.equal(manifest.baseline_tests.length, 65);
assert.equal(manifest.baseline_failures.length, 8);
assert.equal(manifest.negatives.length, 32);
const output = `${JSON.stringify(manifest, null, 2)}\n`;
if (process.argv.includes('--check')) {
  assert.equal(fs.readFileSync(new URL('./manifest.json', import.meta.url), 'utf8'), output);
  console.log('PASS immutable baseline manifest matches pinned source and all65 test IDs');
} else process.stdout.write(output);
