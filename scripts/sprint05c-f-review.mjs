import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { assertLock } from '../spikes/envoy/wire-fixtures.mjs';

assertLock();
process.umask(0o077);
const [mode, revision, output] = process.argv.slice(2);
assert.ok(['a', 'b', 'c', 'd', 'e'].includes(mode));
assert.match(output ?? '', /^evidence\/sprint05c-f\/[a-z0-9-]+$/);
assert.ok(!fs.existsSync(output));
const root = process.cwd();
const upstream = '/home/tiecont/Projects/aegis-gate';
const node = `${upstream}/.local/toolchains/node/bin/node`;
const goRoot = '/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 << 20 }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
const commit = git('rev-parse', `${revision}^{commit}`);
const clone = path.join('/home/tiecont/.cache/aegisgate-sprint05c-f', `${mode}-${commit.slice(0, 12)}-${path.basename(output)}`);
assert.ok(!fs.existsSync(clone));
fs.mkdirSync(output, { recursive: true });
const record = {
  reviewer_commit: git('rev-parse', 'HEAD'), reviewer_tree: git('rev-parse', 'HEAD^{tree}'),
  collector_sha256: sha(fs.readFileSync(import.meta.filename)),
  source_commit: commit, source_tree: git('rev-parse', `${commit}^{tree}`),
  argv: process.argv, cwd: root, mode, clone, started_at: new Date().toISOString(),
  fixture_lock: '/tmp/aegisgate-sprint02-fixtures.lock',
  node: { path: node, version: process.version, sha256: sha(fs.readFileSync(node)) },
  go: { path: `${goRoot}/bin/go`, sha256: sha(fs.readFileSync(`${goRoot}/bin/go`)) },
  commands: [], observations_complete: false, semantic_security_pass: false,
};
assert.equal(record.node.sha256, '0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b');
assert.equal(record.go.sha256, 'de0ae3e082ce7599eae4fb69fa2ef1e43b8f31ffd3fce62cdf81930aa9005050');
const save = () => fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(record, null, 2) + '\n');
async function run(label, program, args, { cwd = clone, env = {}, timeout = 900000 } = {}) {
  assertLock();
  const started_at = new Date().toISOString();
  const child = spawn(program, args, { cwd, env: { ...process.env,
    PATH: `${path.dirname(node)}:${goRoot}/bin:${process.env.PATH}`,
    GOTOOLCHAIN: 'local', GOWORK: 'off', GOAMD64: 'v1', GOFLAGS: '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  const stdout = [], stderr = [];
  child.stdout.on('data', (b) => stdout.push(b));
  child.stderr.on('data', (b) => stderr.push(b));
  let error, timedOut = false;
  child.on('error', (e) => { error = e.message; });
  const timer = setTimeout(() => {
    timedOut = true;
    process.kill(-child.pid, 'SIGTERM');
  }, timeout);
  const [exit_code, signal] = await new Promise((resolve) => child.once('close', (...values) => resolve(values)));
  clearTimeout(timer);
  const streams = ['stdout', 'stderr'].map((name, i) => {
    const bytes = Buffer.concat(i ? stderr : stdout), file = `${label}.${name}`;
    fs.writeFileSync(`${output}/${file}`, bytes);
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  record.commands.push({ label, program, binary_sha256: fs.existsSync(program) ? sha(fs.readFileSync(program)) : null,
    args, cwd, environment: { GOTOOLCHAIN: 'local', GOWORK: 'off', GOAMD64: 'v1', GOFLAGS: '', ...env },
    started_at, ended_at: new Date().toISOString(), exit_code, signal, error, timedOut, streams });
  save();
  console.log(`${mode}/${label}: exit=${exit_code}`);
  return { exit_code, stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString() };
}
const checked = async (...args) => {
  const result = await run(...args);
  assert.equal(result.exit_code, 0, args[0]);
  return result;
};
function inventory() {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: clone }).toString().split('\0').filter(Boolean);
  return files.map((file) => ({ file, sha256: sha(fs.readFileSync(path.join(clone, file))) }));
}
const captures = [];
try {
  fs.mkdirSync(path.dirname(clone), { recursive: true });
  await checked('clone', 'git', ['clone', '--shared', '--no-checkout', root, clone], { cwd: root });
  await checked('checkout', 'git', mode === 'a' ? ['checkout', '-b', 'feat/sprint05c-strict-ingress', commit] : ['checkout', '--detach', commit]);
  record.clean_before = (await checked('clean-before', 'git', ['status', '--porcelain'])).stdout.trim();
  assert.equal(record.clean_before, '');
  record.sources = inventory();
  fs.mkdirSync(`${clone}/.local`, { recursive: true });
  fs.mkdirSync(`${clone}/.local/sprint05c-f-tmp`, { recursive: true });
  process.env.TMPDIR = `${clone}/.local/sprint05c-f-tmp`;
  fs.symlinkSync(`${upstream}/.local/toolchains`, `${clone}/.local/toolchains`);
  await checked('protected-before', node, ['scripts/sprint05b-baseline.mjs']);
  if (mode === 'd') {
    await checked('go-version', `${goRoot}/bin/go`, ['version']);
    record.observer_suite_exit = (await run('original-observer', `${goRoot}/bin/go`, ['test', '-race', '-json', './spikes/envoy/sprint05c-attribution', '-count=1'])).exit_code;
    assert.ok([0, 1].includes(record.observer_suite_exit));
    const attack = path.join(root, 'scripts/sprint05c-f-observer_test.go');
    const virtual = path.join(clone, 'spikes/envoy/sprint05c-attribution/sprint05c_f_review_test.go');
    const overlay = path.join(clone, '.local/sprint05c-f-overlay.json');
    fs.writeFileSync(overlay, JSON.stringify({ Replace: { [virtual]: attack } }) + '\n');
    record.overlay = { file: attack, sha256: sha(fs.readFileSync(attack)), virtual, overlay_sha256: sha(fs.readFileSync(overlay)) };
    record.attack_exit = (await run('observer-attacks', `${goRoot}/bin/go`, ['test', `-overlay=${overlay}`, '-race', '-json', './spikes/envoy/sprint05c-attribution', '-run', '^TestSprint05CF', '-count=1'])).exit_code;
    assert.ok([0, 1].includes(record.attack_exit));
  } else if (mode === 'b') {
    captures.push('evidence/sprint05c-b/f-independent-01');
    await checked('b-original-matrix', node, ['spikes/envoy/sprint05c-b-run.mjs', captures[0]]);
    captures.push('evidence/sprint05c-b/f-verify-01');
    await checked('b-verifier', node, ['spikes/envoy/sprint05c-b-verify.mjs', captures[1]]);
  } else if (mode === 'e') {
    captures.push('evidence/sprint05c-e/attempt-901');
    await checked('e-regressions', node, ['scripts/sprint05c-e-regressions.mjs', captures[0]], { env: { GOTOOLCHAIN: 'go1.27.4' } });
  } else if (mode === 'a') {
    captures.push('evidence/sprint05c-a/run-901');
    record.a_proof_exit = (await run('a-wire-proof', node, ['spikes/envoy/sprint05c-a-proof.mjs', captures[0]])).exit_code;
    assert.ok([0, 1].includes(record.a_proof_exit));
    await checked('a-stream-admission', node, [path.join(root, 'scripts/sprint05c-f-ingress.mjs'), clone, path.resolve(output, 'a-stream-admission.json')]);
  } else if (mode === 'c') {
    await checked('spike-install', path.join(path.dirname(node), 'npm'), ['--prefix', 'spikes/pingora', 'ci', '--ignore-scripts', '--strict-peer-deps']);
    captures.push('evidence/sprint05b-f/candidate-901');
    await checked('unchanged-envoy-originals', node, ['spikes/envoy/sprint05a-combined-run.mjs', captures[0]], { env: {
      AEGIS_05B_NATIVE_BINARY: `${upstream}/.local/sprint05b-native/envoy`,
    } });
  }
  await checked('protected-after', node, ['scripts/sprint05b-baseline.mjs']);
  const after = inventory();
  assert.deepEqual(after, record.sources, 'tracked source bytes changed');
  record.clean_tracked_after = (await checked('clean-after', 'git', ['status', '--porcelain', '--untracked-files=no'])).stdout.trim();
  assert.equal(record.clean_tracked_after, '');
  record.observations_complete = true;
} catch (error) {
  record.error = error.stack;
} finally {
  assertLock();
  record.captures = [];
  for (const [i, original] of captures.entries()) {
    if (!fs.existsSync(`${clone}/${original}`)) continue;
    const preserved = `${output}/capture-${i + 1}`;
    fs.cpSync(`${clone}/${original}`, preserved, { recursive: true });
    record.captures.push({ original, preserved });
  }
  record.lock_held_through_capture_and_hashes = true;
  record.ended_at = new Date().toISOString();
  save();
  const files = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = `${dir}/${name}`;
      if (fs.statSync(file).isDirectory()) walk(file);
      else files.push(file);
    }
  }
  walk(output);
  fs.writeFileSync(`${output}/SHA256SUMS`, files.map((file) => `${sha(fs.readFileSync(file))}  ${file}\n`).join(''));
}
process.exitCode = record.observations_complete ? 0 : 1;
