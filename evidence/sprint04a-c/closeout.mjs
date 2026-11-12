import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const dir = 'evidence/sprint04a-c';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const receipt = { started_at: new Date().toISOString(), argv: process.argv,
  source_commit: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), commands: [] };
for (const [name, argv] of [
  ['syntax', ['node', '--check', `${dir}/research.mjs`]],
  ['closeout-syntax', ['node', '--check', `${dir}/closeout.mjs`]],
  ['archive-verification', ['python3', `${dir}/verify-provenance.py`]],
  ['immutable-corpus', ['node', 'spikes/edge-comparison/extract-baseline.mjs', '--check']],
  ['source-whitespace', ['git', 'diff', '--check', '6e113e1fbb0b1a22fb1d4b27fa613b9c57529d82', '--', `${dir}/*.mjs`, `${dir}/*.py`, `${dir}/PLAN.md`, `${dir}/drafts`, 'docs/reports/sprint04a-c-upstream.md']],
  ['secrets', ['docker', 'run', '--rm', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`,
    '-v', `${root}:/repo:ro`, '-v', `${root}/${dir}:/reports`,
    'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f',
    'dir', '/repo/evidence/sprint04a-c', '--config', '/repo/.github/gitleaks.toml', '--redact',
    '--report-format', 'json', '--report-path', '/reports/secrets.json', '--no-banner']],
]) {
  const started_at = new Date().toISOString();
  const r = spawnSync(argv[0], argv.slice(1), { timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  const stdout = r.stdout ?? Buffer.alloc(0), stderr = r.stderr ?? Buffer.alloc(0);
  fs.writeFileSync(`${dir}/local/${name}.stdout.txt`, stdout);
  fs.writeFileSync(`${dir}/local/${name}.stderr.txt`, stderr);
  receipt.commands.push({ name, argv, started_at, ended_at: new Date().toISOString(),
    exit_code: r.status, signal: r.signal, stdout_sha256: hash(stdout), stderr_sha256: hash(stderr) });
  console.log(JSON.stringify({ name, exit_code: r.status }));
}
const verified = [];
for (const filename of ['upstream-commands.json', 'followup-commands.json', 'local-commands.json', 'local-followup-commands.json']) {
  const r = JSON.parse(fs.readFileSync(`${dir}/${filename}`));
  for (const row of r.records) for (const data of row.file ? [row] : [row.stdout, row.stderr]) {
    if (!data) continue;
    const actual = hash(fs.readFileSync(`${dir}/${data.file}`));
    if (actual !== data.sha256) throw new Error(`Hash mismatch: ${data.file}`);
    verified.push(data.file);
  }
}
receipt.fetched_and_command_files_verified = verified.length;
receipt.ended_at = new Date().toISOString();
fs.writeFileSync(`${dir}/verification.json`, `${JSON.stringify(receipt, null, 2)}\n`);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((entry) => {
  const p = path.join(d, entry.name);
  return entry.isDirectory() ? walk(p) : [p];
});
const files = [...walk(dir).filter((f) => !f.endsWith('/SHA256SUMS')),
  'docs/reports/sprint04a-c-upstream.md'].sort();
fs.writeFileSync(`${dir}/SHA256SUMS`, files.map((f) => `${hash(fs.readFileSync(f))}  ${f}`).join('\n') + '\n');
if (receipt.commands.some((r) => r.exit_code !== 0)) process.exitCode = 1;
