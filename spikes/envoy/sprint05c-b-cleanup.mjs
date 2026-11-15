// Recover only B-owned native processes/directories while holding shared lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { assertLock } from './wire-fixtures.mjs';
export async function cleanupOwned() {
  assertLock(); const root = process.cwd(), found = [];
  for (const name of fs.readdirSync('/proc').filter((s) => /^\d+$/.test(s))) {
    const pid = Number(name); if (pid===process.pid) continue;
    try {
      const args = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
      const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
      if (cwd!==root) continue;
      if (args.some((s)=>s.startsWith(path.resolve('.local/sprint05c-b-proof-')) && s.endsWith('/proxy')) ||
        args.some((s)=>s==='spikes/envoy/sprint05c-b-launcher.mjs' || s===path.resolve('spikes/envoy/sprint05c-b-launcher.mjs'))) {
        found.push({ pid, args }); process.kill(pid,'SIGTERM');
      }
    } catch {}
  }
  for (let i=0;i<50;i++) {
    const alive=found.filter(({pid})=>{
      try { const s=fs.readFileSync(`/proc/${pid}/stat`,'utf8'); return s.slice(s.lastIndexOf(')')+2).split(' ')[0]!=='Z'; } catch { return false; }
    });
    if(!alive.length)break; assert.ok(i<49,'owned native process did not terminate'); await delay(100);
  }
  const removed=[];
  for(const name of fs.readdirSync('.local').filter((s)=>/^sprint05c-b-(launch-|proof-)/.test(s))) {
    fs.rmSync(path.resolve('.local',name),{recursive:true,force:true}); removed.push(name);
  }
  return { processes:found, removed, complete:true, lock_held:true };
}
