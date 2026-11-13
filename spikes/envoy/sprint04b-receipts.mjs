import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
export function receipt(output) {
  assert.match(output, /^evidence\/sprint04b-b\/[a-z]+-\d+$/);
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'commit source first');
  fs.mkdirSync(output); // Every attempt is retained in a fresh, bounded directory.
  const sources = git('ls-files', 'spikes/envoy', 'spikes/edge-comparison', 'evidence/sprint04b-b/PLAN.md')
    .split('\n').filter(Boolean);
  const record = { started_at: new Date().toISOString(), cwd: process.cwd(), argv: process.argv,
    source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
    tracked_clean: true, node: process.version, node_executable: process.execPath,
    node_sha256: hash(fs.readFileSync(process.execPath)),
    sources: sources.map((file) => ({ file, sha256: hash(fs.readFileSync(file)) })), commands: [] };
  const save = () => fs.writeFileSync(`${output}/commands.json`, JSON.stringify(record, null, 2) + '\n');
  function file(name, bytes) {
    const target = `${output}/${name}`;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: 'wx' });
    return { file: target, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) };
  }
  function command(name, argv, options = {}) {
    const started_at = new Date().toISOString();
    const result = spawnSync(argv[0], argv.slice(1), { cwd: process.cwd(), timeout: 45000,
      maxBuffer: 8 * 1024 * 1024, ...options });
    record.commands.push({ name, argv, cwd: options.cwd ?? process.cwd(), started_at,
      ended_at: new Date().toISOString(), exit_code: result.status, signal: result.signal,
      error: result.error?.message, stdout: file(`${name}.stdout`, result.stdout ?? Buffer.alloc(0)),
      stderr: file(`${name}.stderr`, result.stderr ?? Buffer.alloc(0)) });
    save(); console.log(`${name}: exit=${result.status}`);
    return result;
  }
  function finish() {
    for (const entry of record.sources) assert.equal(hash(fs.readFileSync(entry.file)), entry.sha256);
    record.ended_at = new Date().toISOString(); save();
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
    const files = walk(output).sort();
    file('SHA256SUMS', files.map((f) => `${hash(fs.readFileSync(f))}  ${f}`).join('\n') + '\n');
    if (record.error || record.commands.some((r) => r.exit_code !== 0)) process.exitCode = 1;
  }
  save(); return { record, save, file, command, finish };
}
