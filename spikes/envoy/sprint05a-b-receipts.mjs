import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

export const hash = (b) => createHash('sha256').update(b).digest('hex');
export const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
export function receipt(output) {
  assert.match(output, /^evidence\/sprint05a-b\/[a-z]+-\d+$/);
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'commit source before proof');
  fs.mkdirSync(output);
  const sources = git('ls-files', 'spikes/envoy/sprint05a-b*', 'spikes/envoy/wire-fixtures.mjs',
    'spikes/edge-comparison/manifest.json', 'evidence/sprint05a-b/PLAN.md').split('\n').filter(Boolean);
  const record = { started_at: new Date().toISOString(), argv: process.argv, cwd: process.cwd(),
    source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
    tracked_clean: true, node: process.version, node_executable: process.execPath,
    node_sha256: hash(fs.readFileSync(process.execPath)),
    sources: sources.map((file) => ({ file, sha256: hash(fs.readFileSync(file)) })), commands: [] };
  const save = () => fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(record, null, 2) + '\n');
  const file = (name, bytes) => {
    const target = `${output}/${name}`;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: 'wx' });
    return { file: target, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) };
  };
  function command(name, argv, options = {}) {
    const result = spawnSync(argv[0], argv.slice(1), { timeout: 45000, maxBuffer: 8 << 20, ...options });
    record.commands.push({ name, argv, cwd: options.cwd ?? process.cwd(), exit_code: result.status,
      signal: result.signal, error: result.error?.message, ended_at: new Date().toISOString(),
      stdout: file(`${name}.stdout`, result.stdout ?? ''), stderr: file(`${name}.stderr`, result.stderr ?? '') });
    save(); console.log(`${name}: exit=${result.status}`); return result;
  }
  function finish() {
    record.ended_at = new Date().toISOString(); save();
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
    file('SHA256SUMS', walk(output).sort().map((f) => `${hash(fs.readFileSync(f))}  ${f}`).join('\n') + '\n');
    if (record.error) process.exitCode = 1;
  }
  save(); return { record, save, file, command, finish };
}
