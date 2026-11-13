import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const output = path.resolve(process.argv[2] ?? 'evidence/sprint04a-d/dashboard');
assert.ok(!fs.existsSync(output));
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const source = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const npm = '/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/npm';
const nodeDirectory = path.dirname(npm);
const environment = { ...process.env, PATH: `${nodeDirectory}:${process.env.PATH}` };
const records = [];
function run(label, program, args, cwd = process.cwd()) {
  const started = new Date().toISOString();
  const child = spawnSync(program, args, { cwd, env: environment, maxBuffer: 16 << 20 });
  const logs = {};
  for (const stream of ['stdout', 'stderr']) {
    const file = path.join(output, `${label}.${stream}.txt`);
    fs.writeFileSync(file, child[stream] ?? '');
    logs[stream] = { file: path.relative(process.cwd(), file), sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
  }
  records.push({ source_commit: source, label, program, args, cwd, started_at: started, ended_at: new Date().toISOString(), exit_code: child.status, signal: child.signal, logs });
  fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(records, null, 2) + '\n');
  console.log(`${label}: exit=${child.status}`);
  return child;
}
assert.equal(run('versions', npm, ['--version']).status, 0);
for (const dependency of ['typescript', 'typescript-eslint', '@typescript-eslint/eslint-plugin', '@typescript-eslint/parser', '@typescript-eslint/typescript-estree', 'next', 'eslint', '@next/eslint-plugin-next']) {
  assert.equal(run(`metadata-${dependency.replaceAll('/', '-').replaceAll('@', '')}`, npm, ['view', dependency, 'version', 'peerDependencies', '--json']).status, 0);
}
assert.equal(run('historical-dependabot', 'gh', ['api', 'repos/tiecont/aegis-gate/actions/jobs/130788796380/logs', '--allow-escape-sequences']).status, 0);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisgate04a-dashboard-peer-'));
for (const name of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join('apps/dashboard', name), path.join(temp, name));
const negative = run('typescript7-unforced-resolution', npm, ['install', 'typescript@7.0.2', '--package-lock-only', '--dry-run', '--ignore-scripts', '--strict-peer-deps'], temp);
assert.notEqual(negative.status, 0, 'do not claim incompatibility if resolution succeeds');
assert.match(negative.stderr.toString(), /ERESOLVE|peer|resolve/, 'unexpected infrastructure failure');
assert.equal(run('supported-lock-install', npm, ['ci', '--ignore-scripts', '--strict-peer-deps'], path.resolve('apps/dashboard')).status, 0);
assert.equal(run('supported-dependency-tree', npm, ['ls', 'typescript', 'typescript-eslint', '@typescript-eslint/eslint-plugin', '@typescript-eslint/parser', '--all'], path.resolve('apps/dashboard')).status, 0);
for (const script of ['lint', 'typecheck', 'test', 'build', 'integration']) assert.equal(run(`dashboard-${script}`, npm, ['run', script], path.resolve('apps/dashboard')).status, 0);
assert.equal(run('dashboard-audit', npm, ['audit', '--audit-level=high', '--json'], path.resolve('apps/dashboard')).status, 0);
console.log('PASS: reproduced unsupported update and verified unforced supported dashboard tree.');
