import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
export const sha = (b) => createHash('sha256').update(b).digest('hex');
export const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 << 20 }).trim();
export const goRoot = '/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64';
export const archive = '/home/tiecont/go/pkg/mod/cache/download/golang.org/toolchain/@v/v0.0.1-go1.27.4.linux-amd64.zip';
export function receipt(output) {
  assertLock(); process.umask(0o077);
  assert.match(output ?? '', /^evidence\/sprint05c-b\/[a-z0-9-]+$/);
  assert.ok(!fs.existsSync(output));
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'commit source before execution');
  fs.mkdirSync(output, { recursive: true });
  const sources = git('ls-files', 'spikes/envoy/sprint05c-b*', 'spikes/pingora/lab.mjs', 'spikes/pingora/package*.json',
    'spikes/edge-comparison', 'spikes/envoy/wire-*.mjs', 'spikes/envoy/config.mjs', 'scripts/sprint05b-baseline.mjs')
    .split('\n').map((file) => ({ file, sha256: sha(fs.readFileSync(file)) }));
  const r = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
    source_clean: true, sources, argv: process.argv, cwd: process.cwd(), node: process.version,
    node_sha256: sha(fs.readFileSync(process.execPath)), started_at: new Date().toISOString(), commands: [],
    security_pass: false, resource_eligible: false };
  assert.equal(r.node_sha256, '0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b');
  const save = () => fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(r, null, 2) + '\n');
  const run = (label, program, args, expected = [0], extra = {}) => {
    assertLock(); const started_at = new Date().toISOString();
    const c = spawnSync(program, args, { timeout: 240000, maxBuffer: 32 << 20, ...extra,
      env: { ...process.env, GOTOOLCHAIN: 'local', GOWORK: 'off', GOAMD64: 'v1', GOFLAGS: '', ...extra.env } });
    const streams = ['stdout', 'stderr'].map((name) => {
      const b = c[name] ?? Buffer.alloc(0), file = `${label}.${name}`;
      fs.writeFileSync(path.join(output, file), b); return { file, bytes: b.length, sha256: sha(b) };
    });
    r.commands.push({ label, program, args, cwd: extra.cwd ?? process.cwd(), environment: extra.env ?? {},
      started_at, ended_at: new Date().toISOString(), exit_code: c.status, signal: c.signal, error: c.error?.message, streams });
    save(); console.log(`${label}: exit=${c.status}`); assert.ok(expected.includes(c.status), `${label} unexpected exit`); return c;
  };
  const finish = () => {
    assertLock(); for (const s of sources) assert.equal(sha(fs.readFileSync(s.file)), s.sha256);
    r.lock_held_through_cleanup_and_hashes = true; r.ended_at = new Date().toISOString(); save();
    fs.writeFileSync(`${output}/SHA256.json`, JSON.stringify(fs.readdirSync(output).sort().map((file) =>
      ({ file, sha256: sha(fs.readFileSync(path.join(output, file))) })), null, 2) + '\n');
  };
  return { r, save, run, finish };
}
