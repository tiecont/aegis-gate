import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { assertLock } from '../../spikes/envoy/wire-fixtures.mjs';

const attempt = process.argv[2];
assert.match(attempt ?? '', /^attempt-[0-9]{2}$/);
const lock = '/tmp/aegisgate-sprint02-fixtures.lock';
if (process.argv[3] !== '--locked') {
  const p = spawnSync('flock', ['--exclusive', lock, process.execPath, import.meta.filename, attempt, '--locked'], { stdio: 'inherit' });
  process.exit(p.status ?? 1);
}
assertLock();
const cwd = process.cwd();
const out = path.join(cwd, 'evidence/sprint04c-e', attempt);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => {
  const p = spawnSync('git', args, { encoding: 'utf8' });
  assert.equal(p.status, 0); return p.stdout.trim();
};
assert.equal(git('status', '--porcelain'), '', 'Commit source before proof');
assert.ok(!fs.existsSync(out), 'fresh attempt required');
fs.mkdirSync(out);
const env = { ...process.env, PATH: `${path.dirname(process.execPath)}:/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin:${process.env.PATH}`,
  AEGIS_NODE_BIN: process.execPath, GOTOOLCHAIN: 'go1.27.4', COMPOSE_PROJECT_NAME: 'aegisgate-04c-e' };
const receipt = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'), tracked_clean: true,
  cwd, argv: process.argv, started_at: new Date().toISOString(), node: process.version, node_binary: process.execPath,
  node_sha256: sha(fs.readFileSync(process.execPath)), fixture_lock: lock, compose_project: env.COMPOSE_PROJECT_NAME, commands: [] };
const write = () => fs.writeFileSync(path.join(out, 'commands.json'), JSON.stringify(receipt, null, 2) + '\n');
for (const name of ['stdout.log', 'stderr.log']) fs.writeFileSync(path.join(out, name), '', { flag: 'wx' });
function run(label, argv, options = {}) {
  assertLock();
  const started_at = new Date().toISOString();
  const p = spawnSync(argv[0], argv.slice(1), { cwd, env, maxBuffer: 32 << 20, timeout: 600000, ...options });
  const streams = {};
  for (const stream of ['stdout', 'stderr']) {
    const file = `${stream}.log`, bytes = p[stream] ?? Buffer.alloc(0), offset = fs.statSync(path.join(out, file)).size;
    fs.appendFileSync(path.join(out, file), bytes);
    streams[stream] = { file, offset, length: bytes.length, sha256: sha(bytes) };
  }
  receipt.commands.push({ label, argv, cwd: options.cwd ?? cwd, started_at, ended_at: new Date().toISOString(), exit_code: p.status,
    signal: p.signal, error_code: p.error?.code ?? null, streams });
  write(); assertLock(); console.log(`${label}: ${p.status}`); return p;
}
function pass(label, argv, options) { const p = run(label, argv, options); assert.equal(p.status, 0, label); return p; }
function held(label) { assert.equal(run(`lock-${label}`, ['flock', '--nonblock', lock, 'true']).status, 1); }
const node = process.execPath, npm = path.join(path.dirname(node), 'npm');
const compose = ['docker', 'compose', '--env-file', '.local/compose.env', '--env-file', '.local/fixture-images.env', '-f', 'infra/compose/compose.yaml'];
let up = false, passed = false;
try {
  held('setup');
  for (const [label, argv] of [['go', ['go', 'version']], ['rust', ['rustc', '+1.99.1', '--version']],
    ['npm', [npm, '--version']], ['docker', ['docker', 'version', '--format', '{{.Client.Version}} {{.Server.Version}}']],
    ['compose', ['docker', 'compose', 'version']]]) pass(`${label}-version`, argv);
  pass('root-install', [npm, 'ci', '--ignore-scripts', '--strict-peer-deps']);
  pass('dashboard-install', [npm, 'ci', '--ignore-scripts', '--strict-peer-deps'], { cwd: path.join(cwd, 'apps/dashboard') });
  pass('spike-install', [npm, 'ci', '--ignore-scripts', '--strict-peer-deps'], { cwd: path.join(cwd, 'spikes/pingora') });
  for (const pkg of ['typescript', 'typescript-eslint', '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin', '@typescript-eslint/typescript-estree'])
    pass(`metadata-${pkg}`, [npm, 'view', pkg, 'version', 'peerDependencies', 'engines', 'dist.integrity', '--json']);
  const docRevision = pass('official-compatibility-revision', ['gh', 'api', 'repos/typescript-eslint/typescript-eslint/commits/main', '--jq', '.sha']).stdout.toString().trim();
  assert.match(docRevision, /^[a-f0-9]{40}$/);
  pass('official-compatibility-doc', ['curl', '--fail', '--silent', '--show-error', '--location', `https://raw.githubusercontent.com/typescript-eslint/typescript-eslint/${docRevision}/docs/users/Dependency_Versions.mdx`]);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisgate-04c-e-ts7-'));
  try {
    for (const f of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(cwd, 'apps/dashboard', f), path.join(temp, f));
    const p = run('typescript7-strict-resolution', [npm, 'install', 'typescript@7.0.2', '--package-lock-only', '--dry-run', '--ignore-scripts', '--strict-peer-deps'], { cwd: temp });
    assert.equal(p.status, 1, 'Changed compatibility needs scoped update/review');
    assert.match(p.stderr.toString(), /ERESOLVE/); assert.match(p.stderr.toString(), />=4\.8\.4 <6\.1\.0/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  pass('dependency-tree', [npm, '--prefix', 'apps/dashboard', 'ls', 'typescript', 'typescript-eslint', '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin', 'minimatch', '--all']);
  pass('fixture-images', ['make', 'fixture-images']);
  fs.copyFileSync('.local/fixture-images.lock.json', path.join(out, 'fixture-images.lock.json'));
  up = true; pass('compose-up', [...compose, 'up', '-d', '--wait', '--wait-timeout', '90']);
  pass('fixture-tls-credentials', ['python3', 'scripts/integration.py']);
  pass('fixture-fresh-restart', ['python3', 'scripts/fixture-image-integration.py']);
  pass('fixture-stale-volume', ['python3', 'evidence/sprint04c-e/stale-volume.py']);
  held('regression');
  pass('format', ['make', 'fmt-check']);
  const packages = ['./apps/control-api/...', './apps/config-publisher/...', './internal/...', './packages/test-fixtures/...'];
  pass('go-vet', ['go', 'vet', ...packages]);
  pass('go-full-race-integration', ['go', 'test', '-race', '-v', ...packages, '-count=1'], { env: { ...env, AEGIS_TENANCY_INTEGRATION: '1' } });
  pass('edge-test', ['cargo', '+1.99.1', 'test', '--workspace', '--locked', '--manifest-path', 'apps/edge/Cargo.toml']);
  for (const f of ['dev-secrets.test.py', 'image_identity_test.py', 'git_history_preflight_test.py']) pass(f, ['python3', `scripts/${f}`, '-v']);
  pass('contracts-check', [npm, 'run', 'contracts:check']); pass('contracts-test', [npm, 'run', 'contracts:test']);
  pass('contracts-integration', [node, 'scripts/contract-integration.mjs']);
  pass('golden', [node, 'internal/configsnapshot/testdata/verify-vector.mjs']);
  for (const s of ['lint', 'typecheck', 'test', 'build', 'integration']) pass(`dashboard-${s}`, [npm, '--prefix', 'apps/dashboard', 'run', s]);
  for (const [source, dest] of [['.local/bin/govulncheck', '.local/bin/govulncheck'], ['.local/tools/bin/cargo-audit', '.local/tools/bin/cargo-audit']]) {
    fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join('/home/tiecont/Projects/aegis-gate', source), dest); fs.chmodSync(dest, 0o755);
    receipt[dest] = { sha256: sha(fs.readFileSync(dest)) };
  }
  pass('govulncheck-version', ['.local/bin/govulncheck', '-version']); pass('cargo-audit-version', ['.local/tools/bin/cargo-audit', '--version']);
  pass('dependency-scans', ['bash', 'scripts/security-scan.sh', 'dependencies']);
  const scanDir = '.local/evidence/security'; fs.mkdirSync(path.join(out, 'dependencies'));
  for (const f of fs.readdirSync(scanDir)) if (/\.(log|json)$/.test(f)) fs.copyFileSync(path.join(scanDir, f), path.join(out, 'dependencies', f));
  pass('source-unchanged', ['git', 'diff', '--exit-code', 'HEAD']); passed = true;
} catch (error) { receipt.error = error.stack; console.error(error.message); }
finally {
  if (up) {
    passed = run('cleanup', [...compose, 'down', '--volumes', '--remove-orphans']).status === 0 && passed;
    for (const kind of ['container', 'network', 'volume']) {
      const p = run(`cleanup-${kind}`, ['docker', kind, 'ls', '--filter', `label=com.docker.compose.project=${env.COMPOSE_PROJECT_NAME}`, '--format', '{{.ID}}']);
      passed = p.status === 0 && p.stdout.toString().trim() === '' && passed;
    }
  }
  held('after-cleanup'); assertLock(); receipt.passed = passed; receipt.lock_held_through_cleanup = true; receipt.ended_at = new Date().toISOString(); write();
  const inventory = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? inventory(path.join(dir, e.name)) : [path.join(dir, e.name)]);
  fs.writeFileSync(path.join(out, 'SHA256SUMS'), inventory(out).sort().map(f => `${sha(fs.readFileSync(f))}  ${path.relative(cwd, f)}\n`).join(''));
}
process.exitCode = passed ? 0 : 1;
