// Additive diagnostics only. Original 75/23 evaluators do not import this module.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function nativeResource(logFile) {
  const bytes = fs.readFileSync(logFile);
  assert.ok(bytes.length <= (1 << 20), 'bounded native launcher log');
  const entries = bytes.toString().split('\n').filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line));
  const launch = entries.find((entry) => entry.adapter === 'test-only-native-envoy');
  assert.ok(launch && Number.isSafeInteger(launch.pid) && launch.pid > 1, 'native launch identity');
  const executable = fs.readFileSync(`/proc/${launch.pid}/exe`);
  assert.equal(createHash('sha256').update(executable).digest('hex'), process.env.AEGIS_05B_NATIVE_SHA256);
  assert.equal(launch.sha256, process.env.AEGIS_05B_NATIVE_SHA256);
  const status = fs.readFileSync(`/proc/${launch.pid}/status`, 'utf8');
  const rss = status.match(/^VmRSS:\s+(\d+)/m);
  assert.ok(rss, 'native process RSS unavailable');
  return { ms: performance.now(), envoy_pid: launch.pid, rss_kib: Number(rss[1]),
    executable_sha256: launch.sha256, isolation: launch.limits,
    observer_process: process.memoryUsage() };
}
