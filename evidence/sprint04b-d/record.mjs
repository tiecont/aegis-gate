import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const attempt = process.argv[2];
assert.match(attempt ?? '', /^attempt-[0-9]{2}$/);
const lock = '/tmp/aegisgate-sprint02-fixtures.lock';
if (process.argv[3] !== '--locked') {
  const child = spawnSync('flock', ['--exclusive', lock, process.execPath, import.meta.filename, attempt, '--locked'],
    { stdio: 'inherit', env: { ...process.env, AEGIS_D_LOCK_REQUESTED: new Date().toISOString() } });
  process.exit(child.status ?? 1);
}
const cwd = process.cwd();
const output = path.join(cwd, 'evidence/sprint04b-d', attempt);
assert.ok(!fs.existsSync(output), 'Use a fresh attempt; never rewrite evidence');
const git = (...args) => {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  assert.equal(result.status, 0);
  return result.stdout.trim();
};
const status = git('status', '--porcelain', '--untracked-files=all');
assert.ok(status.split('\n').every(line => !line || /^evidence\/sprint04b-d\/attempt-/.test(line.slice(3))), 'Commit source before proof');
fs.mkdirSync(output, { recursive: true });
const source = git('rev-parse', 'HEAD');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const environment = { ...process.env, PATH: [path.dirname(process.execPath), process.env.AEGIS_D_GO_DIRECTORY, process.env.PATH].filter(Boolean).join(':'),
  AEGIS_NODE_BIN: process.execPath, GOTOOLCHAIN: 'go1.27.4', COMPOSE_PROJECT_NAME: 'aegisgate-04b-d' };
const files = git('ls-files').split('\n').filter(name =>
  !name.startsWith('evidence/') && !name.startsWith('docs/reports/') && !name.startsWith('spikes/') ||
  name.startsWith('evidence/sprint04b-d/'));
const json = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
json('source.json', { source_commit: source, source_tree: git('rev-parse', 'HEAD^{tree}'), initial_status: status,
  cwd, tool_path: environment.PATH, node_binary: process.execPath, fixture_lock: lock, lock_requested_at: process.env.AEGIS_D_LOCK_REQUESTED,
  lock_acquired_before: new Date().toISOString(), project: environment.COMPOSE_PROJECT_NAME,
  files: files.map(name => ({ path: name, sha256: hash(fs.readFileSync(name)) })) });
const records = [];
function run(label, argv, options = {}) {
  const started = new Date().toISOString();
  const result = spawnSync(argv[0], argv.slice(1), { cwd, env: environment, encoding: 'utf8',
    maxBuffer: 32 << 20, timeout: 900000, ...options });
  const logs = {};
  for (const stream of ['stdout', 'stderr']) {
    const file = `${label}.${stream}.txt`;
    fs.writeFileSync(path.join(output, file), result[stream] ?? '');
    logs[stream] = { file, sha256: hash(fs.readFileSync(path.join(output, file))) };
  }
  records.push({ label, source_commit: source, cwd: options.cwd ?? cwd, argv,
    started_at: started, ended_at: new Date().toISOString(), exit_code: result.status,
    signal: result.signal, error_code: result.error?.code ?? null, logs });
  json('commands.json', records);
  console.log(`${label}: exit=${result.status}`);
  return result;
}
function pass(label, argv, options) { const result = run(label, argv, options); assert.equal(result.status, 0, label); return result; }
function held(stage) { assert.equal(run(`lock-${stage}`, ['flock', '--nonblock', lock, 'true']).status, 1, 'fixture lock released early'); }
const node = process.execPath;
const npm = path.join(path.dirname(node), 'npm');
const compose = ['docker', 'compose', '--env-file', '.local/compose.env', '--env-file', '.local/fixture-images.env', '-f', 'infra/compose/compose.yaml'];
let composeAttempted = false;
let ok = false;
let failure = null;
try {
  held('before-setup');
  pass('tool-locations', ['which', 'go', 'gofmt', 'cargo', 'rustc', 'node', 'npm', 'docker', 'gh']);
  pass('node-version', [node, '--version']);
  pass('npm-version', [npm, '--version']);
  pass('go-version', ['go', 'version']);
  pass('rust-version', ['rustc', '+1.99.1', '--version']);
  pass('docker-version', ['docker', 'version', '--format', '{{.Client.Version}} {{.Server.Version}}']);
  pass('compose-version', ['docker', 'compose', 'version']);
  pass('baseline-main', ['git', 'rev-parse', 'origin/main']);
  pass('pr12-merge-ci', ['gh', 'api', 'repos/tiecont/aegis-gate/actions/runs/43466312855', '--jq', '{id,head_sha,status,conclusion,event,html_url}']);
  pass('pr12-merge-jobs', ['gh', 'api', 'repos/tiecont/aegis-gate/actions/runs/43466312855/jobs', '--jq', '.jobs[] | {id,name,head_sha,status,conclusion,html_url}']);
  pass('root-install', [npm, 'ci', '--ignore-scripts', '--strict-peer-deps']);
  pass('dashboard-install', [npm, 'ci', '--ignore-scripts', '--strict-peer-deps'], { cwd: path.join(cwd, 'apps/dashboard') });
  for (const dependency of ['typescript', 'typescript-eslint', '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin', '@typescript-eslint/typescript-estree', 'next', '@next/eslint-plugin-next', 'eslint', 'react', 'react-dom']) {
    pass(`metadata-${dependency.replaceAll('@', '').replaceAll('/', '-')}`, [npm, 'view', dependency, 'version', 'peerDependencies', 'engines', '--json']);
  }
  const candidate = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisgate-04b-d-ts7-'));
  try {
    for (const name of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(cwd, 'apps/dashboard', name), path.join(candidate, name));
    const result = run('typescript7-strict-resolution', [npm, 'install', 'typescript@7.0.2', '--package-lock-only', '--dry-run', '--ignore-scripts', '--strict-peer-deps'], { cwd: candidate });
    assert.equal(result.status, 1, 'Peer support changed: review evidence before updating');
    assert.match(result.stderr, /ERESOLVE/);
    assert.match(result.stderr, />=4\.8\.4 <6\.1\.0/);
  } finally { fs.rmSync(candidate, { recursive: true, force: true }); }
  pass('dependency-tree', [npm, '--prefix', 'apps/dashboard', 'ls', 'typescript', 'typescript-eslint', '@typescript-eslint/parser', '@typescript-eslint/eslint-plugin', 'minimatch', '--all']);
  pass('fixture-images', ['make', 'fixture-images']);
  fs.copyFileSync('.local/fixture-images.lock.json', path.join(output, 'fixture-images.lock.json'));
  held('after-setup');
  composeAttempted = true;
  pass('compose-up', [...compose, 'up', '-d', '--wait', '--wait-timeout', '90']);
  pass('fixture-credential-tls', ['python3', 'scripts/integration.py']);
  pass('fixture-fresh-restart', ['python3', 'scripts/fixture-image-integration.py']);
  pass('fixture-stale-volume', ['python3', 'evidence/sprint04b-d/stale-volume.py']);
  held('before-regression');
  pass('format', ['make', 'fmt-check']);
  const packages = ['./apps/control-api/...', './apps/config-publisher/...', './internal/...', './packages/test-fixtures/...'];
  pass('go-vet', ['go', 'vet', ...packages]);
  pass('go-full-race-integration', ['go', 'test', '-race', '-v', ...packages, '-count=1'], { env: { ...environment, AEGIS_TENANCY_INTEGRATION: '1' } });
  pass('edge-clippy', ['cargo', '+1.99.1', 'clippy', '--workspace', '--all-targets', '--locked', '--manifest-path', 'apps/edge/Cargo.toml', '--', '-D', 'warnings']);
  pass('edge-test', ['cargo', '+1.99.1', 'test', '--workspace', '--locked', '--manifest-path', 'apps/edge/Cargo.toml']);
  pass('edge-build', ['cargo', '+1.99.1', 'build', '--workspace', '--locked', '--manifest-path', 'apps/edge/Cargo.toml']);
  for (const label of ['dev-secrets.test.py', 'image_identity_test.py', 'git_history_preflight_test.py']) pass(label, ['python3', `scripts/${label}`, '-v']);
  for (const script of ['contracts:check', 'contracts:test']) pass(script.replace(':', '-'), [npm, 'run', script]);
  pass('contracts-integration', [node, 'scripts/contract-integration.mjs']);
  pass('golden', [node, 'internal/configsnapshot/testdata/verify-vector.mjs']);
  for (const script of ['lint', 'typecheck', 'test', 'build', 'integration']) pass(`dashboard-${script}`, [npm, '--prefix', 'apps/dashboard', 'run', script]);
  for (const [name, pkg] of [['control-api', './apps/control-api/cmd/control-api'], ['config-publisher', './apps/config-publisher/cmd/config-publisher'], ['fixtures', './packages/test-fixtures/cmd/fixtures']]) pass(`go-build-${name}`, ['go', 'build', '-o', `.local/bin/${name}`, pkg]);
  pass('gate-selftest', ['make', 'gate-selftest']);
  pass('security-negative', ['make', 'security-negative']);
  pass('root-audit', [npm, 'audit', '--audit-level=high', '--json']);
  pass('dashboard-audit', [npm, '--prefix', 'apps/dashboard', 'audit', '--audit-level=high', '--json']);
  pass('source-unchanged', ['git', 'diff', '--exit-code', 'HEAD', '--', '.', ':!evidence/sprint04b-d/']);
  held('before-cleanup');
  ok = true;
} catch (error) {
  failure = String(error);
  console.error(failure);
} finally {
  if (composeAttempted) {
    const result = run('compose-down', [...compose, 'down', '--volumes', '--remove-orphans']);
    ok = result.status === 0 && ok;
    for (const kind of ['container', 'network', 'volume']) {
      const result = run(`cleanup-${kind}`, ['docker', kind, 'ls', '--filter', 'label=com.docker.compose.project=aegisgate-04b-d', '--format', '{{.ID}}']);
      ok = result.status === 0 && result.stdout.trim() === '' && ok;
    }
  }
  try { held('after-cleanup'); } catch (error) { ok = false; failure ??= String(error); }
  json('result.json', { source_commit: source, complete: ok, failure, ended_at: new Date().toISOString(),
    lock_held_through_cleanup: records.find(r => r.label === 'lock-after-cleanup')?.exit_code === 1 });
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), fs.readdirSync(output).sort().filter(name => name !== 'SHA256SUMS')
    .map(name => `${hash(fs.readFileSync(path.join(output, name)))}  ${path.relative(cwd, path.join(output, name))}\n`).join(''));
}
process.exitCode = ok ? 0 : 1;
