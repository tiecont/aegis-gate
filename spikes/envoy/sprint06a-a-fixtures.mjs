import fs from 'node:fs';
import assert from 'node:assert/strict';
export { listen, until } from './wire-fixtures.mjs';

// Docker has a different process ancestry; the host collector supplies its live lock holder.
export function assertLock() {
  const inode = fs.statSync('/tmp/aegisgate-sprint02-fixtures.lock').ino;
  const holders = new Set();
  let pid = process.ppid;
  while (pid > 1 && !holders.has(pid)) {
    holders.add(pid);
    pid = Number(fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/^PPid:\s+(\d+)/m)[1]);
  }
  if (process.env.AEGIS06A_HOST_LOCK_PID) holders.add(Number(process.env.AEGIS06A_HOST_LOCK_PID));
  assert.ok(fs.readFileSync('/proc/locks', 'utf8').split('\n').some((line) => {
    const f = line.trim().split(/\s+/);
    return f[1] === 'FLOCK' && f[3] === 'WRITE' && holders.has(Number(f[4])) && f[5]?.endsWith(`:${inode}`);
  }), 'live shared fixture lock required');
}
