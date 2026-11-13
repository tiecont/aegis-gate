import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const root = 'evidence/sprint04a-d';
assert.ok(!fs.existsSync(`${root}/SHA256SUMS`));
const git = (...args) => execFileSync('git', args);
assert.equal(git('status', '--porcelain', '--untracked-files=no').toString().trim(), '');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
const verified = [];
for (const file of files(root).filter((f) => f.endsWith('/command.json'))) {
  const receipt = JSON.parse(fs.readFileSync(file));
  for (const stream of ['stdout', 'stderr']) assert.equal(hash(fs.readFileSync(path.join(path.dirname(file), `${stream}.log`))), receipt[`${stream}_sha256`]);
  verified.push({ file, exit_code: receipt.exit_code, source_commit: receipt.source_commit });
}
const nested = JSON.parse(fs.readFileSync(`${root}/reproduce/commands.json`));
for (const command of nested) {
  assert.equal(command.exit_code, command.label === 'typescript7-unforced-resolution' ? 1 : 0);
  for (const stream of ['stdout', 'stderr']) assert.equal(hash(fs.readFileSync(command.logs[stream].file)), command.logs[stream].sha256);
}
for (const file of ['apps/dashboard/package.json', 'apps/dashboard/package-lock.json', '.github/dependabot.yml']) assert.equal(hash(fs.readFileSync(file)), hash(git('show', `3e039408:${file}`)));
fs.writeFileSync(`${root}/verification.json`, JSON.stringify({ source_commit: git('rev-parse', 'HEAD').toString().trim(), source_clean: true,
  argv: process.argv, timestamp: new Date().toISOString(), verified, nested_commands: nested.length,
  dependency_files_changed: false, typescript7_update: 'BLOCKED_UPSTREAM_PEER_RANGE', exit_code: 0 }, null, 2) + '\n');
fs.writeFileSync(`${root}/SHA256SUMS`, [...files(root), 'docs/reports/sprint04a-d-dependencies.md'].sort().map((file) => `${hash(fs.readFileSync(file))}  ${file}\n`).join(''));
console.log('PASS receipts, unchanged supported pins and dependency evidence manifest');
