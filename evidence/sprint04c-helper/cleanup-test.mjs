import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';

const pinned = 'cb9c30904e3430793d9847d9b9bf3eec3a8d052f';
const source = execFileSync('git', ['show', `${pinned}:scripts/sprint04c-gates.mjs`], { encoding: 'utf8' });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const results = [];
for (const mode of ['clean', 'synthetic-value-leak', 'synthetic-key-marker']) {
  const output = 'evidence/sprint04c-root/gates-synthetic';
  const synthetic = 'synthetic-fixture-value-for-fault-injection';
  const files = new Map([
    ['.local/postgres-password', Buffer.from(synthetic)],
    ['.local/pki/valid.jwt', Buffer.from('synthetic-non-token')],
    ['.local/redis.conf', Buffer.from('synthetic-config')],
    ['.local/evidence/security/compose-config.json', Buffer.from('excluded-rendered-config')],
    ['/synthetic/node', Buffer.from('synthetic-node-binary')],
  ]);
  const directories = new Set(['.local/evidence/security']);
  const descriptors = new Map();
  const commands = [];
  const logs = [];
  let nextFd = 10;
  let lockCalls = 0;
  const exists = file => files.has(file) || directories.has(file) || [...files.keys()].some(f => f.startsWith(`${file}/`));
  const fakeFs = {
    existsSync: exists,
    mkdirSync(file) { directories.add(file); },
    readFileSync(file) { assert.ok(files.has(file), `missing synthetic file ${file}`); return files.get(file); },
    writeFileSync(file, bytes) { files.set(file, Buffer.from(bytes)); },
    openSync(file) { assert.ok(!files.has(file)); files.set(file, Buffer.alloc(0)); descriptors.set(nextFd, file); return nextFd++; },
    closeSync(fd) { assert.ok(descriptors.has(fd)); descriptors.delete(fd); },
    copyFileSync(a, b) { files.set(b, files.get(a)); },
    readdirSync(directory, options) {
      const names = new Map();
      for (const file of [...files.keys(), ...directories]) {
        if (!file.startsWith(`${directory}/`)) continue;
        const relative = file.slice(directory.length + 1);
        const name = relative.split('/')[0];
        names.set(name, names.get(name) || relative.includes('/') || directories.has(file));
      }
      return [...names].map(([name, isDirectory]) => options?.withFileTypes ? { name, isDirectory: () => isDirectory } : name);
    },
    rmSync(file) {
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
      commands.push(['inventory', ...args]);
      return '';
    },
    spawn(command, args, options) {
      commands.push([command, ...args]);
      if (args[0] === 'check' && mode !== 'clean') {
        files.set(descriptors.get(options.stdio[1]), Buffer.from(mode === 'synthetic-value-leak' ? synthetic : '-----BEGIN PRIVATE KEY-----'));
      }
      const event = new EventEmitter();
      queueMicrotask(() => event.emit('exit', 0, null));
      return event;
    },
  };
  const fakeProcess = { argv: ['/synthetic/node', 'helper', output], env: {}, execPath: '/synthetic/node', version: process.version, cwd: () => '/synthetic', exitCode: null };
  const context = vm.createContext({ Buffer, process: fakeProcess, console: { log: line => logs.push(line) } });
  const modules = new Map([
    ['node:assert/strict', { default: assert }], ['node:fs', { default: fakeFs }],
    ['node:path', { default: path }], ['node:crypto', { createHash }],
    ['node:child_process', childProcess],
    ['../spikes/envoy/wire-fixtures.mjs', { assertLock() { lockCalls++; } }],
  ]);
  const module = new vm.SourceTextModule(source, { context, identifier: 'pinned-gate-helper' });
  await module.link(specifier => {
    const exports = modules.get(specifier); assert.ok(exports, specifier);
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  });
  await module.evaluate({ timeout: 5000 });
  const receipt = JSON.parse(files.get(`${output}/commands.json`));
  assert.equal(fakeProcess.exitCode, mode === 'clean' ? 0 : 1);
  assert.equal(receipt.passed, mode === 'clean');
  assert.equal(receipt.private_fixture_cleanup.length, 8);
  assert.ok(receipt.private_fixture_cleanup.every(entry => entry.exists === false));
  assert.deepEqual(receipt.remaining_project_networks, []);
  assert.deepEqual(receipt.remaining_project_volumes, []);
  assert.equal(receipt.lock_held_through_cleanup, true);
  assert.ok(lockCalls >= 15);
  assert.equal(descriptors.size, 0);
  assert.equal(commands.filter(row => row[0] === 'make').length, 3);
  assert.ok(!logs.join('').includes(synthetic));
  assert.ok(!JSON.stringify(receipt).includes(synthetic));
  if (mode !== 'clean') assert.match(receipt.private_material_error, /private .* retained gate evidence/);
  assert.ok(!exists('.local/postgres-password') && !exists('.local/pki') && !exists('.local/evidence/security/compose-config.json'));
  results.push({ mode, exit_code: fakeProcess.exitCode, passed: receipt.passed, cleanup_paths: receipt.private_fixture_cleanup.length, lock_assertions: lockCalls, no_values_in_logs_or_receipt: true });
}
console.log(JSON.stringify({ scope: 'Synthetic in-memory fault injection only; no real gates, Docker, fixtures or security acceptance', pinned_source: pinned, source_sha256: sha(source), results }, null, 2));
