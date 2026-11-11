import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluate } from '../../spikes/edge-comparison/evaluate.mjs';

process.umask(0o077);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
assert.equal(process.cwd(), root);
const lock = '/tmp/aegisgate-sprint02-fixtures.lock';
const inode = fs.statSync(lock).ino;
assert.ok(fs.readFileSync('/proc/locks', 'utf8').split('\n').some((line) => {
  const fields = line.trim().split(/\s+/);
  return fields[1] === 'FLOCK' && fields[3] === 'WRITE' && fields[4] === String(process.ppid) && fields[5]?.endsWith(`:${inode}`);
}), 'invoke directly under flock for the entire command');
const shared = '/home/tiecont/Projects/aegis-gate';
const node = path.join(shared, '.local/toolchains/node/bin/node');
const mode = process.argv[2];
assert.ok(['observed-units', 'observed-pingora', 'observed-hyper', 'observed-envoy', 'observed-integration-review', 'observed-final-check'].includes(mode));
const output = path.join(root, 'evidence/sprint03a-e', mode);
assert.ok(!fs.existsSync(output), 'do not overwrite previous evidence');
fs.mkdirSync(output, { mode: 0o700 });
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const harness = ['spikes/pingora/lab.mjs', ...['run.mjs', 'contract.mjs', 'evaluate.mjs', 'manifest.json',
  'supplemental.mjs', 'tls-observer.mjs', 'tls-observer.test.mjs'].map((f) => `spikes/edge-comparison/${f}`)];
const commands = [];
const binding = { started_at: new Date().toISOString(), reviewer_head: git('rev-parse', 'HEAD'),
  observer_commits: ['bd96d00211a3a78d689282697788061c198bf2a1', '502ac330303017b80241e024442fca724aa96462'],
  lock: { path: lock, parent_pid: process.ppid }, harness: harness.map((file) => ({ file, sha256: hash(file) })),
  node: { path: node, version: process.version, sha256: hash(node) }, commands };
function save() { fs.writeFileSync(path.join(output, 'commands.json'), JSON.stringify(binding, null, 2) + '\n'); }
function capture(label, program, args, environment = {}) {
  const started_at = new Date().toISOString();
  const result = spawnSync(program, args, { cwd: root,
    env: { ...process.env, PATH: `${path.dirname(node)}:${process.env.PATH}`, ...environment },
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(output, `${label}.stdout.txt`), result.stdout ?? '');
  fs.writeFileSync(path.join(output, `${label}.stderr.txt`), result.stderr ?? String(result.error ?? ''));
  commands.push({ label, program, args, cwd: root, environment, started_at, ended_at: new Date().toISOString(),
    exit_code: result.status, signal: result.signal, error: result.error?.message,
    stdout_sha256: hash(path.join(output, `${label}.stdout.txt`)), stderr_sha256: hash(path.join(output, `${label}.stderr.txt`)) });
  save();
  console.log(`${label}: exit=${result.status} signal=${result.signal}`);
  return result;
}
save();
if (mode === 'observed-units') {
  assert.equal(capture('manifest', node, ['spikes/edge-comparison/extract-baseline.mjs', '--check']).status, 0);
  assert.equal(capture('units', node, ['--test', 'spikes/edge-comparison/contract.test.mjs',
    'spikes/edge-comparison/evaluate.test.mjs', 'spikes/edge-comparison/tls-observer.test.mjs']).status, 0);
} else if (mode === 'observed-integration-review') {
  const rootHead = execFileSync('git', ['-C', shared, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  binding.root_head = rootHead;
  binding.root_files = [];
  const files = ['Makefile', 'scripts/security-scan.sh', 'IMPLEMENTATION_STATUS.md', 'docs/ADR-011-pingora-evaluation.md',
    'docs/RISK_REGISTER.md', 'docs/sprints/03a-execution.md', 'docs/reports/sprint03a-architecture-decision.md',
    'docs/reports/sprint03a-d-integration.md', ...['make-check-final.log', 'security-scan-final.log',
      'history-secrets.log', 'pingora-spike-vulnerabilities.log', 'hyper-spike-vulnerabilities.log',
      'npm-spike-vulnerabilities.log', 'envoy-spike-vulnerabilities.json'].map((file) => `evidence/sprint03a-d/${file}`)];
  for (const file of files) {
    const committed = execFileSync('git', ['-C', shared, 'show', `${rootHead}:${file}`]);
    assert.ok(fs.readFileSync(path.join(shared, file)).equals(committed), `root file changed from captured commit: ${file}`);
    const destination = path.join(output, 'root-snapshot', file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, committed);
    binding.root_files.push({ file, sha256: hash(destination), root_commit: rootHead });
  }
  capture('integration-change', 'git', ['show', '2e97ce33a4b548f71d6fb70cd19480a65a86d151', '--', 'Makefile', 'scripts/security-scan.sh']);
  save();
} else if (mode === 'observed-final-check') {
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  const directory = path.join(root, '.local/observed-scan');
  fs.mkdirSync(directory, { mode: 0o700 });
  for (const file of ['sprint03a-e-independent-review.md', 'sprint03a-e-observer-followup.md'])
    fs.copyFileSync(path.join(root, 'docs/reports', file), path.join(directory, file));
  for (const [label, target] of [['evidence', '/repo/evidence/sprint03a-e'], ['report', '/review']]) {
    assert.equal(capture(`${label}-secrets`, 'docker', ['run', '--rm', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`,
      '-v', `${root}:/repo:ro`, '-v', `${directory}:/review:ro`, '-v', `${output}:/reports`, scanner, 'dir', target,
      '--config', '/repo/.github/gitleaks.toml', '--redact', '--report-format', 'json', '--report-path', `/reports/${label}-secrets.json`, '--no-banner']).status, 0);
  }
  capture('raw-whitespace', 'git', ['diff', '--check', '--cached']);
  assert.equal(capture('source-doc-json-whitespace', 'git', ['diff', '--check', '--cached', '--', '*.mjs', '*.md', '*.json', '*.jsonl']).status, 0);
} else {
  const candidate = mode.slice('observed-'.length);
  const prior = JSON.parse(fs.readFileSync(path.join(root, 'evidence/sprint03a-e', candidate, 'results.json')));
  const command = prior.candidate.command;
  for (const artifact of prior.candidate.artifacts) assert.equal(hash(artifact.path), artifact.sha256, `changed immutable artifact: ${artifact.path}`);
  binding.candidate_artifacts = prior.candidate.artifacts;
  const fixtureRoot = path.join(root, '.local', mode);
  fs.mkdirSync(fixtureRoot, { mode: 0o700 });
  const lab = capture('lab', node, ['spikes/edge-comparison/run.mjs'], {
    PINGORA_SPIKE_PROFILE: 'release', AEGIS_CANDIDATE_NAME: `${candidate}-independent-e-observed`,
    AEGIS_CANDIDATE_COMMAND: command, AEGIS_CANDIDATE_ARGS: JSON.stringify(prior.candidate.args),
    AEGIS_CANDIDATE_ARTIFACTS: JSON.stringify(prior.candidate.artifacts.map((a) => a.path)), AEGIS_RUN_ROOT: fixtureRoot });
  const resultPath = lab.stdout?.match(/^Evidence: (.+\/results\.json)$/m)?.[1];
  assert.ok(resultPath?.startsWith(`${fixtureRoot}/`), 'failed or interrupted lab; retain logs');
  const result = JSON.parse(fs.readFileSync(resultPath));
  fs.copyFileSync(resultPath, path.join(output, 'results.json'));
  fs.copyFileSync(path.join(path.dirname(resultPath), 'proxy.log'), path.join(output, 'proxy.log'));
  capture('evaluate', node, ['spikes/edge-comparison/evaluate.mjs', path.join(output, 'results.json')]);
  const evaluated = evaluate(result);
  assert.equal(result.lab_sha256, hash(path.join(root, 'spikes/pingora/lab.mjs')));
  assert.equal(result.origin_observer.source_sha256, hash(path.join(root, 'spikes/edge-comparison/tls-observer.mjs')));
  assert.deepEqual(evaluated.failed, prior.tests.filter((t) => t.status === 'fail').map((t) => t.name));
  const tests = result.tests.filter((t) => /HTTP2-downstream|HTTP2-authority|gRPC-|cross-tenant|verified-origin-TLS/.test(t.name));
  for (const name of ['HTTP2-downstream-and-upstream-ALPN', 'gRPC-bidirectional-streaming-and-trailers', 'gRPC-client-cancellation-reaches-origin']) {
    const test = result.tests.find((t) => t.name === name);
    assert.equal(test.status, 'pass'); assert.ok(test.origin.decrypted_bytes > 0, `missing ${name} frame observation`);
    assert.ok(test.origin.handler_invocations > 0, `missing ${name} handler observation`);
  }
  fs.writeFileSync(path.join(output, 'observation-summary.json'), JSON.stringify({ ...evaluated,
    lab_sha256: result.lab_sha256, origin_observer: result.origin_observer,
    same_failure_inventory_as_original_reviewer_run: true, positive_and_denial_counters: tests,
    original_results_sha256: hash(path.join(root, 'evidence/sprint03a-e', candidate, 'results.json')) }, null, 2) + '\n');
}
binding.completed_at = new Date().toISOString();
for (const entry of binding.harness) assert.equal(hash(path.join(root, entry.file)), entry.sha256, 'harness changed during capture');
save();
