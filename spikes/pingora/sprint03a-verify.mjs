import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Run under flock: scans and any fixture work share the sprint fixture lock.
const lockPath = '/tmp/aegisgate-sprint02-fixtures.lock';
const selfLocks = fs.readFileSync('/proc/locks', 'utf8');
const lockInode = fs.statSync(lockPath).ino;
assert.ok(selfLocks.split('\n').some((line) => {
  const fields = line.trim().split(/\s+/);
  return fields[1] === 'FLOCK' && fields[3] === 'WRITE'
    && fields[4] === String(process.ppid) && fields[5]?.endsWith(`:${lockInode}`);
}), 'invoke this script directly under flock, not an unlocked shell');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baselineRoot = process.argv[2];
assert.ok(baselineRoot && path.isAbsolute(baselineRoot), 'absolute read-only baseline root required');
const output = path.join(root, 'evidence/sprint03a-a');
fs.mkdirSync(output, { recursive: true });
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sha256 = (file) => digest(fs.readFileSync(file));
const commands = [];
function capture(name, program, args) {
  const started_at = new Date().toISOString();
  const result = spawnSync(program, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  fs.writeFileSync(path.join(output, name), result.stdout);
  const stderr = `${name}.stderr.txt`;
  fs.writeFileSync(path.join(output, stderr), result.stderr);
  commands.push({ program, args, cwd: root, started_at, ended_at: new Date().toISOString(),
    exit_code: result.status, stdout: name, stdout_sha256: sha256(path.join(output, name)),
    stderr, stderr_sha256: sha256(path.join(output, stderr)) });
  return result;
}
const source = ['spikes/pingora/Cargo.toml', 'spikes/pingora/Cargo.lock',
  'spikes/pingora/src/main.rs', 'spikes/pingora/src/config.rs'];
const source_binding = source.map((file) => {
  const own_sha256 = sha256(path.join(root, file));
  const baseline_sha256 = sha256(path.join(baselineRoot, file));
  assert.equal(own_sha256, baseline_sha256, `baseline source differs: ${file}`);
  return { file, own_sha256, baseline_sha256, equal: true };
});
const binaryRelative = 'spikes/pingora/target/release/aegisgate-pingora-feasibility';
const baselineBinary = path.join(baselineRoot, binaryRelative);
const ownBinary = path.join(root, binaryRelative);
fs.mkdirSync(path.dirname(ownBinary), { recursive: true });
fs.copyFileSync(baselineBinary, ownBinary);
fs.chmodSync(ownBinary, 0o755);
assert.equal(sha256(ownBinary), sha256(baselineBinary));
capture('cargo-version.txt', 'cargo', ['+1.99.1', '--version']);
capture('fmt.txt', 'cargo', ['+1.99.1', 'fmt', '--check', '--manifest-path', 'spikes/pingora/Cargo.toml']);
const audit = capture('cargo-audit.json', path.join(baselineRoot, '.local/tools/bin/cargo-audit'),
  ['audit', '--file', 'spikes/pingora/Cargo.lock', '--json']);
capture('derivative-tree.txt', 'cargo', ['+1.99.1', 'tree', '--locked', '--offline',
  '--manifest-path', 'spikes/pingora/Cargo.toml', '-i', 'derivative']);
capture('unsafe-libyaml-tree.txt', 'cargo', ['+1.99.1', 'tree', '--locked', '--offline',
  '--manifest-path', 'spikes/pingora/Cargo.toml', '-i', 'unsafe-libyaml']);
capture('npm-audit.json', path.join(baselineRoot, '.local/toolchains/node/bin/npm'),
  ['audit', '--prefix', 'spikes/pingora', '--json']);
const summary = {
  purpose: 'Exact-lock scoped checks and explicit reused-baseline provenance; not a fresh binary build',
  script_sha256: sha256(fileURLToPath(import.meta.url)), lock: { path: lockPath, held_by_parent_pid: process.ppid },
  node: process.version, own_root: root, baseline_root: baselineRoot,
  source_binding, binary: { source: baselineBinary, copied_to: ownBinary,
    sha256: sha256(ownBinary), freshly_built_here: false }, commands,
  audit: audit.status === 0 ? JSON.parse(audit.stdout) : null,
};
fs.writeFileSync(path.join(output, 'verification.json'), `${JSON.stringify(summary, null, 2)}\n`);
assert.ok(commands.every((command) => command.exit_code === 0), 'a check failed; see verification.json');
console.log(JSON.stringify({ binary_sha256: summary.binary.sha256,
  vulnerabilities: summary.audit.vulnerabilities.count,
  warnings: Object.fromEntries(Object.entries(summary.audit.warnings).map(([kind, values]) => [kind, values.length])),
  commands: commands.length, output }, null, 2));
