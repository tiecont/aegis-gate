import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const [cwd, output] = process.argv.slice(2);
assert.ok(cwd?.startsWith('/tmp/aegisgate-04a-e/.local/review/f-'));
assert.ok(output?.startsWith('/tmp/aegisgate-04a-e/evidence/sprint04a-e/f-'));
const { assertLock } = await import(path.join(cwd, 'spikes/envoy/wire-fixtures.mjs'));
assertLock();
assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }).trim(), '');
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
const receipt = { source_commit: source, source_clean: true, started_at: new Date().toISOString(),
  argv: process.argv, node: process.version, node_sha256: hash(fs.readFileSync(process.execPath)),
  compose_project: 'aegisgate-04a-e-review', commands: [], failures: [] };
const save = () => fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(receipt, null, 2) + '\n');
const env = { ...process.env, GOTOOLCHAIN: 'go1.27.4', PATH: `${path.dirname(process.execPath)}:${process.env.PATH}` };
function run(label, program, args, extraEnv = {}) {
  const started_at = new Date().toISOString();
  const child = spawnSync(program, args, { cwd, env: { ...env, ...extraEnv }, maxBuffer: 64 << 20 });
  const streams = {};
  for (const stream of ['stdout', 'stderr']) {
    const bytes = child[stream] ?? Buffer.alloc(0);
    fs.writeFileSync(path.join(output, `${label}.${stream}`), bytes);
    streams[`${stream}_sha256`] = hash(bytes);
  }
  receipt.commands.push({ label, program, args, cwd, environment: extraEnv, started_at,
    ended_at: new Date().toISOString(), exit_code: child.status, signal: child.signal,
    error: child.error?.message ?? null, ...streams });
  if (child.status !== 0) receipt.failures.push(label);
  save(); console.log(`${label}: exit=${child.status}`); return child;
}
function must(...args) { assert.equal(run(...args).status, 0, `${args[0]} failed`); }
const compose = ['compose', '-p', receipt.compose_project, '--env-file', '.local/compose.env',
  '--env-file', '.local/fixture-images.env', '-f', 'infra/compose/compose.yaml'];
const packages = ['./apps/control-api/internal/persistence', './apps/control-api/internal/transport',
  './internal/configreview', './internal/configconsumer', './internal/configsnapshot',
  './internal/configrollout', './internal/configpublish'];
let attempted = false;
try {
  must('go-version', 'go', ['version']);
  must('fixture-images', 'make', ['fixture-images']);
  attempted = true;
  must('postgres-up', 'docker', [...compose, 'up', '-d', '--wait', '--wait-timeout', '90', 'postgres']);
  must('module03-race-integration', 'go', ['test', '-race', '-v', ...packages, '-count=1'], { AEGIS_TENANCY_INTEGRATION: '1' });
  must('vet', 'go', ['vet', ...packages]);
  must('golden-vector', process.execPath, ['internal/configsnapshot/testdata/verify-vector.mjs']);
  must('f-source-whitespace', 'git', ['diff', '--check', '3e039408', '--', 'apps', 'internal', 'scripts', 'docs']);
} catch (error) {
  receipt.error = error.stack; process.exitCode = 1;
} finally {
  if (attempted) {
    const stopped = run('postgres-down', 'docker', [...compose, 'down', '--volumes', '--remove-orphans']);
    if (stopped.status !== 0) process.exitCode = 1;
    const containers = run('remaining-owned-containers', 'docker', ['ps', '-aq', '--filter', `label=com.docker.compose.project=${receipt.compose_project}`]);
    receipt.remaining_owned_containers = containers.stdout?.toString().trim() ?? '';
    assert.equal(receipt.remaining_owned_containers, '');
  }
  assertLock();
  if (!receipt.remaining_owned_containers) {
    for (const name of ['pki', 'compose.env', 'fixture-images.env']) {
      fs.rmSync(path.join(cwd, '.local', name), { force: true, recursive: true });
    }
    receipt.fixture_secret_cleanup = true;
  }
  receipt.lock_held_through_cleanup = true;
  receipt.ended_at = new Date().toISOString(); receipt.exit_code = process.exitCode ?? 0; save();
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), fs.readdirSync(output).sort().map((name) => `${hash(fs.readFileSync(path.join(output, name)))}  ${name}`).join('\n') + '\n');
}
