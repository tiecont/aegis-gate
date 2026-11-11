import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sharedRoot = process.argv[2];
assert.ok(sharedRoot && path.isAbsolute(sharedRoot), 'absolute read-only shared runner root required');
const lockPath = '/tmp/aegisgate-sprint02-fixtures.lock';
const lockInode = fs.statSync(lockPath).ino;
assert.ok(fs.readFileSync('/proc/locks', 'utf8').split('\n').some((line) => {
  const fields = line.trim().split(/\s+/);
  return fields[1] === 'FLOCK' && fields[3] === 'WRITE'
    && fields[4] === String(process.ppid) && fields[5]?.endsWith(`:${lockInode}`);
}), 'invoke directly under flock');
const label = process.argv[3] ?? 'corrected';
assert.match(label, /^[a-z0-9-]+$/, 'simple evidence label required');
const output = path.join(root, 'evidence/sprint03a-a', label);
const privateRoot = path.join(root, '.local');
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
fs.chmodSync(privateRoot, 0o700);
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sharedFiles = ['spikes/edge-comparison/run.mjs', 'spikes/edge-comparison/contract.mjs',
  'spikes/edge-comparison/manifest.json', 'spikes/edge-comparison/supplemental.mjs',
  'spikes/edge-comparison/contract.test.mjs', 'spikes/pingora/lab.mjs'];
const hashes = () => Object.fromEntries(sharedFiles.map((file) => [file, sha256(path.join(sharedRoot, file))]));
const before = hashes();
const env = { ...process.env, PINGORA_SPIKE_PROFILE: 'release',
  AEGIS_CANDIDATE_NAME: 'pingora-0.9.1-sprint03a-a', AEGIS_CANDIDATE_ROOT: root,
  AEGIS_RUN_ROOT: privateRoot };
delete env.AEGIS_CANDIDATE_COMMAND;
delete env.AEGIS_CANDIDATE_ARGS;
const commands = [];
function run(name, args) {
  const started_at = new Date().toISOString();
  const result = spawnSync(process.execPath, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  fs.writeFileSync(path.join(output, `${name}.stdout.txt`), result.stdout);
  fs.writeFileSync(path.join(output, `${name}.stderr.txt`), result.stderr);
  commands.push({ program: process.execPath, args, cwd: root, started_at, ended_at: new Date().toISOString(),
    environment: Object.fromEntries(['PINGORA_SPIKE_PROFILE', 'AEGIS_CANDIDATE_NAME', 'AEGIS_CANDIDATE_ROOT', 'AEGIS_RUN_ROOT'].map((key) => [key, env[key]])),
    exit_code: result.status, stdout: `${name}.stdout.txt`, stderr: `${name}.stderr.txt` });
  return result;
}
const contract = run('contract', ['--test', path.join(sharedRoot, 'spikes/edge-comparison/contract.test.mjs')]);
assert.equal(contract.status, 0, 'shared contract tests failed');
const lab = run('lab', [path.join(sharedRoot, 'spikes/edge-comparison/run.mjs')]);
const resultPath = lab.stdout.match(/^Evidence: (.+\/results\.json)$/m)?.[1];
assert.ok(resultPath && fs.realpathSync(resultPath).startsWith(`${privateRoot}/`), 'result must be in assigned worktree');
const raw = fs.readFileSync(resultPath, 'utf8');
const data = JSON.parse(raw);
const proxyLog = path.join(path.dirname(resultPath), 'proxy.log');
assert.ok(!/BEGIN (?:RSA |EC |)PRIVATE KEY/.test(raw + fs.readFileSync(proxyLog, 'utf8')), 'private key export prohibited');
fs.writeFileSync(path.join(output, 'results.json'), raw);
assert.deepEqual(hashes(), before, 'shared source changed during proof; rerun for immutable source binding');
const manifest = JSON.parse(fs.readFileSync(path.join(sharedRoot, 'spikes/edge-comparison/manifest.json')));
const baseline = data.tests.filter((test) => manifest.baseline_tests.includes(test.name));
const failures = baseline.filter((test) => test.status === 'fail').map((test) => test.name);
const summary = { commands, lock: { path: lockPath, held_by_parent_pid: process.ppid },
  script_sha256: sha256(fileURLToPath(import.meta.url)), shared_source_sha256: before,
  results_sha256: sha256(path.join(output, 'results.json')), private_result: resultPath,
  private_result_sha256: sha256(resultPath), proxy_log_sha256: sha256(proxyLog),
  total: data.tests.length, pass: data.tests.filter((test) => test.status === 'pass').length,
  fail: data.tests.filter((test) => test.status === 'fail').length,
  baseline: { total: baseline.length, pass: baseline.filter((test) => test.status === 'pass').length,
    fail: failures.length, failures, expected_failures: manifest.baseline_failures },
  supplemental: data.tests.filter((test) => !manifest.baseline_tests.includes(test.name))
    .map((test) => ({ name: test.name, status: test.status })), fatal: data.fatal ?? null };
fs.writeFileSync(path.join(output, 'run.json'), `${JSON.stringify(summary, null, 2)}\n`);
assert.ok(!data.fatal, 'incomplete lab proof; see results.json');
assert.equal(baseline.length, 65);
assert.deepEqual([...failures].sort(), [...manifest.baseline_failures].sort(), 'baseline failure set changed');
console.log(JSON.stringify({ total: summary.total, pass: summary.pass, fail: summary.fail,
  baseline: summary.baseline, supplemental: summary.supplemental }, null, 2));
// Preserve the actual failing proof status instead of converting reproduction into GO.
process.exitCode = lab.status;
