import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from '../spikes/envoy/wire-fixtures.mjs';
assertLock(); process.umask(0o077);
const out = process.argv[2];
assert.match(out ?? '', /^evidence\/sprint05c-f\/checks-\d+$/);
assert.ok(!fs.existsSync(out));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 << 20 }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
fs.mkdirSync(out, { recursive: true });
const stage = fs.mkdtempSync('/home/tiecont/.cache/aegisgate-sprint05c-f-scan-');
const name = `aegisgate-sprint05c-f-scan-${process.pid}`;
const image = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
const r = { argv: process.argv, source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  collector_sha256: sha(fs.readFileSync(import.meta.filename)), started_at: new Date().toISOString(),
  inputs: [], commands: [], checked_hashes: 0, security_pass: false };
function run(label, program, args) {
  assertLock(); const started_at = new Date().toISOString();
  const resolved = path.isAbsolute(program) ? program : process.env.PATH.split(path.delimiter).map((dir) => path.join(dir, program)).find((file) => fs.existsSync(file));
  assert.ok(resolved);
  const c = spawnSync(resolved, args, { timeout: 180000, maxBuffer: 16 << 20 });
  const streams = ['stdout', 'stderr'].map((key) => {
    const b = c[key] ?? Buffer.alloc(0), file = `${label}.${key}`;
    fs.writeFileSync(`${out}/${file}`, b); return { file, sha256: sha(b), bytes: b.length };
  });
  r.commands.push({ label, program: resolved, binary_sha256: sha(fs.readFileSync(resolved)), args,
    started_at, ended_at: new Date().toISOString(), exit_code: c.status, signal: c.signal, error: c.error?.message, streams });
  assert.equal(c.status, 0, label); return c;
}
function put(file, bytes, provenance) {
  const target = path.join(stage, file); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes); r.inputs.push({ file, provenance, sha256: sha(bytes), bytes: bytes.length });
}
function copy(file) {
  if (file === out) return;
  if (fs.statSync(file).isDirectory()) for (const name of fs.readdirSync(file).sort()) copy(path.join(file, name));
  else put(file, fs.readFileSync(file), 'F working tree');
}
function check(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (full === out) continue;
    if (fs.statSync(full).isDirectory()) { check(full); continue; }
    if (file === 'SHA256SUMS') {
      // The first ENOSPC attempt's empty manifest is explicitly ineligible.
      const lines = fs.readFileSync(full, 'utf8').trim().split('\n').filter(Boolean);
      if (!lines.length) { (r.incomplete_manifests ??= []).push(full); continue; }
      for (const line of lines) {
        const [digest, target] = line.split('  ');
        const preserved = fs.existsSync(target) ? target : path.join(dir, path.basename(target));
        assert.equal(sha(fs.readFileSync(preserved)), digest, target); r.checked_hashes++;
      }
    }
  }
}
try {
  const protectedFiles = JSON.parse(run('protected', process.execPath, ['scripts/sprint05b-baseline.mjs']).stdout).protectedFiles;
  run('protected-tests', process.execPath, ['--test', 'spikes/edge-comparison/contract.test.mjs', 'spikes/edge-comparison/evaluate.test.mjs',
    'spikes/edge-comparison/tls-observer.test.mjs', 'spikes/envoy/wire-observer.test.mjs', 'spikes/envoy/sprint05a-a-config.test.mjs']);
  for (const file of fs.readdirSync('scripts').filter((file) => /^sprint05c-f-.*\.mjs$/.test(file))) run(`syntax-${file}`, process.execPath, ['--check', `scripts/${file}`]);
  const fmt = run('gofmt', '/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/gofmt', ['-l', 'scripts/sprint05c-f-observer_test.go']);
  assert.equal(fmt.stdout.toString(), '');
  run('whitespace', 'git', ['diff', '--check', '078d83c', '--', 'scripts/sprint05c-f-*', 'docs/reports/sprint05c-f-security-review.md']);
  check('evidence/sprint05c-f');
  for (const file of fs.readdirSync('scripts').filter((file) => file.startsWith('sprint05c-f-'))) copy(`scripts/${file}`);
  copy('docs/reports/sprint05c-f-security-review.md'); copy('evidence/sprint05c-f');
  r.reviewed_sources = [];
  r.protected_source_checks = 0;
  r.dependency_changes = [];
  for (const [letter, revision] of [['a', 'dc5d966'], ['b', '0444023'], ['c', '7255fa2'], ['d', 'cbc73f5'], ['e', 'dd1eaa4']]) {
    const commit = git('rev-parse', `${revision}^{commit}`);
    const files = git('diff', '--name-only', '078d83c', commit).split('\n').filter((file) => file && !file.startsWith('evidence/'));
    r.reviewed_sources.push({ letter, commit, tree: git('rev-parse', `${commit}^{tree}`), files });
    r.dependency_changes.push(...files.filter((file) => /(?:^|\/)(?:go\.(?:mod|sum)|Cargo\.(?:toml|lock)|package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file)).map((file) => ({ letter, commit, file })));
    for (const pin of protectedFiles) {
      assert.equal(sha(execFileSync('git', ['show', `${commit}:${pin.file}`], { maxBuffer: 16 << 20 })), pin.sha256);
      r.protected_source_checks++;
    }
    for (const file of files) put(`reviewed-source/${letter}/${file}`, execFileSync('git', ['show', `${commit}:${file}`], { maxBuffer: 16 << 20 }), `${commit}:${file}`);
  }
  assert.deepEqual(r.dependency_changes, []);
  run('scanner-image', 'docker', ['image', 'inspect', image, '--format', '{{.Id}} {{json .RepoDigests}}']);
  run('secrets', 'docker', ['run', '--rm', '--pull', 'never', '--network', 'none', '--name', name,
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', `${process.getuid()}:${process.getgid()}`,
    '-v', `${stage}:/scan:ro`, '-v', `${path.resolve('.github/gitleaks.toml')}:/policy/gitleaks.toml:ro`, '-v', `${path.resolve(out)}:/reports`,
    image, 'dir', '/scan', '--config', '/policy/gitleaks.toml', '--redact', '--report-format', 'json', '--report-path', '/reports/secrets.json', '--no-banner']);
  assert.deepEqual(JSON.parse(fs.readFileSync(`${out}/secrets.json`)), []);
  r.complete = true;
} catch (error) { r.error = error.stack; process.exitCode = 1; }
finally {
  assertLock();
  spawnSync('docker', ['rm', '--force', name], { stdio: 'ignore' });
  r.scanner_absent = spawnSync('docker', ['container', 'inspect', name], { stdio: 'ignore' }).status !== 0;
  fs.rmSync(stage, { recursive: true }); r.stage_absent = !fs.existsSync(stage);
  r.lock_held_through_cleanup_and_hashes = true; r.ended_at = new Date().toISOString();
  fs.writeFileSync(`${out}/receipt.json`, JSON.stringify(r, null, 2) + '\n');
  fs.writeFileSync(`${out}/SHA256SUMS`, fs.readdirSync(out).sort().map((file) => `${sha(fs.readFileSync(`${out}/${file}`))}  ${out}/${file}\n`).join(''));
  console.log(JSON.stringify({ complete: r.complete, error: r.error, checked_hashes: r.checked_hashes, inputs: r.inputs.length,
    scanner_absent: r.scanner_absent, stage_absent: r.stage_absent }));
}
