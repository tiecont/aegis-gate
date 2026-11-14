import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { assertLock } from '../../spikes/envoy/wire-fixtures.mjs';

assertLock();
const root = process.cwd();
const out = path.resolve(process.argv[2]);
assert.ok(!fs.existsSync(out));
fs.mkdirSync(out, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex');
const e = '/tmp/aegisgate-04c-e-safe';
const helper = '/tmp/aegisgate-04c-helper-test';
const node = '/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node';
const git = (cwd, ...args) => {
  const p = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(p.status, 0); return p.stdout.trim();
};
const receipt = { source_commit: git(root, 'rev-parse', 'HEAD'), source_tree: git(root, 'rev-parse', 'HEAD^{tree}'), argv: process.argv, node: process.version, node_sha256: sha(fs.readFileSync(process.execPath)), started_at: new Date().toISOString(), commands: [] };
let stage;
function run(label, argv, cwd = root) {
  assertLock();
  const started_at = new Date().toISOString();
  const p = spawnSync(argv[0], argv.slice(1), { cwd, timeout: 240000, maxBuffer: 16 << 20 });
  const streams = ['stdout', 'stderr'].map(name => {
    const bytes = p[name] ?? Buffer.alloc(0), file = `${label}.${name}`;
    fs.writeFileSync(path.join(out, file), bytes);
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  receipt.commands.push({ label, argv, cwd, started_at, ended_at: new Date().toISOString(), exit_code: p.status, signal: p.signal, streams });
  assert.equal(p.status, 0, label); assertLock(); return p.stdout;
}
try {
  assert.equal(git(root, 'status', '--porcelain', '--untracked-files=no'), '');
  assert.equal(git(e, 'status', '--porcelain'), '');
  const revision = git(e, 'rev-parse', 'HEAD');
  assert.equal(revision, '212677805416a3e38d44724bfaf1101c8e11a0d5');
  receipt.e_revision = revision; receipt.e_tree = git(e, 'rev-parse', 'HEAD^{tree}');
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', '551591395880ce87863b4e861c05d266c719b91f', revision], { cwd: e }).status, 1);
  const changes = git(e, 'diff', '--name-only', 'a325b9e', revision).split('\n');
  assert.ok(changes.every(file => /^(evidence\/sprint04c-e\/|docs\/reports\/sprint04c-e-regressions\.md$)/.test(file)));
  const manifests = [];
  for (const file of changes.filter(file => file.endsWith('/SHA256SUMS'))) {
    const missing = []; let entries = 0;
    for (const line of fs.readFileSync(path.join(e, file), 'utf8').trim().split('\n')) {
      const [expected, target] = line.split('  ');
      const absolute = path.resolve(target.includes('/') ? e : path.join(e, path.dirname(file)), target);
      if (!fs.existsSync(absolute)) { missing.push(target); continue; }
      assert.equal(sha(fs.readFileSync(absolute)), expected); entries++;
    }
    if (file.includes('/attempt-01/')) assert.deepEqual(missing, ['evidence/sprint04c-e/attempt-01/stdout.log']);
    else assert.deepEqual(missing, []);
    manifests.push({ file, entries, missing });
  }
  receipt.e_manifests = manifests;
  run('E-collector-syntax', [node, '--check', 'evidence/sprint04c-e/record.mjs'], e);
  run('immutable75-E', [node, 'spikes/edge-comparison/extract-baseline.mjs', '--check'], e);
  run('E-post-cleanup-audit', ['python3', 'evidence/sprint04c-e/verify.py', path.join(out, 'E-audit.json'), '--audit-only'], e);
  run('go-version', ['/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go', 'version']);
  run('independent-recovery-negative', ['/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go', 'test', '-race', '-v', './internal/configconsumer', './internal/configpublish', '-run', 'Recovery|Negative', '-count=1']);
  run('helper-test-syntax', [node, '--check', 'evidence/sprint04c-helper/cleanup-test.mjs'], helper);
  run('helper-owner-test', [node, '--experimental-vm-modules', 'evidence/sprint04c-helper/cleanup-test.mjs'], helper);
  // Extend the existing synthetic harness in memory; keep the pinned helper unchanged.
  let harness = fs.readFileSync(path.join(helper, 'evidence/sprint04c-helper/cleanup-test.mjs'), 'utf8');
  harness = harness.replace("'synthetic-key-marker'])", "'synthetic-key-marker', 'synthetic-inventory-error'])");
  harness = harness.replace("commands.push(['inventory', ...args]);", "if (mode === 'synthetic-inventory-error' && args[0] === 'ps') throw new Error('synthetic inventory unavailable');\n      commands.push(['inventory', ...args]);");
  harness = harness.replace('await module.evaluate({ timeout: 5000 });', `if (mode === 'synthetic-inventory-error') {
    let error;
    try { await module.evaluate({ timeout: 5000 }); } catch (caught) { error = caught; }
    assert.match(error?.message ?? '', /synthetic inventory unavailable/);
    assert.ok(exists('.local/postgres-password') && exists('.local/pki/valid.jwt'));
    results.push({ mode, defect_reproduced: true, generated_private_files_remain: true });
    continue;
  }
  await module.evaluate({ timeout: 5000 });`);
  fs.writeFileSync(path.join(out, 'independent-helper-harness.mjs'), harness);
  run('helper-independent-syntax', [node, '--check', path.join(out, 'independent-helper-harness.mjs')], helper);
  run('helper-inventory-error', [node, '--experimental-vm-modules', path.join(out, 'independent-helper-harness.mjs')], helper);
  receipt.helper_revision = 'cb9c30904e3430793d9847d9b9bf3eec3a8d052f';
  receipt.helper_source_sha256 = sha(spawnSync('git', ['show', `${receipt.helper_revision}:scripts/sprint04c-gates.mjs`], { cwd: helper }).stdout);
  stage = path.join(root, '.local/f-final-scan'); assert.ok(!fs.existsSync(stage)); fs.mkdirSync(stage, { recursive: true });
  for (const file of changes) { const dest = path.join(stage, file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(e, file), dest); }
  const scanImage = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  run('E-independent-secrets', ['docker', 'run', '--rm', '--network', 'none', '-v', `${stage}:/input:ro`, '-v', `${root}/.github/gitleaks.toml:/config:ro`, '-v', `${out}:/reports`, scanImage, 'dir', '/input', '--config', '/config', '--redact', '--report-format', 'json', '--report-path', '/reports/secrets.json', '--no-banner']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'secrets.json'))), []);
  receipt.verdict = 'ACCEPT corrected E evidence; REJECT gate helper because inventory failure skips private-file cleanup';
  receipt.exit_code = 0;
} catch (error) { receipt.error = error.stack; receipt.exit_code = 1; }
finally {
  if (stage && fs.existsSync(stage)) fs.rmSync(stage, { recursive: true });
  assertLock(); receipt.lock_held_through_cleanup = true; receipt.ended_at = new Date().toISOString();
  fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'SHA256SUMS'), fs.readdirSync(out).filter(file => file !== 'SHA256SUMS').sort().map(file => `${sha(fs.readFileSync(path.join(out, file)))}  ${path.relative(root, path.join(out, file))}\n`).join(''));
  console.log(JSON.stringify({ exit_code: receipt.exit_code, verdict: receipt.verdict, error: receipt.error }));
}
process.exitCode = receipt.exit_code;
