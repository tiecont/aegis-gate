import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

process.umask(0o077);
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05b-f\/audit-\d+$/);
assert.ok(!fs.existsSync(output)); fs.mkdirSync(output, { recursive: true });
const git = (...args) => execFileSync('git', args, { maxBuffer: 32 << 20 });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const record = { reviewer_commit: git('rev-parse', 'HEAD').toString().trim(), argv: process.argv,
  started_at: new Date().toISOString(), scope: 'Offline committed-source and evidence verification; no fixtures or listeners',
  semantic_security_pass: false, packages: [], manifests: 0, hashes: 0, source_hashes: 0, errors: [] };
const packages = [
  ['a', '37f5439', 'evidence/sprint05b-a'], ['b', 'f7ce126', 'evidence/sprint05b-b'],
  ['c', '0170010', 'evidence/sprint05b-c'], ['d', 'd85d04b', 'evidence/sprint05b-d'],
  ['e', '7755f7a', 'evidence/sprint05b-e'], ['root', 'fb4cc6a', 'evidence/sprint05b-root']];
const protectedFiles = ['spikes/pingora/lab.mjs', 'spikes/edge-comparison/manifest.json',
  'spikes/edge-comparison/contract.mjs', 'spikes/edge-comparison/supplemental.mjs',
  'spikes/edge-comparison/evaluate.mjs', 'spikes/edge-comparison/run.mjs',
  'spikes/edge-comparison/tls-observer.mjs', 'spikes/edge-comparison/extract-baseline.mjs',
  'spikes/envoy/wire-probes.mjs', 'spikes/envoy/wire-observer.mjs', 'spikes/envoy/wire-fixtures.mjs'];
const check = (context, operation) => { try { operation(); } catch (error) { record.errors.push({ context, error: error.message }); } };
for (const [label, revision, prefix] of packages) {
  const commit = git('rev-parse', `${revision}^{commit}`).toString().trim();
  const files = git('ls-tree', '-r', '--name-only', commit).toString().trim().split('\n'), inventory = new Set(files);
  const get = (file) => git('show', `${commit}:${file}`);
  const entry = { label, commit, tree: git('rev-parse', `${commit}^{tree}`).toString().trim(),
    protected: [], manifests: [], files: files.filter((file) => file.startsWith(`${prefix}/`)).length };
  record.packages.push(entry);
  for (const file of protectedFiles) check(`${label}:protected:${file}`, () => {
    const bytes = get(file); assert.deepEqual(bytes, git('show', `8758b1c:${file}`));
    entry.protected.push({ file, sha256: sha(bytes) });
  });
  for (const file of files.filter((file) => file.startsWith(`${prefix}/`))) {
    if (/\/(?:SHA256SUMS|SHA256\.json)$/.test(file)) check(`${label}:manifest:${file}`, () => {
      const bytes = get(file), dir = path.posix.dirname(file);
      const entries = file.endsWith('.json') ? JSON.parse(bytes) : bytes.toString().trim().split('\n').filter(Boolean).map((line) => {
        const match = /^([a-f0-9]{64})  (.+)$/.exec(line); assert.ok(match, file);
        return { sha256: match[1], file: match[2] };
      });
      for (const expected of entries) {
        const target = inventory.has(expected.file) ? expected.file : path.posix.join(dir, expected.file);
        assert.ok(inventory.has(target), target); assert.equal(sha(get(target)), expected.sha256, target); record.hashes++;
      }
      record.manifests++; entry.manifests.push({ file, sha256: sha(bytes), entries: entries.length });
    });
    if (/(?:receipt|commands)\.json$/.test(file)) check(`${label}:receipt:${file}`, () => {
      const r = JSON.parse(get(file)), source = r.source_commit ?? r.sourceCommit, tree = r.source_tree ?? r.sourceTree;
      if (source && tree) assert.equal(git('rev-parse', `${source}^{tree}`).toString().trim(), tree);
      if (source) for (const sourceFile of r.sources ?? []) {
        if (!sourceFile.file || !sourceFile.sha256) continue;
        assert.equal(sha(git('show', `${source}:${sourceFile.file}`)), sourceFile.sha256, sourceFile.file); record.source_hashes++;
      }
    });
  }
}
for (const [final, measured, paths] of [
  ['37f5439', '95ded76', ['spikes/envoy']], ['0170010', 'fe92fc1', ['spikes/envoy']],
  ['d85d04b', 'eba8445', ['spikes/envoy/sprint05b-d-streaming.mjs']]])
  check(`code-equivalence:${final}:${measured}`, () => assert.equal(git('diff', '--name-only', final, measured, '--', ...paths).toString().trim(), ''));
record.complete = record.errors.length === 0;
record.ended_at = new Date().toISOString();
fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(record, null, 2) + '\n');
fs.writeFileSync(`${output}/SHA256SUMS`, `${sha(fs.readFileSync(`${output}/receipt.json`))}  ${output}/receipt.json\n`);
console.log(JSON.stringify({ complete: record.complete, manifests: record.manifests, hashes: record.hashes,
  source_hashes: record.source_hashes, errors: record.errors }));
process.exitCode = record.complete ? 0 : 1;
