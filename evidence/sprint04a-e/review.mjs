import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

process.umask(0o077);
const root = '/tmp/aegisgate-04a-e';
const node = '/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node';
const npm = path.join(path.dirname(node), 'npm');
const baseline = '3e03940848c81751c87bbcec131238abb7d28e1b';
const heads = {
  a: '8d83ece166290b7c81e757281e5b1778e83dede4',
  b: '93dc1223ae09d2562a9b4c5b307b173f960b9ea4',
  c: '6acbe0f55d50334a14b95c4d3e9888f5d1aebecf',
  d: 'b42bae1e9ffa63b4dfd4c94c9a6376f7129077ce',
};
const [mode, attempt = '01', suppliedHead] = process.argv.slice(2);
assert.match(attempt, /^[a-z0-9-]+$/);
process.chdir(root);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const output = path.join(root, 'evidence/sprint04a-e', `${mode}-${attempt}`);
assert.equal(git('status', '--porcelain'), '', 'commit review sources before proof');
assert.ok(!fs.existsSync(output), 'retain every attempt');
fs.mkdirSync(output, { recursive: true });
const receipt = { reviewer_commit: git('rev-parse', 'HEAD'), reviewer_clean: true,
  argv: process.argv, started_at: new Date().toISOString(), executable: process.execPath,
  node: process.version, node_sha256: hash(fs.readFileSync(process.execPath)), baseline,
  heads, commands: [], failures: [] };
const save = () => fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(receipt, null, 2) + '\n');
const env = { ...process.env, PATH: `${path.dirname(node)}:${process.env.PATH}` };
function run(label, program, args, cwd = root, expected = 0, extraEnv = {}) {
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
    error: child.error?.message ?? null, expected_exit: expected, ...streams });
  save(); console.log(`${label}: exit=${child.status}`);
  if (child.status !== expected) receipt.failures.push(label);
  return child;
}
function must(...args) {
  const child = run(...args);
  assert.equal(child.status, args[4] ?? 0, `${args[0]} unexpected exit; retain logs`);
  return child;
}
function checkout(letter, head = heads[letter]) {
  const cwd = path.join(root, '.local/review', `${letter}-${head.slice(0, 12)}-${attempt}`);
  must(`checkout-${letter}`, 'git', ['worktree', 'add', '--detach', cwd, head]);
  const status = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' }).trim();
  assert.equal(status, '');
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd }).toString().split('\0').filter(Boolean);
  receipt.checkouts ??= [];
  receipt.checkouts.push({ letter, head, cwd, source_clean: true,
    tracked_files: paths.map((file) => ({ file, sha256: hash(fs.readFileSync(path.join(cwd, file))) })) });
  save(); return cwd;
}
function preserve(directory, name) {
  fs.cpSync(directory, path.join(output, name), { recursive: true, errorOnExist: true });
}
function immutable(cwd) {
  const files = ['spikes/pingora/lab.mjs', ...['manifest.json', 'contract.mjs', 'supplemental.mjs', 'evaluate.mjs', 'tls-observer.mjs'].map((name) => `spikes/edge-comparison/${name}`)];
  return files.map((file) => {
    const expected = hash(execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root }));
    const actual = hash(fs.readFileSync(path.join(cwd, file)));
    assert.equal(actual, expected, file); return { file, sha256: actual };
  });
}
try {
  must('node-version', node, ['--version']);
  must('npm-version', npm, ['--version']);
  if (mode === 'b') {
    const cwd = checkout('b'); receipt.immutable = immutable(cwd);
    must('fixture-dependencies', npm, ['ci', '--ignore-scripts', '--strict-peer-deps'], path.join(cwd, 'spikes/pingora'));
    const target = 'evidence/sprint04a-b/e-independent';
    run('independent-wire', 'flock', ['/tmp/aegisgate-sprint02-fixtures.lock', node, 'spikes/envoy/wire-run.mjs', target], cwd, 1);
    preserve(path.join(cwd, target), 'wire');
    const read = (name) => JSON.parse(fs.readFileSync(path.join(output, 'wire', name)));
    receipt.decisions = ['unchanged75', 'diagnostic75'].map((name) => read(`${name}-decision.json`));
    receipt.h2 = ['unchanged75', 'diagnostic75'].map((name) => read(`${name}-results.json`).tests.find((test) => test.name === 'HTTP2-authority-Host-and-SNI-confusion-rejected'));
    const probes = read('probes.json');
    receipt.warm = probes.tests.find((test) => test.name === 'warm-valid-then-Host-denial-observation');
    receipt.cleanup = read('commands.json').cleanup;
    assert.equal(receipt.warm.rejection_interval.bytes, 9);
    assert.equal(receipt.warm.frames[0].hex, '000000040100000000');
    assert.deepEqual(receipt.cleanup.remaining_owned_containers, []);
    assert.equal(receipt.cleanup.lock_held_through_cleanup, true);
  } else if (mode === 'd') {
    const cwd = checkout('d');
    for (const file of ['apps/dashboard/package.json', 'apps/dashboard/package-lock.json']) {
      assert.equal(hash(fs.readFileSync(path.join(cwd, file))), hash(execFileSync('git', ['show', `${baseline}:${file}`])));
    }
    must('dashboard-reproduce', 'flock', ['/tmp/aegisgate-sprint02-fixtures.lock', node, 'evidence/sprint04a-d/dashboard-reproduce.mjs', path.join(output, 'dashboard')], cwd);
    must('supported-normal-update', npm, ['--prefix', 'apps/dashboard', 'update', '--package-lock-only', '--ignore-scripts', '--strict-peer-deps', '--dry-run'], cwd);
  } else if (mode === 'ac') {
    for (const letter of ['a', 'c']) {
      const cwd = checkout(letter); receipt[`immutable_${letter}`] = immutable(cwd);
      must(`immutable-${letter}`, node, ['spikes/edge-comparison/extract-baseline.mjs', '--check'], cwd);
      if (letter === 'a') {
        const target = path.join(output, 'a-verification');
        must('a-boundary-verifier', node, ['spikes/envoy/strict-boundary-check.mjs', 'evidence/sprint04a-a/upstream-04', target], cwd);
      } else {
        must('c-original-manifest', 'sha256sum', ['--check', 'evidence/sprint04a-c/SHA256SUMS', '--quiet'], cwd);
        must('c-verifier', node, ['evidence/sprint04a-c/capability-refresh.mjs', 'verify', 'review-01', 'current-01'], cwd);
        preserve(path.join(cwd, 'evidence/sprint04a-c/review-01'), 'c-verification');
        must('c-refreshed-manifest', 'sha256sum', ['--check', 'evidence/sprint04a-c/SHA256SUMS', '--quiet'], cwd);
      }
    }
  } else if (mode === 'f') {
    assert.match(suppliedHead ?? '', /^[a-f0-9]{40}$/);
    const cwd = checkout('f', suppliedHead);
    receipt.immutable_schema = hash(fs.readFileSync(path.join(cwd, 'internal/configsnapshot/schema-v1.json')));
    assert.equal(receipt.immutable_schema, hash(execFileSync('git', ['show', `${baseline}:internal/configsnapshot/schema-v1.json`])));
    receipt.reviewed_f_head = suppliedHead;
    must('fixture-dependencies', npm, ['ci', '--ignore-scripts', '--strict-peer-deps'], path.join(cwd, 'spikes/pingora'));
    must('f-independent-integration', 'flock', ['/tmp/aegisgate-sprint02-fixtures.lock', node,
      path.join(root, 'evidence/sprint04a-e/f-execute.mjs'), cwd, path.join(output, 'recovery')], root);
  } else throw new Error('unknown review mode');
} catch (error) {
  receipt.error = error.stack; process.exitCode = 1;
} finally {
  receipt.ended_at = new Date().toISOString(); receipt.exit_code = process.exitCode ?? 0; save();
  const files = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), files(output).sort().map((file) => `${hash(fs.readFileSync(file))}  ${path.relative(output, file)}`).join('\n') + '\n');
}
