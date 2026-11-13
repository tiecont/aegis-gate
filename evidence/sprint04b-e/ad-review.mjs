import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const [a, d, originalD, output] = process.argv.slice(2);
assert.ok(a && d && originalD && output && !fs.existsSync(output));
const baseline = 'cbb5f71db84b9489bf4a6260696bbba29ab4a561';
const heads = ['3348ca06a70e37b574f415bc359bec31c1bfb5af', 'ab4e1f642e2bcbac1723d156390cc1cbebdad157'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const gitBytes = (cwd, ...args) => execFileSync('git', args, { cwd, maxBuffer: 32 << 20 });
const git = (cwd, ...args) => gitBytes(cwd, ...args).toString().trim();
assert.equal(git(process.cwd(), 'status', '--porcelain', '--untracked-files=no'), '');
for (const [i, root] of [a, d].entries()) {
  assert.equal(git(root, 'rev-parse', 'HEAD'), heads[i]);
  assert.equal(git(root, 'status', '--porcelain'), '');
}
fs.mkdirSync(output, { recursive: true });
const receipt = { reviewer: git(process.cwd(), 'rev-parse', 'HEAD'), reviewer_tree: git(process.cwd(), 'rev-parse', 'HEAD^{tree}'),
  argv: process.argv, node: process.version, node_sha256: hash(fs.readFileSync(process.execPath)), started_at: new Date().toISOString(), commands: [], sources: [], manifests: [] };
const read = (root, file) => fs.readFileSync(path.join(root, file));
const json = (root, file) => JSON.parse(read(root, file));
function run(label, cwd, program, args) {
  const started_at = new Date().toISOString();
  const result = spawnSync(program, args, { cwd, maxBuffer: 32 << 20 });
  const streams = {};
  for (const stream of ['stdout', 'stderr']) {
    const file = path.join(output, `${label}.${stream}`);
    fs.writeFileSync(file, result[stream] ?? '', { flag: 'wx' });
    streams[stream] = { file, sha256: hash(fs.readFileSync(file)) };
  }
  receipt.commands.push({ label, cwd, program, args, started_at, ended_at: new Date().toISOString(), exit_code: result.status, signal: result.signal, streams });
  assert.equal(result.status, 0, `${label} failed`);
  return result.stdout.toString();
}
try {
  for (const [i, root] of [a, d].entries()) {
    const files = git(root, 'diff', '--name-only', baseline, heads[i]).split('\n');
    assert.ok(files.every(f => i === 0 ? /^(docs\/ADR-012-|docs\/reports\/sprint04b-(a-|alternative-|security-)|evidence\/sprint04b-a\/)/.test(f) : /^(docs\/reports\/sprint04b-d-reliability.md|evidence\/sprint04b-d\/)/.test(f)));
    receipt.sources.push({ owner: i ? 'D' : 'A', head: heads[i], tree: git(root, 'rev-parse', 'HEAD^{tree}'), clean: true,
      files: files.map(file => ({ file, sha256: hash(read(root, file)) })) });
    run(`whitespace-${i}`, root, 'git', ['diff', '--check', baseline, heads[i], '--', '.', ':!evidence/sprint04b-d/attempt-*']);
    run(`immutable75-${i}`, root, process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']);
  }
  receipt.a_commands = [];
  for (const dir of ['document-hashes', 'document-whitespace', 'immutable-baseline', 'protected-source']) {
    const prefix = `evidence/sprint04b-a/${dir}`;
    const c = json(a, `${prefix}/command.json`);
    assert.equal(c.source_commit, '9378c8f85e855358ec26ff33fbae5db06a699d7d');
    assert.equal(git(a, 'rev-parse', `${c.source_commit}^{tree}`), c.source_tree);
    assert.equal(c.source_clean, true);
    assert.equal(c.exit_code, 0);
    for (const stream of ['stdout', 'stderr']) assert.equal(hash(read(a, `${prefix}/${stream}.log`)), c[`${stream}_sha256`]);
    receipt.a_commands.push({ prefix, source: c.source_commit, exit_code: c.exit_code });
  }
  for (const line of read(a, 'evidence/sprint04b-a/document-hashes/stdout.log').toString().trim().split('\n')) {
    const [, expected, file] = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.equal(hash(read(a, file)), expected);
    assert.equal(hash(gitBytes(a, 'show', `9378c8f85e855358ec26ff33fbae5db06a699d7d:${file}`)), expected);
  }
  receipt.d_attempts = [];
  for (const number of ['01', '02', '03']) {
    const prefix = `evidence/sprint04b-d/attempt-${number}`;
    const source = json(d, `${prefix}/source.json`);
    assert.equal(git(d, 'rev-parse', `${source.source_commit}^{tree}`), source.source_tree);
    for (const f of source.files) assert.equal(hash(gitBytes(d, 'show', `${source.source_commit}:${f.path}`)), f.sha256);
    const missing = [];
    const lines = read(d, `${prefix}/SHA256SUMS`).toString().trim().split('\n');
    for (const line of lines) {
      const [, expected, file] = /^([a-f0-9]{64})  (.+)$/.exec(line);
      if (!fs.existsSync(path.join(d, file))) missing.push(file);
      else assert.equal(hash(read(d, file)), expected);
    }
    assert.deepEqual(missing, number === '02' ? [`${prefix}/compose-config.stdout.txt`] : []);
    const commands = json(d, `${prefix}/commands.json`);
    for (const c of commands) {
      assert.equal(c.source_commit, source.source_commit);
      for (const stream of ['stdout', 'stderr']) {
        const file = path.join(prefix, c.logs[stream].file);
        if (!missing.includes(file)) assert.equal(hash(read(d, file)), c.logs[stream].sha256);
      }
    }
    const result = json(d, `${prefix}/result.json`);
    assert.equal(result.complete, number !== '01');
    if (number === '03') {
      assert.equal(source.source_commit, '54e7ea06b7519e9e2a5aee1ba4b03488897ae355');
      assert.equal(commands.length, 64);
      assert.equal(source.files.length, 224);
      assert.equal(result.lock_held_through_cleanup, true);
      for (const c of commands) assert.equal(c.exit_code, c.label.startsWith('lock-') || c.label === 'typescript7-strict-resolution' ? 1 : 0, c.label);
      assert.ok(!commands.some(c => c.label === 'compose-config'));
      for (const kind of ['container', 'network', 'volume']) assert.equal(read(d, `${prefix}/cleanup-${kind}.stdout.txt`).toString().trim(), '');
      const log = read(d, `${prefix}/go-full-race-integration.stdout.txt`).toString();
      assert.ok(!/--- (FAIL|SKIP):/.test(log));
      receipt.go_counts = { top_level: (log.match(/^--- PASS:/gm) ?? []).length, subtests: (log.match(/^\s+--- PASS:/gm) ?? []).length, packages: (log.match(/^ok\s/gm) ?? []).length };
      for (const name of ['TestRecoveryExternalProvisioningRejectsEncryptedFullStateRollback', 'TestRecoveryCapturedGenerationDrain', 'TestRecoveryDisconnectedEmergencyFailClosed', 'TestRecoverySignerOutageStagedRestartAndRetirement', 'TestIntegrationRecoveryDurableReferencesPruneAndRestart', 'TestIntegrationRecoveryArchiveRoundTripBeforeAuditCleanup']) assert.ok(log.includes(`--- PASS: ${name} `));
      assert.match(read(d, `${prefix}/typescript7-strict-resolution.stderr.txt`).toString(), /ERESOLVE/);
      assert.match(read(d, `${prefix}/metadata-typescript-eslint-typescript-estree.stdout.txt`).toString(), />=4\.8\.4 <6\.1\.0/);
    }
    receipt.d_attempts.push({ number, source: source.source_commit, source_hashes: source.files.length, commands: commands.length, manifest_entries: lines.length, missing, eligible: number === '03', result });
  }
  const omitted = 'evidence/sprint04b-d/attempt-02/compose-config.stdout.txt';
  assert.equal(git(d, 'log', '--all', '--format=%H', '--', omitted), '');
  receipt.omitted_output_never_tracked_in_reachable_history = true;
  assert.equal(git(d, 'diff', '--name-only', baseline, heads[1], '--', '.', ':!evidence/sprint04b-d', ':!docs/reports/sprint04b-d-reliability.md'), '');
  const privateValues = ['postgres-password', 'redis-password', 'nats-token'].map(f => fs.readFileSync(path.join(originalD, '.local', f)).toString().trim());
  let checked = 0;
  for (const f of receipt.sources[1].files) {
    const bytes = read(d, f.file);
    for (const value of privateValues) { assert.ok(value.length >= 12); assert.ok(!bytes.includes(Buffer.from(value)), 'private fixture value found'); }
    assert.ok(!/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/.test(bytes.toString()));
    checked++;
  }
  receipt.credential_check = { files: checked, matches: 0, private_values_logged: false };
  run('go-version', d, '/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go', ['version']);
  run('recovery-independent', d, '/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go', ['test', '-race', '-v', './internal/configconsumer', './internal/configpublish', '-run', '^TestRecovery', '-count=1']);
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  for (const [owner, root, target] of [['a', a, 'evidence/sprint04b-a'], ['d', d, 'evidence/sprint04b-d']]) {
    run(`secrets-${owner}`, root, 'flock', ['/tmp/aegisgate-sprint02-fixtures.lock', 'docker', 'run', '--rm', '--pull=never', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`, '-v', `${root}:/repo:ro`, '-v', `${path.resolve(output)}:/reports`, scanner, 'dir', `/repo/${target}`, '--config', '/repo/.github/gitleaks.toml', '--redact', '--report-format', 'json', '--report-path', `/reports/secrets-${owner}.json`, '--no-banner']);
  }
  for (const root of [a, d]) assert.equal(git(root, 'status', '--porcelain'), '');
  receipt.verdicts = { A: 'ACCEPT proposed design only; no contract activation or GO', D: 'ACCEPT local regression evidence; only attempt03 eligible' };
  receipt.exit_code = 0;
} catch (error) { receipt.error = error.stack; receipt.exit_code = 1; process.exitCode = 1; }
finally {
  receipt.ended_at = new Date().toISOString();
  receipt.scope = 'Exact A/D source/evidence review, independent isolated recovery tests and offline scans. No shared-service fixture rerun, full gates, runtime GO, owner edits or upstream publication.';
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), fs.readdirSync(output).sort().map(f => `${hash(fs.readFileSync(path.join(output, f)))}  ${path.join(output, f)}`).join('\n') + '\n');
  console.log(JSON.stringify({ output, exit_code: receipt.exit_code, verdicts: receipt.verdicts, error: receipt.error ?? null }));
}
