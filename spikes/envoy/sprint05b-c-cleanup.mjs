import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { assertLock } from './wire-fixtures.mjs';

export async function cleanupOwned(run, versionName) {
  assertLock(); const prefix = path.resolve('.local') + '/'; const removed = [];
  // Docker can finish Create after its CLI is killed during readiness failure.
  for (let round = 0; round < 6; round++) {
    const ids = execFileSync('docker', ['ps', '-aq', '--filter', 'name=^/aegis-envoy-'], { encoding: 'utf8', timeout: 10000 }).trim().split('\n').filter(Boolean);
    if (versionName && spawnSync('docker', ['inspect', '--format', '{{.Id}}', versionName], { stdio: 'ignore', timeout: 10000 }).status === 0) ids.push(versionName);
    for (const id of ids) {
      const mounts = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .Mounts}}', id], { timeout: 10000 }));
      if (id !== versionName && !mounts.some((m) => m.Source.startsWith(prefix))) continue;
      run(`remove-${round}-${id}`, 'docker', ['rm', '--force', id]);
      assert.notEqual(spawnSync('docker', ['inspect', '--format', '{{.Id}}', id], { stdio: 'ignore', timeout: 10000 }).status, 0);
      removed.push({ id, mounts: mounts.map((m) => ({ source: m.Source, readonly: !m.RW })), round });
    }
    await delay(1000); assertLock();
  }
  return { removed, observation_rounds: 6, scope: prefix, no_pending_ownership_guarantee_beyond_observed_interval: true };
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
    assert.equal(r.status, 0);
  }
  receipt.cleanup = await cleanupOwned(run);
  receipt.ended_at = new Date().toISOString(); receipt.lock_held_through_cleanup_hashing = true;
  fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(`${output}/SHA256SUMS`, fs.readdirSync(output).sort().map((file) => `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}\n`).join(''));
}
