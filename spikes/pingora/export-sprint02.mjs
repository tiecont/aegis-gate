import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const redact = (value) => JSON.parse(JSON.stringify(value).replaceAll(root, '$WORKTREE'));
const [baselinePath, expandedPath] = process.argv.slice(2);
function runResult(input) {
  const resolved = fs.realpathSync(path.resolve(root, input));
  if (!resolved.startsWith(path.join(root, '.local/pingora-run-')) || path.basename(resolved) !== 'results.json') {
    throw new Error('expected results.json in this worktree private lab directory');
  }
  const bytes = fs.readFileSync(resolved);
  const data = JSON.parse(bytes);
  const log = fs.readFileSync(path.join(path.dirname(resolved), 'proxy.log'));
  if (/BEGIN (?:RSA |EC |)PRIVATE KEY/.test(log.toString())) throw new Error('private key in lab log');
  return { result_sha256: digest(bytes), proxy_log_sha256: digest(log),
    pass: data.tests.filter((test) => test.status === 'pass').length,
    fail: data.tests.filter((test) => test.status === 'fail').length, ...redact(data) };
}
const checks = [];
for (const [program, args] of [
  ['cargo', ['+1.99.1', 'fmt', '--check', '--manifest-path', 'spikes/pingora/Cargo.toml']],
  ['cargo', ['+1.99.1', 'clippy', '--locked', '--manifest-path', 'spikes/pingora/Cargo.toml', '--', '-D', 'warnings']],
  ['cargo', ['+1.99.1', 'test', '--locked', '--manifest-path', 'spikes/pingora/Cargo.toml']],
  ['cargo', ['+1.99.1', 'build', '--release', '--locked', '--manifest-path', 'spikes/pingora/Cargo.toml']],
  ...['lab.mjs', 'evidence.mjs', 'research.mjs', 'export-sprint02.mjs'].map((file) =>
    [process.execPath, ['--check', `spikes/pingora/${file}`]]),
  ...['derivative', 'unsafe-libyaml'].map((crate) =>
    ['cargo', ['+1.99.1', 'tree', '--locked', '--manifest-path', 'spikes/pingora/Cargo.toml', '-i', crate]]),
]) {
  const result = spawnSync(program, args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  checks.push(redact({ program, args, exit_code: result.status, stdout: result.stdout, stderr: result.stderr,
    error: result.error?.message }));
  console.log(`${result.status === 0 ? 'PASS' : 'FAIL'} ${path.basename(program)} ${args.join(' ')}`);
}
const files = ['Cargo.toml', 'Cargo.lock', 'package.json', 'package-lock.json', 'lab.mjs',
  'evidence.mjs', 'research.mjs', 'export-sprint02.mjs', 'src/main.rs', 'src/config.rs',
  'target/release/aegisgate-pingora-feasibility'];
const hashes = Object.fromEntries(files.map((file) => [file, digest(fs.readFileSync(path.join(root, 'spikes/pingora', file)))]));
const auditDirectory = path.join(root, '.local/evidence/pingora');
const rustAudit = JSON.parse(fs.readFileSync(path.join(auditDirectory, 'audit.json')));
const npmAudit = JSON.parse(fs.readFileSync(path.join(auditDirectory, 'npm-audit.json')));
const evidence = { generated_at: new Date().toISOString(),
  scope: 'owned loopback fixtures; research evidence only; root owns gate decision',
  expanded_source_and_binary_sha256: hashes, checks,
  baseline_provenance: 'unchanged tracked 35-case harness at 2425c2c; pre-existing copied release binary; final expanded run uses freshly rebuilt and hashed local binary',
  baseline: runResult(baselinePath), expanded: runResult(expandedPath),
  rust_audit: redact(rustAudit), npm_audit: npmAudit,
  audit_artifact_sha256: Object.fromEntries(['audit.json', 'npm-audit.json', 'licenses.json', 'features.txt', 'metadata.json']
    .map((file) => [file, digest(fs.readFileSync(path.join(auditDirectory, file)))])) };
fs.writeFileSync(path.join(root, 'spikes/pingora/evidence/sprint02-runs.json'), JSON.stringify(evidence, null, 2));
if (checks.some((check) => check.exit_code !== 0)) process.exitCode = 1;
console.log(`Baseline ${evidence.baseline.pass}/${evidence.baseline.tests.length}; expanded ${evidence.expanded.pass}/${evidence.expanded.tests.length}`);
