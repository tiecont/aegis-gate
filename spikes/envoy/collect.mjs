import fs from 'node:fs';
import path from 'node:path';

const [logfile, prefix] = process.argv.slice(2);
if (!logfile || !prefix) throw new Error('usage: collect.mjs harness-log evidence-prefix');
const log = fs.readFileSync(logfile, 'utf8');
const resultPath = log.match(/^Evidence: (.+)$/m)?.[1];
if (!resultPath) throw new Error('shared harness did not emit evidence path');
const results = JSON.parse(fs.readFileSync(resultPath));
const run = path.dirname(resultPath);
for (const [filename, suffix] of [[resultPath, 'results.json'], [path.join(run, 'proxy.log'), 'proxy.log']]) {
  fs.copyFileSync(filename, `${prefix}-${suffix}`);
}
const adapterLog = fs.readFileSync(path.join(run, 'proxy.log'), 'utf8');
const startup = adapterLog.split('\n').find((line) => line.startsWith('{"adapter":"envoy"'));
if (startup) {
  const resourceFile = JSON.parse(startup).resources;
  if (fs.existsSync(resourceFile)) fs.copyFileSync(resourceFile, `${prefix}-resources.jsonl`);
}
const summary = {
  result: results.result, fatal: results.fatal ?? null,
  tests: results.tests.length, passed: results.tests.filter((t) => t.status === 'pass').length,
  failures: results.tests.filter((t) => t.status === 'fail'),
  source_artifacts: results.candidate?.artifacts ?? [],
  source_note: 'Only artifacts captured by the shared harness at launch are historical source bindings. Early runs captured the shell launcher only; no retroactive hash claim for their JS implementation.',
  root_lab_sha256: results.lab_sha256, test_manifest_sha256: results.test_manifest_sha256,
  root_supplemental_sha256: results.supplemental_sha256,
  resource_note: 'shared harness CPU/RSS samples launcher only; use separate controlled-resource benchmark for actual Envoy measurements',
};
fs.writeFileSync(`${prefix}-summary.json`, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ tests: summary.tests, passed: summary.passed, failures: summary.failures.map((t) => t.name), fatal: summary.fatal }));
