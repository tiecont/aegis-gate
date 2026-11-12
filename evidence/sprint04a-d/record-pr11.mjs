import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';

const root = '/tmp/aegisgate-04a-pr11';
const output = path.resolve('evidence/sprint04a-d/pr11');
assert.ok(!fs.existsSync(output), 'never overwrite immutable evidence');
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const source = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(source, '95d5b95a6d7344a6fd180f8ed4bedad71b223143');
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim(), '');
const inode = fs.statSync('/tmp/aegisgate-sprint02-fixtures.lock').ino;
assert.ok(fs.readFileSync('/proc/locks', 'utf8').split('\n').some((line) => {
  const f = line.trim().split(/\s+/);
  return f[1] === 'FLOCK' && f[3] === 'WRITE' && f[4] === String(process.ppid) && f[5]?.endsWith(`:${inode}`);
}), 'fixture lock must cover start, tests and cleanup');
const records = [];
let failed = false;
function run(label, argv, environment = {}) {
  const log = path.join(output, `${label}.log`);
  const fd = fs.openSync(log, 'wx', 0o600);
  const started = new Date().toISOString();
  const result = spawnSync(argv[0], argv.slice(1), { cwd: root, env: { ...process.env, ...environment }, stdio: ['ignore', fd, fd] });
  fs.closeSync(fd);
  records.push({ source_commit: source, argv, environment, started_at: started, ended_at: new Date().toISOString(), exit_code: result.status, signal: result.signal, log: path.relative(process.cwd(), log), sha256: crypto.createHash('sha256').update(fs.readFileSync(log)).digest('hex') });
  fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(records, null, 2) + '\n');
  console.log(`${label}: exit=${result.status}`);
  failed ||= result.status !== 0;
}
try {
  run('fixtures-up', ['make', 'dev-up']);
  run('oidc-jwt-rotation-negatives', ['go', 'test', '-race', '-v', './apps/control-api/internal/identity', './apps/control-api/internal/transport', '-count=1'], { GOTOOLCHAIN: 'go1.27.4', AEGIS_TENANCY_INTEGRATION: '1' });
  run('module-verification', ['go', 'mod', 'verify'], { GOTOOLCHAIN: 'go1.27.4' });
  run('go-vulnerabilities', ['.local/bin/govulncheck', '-C', 'apps/control-api/cmd/control-api', '-scan=module'], { GOTOOLCHAIN: 'go1.27.4' });
} finally {
  run('fixtures-down', ['make', 'dev-down']);
}
process.exitCode = failed ? 1 : 0;
