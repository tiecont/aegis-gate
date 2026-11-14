import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';

const pinned = '578d78f3465d5a4cbb9587a0e03be975b33cd1c9';
const source = execFileSync('git', ['show', `${pinned}:scripts/sprint04c-gates.mjs`], { encoding: 'utf8' });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const privatePaths = [
  '.local/pki', '.local/postgres-password', '.local/redis-password', '.local/nats-token',
  '.local/redis.conf', '.local/nats.conf', '.local/compose.env', '.local/evidence/security/compose-config.json',
];
const cases = [
  { mode: 'clean', faults: [] },
  { mode: 'synthetic-value-leak', faults: ['value-leak'], errors: ['private-evidence-validation'] },
  { mode: 'synthetic-key-marker', faults: ['key-marker'], errors: ['private-evidence-validation'] },
  ...['dev-down', 'compose-down'].flatMap(stage => [
    { mode: `${stage}-throw`, faults: [`${stage}-throw`], errors: [stage] },
    { mode: `${stage}-error-event`, faults: [`${stage}-error-event`] },
    { mode: `${stage}-nonzero`, faults: [`${stage}-nonzero`] },
  ]),
  ...['container', 'network', 'volume'].flatMap(kind => [
    { mode: `${kind}-inventory-throw`, faults: [`${kind}-inventory-throw`], errors: [`${kind}-inventory`] },
    { mode: `${kind}-inventory-nonempty`, faults: [`${kind}-inventory-nonempty`] },
  ]),
  ...['mkdir', 'readdir', 'copy'].map(action => ({
    mode: `evidence-${action}-throw`, faults: [`evidence-${action}-throw`], errors: ['scanner-evidence-copy'],
  })),
  { mode: 'validation-read-throw', faults: ['validation-read-throw'], errors: ['private-evidence-validation'] },
  ...privatePaths.map(file => ({ mode: `remove-throw:${file}`, faults: [`remove-throw:${file}`], errors: [`remove:${file}`] })),
  { mode: 'remove-silent-noop', faults: ['remove-silent-noop'] },
  { mode: 'check-nonzero', faults: ['check-nonzero'] },
  { mode: 'check-throw', faults: ['check-throw'] },
  { mode: 'combined-failures', faults: ['dev-down-throw', 'compose-down-error-event', 'container-inventory-throw', 'evidence-copy-throw', 'value-leak', 'remove-throw:.local/pki', 'network-inventory-throw', 'volume-inventory-throw'], errors: ['dev-down', 'container-inventory', 'scanner-evidence-copy', 'private-evidence-validation', 'remove:.local/pki', 'network-inventory', 'volume-inventory'] },
  { mode: 'lock-missing-at-entry', faults: ['lock-missing-at-entry'], abort: true },
  { mode: 'lock-lost-before-cleanup', faults: ['lock-lost-before-cleanup'], abort: true },
];
const results = [];
for (const test of cases) {
  const { mode, faults } = test;
  const has = fault => faults.includes(fault);
  const output = 'evidence/sprint04c-root/gates-synthetic';
  const security = '.local/evidence/security';
  const synthetic = 'synthetic-fixture-value-for-fault-injection';
  const files = new Map([
    ['.local/postgres-password', Buffer.from(synthetic)],
    ['.local/pki/valid.jwt', Buffer.from('synthetic-non-token')],
    ['.local/redis-password', Buffer.from('synthetic-redis-value')],
    ['.local/nats-token', Buffer.from('synthetic-nats-value')],
    ['.local/redis.conf', Buffer.from('synthetic-config')],
    ['.local/nats.conf', Buffer.from('synthetic-config')],
    ['.local/compose.env', Buffer.from('synthetic-config')],
    ['.local/evidence/security/compose-config.json', Buffer.from('excluded-rendered-config')],
    ['.local/evidence/security/safe.json', Buffer.from('{"findings":[]}')],
    ['.local/evidence/security/safe.log', Buffer.from('synthetic scanner log')],
    ['.local/evidence/security/safe.tsv', Buffer.from('synthetic\tscanner')],
    ['.local/evidence/security/ignored.txt', Buffer.from('excluded-extension')],
    ['.local/unrelated-sentinel', Buffer.from('must survive')],
    ['unrelated/sentinel', Buffer.from('must survive')],
    ['/synthetic/node', Buffer.from('synthetic-node-binary')],
  ]);
  const directories = new Set([security]);
  const descriptors = new Map();
  const commands = [];
  const logs = [];
  const events = [];
  const removalAttempts = [];
  const copies = [];
  let nextFd = 10;
  let lockCalls = 0;
  let lockHeld = !has('lock-missing-at-entry');
  let lockEpoch = 0;
  const failure = fault => { if (has(fault)) throw new Error(`synthetic fault: ${fault}`); };
  // Consume a successful guard at each stage boundary, including every removal.
  const guarded = operation => {
    assert.ok(lockHeld, `unguarded operation: ${operation}`);
    assert.ok(lockCalls > lockEpoch, `missing fresh lock guard: ${operation}`);
    lockEpoch = lockCalls;
    events.push({ operation, guard: lockCalls });
  };
  const exists = file => files.has(file) || directories.has(file) || [...files.keys()].some(f => f.startsWith(`${file}/`));
  const fakeFs = {
    existsSync: exists,
    mkdirSync(file) {
      guarded(`mkdir:${file}`);
      if (file === `${output}/security`) failure('evidence-mkdir-throw');
      directories.add(file);
    },
    readFileSync(file) {
      if (file === '.local/postgres-password') { guarded('private-evidence-validation'); failure('validation-read-throw'); }
      assert.ok(files.has(file), `missing synthetic file ${file}`); return files.get(file);
    },
    writeFileSync(file, bytes) {
      if (file === `${output}/commands.json` && JSON.parse(bytes).ended_at) guarded('final-receipt');
      assert.ok(lockHeld, `write without lock: ${file}`);
      files.set(file, Buffer.from(bytes));
      if (file.endsWith('/SHA256SUMS')) events.push({ operation: 'final-manifest', guard: lockCalls });
    },
    openSync(file) { assert.ok(!files.has(file)); files.set(file, Buffer.alloc(0)); descriptors.set(nextFd, file); return nextFd++; },
    closeSync(fd) { assert.ok(descriptors.has(fd)); descriptors.delete(fd); },
    copyFileSync(a, b) {
      copies.push([a, b]); failure('evidence-copy-throw');
      assert.ok(files.has(a)); files.set(b, Buffer.from(files.get(a)));
    },
    readdirSync(directory, options) {
      if (directory === security) failure('evidence-readdir-throw');
      const names = new Map();
      for (const file of [...files.keys(), ...directories]) {
        if (!file.startsWith(`${directory}/`)) continue;
        const relative = file.slice(directory.length + 1);
        const name = relative.split('/')[0];
        names.set(name, names.get(name) || relative.includes('/') || directories.has(file));
      }
      return [...names].map(([name, isDirectory]) => options?.withFileTypes ? { name, isDirectory: () => isDirectory } : name);
    },
    rmSync(file, options) {
      guarded(`remove:${file}`);
      assert.equal(options.recursive, true); assert.equal(options.force, true);
      removalAttempts.push(file); failure(`remove-throw:${file}`);
      if (has('remove-silent-noop') && file === '.local/pki') return;
      for (const key of [...files.keys()]) if (key === file || key.startsWith(`${file}/`)) files.delete(key);
      for (const key of [...directories]) if (key === file || key.startsWith(`${file}/`)) directories.delete(key);
    },
  };
  const childProcess = {
    execFileSync(command, args) {
      if (command === 'git') {
        if (args[0] === 'status') return '';
        return args.at(-1).includes('tree') ? 'synthetic-tree' : pinned;
      }
      assert.equal(command, 'docker');
      const kind = args[0] === 'ps' ? 'container' : args[0];
      assert.ok(['container', 'network', 'volume'].includes(kind));
      assert.ok(args.includes('label=com.docker.compose.project=aegisgate-04c-root'));
      guarded(`${kind}-inventory`);
      commands.push(['inventory', ...args]);
      failure(`${kind}-inventory-throw`);
      return has(`${kind}-inventory-nonempty`) ? `synthetic-${kind}-id\n` : '';
    },
    spawn(command, args, options) {
      const stage = command === 'docker' ? 'compose-down' : ({ check: 'check', 'security-scan': 'security-scan', 'dev-down': 'dev-down' })[args[0]];
      assert.ok(stage, 'unexpected child command');
      guarded(`spawn:${stage}`);
      commands.push([command, ...args]);
      failure(`${stage}-throw`);
      if (stage === 'check' && (has('value-leak') || has('key-marker'))) {
        files.set(descriptors.get(options.stdio[1]), Buffer.from(has('value-leak') ? synthetic : '-----BEGIN PRIVATE KEY-----'));
      }
      const event = new EventEmitter();
      queueMicrotask(() => {
        if (has('lock-lost-before-cleanup') && stage === 'security-scan') lockHeld = false;
        if (has(`${stage}-error-event`)) event.emit('error', new Error(`synthetic fault: ${stage}-error-event`));
        else event.emit('exit', has(`${stage}-nonzero`) ? 7 : 0, null);
      });
      return event;
    },
  };
  const fakeProcess = { argv: ['/synthetic/node', 'helper', output], env: {}, execPath: '/synthetic/node', version: process.version, cwd: () => '/synthetic', exitCode: null };
  const context = vm.createContext({ Buffer, process: fakeProcess, console: { log: line => logs.push(line) } });
  const modules = new Map([
    ['node:assert/strict', { default: assert }], ['node:fs', { default: fakeFs }],
    ['node:path', { default: path }], ['node:crypto', { createHash }],
    ['node:child_process', childProcess],
    ['../spikes/envoy/wire-fixtures.mjs', { assertLock() { lockCalls++; assert.ok(lockHeld, 'synthetic fixture lock unavailable'); } }],
  ]);
  const module = new vm.SourceTextModule(source, { context, identifier: 'pinned-gate-helper' });
  await module.link(specifier => {
    const exports = modules.get(specifier); assert.ok(exports, specifier);
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  });
  let evaluationError;
  try { await module.evaluate({ timeout: 5000 }); } catch (error) { evaluationError = error; }
  if (test.abort) {
    assert.match(evaluationError?.message ?? '', /synthetic fixture lock unavailable/);
    assert.equal(fakeProcess.exitCode, null);
    assert.deepEqual(removalAttempts, []);
    assert.ok(exists('.local/pki/valid.jwt') && exists('.local/postgres-password'));
    assert.ok(!files.has(`${output}/SHA256SUMS`));
    if (has('lock-missing-at-entry')) { assert.equal(commands.length, 0); assert.ok(!exists(output)); }
    else {
      const incomplete = JSON.parse(files.get(`${output}/commands.json`));
      assert.equal(incomplete.lock_held_through_cleanup, undefined);
      assert.equal(incomplete.passed, undefined);
      assert.equal(commands.filter(row => row[0] === 'make').length, 2);
    }
    results.push({ mode, expected_abort: true, error: evaluationError.message, lock_assertions: lockCalls, events });
    continue;
  }
  assert.equal(evaluationError, undefined, `${mode}: module evaluation escaped cleanup`);
  const receipt = JSON.parse(files.get(`${output}/commands.json`));
  assert.equal(fakeProcess.exitCode, mode === 'clean' ? 0 : 1, JSON.stringify(receipt.cleanup_errors));
  assert.equal(receipt.passed, mode === 'clean');
  assert.ok(Date.parse(receipt.ended_at) >= Date.parse(receipt.started_at));
  assert.deepEqual(removalAttempts, privatePaths);
  const failedRemovals = privatePaths.filter(file => has(`remove-throw:${file}`));
  assert.equal(receipt.private_fixture_cleanup.length, 8 - failedRemovals.length);
  for (const file of privatePaths) {
    const remains = failedRemovals.includes(file) || (has('remove-silent-noop') && file === '.local/pki');
    assert.equal(exists(file), remains, `${mode}: ${file}`);
    if (!failedRemovals.includes(file)) assert.equal(receipt.private_fixture_cleanup.find(entry => entry.file === file)?.exists, remains);
  }
  assert.ok(exists('.local/unrelated-sentinel') && exists('unrelated/sentinel'));
  for (const kind of ['container', 'network', 'volume']) {
    const ids = receipt[`remaining_project_${kind === 'container' ? 'containers' : `${kind}s`}`];
    assert.deepEqual(ids, has(`${kind}-inventory-throw`) ? undefined : has(`${kind}-inventory-nonempty`) ? [`synthetic-${kind}-id`] : []);
  }
  assert.deepEqual((receipt.cleanup_errors ?? []).map(entry => entry.label), test.errors ?? []);
  if (has('value-leak') || has('key-marker')) assert.match(receipt.cleanup_errors.find(entry => entry.label === 'private-evidence-validation').error, /private .* retained gate evidence/);
  for (const error of receipt.cleanup_errors ?? []) assert.ok(error.error.length > 0);
  assert.equal(receipt.private_material_check?.matches, (test.errors ?? []).includes('private-evidence-validation') ? undefined : 0);
  assert.equal(receipt.lock_held_through_cleanup, true);
  const expectedRuns = has('check-throw') ? 3 : 4;
  const spawnThrows = faults.filter(fault => /^(check|dev-down|compose-down)-throw$/.test(fault)).length;
  assert.equal(lockCalls, 1 + 2 * expectedRuns - spawnThrows + 15 + 1);
  assert.equal(descriptors.size, spawnThrows * 2);
  assert.equal(commands.filter(row => row[0] === 'inventory').length, 3);
  assert.equal(receipt.commands.length, expectedRuns - spawnThrows);
  if (has('check-throw')) assert.match(receipt.error, /synthetic fault: check-throw/);
  for (const record of receipt.commands) {
    const stage = ({ cleanup: 'dev-down', 'cleanup-volumes': 'compose-down' })[record.label] ?? record.label;
    assert.equal(record.exit_code, has(`${stage}-error-event`) ? null : has(`${stage}-nonzero`) ? 7 : 0);
    if (has(`${stage}-error-event`)) assert.match(record.error, /synthetic fault:/);
    for (const stream of record.streams) assert.equal(stream.sha256, sha(files.get(stream.file)));
  }
  assert.ok(!logs.join('').includes(synthetic));
  assert.ok(!JSON.stringify(receipt).includes(synthetic));
  assert.ok(!exists(`${output}/security/compose-config.json`) && !exists(`${output}/security/ignored.txt`));
  assert.ok(copies.every(([file]) => /safe\.(json|log|tsv)$/.test(file)));
  if (!faults.some(fault => /^evidence-.*-throw$/.test(fault))) assert.equal(copies.length, 3);
  const manifest = files.get(`${output}/SHA256SUMS`).toString().trim().split('\n');
  const retained = [...files.keys()].filter(file => file.startsWith(`${output}/`) && !file.endsWith('/SHA256SUMS'));
  assert.equal(manifest.length, retained.length);
  for (const line of manifest) {
    const [digest, file] = line.split('  '); assert.ok(retained.includes(file)); assert.equal(digest, sha(files.get(file)));
  }
  assert.equal(events.at(-1).operation, 'final-manifest');
  assert.equal(events.at(-2).operation, 'final-receipt');
  // Export receipt structure without hashes of deliberately contaminated synthetic streams.
  const safeReceipt = { ...receipt, commands: receipt.commands.map(({ streams, ...record }) => ({ ...record, streams: streams.map(({ file }) => ({ file, hash_verified_in_memory: true })) })) };
  results.push({ mode, exit_code: fakeProcess.exitCode, passed: receipt.passed, lock_assertions: lockCalls, descriptor_residue_on_synchronous_spawn_throw: descriptors.size, no_values_in_logs_or_receipt: true, manifest_verified: true, events, receipt: safeReceipt });
}
console.log(JSON.stringify({ scope: 'Independent F synthetic in-memory fault injection only; no real gates, Docker, scanners or fixtures; no full gate/security acceptance', pinned_source: pinned, source_sha256: sha(source), cases: results.length, results }, null, 2));
