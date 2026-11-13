import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const [root, output] = process.argv.slice(2);
const baseline = 'cbb5f71db84b9489bf4a6260696bbba29ab4a561';
const head = '0cf24f494001711bfb87695536db20732dcb7b1a';
const sha = value => createHash('sha256').update(value).digest('hex');
const gb = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32 << 20 });
const git = (...args) => gb(...args).toString().trim();
const read = file => fs.readFileSync(path.join(root, file));
const tree = revision => new Map(gb('ls-tree', '-rz', revision).toString().split('\0').filter(Boolean).map(line => {
  const [, mode, type, blob, file] = /^(\d+) (\w+) ([a-f0-9]+)\t(.+)$/.exec(line);
  return [file, { mode, type, blob }];
}));
assert.ok(root && output && !fs.existsSync(output));
assert.equal(git('rev-parse', 'HEAD'), head);
assert.equal(git('status', '--porcelain'), '');
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no']).toString().trim(), '');
fs.mkdirSync(output, { recursive: true });
const receipt = { source_commit: head, source_tree: git('rev-parse', 'HEAD^{tree}'), baseline,
  reviewer: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), argv: process.argv,
  node: process.version, node_sha256: sha(fs.readFileSync(process.execPath)), started_at: new Date().toISOString(),
  owners: [], commands: [] };
function run(label, command, args) {
  const started_at = new Date().toISOString();
  const result = spawnSync(command, args, { cwd: root, maxBuffer: 16 << 20 });
  const streams = ['stdout', 'stderr'].map(stream => {
    const file = path.join(output, `${label}.${stream}`);
    fs.writeFileSync(file, result[stream] ?? '', { flag: 'wx' });
    return { file, sha256: sha(fs.readFileSync(file)) };
  });
  receipt.commands.push({ label, command, args, cwd: root, started_at, ended_at: new Date().toISOString(), exit_code: result.status, signal: result.signal, streams });
  assert.equal(result.status, 0, label);
}
try {
  const original = tree(baseline), integrated = tree(head);
  const shared = ['IMPLEMENTATION_STATUS.md', 'docs/ADR-011-pingora-evaluation.md', 'docs/RISK_REGISTER.md'];
  receipt.protected = [];
  for (const [file, object] of original) {
    if (!shared.includes(file)) { assert.deepEqual(integrated.get(file), object, file); receipt.protected.push({ file, ...object }); }
  }
  const ownership = [
    ['A', '3348ca06a70e37b574f415bc359bec31c1bfb5af', /^(docs\/ADR-012-|docs\/reports\/sprint04b-(a-|alternative-|security-)|evidence\/sprint04b-a\/)/],
    ['B', '5de81795963d07486d0621822131d4e1554ccadc', /^(docs\/reports\/sprint04b-b-upstream\.md$|evidence\/sprint04b-b\/|spikes\/envoy\/sprint04b-(receipts|repro|upstream|upstream-verify)\.mjs$)/],
    ['C', '71a3dc6381223d54fa8b23ecf84ff205e0b52ea6', /^(docs\/reports\/sprint04b-c-protocol\.md$|evidence\/sprint04b-c\/|spikes\/envoy\/sprint04b-(observer|observer\.test|protocol|run|verify)\.mjs$)/],
    ['D', 'ab4e1f642e2bcbac1723d156390cc1cbebdad157', /^(docs\/reports\/sprint04b-d-reliability\.md$|evidence\/sprint04b-d\/)/],
    ['E', '8ca7e4f7fa9541b1f8cee4b82bbc94553b1207c8', /^(docs\/reports\/sprint04b-e-(phase0|ad|c)-review\.md$|evidence\/sprint04b-e\/)/],
  ];
  const owned = new Set();
  for (const [owner, revision, allowed] of ownership) {
    const expected = tree(revision);
    const changed = git('diff', '--name-only', baseline, revision).split('\n').filter(Boolean);
    assert.ok(changed.length && changed.every(file => allowed.test(file)), owner);
    const files = changed.map(file => {
      assert.ok(!owned.has(file), `ownership overlap: ${file}`); owned.add(file);
      assert.deepEqual(integrated.get(file), expected.get(file), `${owner}: ${file}`);
      assert.equal(sha(read(file)), sha(gb('show', `${revision}:${file}`)), file);
      return { file, ...expected.get(file), sha256: sha(read(file)) };
    });
    receipt.owners.push({ owner, revision, tree: git('rev-parse', `${revision}^{tree}`), files });
  }
  const changed = git('diff', '--name-only', baseline, head).split('\n');
  receipt.root_files = changed.filter(file => !owned.has(file));
  const rootOnly = /^(IMPLEMENTATION_STATUS\.md$|docs\/(ADR-011-pingora-evaluation\.md|RISK_REGISTER\.md|sprints\/04b-execution\.md|reports\/sprint04(a-closeout-addendum|b-completion)\.md)$|scripts\/sprint04b-gates\.mjs$|evidence\/sprint04b-root\/(bootstrap|pr12-hosted|pr12-main-ci|pr12-merge|toolchain-hashes|toolchain-paths)\/(command\.json|stdout\.log|stderr\.log)$)/;
  assert.ok(receipt.root_files.every(file => rootOnly.test(file)));
  receipt.root_files = receipt.root_files.map(file => ({ file, ...integrated.get(file), sha256: sha(read(file)) }));
  for (const [file, object] of integrated) {
    assert.equal(object.type, 'blob', file); assert.ok(['100644', '100755'].includes(object.mode), file);
    assert.equal(sha(read(file)), sha(gb('show', `${head}:${file}`)), file);
  }
  assert.equal(integrated.get('scripts/sprint04b-gates.mjs').blob, '890a930461899958b45f7682c9d68c2f74dc1da1');
  receipt.integrated_files = integrated.size; receipt.changed_files = changed.length;
  run('immutable75', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']);
  run('root-whitespace', 'git', ['diff', '--check', baseline, head, '--', ...receipt.root_files.map(f => f.file)]);
  run('helper-syntax', process.execPath, ['--check', 'scripts/sprint04b-gates.mjs']);
  assert.equal(git('status', '--porcelain'), '');
  receipt.exit_code = 0; receipt.verdict = 'ACCEPT exact integrated source equality and proposed-only documentation; full local/hosted gate acceptance pending';
} catch (error) { receipt.error = error.stack; receipt.exit_code = 1; process.exitCode = 1; }
finally {
  receipt.ended_at = new Date().toISOString();
  receipt.scope = 'Read-only exact integrated snapshot, all protected baseline objects, accepted A-D/E file modes/blobs/bytes, root-only additions, unchanged75 and helper syntax. No fixture use, runtime rerun, hosted assertion or GO.';
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), fs.readdirSync(output).sort().map(file => `${sha(fs.readFileSync(path.join(output, file)))}  ${path.join(output, file)}`).join('\n') + '\n');
  console.log(JSON.stringify({ output, exit_code: receipt.exit_code, verdict: receipt.verdict, error: receipt.error ?? null }));
}
