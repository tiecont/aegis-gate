import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { assertLock } from './wire-fixtures.mjs';

export async function cleanupOwned(run, versionName, createdOnly = false) {
  assertLock(); const prefix = path.resolve('.local') + '/'; const removed = [], inspected = [];
  const names = ['aegis-envoy-', 'aegis-sprint05a-a-', 'aegis-sprint05b-c-'];
  // Docker can finish Create after its CLI is killed during readiness failure.
  for (let round = 0; round < 6; round++) {
    const candidates = new Map();
    // Enumerate prefixes separately, then union IDs; never combine name filters.
    for (const [index, name] of names.entries()) {
      const result = run(`inventory-${round}-${index}`, 'docker', ['ps', '-a', '--filter', `name=^/${name}`,
        '--format', '{{.ID}} {{.State}}']);
      for (const line of result.stdout.toString().trim().split('\n').filter(Boolean)) {
        const [id, state] = line.split(' '); assert.match(id, /^[a-f0-9]+$/); candidates.set(id, state);
      }
    }
    if (versionName && spawnSync('docker', ['inspect', '--format', '{{.Id}}', versionName], { stdio: 'ignore', timeout: 10000 }).status === 0 && !createdOnly) candidates.set(versionName, 'owned-version');
    for (const [id, state] of candidates) {
      const mounts = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .Mounts}}', id], { timeout: 10000 }));
      if (id !== versionName && !mounts.some((m) => m.Source.startsWith(prefix))) continue;
      const stateError = execFileSync('docker', ['inspect', '--format', '{{json .State.Error}}', id], { encoding: 'utf8', timeout: 10000 });
      inspected.push({ id, state, state_error: JSON.parse(stateError), mounts: mounts.map((m) => ({ source: m.Source, readonly: !m.RW })), round });
      if (createdOnly && state !== 'created') continue;
      run(`remove-${round}-${id}`, 'docker', ['rm', '--force', id]);
      assert.notEqual(spawnSync('docker', ['inspect', '--format', '{{.Id}}', id], { stdio: 'ignore', timeout: 10000 }).status, 0);
      removed.push({ id, mounts: mounts.map((m) => ({ source: m.Source, readonly: !m.RW })), round });
    }
    await delay(1000); assertLock();
  }
  return { removed, inspected, created_only: createdOnly, enumeration: 'separate name-prefix queries; union by ID',
    observation_rounds: 6, scope: prefix, no_pending_ownership_guarantee_beyond_observed_interval: true };
}

if (process.argv[1] === import.meta.filename) {
  process.umask(0o077); assertLock(); const output = process.argv[2];
  assert.match(output ?? '', /^evidence\/sprint05b-c\/cleanup-\d+$/); assert.ok(!fs.existsSync(output));
  fs.mkdirSync(output, { recursive: true });
  const sha = (b) => createHash('sha256').update(b).digest('hex');
  const receipt = { argv: process.argv, started_at: new Date().toISOString(),
    source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), commands: [] };
  function run(label, program, args) {
    assertLock(); const r = spawnSync(program, args, { timeout: 15000 });
    for (const name of ['stdout', 'stderr']) fs.writeFileSync(`${output}/${label}.${name}`, r[name] ?? '');
    receipt.commands.push({ label, program, args, exit_code: r.status, signal: r.signal, error: r.error?.message });
    assert.equal(r.status, 0); return r;
  }
  receipt.cleanup = await cleanupOwned(run, undefined, process.argv[3] === '--created-only');
  receipt.ended_at = new Date().toISOString(); receipt.lock_held_through_cleanup_hashing = true;
  fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(`${output}/SHA256SUMS`, fs.readdirSync(output).sort().map((file) => `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}\n`).join(''));
}
