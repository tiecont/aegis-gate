// Collection success means complete evidence, never acceptance of a known failing candidate.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';

process.umask(0o077); assertLock();
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05a-a\/attempt-\d+$/);
const root = process.cwd();
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain'), '', 'commit clean source before runtime receipts');
assert.ok(!fs.existsSync(output), 'retain every attempt');
const hash = (b) => createHash('sha256').update(b).digest('hex');
const baseline = '541d1d915ce6a3b679dc3fed3ea0a98f908ce001';
const inventory = execFileSync('git', ['ls-tree', '-rz', baseline]);
function checkBaseline() {
  let count = 0;
  for (const entry of inventory.toString().split('\0').filter(Boolean)) {
    const [info, file] = entry.split('\t'); const [mode, kind, oid] = info.split(' ');
    assert.equal(kind, 'blob');
    const bytes = mode === '120000' ? Buffer.from(fs.readlinkSync(file)) : fs.readFileSync(file);
    const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(actual, oid, `immutable baseline object changed: ${file}`); count++;
  }
  return { commit: baseline, tree: git('rev-parse', `${baseline}^{tree}`),
    tracked_objects: count, ls_tree_sha256: hash(inventory), all_working_blobs_equal: true };
}
const protectedBefore = checkBaseline();
fs.mkdirSync(output, { recursive: true }); fs.mkdirSync('.local', { recursive: true });
const initialDirs = new Set(fs.readdirSync('.local'));
const fixture = fs.mkdtempSync(path.resolve('.local/sprint05a-a-proof-'));
const record = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'), source_clean: true,
  started_at: new Date().toISOString(), cwd: root, argv: process.argv,
  node: { version: process.version, executable: process.execPath, sha256: hash(fs.readFileSync(process.execPath)) },
  protected_baseline: protectedBefore, commands: [], fixture_lock: '/tmp/aegisgate-sprint02-fixtures.lock',
  collection_complete: false, security_acceptance: 'NO-GO; independent review and architecture/security decision pending',
  environment: { PINGORA_SPIKE_PROFILE: 'release', AEGIS_RUN_ROOT: fixture,
    AEGIS_CANDIDATE_NAME: 'envoy-sprint05a-a-te', AEGIS_CANDIDATE_COMMAND: process.execPath,
    AEGIS_CANDIDATE_ARGS: JSON.stringify([path.resolve('spikes/envoy/sprint05a-a-launcher.mjs')]),
    AEGIS_CANDIDATE_ARTIFACTS: JSON.stringify(['config.mjs', 'recovery-config.mjs', 'sprint05a-a-config.mjs', 'image.lock.json']
      .map((f) => path.resolve('spikes/envoy', f))) },
  sources: git('ls-files', 'spikes/envoy', 'spikes/edge-comparison', 'spikes/pingora/lab.mjs', 'package-lock.json')
    .split('\n').filter(Boolean).map((file) => ({ file, sha256: hash(fs.readFileSync(file)) })) };
const save = () => fs.writeFileSync(`${output}/commands.json`, JSON.stringify(record, null, 2) + '\n');
function file(name, bytes) {
  const target = `${output}/${name}`; fs.writeFileSync(target, bytes, { flag: 'wx' });
  return { file: target, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) };
}
async function run(label, argv, expected = [0], env = {}) {
  assertLock(); const started = new Date().toISOString(); const stdout = []; const stderr = [];
  const child = spawn(argv[0], argv.slice(1), { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (b) => stdout.push(b)); child.stderr.on('data', (b) => stderr.push(b));
  let timedOut = false; const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 6000).unref(); }, 180000);
  const result = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (exit, signal) => resolve({ exit, signal })); });
  clearTimeout(timer);
  const out = Buffer.concat(stdout); const err = Buffer.concat(stderr);
  record.commands.push({ label, argv, cwd: root, environment: env, started_at: started, ended_at: new Date().toISOString(),
    exit_code: result.exit, signal: result.signal, timed_out: timedOut,
    stdout: file(`${label}.stdout`, out), stderr: file(`${label}.stderr`, err) }); save();
  console.log(`${label}: exit=${result.exit}`);
  assert.equal(timedOut, false, label); assert.ok(expected.includes(result.exit), `${label}: unexpected exit ${result.exit}`);
  return out.toString();
}
async function owned() {
  const out = await run(`containers-${record.commands.length}`, ['docker', 'ps', '-a',
    '--filter', 'name=^/aegis-envoy-', '--filter', 'name=^/aegis-sprint05a-a-', '--format', '{{.ID}} {{.Names}}']);
  const found = [];
  for (const line of out.trim().split('\n').filter(Boolean)) {
    const [id, name] = line.split(' ');
    const mounts = JSON.parse(await run(`mounts-${record.commands.length}`,
      ['docker', 'inspect', '--format', '{{json .Mounts}}', id]));
    if (mounts.some((m) => m.Source.startsWith(`${root}/.local/`))) found.push(name);
  }
  return found;
}
try {
  await run('git-version', ['git', '--version']); await run('openssl-version', ['openssl', 'version']);
  await run('docker-version', ['docker', 'version', '--format', '{{json .}}']);
  const image = JSON.parse(fs.readFileSync('spikes/envoy/image.lock.json')).image;
  await run('image', ['docker', 'image', 'inspect', image, '--format', '{{.Id}} {{.Os}}/{{.Architecture}} {{json .RepoDigests}}']);
  await run('envoy-version', ['docker', 'run', '--rm', '--pull', 'never', '--network', 'none', '--entrypoint', '/usr/local/bin/envoy', image, '--version']);
  await run('node-dependencies', [process.execPath, '--input-type=module', '-e',
    "import fs from 'node:fs'; import {createRequire} from 'node:module'; const r=createRequire(import.meta.url); for(const p of ['ws','@grpc/grpc-js']) console.log(p,JSON.parse(fs.readFileSync(r.resolve(p+'/package.json'))).version);"]);
  await run('immutable-manifest', [process.execPath, 'spikes/edge-comparison/extract-baseline.mjs', '--check']);
  await run('protected-tests', [process.execPath, '--test', 'spikes/edge-comparison/contract.test.mjs', 'spikes/edge-comparison/evaluate.test.mjs']);
  await run('candidate-config-test', [process.execPath, '--test', 'spikes/envoy/sprint05a-a-config.test.mjs']);
  await run('focused', [process.execPath, 'spikes/envoy/sprint05a-a-focused.mjs', path.resolve(output, 'focused.json'), path.join(fixture, 'focused')]);
  const focused = JSON.parse(fs.readFileSync(`${output}/focused.json`)); assert.equal(focused.completed, true);
  record.focused = { completed: true, probes: focused.probes.length,
    baseline_original_failures: focused.probes.filter((p) => p.name.startsWith('baseline:') && p.historical_name && !p.original_assertion_pass).length,
    candidate_original_passes: focused.probes.filter((p) => p.name.startsWith('candidate:') && p.historical_name && p.original_assertion_pass).length };
  const stdout = await run('full75', [process.execPath, 'spikes/edge-comparison/run.mjs'], [0, 1], record.environment);
  const matches = [...stdout.matchAll(/^Evidence: (.+)$/gm)]; assert.equal(matches.length, 1);
  const resultFile = matches[0][1]; assert.ok(resultFile.startsWith(`${fixture}/edge-proof-run-`));
  const raw = fs.readFileSync(resultFile); file('full75.json', raw);
  const results = JSON.parse(raw); assert.ok(!results.fatal, results.fatal); assert.equal(results.tests.length, 75);
  await run('evaluate', [process.execPath, 'spikes/edge-comparison/evaluate.mjs', `${output}/full75.json`], [0, 1]);
  record.full75 = { total: results.tests.length, passed: results.tests.filter((t) => t.status === 'pass').length,
    failures: results.tests.filter((t) => t.status === 'fail'), result: results.result };
  file('proxy.log', fs.readFileSync(path.join(path.dirname(resultFile), 'proxy.log')));
  for (const [i, dir] of fs.readdirSync('.local').filter((d) => !initialDirs.has(d) && /^(envoy-run-|sprint05a-a-envoy-)/.test(d)).entries()) {
    for (const name of ['bootstrap.json', 'resources.jsonl']) if (fs.existsSync(`.local/${dir}/${name}`))
      file(`launcher-${i}-${name}`, fs.readFileSync(`.local/${dir}/${name}`));
  }
  record.collection_complete = true;
} catch (e) { record.error = e.stack; process.exitCode = 1; }
finally {
  record.cleanup = { lock_held: true, stopped: [] };
  try {
    for (const name of await owned()) { await run(`stop-${record.commands.length}`, ['docker', 'stop', '--timeout', '2', name]); record.cleanup.stopped.push(name); }
    record.cleanup.remaining_owned_containers = await owned(); assert.deepEqual(record.cleanup.remaining_owned_containers, []);
    for (const dir of fs.readdirSync('.local')) if (!initialDirs.has(dir) && /^(envoy-run-|sprint05a-a-envoy-|sprint05a-a-proof-)/.test(dir))
      fs.rmSync(path.join('.local', dir), { recursive: true, force: true });
    record.cleanup.fixture_removed = !fs.existsSync(fixture); assert.equal(record.cleanup.fixture_removed, true);
    record.cleanup.new_owned_directories = fs.readdirSync('.local').filter((d) => !initialDirs.has(d));
    assert.deepEqual(record.cleanup.new_owned_directories, []);
    record.protected_baseline_after = checkBaseline();
    for (const source of record.sources) assert.equal(hash(fs.readFileSync(source.file)), source.sha256);
  } catch (e) { record.cleanup.error = e.stack; process.exitCode = 1; }
  assertLock(); record.ended_at = new Date().toISOString(); save();
  const files = fs.readdirSync(output).sort();
  fs.writeFileSync(`${output}/SHA256SUMS`, files.map((f) => `${hash(fs.readFileSync(`${output}/${f}`))}  ${output}/${f}`).join('\n') + '\n');
}
