import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { assertLock } from '../spikes/envoy/wire-fixtures.mjs';

const [output] = process.argv.slice(2);
assert.ok(output?.startsWith('evidence/sprint04b-root/gates-'));
assert.ok(!fs.existsSync(output), 'fresh evidence required');
assertLock();
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
fs.mkdirSync(output, { recursive: true });
process.env.COMPOSE_PROJECT_NAME = 'aegisgate-04b-root';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const receipt = {
  source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  tracked_clean: true, argv: process.argv, cwd: process.cwd(),
  started_at: new Date().toISOString(), node: process.version,
  node_binary: process.execPath, node_sha256: sha(fs.readFileSync(process.execPath)),
  fixture_lock: '/tmp/aegisgate-sprint02-fixtures.lock',
  compose_project: process.env.COMPOSE_PROJECT_NAME, commands: [],
};
const save = () => fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(receipt, null, 2) + '\n');
async function run(label, command, args) {
  assertLock();
  const record = { label, command, args, cwd: process.cwd(), started_at: new Date().toISOString() };
  const streams = ['stdout', 'stderr'].map((name) => ({ file: path.join(output, `${label}.${name}.log`) }));
  const descriptors = streams.map(({ file }) => fs.openSync(file, 'wx'));
  const child = spawn(command, args, { stdio: ['ignore', ...descriptors] });
  const result = await new Promise((resolve) => {
    child.once('error', (error) => resolve({ exit_code: null, error: error.message }));
    child.once('exit', (exit_code, signal) => resolve({ exit_code, signal }));
  });
  descriptors.forEach((fd) => fs.closeSync(fd));
  Object.assign(record, result, { ended_at: new Date().toISOString(),
    streams: streams.map(({ file }) => ({ file, sha256: sha(fs.readFileSync(file)) })) });
  receipt.commands.push(record); save();
  console.log(JSON.stringify({ label, ...result }));
  assertLock();
  return result.exit_code === 0;
}
let passed = true;
try {
  passed = (await run('check', 'make', ['check'])) && passed;
  passed = (await run('security-scan', 'make', ['security-scan'])) && passed;
} catch (error) {
  receipt.error = error.stack; passed = false;
} finally {
  passed = (await run('cleanup', 'make', ['dev-down'])) && passed;
  passed = (await run('cleanup-volumes', 'docker', ['compose', '--env-file', '.local/compose.env',
    '--env-file', '.local/fixture-images.env', '-f', 'infra/compose/compose.yaml',
    'down', '--volumes', '--remove-orphans'])) && passed;
  const remaining = execFileSync('docker', ['ps', '-aq', '--filter',
    'label=com.docker.compose.project=aegisgate-04b-root'], { encoding: 'utf8' }).trim();
  receipt.remaining_project_containers = remaining.split('\n').filter(Boolean);
  passed = !remaining && passed;
  // Rendered Compose contains credentials; retain only safe scanner outputs.
  const security = '.local/evidence/security';
  if (fs.existsSync(security)) {
    fs.mkdirSync(path.join(output, 'security'));
    for (const entry of fs.readdirSync(security)) {
      if (/\.(json|log|tsv)$/.test(entry) && entry !== 'compose-config.json') {
        fs.copyFileSync(path.join(security, entry), path.join(output, 'security', entry));
      }
    }
  }
  assertLock();
  receipt.ended_at = new Date().toISOString(); receipt.passed = passed;
  receipt.lock_held_through_cleanup = true; save();
  const files = [];
  const inventory = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) inventory(file);
      else files.push(`${sha(fs.readFileSync(file))}  ${file}`);
    }
  };
  inventory(output);
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), files.sort().join('\n') + '\n');
}
process.exitCode = passed ? 0 : 1;
