import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const helper = '578d78f3465d5a4cbb9587a0e03be975b33cd1c9';
const root = process.cwd();
assert.equal(root, '/tmp/aegisgate-04c-cleanup-review');
const out = process.argv[2];
assert.equal(out, 'evidence/sprint04c-f/cleanup-01');
assert.ok(!fs.existsSync(out), 'fresh evidence required');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  assert.equal(result.status, 0); return result.stdout.trim();
};
assert.equal(git('status', '--porcelain'), '', 'commit verifier sources before execution');
const helperSource = Buffer.from(git('show', `${helper}:scripts/sprint04c-gates.mjs`) + '\n');
assert.deepEqual(fs.readFileSync('scripts/sprint04c-gates.mjs'), helperSource);
fs.mkdirSync(out, { recursive: true });
const receipt = {
  scope: 'Independent F helper repair review; synthetic VM only; no Docker/scanner/shared fixture execution',
  argv: process.argv, cwd: root, started_at: new Date().toISOString(),
  source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  tracked_clean_at_start: true, helper_commit: helper, helper_tree: git('rev-parse', `${helper}^{tree}`),
  helper_blob: git('rev-parse', `${helper}:scripts/sprint04c-gates.mjs`),
  helper_sha256: sha(helperSource),
  sources: ['evidence/sprint04c-helper/cleanup-test.mjs', 'evidence/sprint04c-f/review-cleanup.mjs', 'spikes/envoy/wire-fixtures.mjs'].map(file => ({ file, sha256: sha(fs.readFileSync(file)) })),
  node: process.version, node_versions: process.versions, node_binary: process.execPath,
  node_sha256: sha(fs.readFileSync(process.execPath)),
  lock_scope: 'VM assertLock mock only; no shared fixtures/scanners accessed; real lifecycle flock not exercised',
  commands: [],
};
function run(label, argv) {
  const started_at = new Date().toISOString();
  const result = spawnSync(argv[0], argv.slice(1), { timeout: 30000, maxBuffer: 16 << 20 });
  const streams = ['stdout', 'stderr'].map(name => {
    const bytes = result[name] ?? Buffer.alloc(0), file = `${out}/${label}.${name}`;
    fs.writeFileSync(file, bytes);
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  receipt.commands.push({ label, argv, cwd: root, started_at, ended_at: new Date().toISOString(), exit_code: result.status, signal: result.signal, error: result.error?.message, streams });
  assert.equal(result.status, 0, label); return result.stdout;
}
try {
  run('node-version', [process.execPath, '--version']);
  run('git-version', ['git', '--version']);
  run('helper-syntax', [process.execPath, '--check', 'scripts/sprint04c-gates.mjs']);
  run('harness-syntax', [process.execPath, '--check', 'evidence/sprint04c-helper/cleanup-test.mjs']);
  run('collector-syntax', [process.execPath, '--check', 'evidence/sprint04c-f/review-cleanup.mjs']);
  const proof = JSON.parse(run('synthetic-faults', [process.execPath, '--experimental-vm-modules', 'evidence/sprint04c-helper/cleanup-test.mjs']));
  assert.equal(proof.pinned_source, helper); assert.equal(proof.source_sha256, receipt.helper_sha256);
  assert.equal(proof.cases, 33);
  assert.equal(proof.results.filter(test => test.expected_abort).length, 2);
  assert.equal(proof.results.filter(test => test.exit_code === 0).length, 1);
  assert.equal(proof.results.filter(test => test.exit_code === 1).length, 30);
  receipt.case_summary = proof.results.map(({ mode, exit_code, expected_abort, lock_assertions, descriptor_residue_on_synchronous_spawn_throw, receipt: helperReceipt }) => ({ mode, exit_code, expected_abort, lock_assertions, descriptor_residue_on_synchronous_spawn_throw, cleanup_error_labels: helperReceipt?.cleanup_errors?.map(error => error.label) ?? [] }));
  run('changes-from-helper', ['git', 'diff', '--name-status', helper, 'HEAD']);
  const changed = git('diff', '--name-only', helper, 'HEAD').split('\n');
  assert.deepEqual(changed.sort(), ['evidence/sprint04c-f/review-cleanup.mjs', 'evidence/sprint04c-helper/cleanup-test.mjs']);
  run('whitespace', ['git', 'diff', '--check', helper, 'HEAD']);
  receipt.verdict = 'ACCEPT exact helper repair for scoped cleanup continuation/failure receipts under held lock; full gates and Module01 remain unaccepted';
  receipt.exit_code = 0;
} catch (error) {
  receipt.exit_code = 1; receipt.error = error.stack;
} finally {
  receipt.ended_at = new Date().toISOString();
  fs.writeFileSync(`${out}/verification.json`, JSON.stringify(receipt, null, 2) + '\n');
  const files = fs.readdirSync(out).sort().map(file => path.join(out, file));
  fs.writeFileSync(`${out}/SHA256SUMS`, files.map(file => `${sha(fs.readFileSync(file))}  ${file}\n`).join(''));
  console.log(JSON.stringify({ exit_code: receipt.exit_code, verdict: receipt.verdict, error: receipt.error }));
}
process.exitCode = receipt.exit_code;
