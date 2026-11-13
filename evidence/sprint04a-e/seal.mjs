import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const root = '/tmp/aegisgate-04a-e'; process.chdir(root); process.umask(0o077);
const [name, finalF] = process.argv.slice(2);
assert.match(name ?? '', /^seal-[0-9]{2}$/);
assert.match(finalF ?? '', /^[a-f0-9]{40}$/);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 << 20 }).trim();
assert.equal(git('status', '--porcelain'), '', 'commit review sources/report before final verification');
const base = 'evidence/sprint04a-e'; const output = path.join(base, name);
assert.ok(!fs.existsSync(output)); fs.mkdirSync(output);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const receipt = { reviewer_commit: git('rev-parse', 'HEAD'), reviewer_clean: true,
  argv: process.argv, started_at: new Date().toISOString(), node: process.version,
  node_sha256: hash(fs.readFileSync(process.execPath)), reviewed_final_f: finalF,
  commands: [], failures: [], attempts: [] };
const save = () => fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(receipt, null, 2) + '\n');
function run(label, program, args, cwd = root) {
  const started_at = new Date().toISOString();
  const child = spawnSync(program, args, { cwd, maxBuffer: 32 << 20 });
  const streams = {};
  for (const stream of ['stdout', 'stderr']) {
    const bytes = child[stream] ?? Buffer.alloc(0);
    fs.writeFileSync(path.join(output, `${label}.${stream}`), bytes);
    streams[`${stream}_sha256`] = hash(bytes);
  }
  receipt.commands.push({ label, program, args, cwd, started_at, ended_at: new Date().toISOString(),
    exit_code: child.status, signal: child.signal, ...streams });
  if (child.status !== 0) receipt.failures.push(label);
  save(); console.log(`${label}: exit=${child.status}`);
  assert.equal(child.status, 0, `${label} failed`);
}
function verifyManifest(directory) {
  const entries = fs.readFileSync(path.join(directory, 'SHA256SUMS'), 'utf8').trim().split('\n');
  for (const line of entries) {
    const [, expected, file] = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.equal(hash(fs.readFileSync(path.join(directory, file))), expected, `${directory}/${file}`);
  }
  return entries.length;
}
try {
  for (const attempt of ['b-01', 'd-01', 'ac-01', 'f-01']) {
    const directory = path.join(base, attempt);
    const source = JSON.parse(fs.readFileSync(path.join(directory, 'commands.json')));
    assert.equal(source.reviewer_clean, true); assert.equal(source.exit_code, 0);
    assert.deepEqual(source.failures, []); assert.equal(source.error, undefined);
    for (const command of source.commands) {
      assert.equal(command.exit_code, command.expected_exit ?? 0);
      for (const stream of ['stdout', 'stderr']) assert.equal(hash(fs.readFileSync(path.join(directory, `${command.label}.${stream}`))), command[`${stream}_sha256`]);
    }
    receipt.attempts.push({ attempt, reviewer_commit: source.reviewer_commit,
      command_count: source.commands.length, manifest_entries: verifyManifest(directory),
      commands_sha256: hash(fs.readFileSync(path.join(directory, 'commands.json'))) });
  }
  for (const directory of ['b-01/wire', 'f-01/recovery']) verifyManifest(path.join(base, directory));
  const f = JSON.parse(fs.readFileSync(path.join(base, 'f-01/commands.json')));
  const checkpoint = f.reviewed_f_head;
  run('f-source-equality', 'git', ['diff', '--exit-code', checkpoint, finalF, '--', 'apps', 'internal', 'scripts', 'go.mod', 'go.sum', 'packages', 'spikes', 'docs/CONFIG_PROTOCOL.md', 'docs/CONFIG_RECOVERY_RUNBOOK.md']);
  receipt.f_changes_after_proof = git('diff', '--name-only', checkpoint, finalF).split('\n').filter(Boolean);
  assert.ok(receipt.f_changes_after_proof.every((file) => file.startsWith('evidence/sprint04a-f/') || file === 'docs/reports/sprint04a-f-config-recovery.md'));
  receipt.heads = {};
  const current = { a: 'fix/module01-envoy-codec-boundary', b: 'test/module01-origin-boundary', c: 'research/module01-upstream-capability', d: 'fix/dashboard-dependency-resolution', f: 'hardening/module03-local-recovery' };
  const pinned = JSON.parse(fs.readFileSync(path.join(base, 'ac-01/commands.json'))).heads;
  for (const [letter, branch] of Object.entries(current)) {
    const head = git('rev-parse', branch);
    assert.equal(head, letter === 'f' ? finalF : pinned[letter]);
    const owner = `/tmp/aegisgate-04a-${letter}`;
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: owner, encoding: 'utf8' }).trim(), '');
    receipt.heads[letter] = { branch, head, owner_clean: true };
  }
  const fDirectory = `/tmp/aegisgate-04a-f`;
  run('f-owner-manifest', 'sha256sum', ['--check', 'evidence/sprint04a-f/SHA256SUMS', '--quiet'], fDirectory);
  const fSource = JSON.parse(fs.readFileSync(path.join(fDirectory, 'evidence/sprint04a-f/attempt-01/source.json')));
  assert.equal(fSource.initial_status, ''); assert.equal(fSource.source_commit, checkpoint);
  for (const entry of fSource.files) {
    assert.equal(hash(execFileSync('git', ['show', `${checkpoint}:${entry.path}`])), entry.sha256);
  }
  const log = fs.readFileSync(path.join(base, 'f-01/recovery/module03-race-integration.stdout'), 'utf8');
  assert.ok(!log.includes('--- SKIP') && !log.includes('--- FAIL'));
  receipt.f_integrated_top_level_tests = (log.match(/^--- PASS:/gm) ?? []).length;
  receipt.f_integrated_packages = (log.match(/^ok\s/gm) ?? []).length;
  assert.equal(receipt.f_integrated_packages, 7);
  receipt.f_proof_source = checkpoint;
  for (const file of ['review.mjs', 'f-execute.mjs', 'seal.mjs']) run(`syntax-${file}`, process.execPath, ['--check', path.join(base, file)]);
  run('review-source-whitespace', 'git', ['diff', '--check', '3e039408', '--', `${base}/*.mjs`, 'docs/reports/sprint04a-e-security-review.md']);
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  run('review-secrets', 'flock', ['/tmp/aegisgate-sprint02-fixtures.lock', 'docker', 'run', '--rm', '--pull=never', '--network', 'none',
    '--user', `${process.getuid()}:${process.getgid()}`, '-v', `${root}/${base}:/review/evidence:ro`,
    '-v', `${root}/docs/reports/sprint04a-e-security-review.md:/review/report.md:ro`,
    '-v', `${root}/.github/gitleaks.toml:/config.toml:ro`, '-v', `${root}/${output}:/reports`,
    scanner, 'dir', '/review', '--config', '/config.toml', '--redact', '--report-format', 'json', '--report-path', '/reports/secrets.json', '--no-banner']);
} catch (error) { receipt.error = error.stack; process.exitCode = 1; }
finally {
  receipt.ended_at = new Date().toISOString(); receipt.exit_code = process.exitCode ?? 0; save();
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), fs.readdirSync(output).sort().map((file) => `${hash(fs.readFileSync(path.join(output, file)))}  ${file}`).join('\n') + '\n');
}
