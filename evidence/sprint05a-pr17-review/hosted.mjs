import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const head = '12b870eac50925e1b5e086617975069995129c95';
const merge = '68fca430b55b5ae86d676b1f2e3a0b1ec7b0448d';
const output = 'evidence/sprint05a-pr17-review/hosted-01';
const sha = b => createHash('sha256').update(b).digest('hex');
const commands = [];
function run(argv) {
  const b = execFileSync(argv[0], argv.slice(1), { maxBuffer: 16 << 20, timeout: 60000 });
  commands.push({ argv, exit_code: 0, bytes: b.length, sha256: sha(b) });
  return b;
}
assert.ok(!fs.existsSync(output));
const observed_at = new Date().toISOString();
const result = JSON.parse(run(['gh', 'run', 'view', '43617194188', '--repo', 'tiecont/aegis-gate', '--json', 'databaseId,headSha,status,conclusion,url,jobs']));
assert.equal(result.headSha, head);
assert.equal(result.status, 'completed');
assert.equal(result.conclusion, 'success');
assert.deepEqual(result.jobs.map(j => [j.name, j.conclusion]).sort(), [['foundation-quality', 'success'], ['supply-chain-security', 'success']]);
const commit = JSON.parse(run(['gh', 'api', `repos/tiecont/aegis-gate/git/commits/${merge}`]));
const tree = execFileSync('git', ['rev-parse', `${head}^{tree}`], { encoding: 'utf8' }).trim();
assert.equal(commit.tree.sha, tree);
assert.deepEqual(commit.parents.map(p => p.sha), ['541d1d915ce6a3b679dc3fed3ea0a98f908ce001', head]);
const log = run(['gh', 'run', 'view', '43617194188', '--repo', 'tiecont/aegis-gate', '--log']).toString();
const messages = log.split('\n').map(line => {
  const [job, step, ...rest] = line.split('\t');
  return { job, step, message: rest.join('\t').replace(/^\uFEFF?\d{4}-\d{2}-\d{2}T\S+\s+/, '').replace(/\x1b\[[0-9;]*m|\^\[\[[0-9;]*m/g, '') };
});
const selected = messages.filter(p => /^(PASS [a-z0-9-]+$|# (pass|fail) \d+$|test result:|Artifact supply-chain-evidence.*successfully)/.test(p.message) || p.message === merge);
for (const j of result.jobs) {
  assert.ok(selected.some(p => p.job === j.name && p.message === merge), 'actual checkout');
  assert.ok(messages.some(p => p.job === j.name && p.message.includes('flock /tmp/aegisgate-sprint02-fixtures.lock')), 'locked workflow');
}
for (const name of ['go-vulnerabilities', 'rust-vulnerabilities', 'pingora-spike-vulnerabilities', 'hyper-spike-vulnerabilities', 'npm-root-vulnerabilities', 'npm-dashboard-vulnerabilities', 'npm-spike-vulnerabilities', 'worktree-secrets', 'history-git-preflight', 'history-secrets', 'repository-sbom', 'filesystem-vulnerabilities', 'envoy-spike-vulnerabilities', 'envoy-spike-sbom', ...[1, 2, 3, 4].flatMap(n => [`image-${n}-vulnerabilities`, `image-${n}-sbom`])]) {
  assert.ok(selected.some(p => p.job === 'supply-chain-security' && p.message === `PASS ${name}`), name);
}
assert.ok(!messages.some(p => /^FAIL [a-z0-9-]+$/.test(p.message)));
assert.ok(messages.some(p => p.job === 'foundation-quality' && /make check$/.test(p.message.trim())));
assert.ok(messages.some(p => p.job === 'supply-chain-security' && /make security-scan$/.test(p.message.trim())));
const receipt = { observed_at, reviewed_commit: head, reviewed_tree: tree, hosted_checkout: merge, checkout_parents: commit.parents.map(p => p.sha), checkout_tree_equal: true, run: result, commands, selected_log_messages: selected, log_retention: 'Full log inspected in memory; only digest and selected non-sensitive milestones retained.', passed: true };
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
fs.writeFileSync(`${output}/SHA256SUMS`, `${sha(fs.readFileSync(`${output}/receipt.json`))}  ${output}/receipt.json\n`);
console.log(JSON.stringify({ passed: true, head, hosted_checkout: merge, tree, jobs: result.jobs.map(j => [j.name, j.conclusion]), selected_log_messages: selected }, null, 2));
