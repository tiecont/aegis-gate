import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const [source, output] = process.argv.slice(2);
assert.match(source ?? '', /^[a-f0-9]{40}$/);
assert.match(output ?? '', /^evidence\/sprint04c-integration-audit\/proof-\d+$/);
assert.ok(!fs.existsSync(output));
const base = 'a325b9ecc086e09467f61b49f17da241bf8e43ea';
const git = (...args) => execFileSync('git', args, { maxBuffer: 32 << 20 });
const value = (...args) => git(...args).toString().trim();
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(value('status', '--porcelain'), '');
const ownSource = value('rev-parse', 'HEAD');
assert.equal(sha(fs.readFileSync(import.meta.filename)), sha(git('show', `${ownSource}:evidence/sprint04c-integration-audit/verify.mjs`)));
fs.mkdirSync(output, { recursive: true });
const receipt = {
  verifier_commit: ownSource,
  verifier_tree: value('rev-parse', `${ownSource}^{tree}`),
  source_commit: source,
  source_tree: value('rev-parse', `${source}^{tree}`),
  baseline: base,
  argv: process.argv,
  cwd: process.cwd(),
  started_at: new Date().toISOString(),
  node: process.version,
  node_binary_sha256: sha(fs.readFileSync(process.execPath)),
  git: value('--version'),
  commands: [],
  classification: 'preliminary-source-audit-only',
  final_integration_accepted: false,
};
function run(label, program, args) {
  const started = new Date().toISOString();
  const result = spawnSync(program, args, { timeout: 60000, maxBuffer: 8 << 20 });
  const streams = ['stdout', 'stderr'].map((stream) => {
    const file = `${output}/${label}.${stream}`;
    fs.writeFileSync(file, result[stream] ?? '');
    return { file, sha256: sha(fs.readFileSync(file)) };
  });
  receipt.commands.push({ label, program, args, started_at: started, ended_at: new Date().toISOString(), exit_code: result.status, signal: result.signal, streams });
  assert.equal(result.status, 0, label);
}
try {
  run('remote-refresh', 'git', ['fetch', 'origin', 'main']);
  receipt.refreshed_remote_main = value('rev-parse', 'origin/main');
  assert.equal(receipt.refreshed_remote_main, base, 'baseline advanced; reassess');
  run('baseline-ancestry', 'git', ['merge-base', '--is-ancestor', base, source]);
  const rejected = spawnSync('git', ['merge-base', '--is-ancestor', '551591395880ce87863b4e861c05d266c719b91f', source]);
  assert.equal(rejected.status, 1);
  receipt.rejected_E_ancestor_absent = true;
  const baselineRows = value('ls-tree', '-r', base).split('\n');
  const allowedShared = new Set(['IMPLEMENTATION_STATUS.md', 'docs/RISK_REGISTER.md', 'docs/ADR-012-strict-ingress-decision-proposed.md']);
  let protectedCount = 0;
  for (const row of baselineRows) {
    const [metadata, file] = row.split('\t');
    if (allowedShared.has(file)) continue;
    assert.equal(value('ls-tree', source, '--', file), `${metadata}\t${file}`, file);
    protectedCount++;
  }
  receipt.protected_baseline_objects = protectedCount;
  receipt.allowed_shared_documents = [...allowedShared];
  const owners = {
    A: '02bad67b51a8171493ad3ff1eee245e3f07d6e2f',
    B: '12abd255b754b553480544edbf9452b7f65d9a4d',
    C: '49f2d554d30fd9002f6d15e7ee39999a6e866d5c',
    D: 'd9a2004167a178a3a1d4549cc97378fe4b02c360',
    E: '212677805416a3e38d44724bfaf1101c8e11a0d5',
  };
  receipt.accepted_component_objects = [];
  for (const [owner, commit] of Object.entries(owners)) {
    const files = value('diff', '--name-only', base, commit).split('\n');
    for (const file of files) assert.equal(value('ls-tree', source, '--', file), value('ls-tree', commit, '--', file), `${owner}: ${file}`);
    receipt.accepted_component_objects.push({ owner, commit, files: files.length });
  }
  const tracked = value('ls-tree', '-r', '--name-only', source).split('\n');
  const manifests = tracked.filter((file) => /^evidence\/sprint04c-/.test(file) && file.endsWith('/SHA256SUMS'));
  const redacted = 'evidence/sprint04c-f/receipts-01/secrets.json';
  receipt.manifests = [];
  for (const file of manifests) {
    const rows = git('show', `${source}:${file}`).toString().trim().split('\n').filter(Boolean);
    let verified = 0;
    let excluded = 0;
    for (const row of rows) {
      const match = /^([a-f0-9]{64})  (.+)$/.exec(row);
      assert.ok(match, file);
      const [, expected, entry] = match;
      if (entry === redacted) {
        const metadata = JSON.parse(git('show', `${source}:evidence/sprint04c-f/receipts-01/redaction.json`));
        assert.equal(metadata.original_report_sha256, expected);
        assert.ok(!tracked.includes(entry));
        excluded++;
        continue;
      }
      if (entry === 'evidence/sprint04c-e/attempt-01/stdout.log') {
        const metadata = git('show', `${source}:evidence/sprint04c-e/attempt-01/REDACTION.md`).toString();
        assert.ok(metadata.includes(expected));
        assert.equal(expected, '8992edbdc9711c445bcf8cd811d3288feb08d299479f7544bdfe37eb2df9b3a1');
        assert.ok(!tracked.includes(entry));
        excluded++;
        continue;
      }
      assert.ok(tracked.includes(entry), `${file}: absent ${entry}`);
      assert.equal(sha(git('show', `${source}:${entry}`)), expected, entry);
      verified++;
    }
    receipt.manifests.push({ file, verified, excluded_redacted: excluded, eligible: excluded === 0 });
  }
  run('immutable75', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']);
  run('authored-whitespace', 'git', ['diff', '--check', base, source, '--', 'scripts', 'spikes/envoy/sprint04c-*', 'docs', 'IMPLEMENTATION_STATUS.md']);
  const syntax = tracked.filter((file) => file.endsWith('.mjs') && (file.startsWith('spikes/envoy/sprint04c-') || file === 'scripts/sprint04c-gates.mjs'));
  for (const file of syntax) {
    assert.equal(sha(fs.readFileSync(file)), sha(git('show', `${source}:${file}`)), `syntax source differs: ${file}`);
    run(`syntax-${path.basename(file)}`, process.execPath, ['--check', file]);
  }
  for (const file of ['IMPLEMENTATION_STATUS.md', 'docs/reports/sprint04c-completion.md', 'docs/ADR-012-sprint04c-decision-addendum-proposed.md']) {
    const content = git('show', `${source}:${file}`).toString();
    for (const marker of ['NO-GO', 'LOCKED', 'BLOCKED', 'PENDING']) assert.ok(content.includes(marker), `${file}: ${marker}`);
  }
  receipt.result = 'PASS within preliminary source-audit scope';
  receipt.remaining = ['latest helper independent acceptance', 'final complete locked local gates and cleanup', 'exact PR-head and merge hosted jobs', 'final source/receipt audit'];
} catch (error) {
  receipt.result = 'FAIL';
  receipt.error = error.stack;
  process.exitCode = 1;
} finally {
  receipt.ended_at = new Date().toISOString();
  fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(`${output}/SHA256SUMS`, fs.readdirSync(output).sort().map((file) => `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}`).join('\n') + '\n');
  console.log(JSON.stringify({ result: receipt.result, protected: receipt.protected_baseline_objects, components: receipt.accepted_component_objects, manifests: receipt.manifests?.length, final_integration_accepted: false }));
}
