import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from '../../spikes/envoy/wire-fixtures.mjs';

const target = '4855552ffb7e46b48aac9d668ff459cbfc270ed5';
const tested = 'dd5b48441982bf76a53982a16c53b948e59b175e';
const accepted = 'c8fd9b92126cdd1a5c7ee1e731bc494213822cff';
const baseline = 'a325b9ecc086e09467f61b49f17da241bf8e43ea';
const gate = 'evidence/sprint04c-root/gates-01';
const clone = '/tmp/aegisgate-04c-gates';
const image = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
const [output] = process.argv.slice(2);
assert.match(output ?? '', /^evidence\/sprint04c-f\/gate-binding-\d+$/);
assert.ok(!fs.existsSync(output), 'fresh output required');
assertLock();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 << 20 });
const value = (...args) => git(...args).toString().trim();
assert.equal(value('status', '--porcelain'), '');
const reviewer = value('rev-parse', 'HEAD');
assert.equal(sha(fs.readFileSync(import.meta.filename)), sha(git('show', `${reviewer}:evidence/sprint04c-f/review-gate-binding.mjs`)));
const read = (file, revision = target) => git('show', `${revision}:${file}`);
const json = (file, revision = target) => JSON.parse(read(file, revision));
const tree = revision => new Map(git('ls-tree', '-rz', revision).toString().split('\0').filter(Boolean).map(row => {
  const [metadata, file] = row.split('\t');
  return [file, metadata];
}));
const receipt = {
  scope: 'Independent retained full-gate/source binding; no full gate or original75/23 execution',
  reviewer_commit: reviewer, reviewer_tree: value('rev-parse', `${reviewer}^{tree}`),
  verifier_sha256: sha(fs.readFileSync(import.meta.filename)),
  target, target_tree: value('rev-parse', `${target}^{tree}`),
  tested, tested_tree: value('rev-parse', `${tested}^{tree}`), helper_acceptance: accepted,
  argv: process.argv, cwd: process.cwd(), started_at: new Date().toISOString(),
  node: process.version, node_versions: process.versions, node_binary: process.execPath,
  node_sha256: sha(fs.readFileSync(process.execPath)), fixture_lock: '/tmp/aegisgate-sprint02-fixtures.lock',
  commands: [], passed: false,
};
fs.mkdirSync(output, { recursive: true });
function run(label, program, args, options = {}) {
  assertLock();
  const started_at = new Date().toISOString();
  const { observationOnly = false, ...spawnOptions } = options;
  const p = spawnSync(program, args, { timeout: 60000, maxBuffer: 16 << 20, ...spawnOptions });
  const streams = ['stdout', 'stderr'].map(name => {
    const file = `${output}/${label}.${name}`, bytes = p[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes);
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  receipt.commands.push({ label, program, args, cwd: options.cwd ?? process.cwd(), started_at,
    ended_at: new Date().toISOString(), exit_code: p.status, signal: p.signal, observation_only: observationOnly, streams });
  if (observationOnly && (p.status !== 0 || p.signal !== null)) {
    receipt.unavailable_current_tool_observations ??= [];
    receipt.unavailable_current_tool_observations.push(label);
    assertLock();
    return p.stdout?.toString() ?? '';
  }
  assert.equal(p.status, 0, label);
  assert.equal(p.signal, null, label);
  assertLock();
  return p.stdout.toString();
}
function manifest(file) {
  const entries = read(file).toString().trim().split('\n').map(line => {
    const m = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.ok(m, file);
    const entry = m[2].includes('/') ? m[2] : `${path.posix.dirname(file)}/${m[2]}`;
    assert.ok(entry.startsWith(`${path.posix.dirname(file)}/`) && !entry.split('/').includes('..'));
    assert.equal(sha(read(entry)), m[1], entry);
    return entry;
  });
  assert.equal(new Set(entries).size, entries.length);
  const actual = [...tree(target).keys()].filter(f => f.startsWith(`${path.posix.dirname(file)}/`) && f !== file);
  assert.deepEqual([...entries].sort(), actual.sort());
  return { file, entries: entries.length, sha256: sha(read(file)) };
}
let staging;
try {
  for (const ancestor of [tested, accepted, baseline]) run(`ancestor-${ancestor.slice(0, 7)}`, 'git', ['merge-base', '--is-ancestor', ancestor, target]);
  const rejected = spawnSync('git', ['merge-base', '--is-ancestor', '551591395880ce87863b4e861c05d266c719b91f', target]);
  assert.equal(rejected.status, 1);
  receipt.rejected_E_absent = true;
  const before = tree(tested), after = tree(target);
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(f => before.get(f) !== after.get(f));
  receipt.changed_files = changed;
  const outside = changed.filter(f => !f.startsWith('docs/') && !f.startsWith('evidence/'));
  assert.deepEqual(outside, ['IMPLEMENTATION_STATUS.md']);
  receipt.literal_outside_docs_evidence_equal = false;
  receipt.document_exception = outside;
  receipt.exact_source_objects = [...before.keys()].filter(f => !f.startsWith('docs/') && !f.startsWith('evidence/') && f !== 'IMPLEMENTATION_STATUS.md').length;
  run('status-document-delta', 'git', ['diff', tested, target, '--', 'IMPLEMENTATION_STATUS.md']);
  run('successor-history', 'git', ['log', '--format=%H %P %s', `${tested}..${target}`]);
  const protectedBase = tree(baseline);
  const shared = new Set(['IMPLEMENTATION_STATUS.md', 'docs/RISK_REGISTER.md', 'docs/ADR-012-strict-ingress-decision-proposed.md']);
  for (const [file, object] of protectedBase) if (!shared.has(file)) assert.equal(after.get(file), object, file);
  receipt.protected_baseline_objects = protectedBase.size - shared.size;
  const helper = 'scripts/sprint04c-gates.mjs';
  for (const revision of [tested, accepted, '578d78f3465d5a4cbb9587a0e03be975b33cd1c9']) assert.equal(tree(revision).get(helper), after.get(helper));
  receipt.helper_blob = after.get(helper); receipt.helper_sha256 = sha(read(helper));
  receipt.manifests = [manifest(`${gate}/SHA256SUMS`), manifest('evidence/sprint04c-f/cleanup-01/SHA256SUMS')];
  assert.equal(receipt.manifests[0].entries, 56);
  const r = json(`${gate}/commands.json`);
  assert.equal(r.source_commit, tested); assert.equal(r.source_tree, receipt.tested_tree);
  assert.equal(r.tracked_clean, true); assert.equal(r.passed, true);
  assert.equal(r.lock_held_through_cleanup, true); assert.equal(r.fixture_lock, receipt.fixture_lock);
  assert.equal(r.cwd, clone); assert.equal(r.argv[1], `${clone}/${helper}`);
  assert.equal(r.node_sha256, receipt.node_sha256); assert.equal(r.node, process.version);
  assert.ok(!r.error && !r.cleanup_errors);
  const expected = [['check', 'make', ['check']], ['security-scan', 'make', ['security-scan']],
    ['cleanup', 'make', ['dev-down']], ['cleanup-volumes', 'docker', ['compose', '--env-file', '.local/compose.env', '--env-file', '.local/fixture-images.env', '-f', 'infra/compose/compose.yaml', 'down', '--volumes', '--remove-orphans']]];
  let end = Date.parse(r.started_at), streamCount = 0;
  assert.deepEqual(r.commands.map(c => [c.label, c.command, c.args]), expected);
  for (const c of r.commands) {
    assert.equal(c.cwd, clone); assert.equal(c.exit_code, 0); assert.equal(c.signal, null);
    assert.ok(Date.parse(c.started_at) >= end && Date.parse(c.ended_at) >= Date.parse(c.started_at));
    end = Date.parse(c.ended_at);
    assert.equal(c.streams.length, 2);
    for (const [i, s] of c.streams.entries()) {
      assert.equal(s.file, `${gate}/${c.label}.${['stdout', 'stderr'][i]}.log`);
      assert.equal(sha(read(s.file)), s.sha256); streamCount++;
    }
  }
  assert.ok(Date.parse(r.ended_at) >= end);
  for (const kind of ['containers', 'networks', 'volumes']) assert.deepEqual(r[`remaining_project_${kind}`], []);
  const privatePaths = ['.local/pki', '.local/postgres-password', '.local/redis-password', '.local/nats-token', '.local/redis.conf', '.local/nats.conf', '.local/compose.env', '.local/evidence/security/compose-config.json'];
  assert.deepEqual(r.private_fixture_cleanup, privatePaths.map(file => ({ file, exists: false })));
  assert.deepEqual(r.private_material_check, { files_checked: 56, matches: 0 });
  receipt.retained_gate = { commands: 4, streams: streamCount, started_at: r.started_at, ended_at: r.ended_at,
    original_private_value_check: r.private_material_check, independent_credential_matches: null };
  const keyMarker = new RegExp(['-----BEGIN ', '(?:RSA |EC |OPENSSH )?', 'PRIVATE', ' KEY-----'].join(''));
  const gateFiles = [...after.keys()].filter(f => f.startsWith(`${gate}/`));
  for (const file of gateFiles) assert.doesNotMatch(read(file).toString(), keyMarker, file);
  receipt.independent_private_key_check = { files: gateFiles.length, matches: 0 };
  const cleanup = json('evidence/sprint04c-f/cleanup-01/verification.json');
  assert.equal(cleanup.helper_sha256, receipt.helper_sha256);
  assert.equal(value('rev-parse', `${cleanup.source_commit}^{tree}`), cleanup.source_tree);
  for (const c of cleanup.commands) {
    assert.equal(c.exit_code, 0);
    for (const s of c.streams) { const bytes = read(s.file); assert.equal(sha(bytes), s.sha256); assert.equal(bytes.length, s.bytes); }
  }
  receipt.helper_acceptance_streams = cleanup.commands.length * 2;
  const security = file => `${gate}/security/${file}`;
  for (const file of ['secrets.json', 'history-secrets.json']) assert.deepEqual(json(security(file)), []);
  const scanSummary = read(`${gate}/security-scan.stdout.log`).toString();
  const passLabels = [...scanSummary.matchAll(/^PASS (.+)$/gm)].map(m => m[1]);
  const runLabels = [...scanSummary.matchAll(/^Running (.+)$/gm)].map(m => m[1]);
  assert.deepEqual(passLabels, runLabels); assert.equal(passLabels.length, 26); assert.doesNotMatch(scanSummary, /^FAIL /m);
  const trivy = ['filesystem', 'envoy-spike', 'image-1', 'image-2', 'image-3', 'image-4'].map(name => {
    const report = json(security(`${name}-vulnerabilities.json`));
    assert.equal(report.Trivy.Version, '0.69.1');
    const findings = (report.Results ?? []).flatMap(result => result.Vulnerabilities ?? []);
    assert.equal(findings.filter(v => ['HIGH', 'CRITICAL'].includes(v.Severity)).length, 0);
    if (name === 'filesystem') assert.equal(report.Metadata.Commit, tested);
    return { name, results: report.Results?.length ?? 0, vulnerabilities: findings.length, artifact: report.ArtifactName };
  });
  const maintenance = [];
  for (const name of ['rust', 'pingora-spike', 'hyper-spike']) {
    const report = json(security(`${name}-vulnerabilities.log`));
    assert.equal(report.vulnerabilities.found, false); assert.equal(report.vulnerabilities.count, 0);
    maintenance.push(...Object.values(report.warnings).flat().map(w => w.advisory.id));
  }
  for (const name of ['root', 'dashboard', 'spike']) assert.equal(json(security(`npm-${name}-vulnerabilities.log`)).metadata.vulnerabilities.total, 0);
  assert.match(read(security('go-vulnerabilities.log')).toString(), /No vulnerabilities found/);
  for (const name of ['repository', 'envoy-spike', 'image-1', 'image-2', 'image-3', 'image-4']) assert.equal(json(security(`${name}.cdx.json`)).bomFormat, 'CycloneDX');
  receipt.scanners = { pass_labels: passLabels, trivy, maintenance_warnings: maintenance };
  const available = Number(read(security('history-git-preflight.log')).toString().match(/^(\d+) commits available/)[1]);
  const scanned = Number(read(security('history-secrets.log')).toString().match(/^(\d+) commits scanned/)[1]);
  assert.equal(available, Number(value('rev-list', '--count', tested)));
  assert.equal(scanned, Number(value('rev-list', '--no-merges', '--count', tested)));
  assert.match(read(security('history-gitleaks.log')).toString(), /no leaks found/);
  run('retained-history-parser', 'python3', ['scripts/history_scan_evidence.py', `${gate}/security/history-gitleaks.log`]);
  receipt.history = { retained_available: available, retained_scanned_nonmerges: scanned,
    target_commits: Number(value('rev-list', '--count', target)), target_nonmerges: Number(value('rev-list', '--no-merges', '--count', target)),
    later_review_branch_merged: false, retained_scan_covers_target_successors: false };
  const inventory = read(security('image-inventory.tsv')).toString().trim().split('\n').map(line => line.split('\t'));
  assert.deepEqual(inventory.map(row => row[0]), ['demo-origin', 'nats', 'postgres', 'redis']);
  const locks = json(security('fixture-images.lock.json'));
  for (const [service, kind, imageRef] of inventory) if (kind === 'local') {
    const lock = locks[service]; assert.equal(lock.image_id, imageRef);
    assert.equal(sha(read(`infra/compose/Dockerfile.${service === 'postgres' ? 'postgres' : 'origin'}`)), lock.dockerfile_sha256);
    const hash = createHash('sha256');
    for (const name of lock.source_files) hash.update(name).update('\0').update(read(`infra/compose/${name}`)).update('\0');
    assert.equal(hash.digest('hex'), lock.source_sha256);
  }
  receipt.image_inventory = inventory;
  const toolReceiptFile = 'evidence/sprint04c-e/attempt-02/commands.json';
  const toolReceipt = json(toolReceiptFile);
  assert.equal(value('rev-parse', `${toolReceipt.source_commit}^{tree}`), toolReceipt.source_tree);
  receipt.prior_component_tool_versions = [];
  for (const label of ['go-version', 'rust-version', 'npm-version', 'docker-version', 'compose-version', 'govulncheck-version', 'cargo-audit-version']) {
    const command = toolReceipt.commands.find(c => c.label === label);
    assert.ok(command, label); assert.equal(command.exit_code, 0);
    const stream = command.streams.stdout;
    const bytes = read(`evidence/sprint04c-e/attempt-02/${stream.file}`).subarray(stream.offset, stream.offset + stream.length);
    assert.equal(bytes.length, stream.length); assert.equal(sha(bytes), stream.sha256);
    receipt.prior_component_tool_versions.push({ label, version: bytes.toString().trim(), receipt: toolReceiptFile,
      source_commit: toolReceipt.source_commit, source_tree: toolReceipt.source_tree, stream_sha256: stream.sha256 });
  }
  receipt.tool_provenance_limit = 'Original receipt records Node version/hash; Go/Rust and scanner versions are constrained by unchanged scripts; current versions below are observations, not reconstructed historical executions. Image archives/rendered Compose were intentionally not retained.';
  run('node-version', process.execPath, ['--version']);
  run('git-version', 'git', ['--version']);
  run('go-version-current', 'go', ['version'], { observationOnly: true, env: { ...process.env, GOTOOLCHAIN: 'go1.27.4', GOPROXY: 'off' } });
  run('rust-version-current', 'rustc', ['+1.99.1', '--version'], { observationOnly: true });
  run('cargo-version-current', 'cargo', ['+1.99.1', '--version'], { observationOnly: true });
  run('npm-version-current', path.join(path.dirname(process.execPath), 'npm'), ['--version'], { env: { ...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH}` } });
  run('docker-version-current', 'docker', ['version', '--format', '{{.Client.Version}} {{.Server.Version}}']);
  run('compose-version-current', 'docker', ['compose', 'version', '--short']);
  run('govulncheck-version-current', `${clone}/.local/bin/govulncheck`, ['-version'], { observationOnly: true });
  run('cargo-audit-version-current', `${clone}/.local/tools/bin/cargo-audit`, ['--version'], { observationOnly: true });
  receipt.live_clone_head_before = run('clone-head-before', 'git', ['-C', clone, 'rev-parse', 'HEAD']).trim();
  run('clone-status', 'git', ['--no-optional-locks', '-C', clone, 'status', '--porcelain']);
  receipt.live_private_paths = privatePaths.map(file => {
    let exists = true;
    try { fs.lstatSync(path.join(clone, file)); } catch (e) { if (e.code === 'ENOENT') exists = false; else throw e; }
    assert.equal(exists, false, file); return { file, exists };
  });
  for (const file of gateFiles) assert.equal(sha(fs.readFileSync(path.join(clone, file))), sha(read(file)), `live retained evidence: ${file}`);
  receipt.live_retained_gate_files_equal = gateFiles.length;
  receipt.live_resources = {};
  for (const [kind, args] of [['containers', ['ps', '-aq']], ['networks', ['network', 'ls', '-q']], ['volumes', ['volume', 'ls', '-q']]]) {
    const ids = run(`live-${kind}`, 'docker', [...args, '--filter', 'label=com.docker.compose.project=aegisgate-04c-root']).trim().split('\n').filter(Boolean);
    assert.deepEqual(ids, []); receipt.live_resources[kind] = ids;
  }
  receipt.live_clone_head_after = run('clone-head-after', 'git', ['-C', clone, 'rev-parse', 'HEAD']).trim();
  assert.equal(receipt.live_clone_head_before, receipt.live_clone_head_after);
  run('gitleaks-version-current', 'docker', ['run', '--rm', '--pull=never', '--network=none', image, 'version']);
  staging = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisgate-f-binding-'));
  const archive = git('archive', reviewer);
  execFileSync('tar', ['-x', '-C', staging], { input: archive });
  const common = value('rev-parse', '--path-format=absolute', '--git-common-dir');
  const dockerArgs = ['run', '--rm', '--pull=never', '--network=none', '--user', `${process.getuid()}:${process.getgid()}`,
    '-e', 'GIT_DIR=/git-common', '-e', 'GIT_WORK_TREE=/repo', '-v', `${staging}:/repo:ro`, '-v', `${common}:/git-common:ro`, '-v', `${path.resolve(output)}:/reports`, image];
  run('target-history-secrets', 'docker', [...dockerArgs, 'git', '/repo', '--config', '/repo/.github/gitleaks.toml', '--redact', '--report-format', 'json', '--report-path', '/reports/target-history-secrets.json', '--no-banner', `--log-opts=${target}`]);
  run('target-history-parser', 'python3', ['scripts/history_scan_evidence.py', `${output}/target-history-secrets.stderr`]);
  const historyLog = fs.readFileSync(`${output}/target-history-secrets.stderr`, 'utf8');
  assert.equal(Number(historyLog.match(/(\d+) commits scanned\./)[1]), receipt.history.target_nonmerges);
  assert.deepEqual(JSON.parse(fs.readFileSync(`${output}/target-history-secrets.json`)), []);
  run('reviewer-snapshot-secrets', 'docker', [...dockerArgs, 'dir', '/repo', '--config', '/repo/.github/gitleaks.toml', '--redact', '--report-format', 'json', '--report-path', '/reports/reviewer-snapshot-secrets.json', '--no-banner']);
  assert.deepEqual(JSON.parse(fs.readFileSync(`${output}/reviewer-snapshot-secrets.json`)), []);
  receipt.history.independent_target_scan = { revision: target, network: 'none', explicit_revision_not_all_refs: true, findings: 0 };
  run('authored-whitespace', 'git', ['diff', '--check', target, reviewer, '--', 'evidence/sprint04c-f/review-gate-binding.mjs', 'evidence/sprint04c-f/gate-binding-plan.md', 'docs/reports/sprint04c-f-gate-binding-review.md']);
  receipt.passed = true;
} catch (error) {
  receipt.error = error.stack; process.exitCode = 1;
} finally {
  if (staging) { fs.rmSync(staging, { recursive: true, force: true }); receipt.scanner_staging_removed = !fs.existsSync(staging); }
  assertLock(); receipt.lock_held_through_cleanup = true; receipt.ended_at = new Date().toISOString();
  fs.writeFileSync(`${output}/verification.json`, JSON.stringify(receipt, null, 2) + '\n');
  const files = fs.readdirSync(output).sort();
  fs.writeFileSync(`${output}/SHA256SUMS`, files.map(file => `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}`).join('\n') + '\n');
  console.log(JSON.stringify({ passed: receipt.passed, error: receipt.error, output }));
}
