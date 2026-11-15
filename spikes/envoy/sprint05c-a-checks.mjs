import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { rawCommand, hash } from './sprint05c-a-build.mjs';

const out = process.argv[2]; assert.match(out ?? '', /^evidence\/sprint05c-a\/checks-\d+$/); assert.ok(!fs.existsSync(out));
const record = { started: new Date().toISOString(), commands: [], fullSecurityScan: false, runtimeGO: false };
async function run(argv) {
  const r = await rawCommand(argv); record.commands.push(r); assert.equal(r.exit, 0, r.stderr); assert.equal(r.error, undefined); return r.stdout.trim();
}
assert.equal(await run(['git', 'status', '--porcelain', '--untracked-files=all']), '', 'commit checks/report before recording proof');
record.sourceCommit = await run(['git', 'rev-parse', 'HEAD']); record.sourceTree = await run(['git', 'rev-parse', 'HEAD^{tree}']);
fs.mkdirSync(out);
try {
  await run([process.execPath, 'spikes/envoy/sprint05c-a-verify.mjs', 'evidence/sprint05c-a/run-12']);
  record.baseline = JSON.parse(await run([process.execPath, 'scripts/sprint05b-baseline.mjs']));
  await run(['git', 'diff', '--check', '078d83c0ab1cb1364d0245d4c4f62f0fe0439e97']);
  const owned = (await run(['git', 'diff', '--name-only', '078d83c0ab1cb1364d0245d4c4f62f0fe0439e97'])).split('\n');
  assert.ok(owned.every((file) => /^spikes\/envoy\/sprint05c-a-/.test(file) || /^evidence\/sprint05c-a\//.test(file) || file === 'docs/reports/sprint05c-a-ingress-runtime.md'));
  record.ownedChanges = owned;
  const scripts = (await run(['git', 'ls-files', 'spikes/envoy/sprint05c-a-*.mjs'])).split('\n');
  for (const script of scripts) await run([process.execPath, '--check', script]);
  record.verifiedArtifacts = 0; record.verifiedSourceBindings = 0;
  for (const attempt of fs.readdirSync('evidence/sprint05c-a').filter((f) => /^run-\d+$/.test(f))) {
    const directory = `evidence/sprint05c-a/${attempt}`;
    for (const line of fs.readFileSync(`${directory}/SHA256SUMS`, 'utf8').trim().split('\n')) {
      const [digest, file] = line.split('  '); assert.equal(hash(fs.readFileSync(file)), digest); record.verifiedArtifacts++;
    }
    if (!fs.existsSync(`${directory}/receipt.json`)) { assert.equal(attempt, 'run-10'); continue; }
    const receipt = JSON.parse(fs.readFileSync(`${directory}/receipt.json`));
    for (const pin of receipt.sources) {
      const result = await rawCommand(['git', 'show', `${receipt.sourceCommit}:${pin.file}`]);
      assert.equal(result.exit, 0); assert.equal(hash(Buffer.from(result.stdout)), pin.sha256); record.verifiedSourceBindings++;
    }
  }
  record.runtimeReceiptSha256 = hash(fs.readFileSync('evidence/sprint05c-a/run-12/receipt.json'));
  record.reportSha256 = hash(fs.readFileSync('docs/reports/sprint05c-a-ingress-runtime.md'));
  record.complete = true;
} catch (e) { record.error = { message: e.message, stack: e.stack }; process.exitCode = 1; }
finally {
  record.ended = new Date().toISOString();
  fs.writeFileSync(`${out}/receipt.json`, JSON.stringify(record, null, 2) + '\n');
  fs.writeFileSync(`${out}/SHA256SUMS`, `${hash(fs.readFileSync(`${out}/receipt.json`))}  ${out}/receipt.json\n`);
  console.log(JSON.stringify({ complete: record.complete, error: record.error, commands: record.commands.length,
    artifacts: record.verifiedArtifacts, sourceBindings: record.verifiedSourceBindings, runtimeReceiptSha256: record.runtimeReceiptSha256 }));
}
