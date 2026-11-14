import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';
import { manifest, assertRejected } from '../edge-comparison/contract.mjs';
import { supplementalNegatives } from '../edge-comparison/supplemental.mjs';

process.umask(0o077); assertLock();
const output = process.argv[2];
const reportOnly = process.argv[3] === '--report-only';
assert.ok(process.argv[3] === undefined || reportOnly);
assert.match(output ?? '', /^evidence\/sprint05a-f\/checks-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain', ...(reportOnly ? ['--untracked-files=no'] : [])), '');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const receipt = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  started_at: new Date().toISOString(), argv: process.argv, node: process.version,
  node_binary_sha256: sha(fs.readFileSync(process.execPath)), commands: [], manifests: [], source_bindings: [] };
const pending = [];
function run(label, argv, expected = [0]) {
  assertLock(); const started_at = new Date().toISOString();
  const r = spawnSync(argv[0], argv.slice(1), { timeout: 60000, maxBuffer: 8 << 20 });
  const streams = ['stdout', 'stderr'].map((name) => {
    const file = `${output}/${label}.${name}`; const bytes = r[name] ?? Buffer.alloc(0);
    if (fs.existsSync(output)) fs.writeFileSync(file, bytes); else pending.push([file, bytes]);
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  receipt.commands.push({ label, argv, started_at, ended_at: new Date().toISOString(), exit_code: r.status,
    signal: r.signal, error: r.error?.message, streams });
  console.log(`${label}: exit=${r.status}`); assert.ok(expected.includes(r.status), label);
}
function json(file) { return JSON.parse(fs.readFileSync(file)); }
function verifyManifest(dir) {
  const entries = fs.readFileSync(`${dir}/SHA256SUMS`, 'utf8').trim().split('\n');
  for (const line of entries) { const [digest, file] = line.split('  '); assert.equal(sha(fs.readFileSync(file)), digest, file); }
  receipt.manifests.push({ dir, entries: entries.length, sha256: sha(fs.readFileSync(`${dir}/SHA256SUMS`)) });
}
try {
  if (reportOnly) {
    fs.mkdirSync(output, { recursive: true });
    const report = 'docs/reports/sprint05a-f-security-review.md';
    receipt.report = { file: report, sha256: sha(fs.readFileSync(report)) };
    const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
    for (const scope of [report, 'evidence/sprint05a-f']) run(`final-${path.basename(scope)}`, ['docker', 'run', '--rm', '--pull', 'never', '--network', 'none',
      '--user', `${process.getuid()}:${process.getgid()}`, '-v', `${process.cwd()}:/repo:ro`, scanner, 'dir', `/repo/${scope}`,
      '--config', '/repo/.github/gitleaks.toml', '--redact', '--no-banner']);
    run('final-whitespace', ['git', 'diff', '--check', '541d1d9', '--', 'spikes/envoy/sprint05a-f-*', 'docs/reports/sprint05a-f*']);
    receipt.completed = true;
  } else {
  // This inherited integrity runner independently checks the sanitized original A handoff.
  run('a-handoff-integrity', [process.execPath, 'spikes/envoy/sprint05a-a-verify.mjs', 'evidence/sprint05a-a/checks-02']);
  fs.mkdirSync(output, { recursive: true });
  for (const [file, bytes] of pending) fs.writeFileSync(file, bytes);
  pending.length = 0;
  for (const dir of ['evidence/sprint05a-a/attempt-04', 'evidence/sprint05a-f/ad-01',
    'evidence/sprint05a-f/ad-02', 'evidence/sprint05a-f/ad-03', 'evidence/sprint05a-a/checks-02']) verifyManifest(dir);
  for (const dir of ['evidence/sprint05a-a/attempt-04', 'evidence/sprint05a-f/ad-02', 'evidence/sprint05a-f/ad-03']) {
    const r = json(`${dir}/commands.json`);
    for (const s of r.sources) {
      assert.equal(sha(execFileSync('git', ['show', `${r.source_commit}:${s.file}`])), s.sha256, s.file);
      // The receipt harness evolved after the retained failed attempt; owner sources did not.
      if (!s.file.startsWith('spikes/envoy/sprint05a-f-')) assert.equal(sha(fs.readFileSync(s.file)), s.sha256, s.file);
    }
    receipt.source_bindings.push({ dir, commit: r.source_commit, tree: r.source_tree, files: r.sources.length });
  }
  const focused = json('evidence/sprint05a-a/attempt-04/focused.json');
  const vectors = [...manifest.negatives.filter((v) => /invalid-transfer-encoding|TE-repeated-chunked|TE-not-final-chunked/.test(v.name)),
    { ...supplementalNegatives.find((v) => v.name === 'repeated-transfer-encoding-fields'), name: 'supplemental-repeated-transfer-encoding-fields' }];
  receipt.te_vectors = vectors.map((v) => ({ name: v.name, sha256: sha(Buffer.from(v.request)) }));
  for (const v of vectors) for (const candidate of [false, true]) for (const reused of [false, true]) for (const exact of [false, true]) {
    const rows = focused.probes.filter((p) => p.historical_name === v.name && p.name.startsWith(candidate ? 'candidate:' : 'baseline:') && p.reused === reused && p.exact_historical_input === exact);
    assert.equal(rows.length, 1); const p = rows[0];
    assert.equal(p.request, exact ? v.request : v.request.replace('Connection: close', 'Connection: keep-alive'));
    assert.equal(p.request_hex, Buffer.from(p.request).toString('hex'));
    assert.equal(p.identity.authorized, true); assert.deepEqual(p.statuses, [candidate ? 400 : 501]);
    if (reused) { assert.equal(p.warmup.handlers.length, 1); assert.ok(p.warmup.origin_bytes > 0); }
    if (candidate) assertRejected(p); else assert.throws(() => assertRejected(p));
  }
  const d = json('evidence/sprint05a-f/ad-03/d-stream-errors.json');
  receipt.d_repairs = [];
  for (const name of ['raw-H2-uppercase-header-name', 'raw-H2-connection-specific-header']) {
    const p = d.tests.find((t) => t.name === name); assert.equal(p.status, 'pass');
    for (const k of ['connections', 'bytes', 'handlers', 'parser_errors', 'transport_errors']) assert.equal(p.origin[k], 0);
    assert.ok(p.error_frames.some((f) => f.type === 3 && f.stream === 1 && f.code === 1 && f.hex === '00000403000000000100000001'));
    receipt.d_repairs.push(p);
  }
  assert.deepEqual(d.failures, ['settled-reuse-identity-and-three-authority-negatives', 'individual-settled-userinfo-denial', 'raw-H2-HEADERS-stream-zero', 'raw-H2-zero-WINDOW_UPDATE']);
  const reuse = d.tests.find((t) => t.name === 'valid-identity-and-pool-reuse-after-negative-frames');
  assert.equal(reuse.status, 'pass'); assert.equal(reuse.samples[0].native_connection, reuse.samples[1].native_connection);
  for (const s of reuse.samples) { assert.equal(s.sni, 'lab-origin.test'); assert.equal(s.authority, 'lab-origin.test'); assert.equal(s.alpn, 'h2'); }
  const controls = json('evidence/sprint05a-f/ad-03/d-controls.json');
  assert.equal(controls.semantic_security_pass, false);
  receipt.bounded = controls.tests.filter((t) => t.name.startsWith('paused-native-reader-'));
  for (const p of receipt.bounded) { assert.equal(p.origin_closed_before_client_cancel, false); assert.equal(p.cancellation_proven, true); assert.equal(p.origin_rst_code, 2); }
  const original = execFileSync('git', ['show', '541d1d9:scripts/sprint04c-gates.mjs'], { encoding: 'utf8' });
  const gate = execFileSync('git', ['show', '47f0cd5:scripts/sprint04c-gates.mjs'], { encoding: 'utf8' });
  const expected = original.replace('assert.ok(output?.startsWith("evidence/sprint04c-root/gates-"));',
    'const sprint = /^evidence\\/sprint(04c|05a)-root\\/gates-/.exec(output ?? "")?.[1];\nassert.ok(sprint, "supported isolated sprint output required");')
    .replace('process.env.COMPOSE_PROJECT_NAME = "aegisgate-04c-root";', 'process.env.COMPOSE_PROJECT_NAME = `aegisgate-${sprint}-root`;')
    .replaceAll('"label=com.docker.compose.project=aegisgate-04c-root"', '`label=com.docker.compose.project=${process.env.COMPOSE_PROJECT_NAME}`');
  assert.equal(gate, expected);
  assert.equal(/^evidence\/sprint(04c|05a)-root\/gates-/.exec('evidence/sprint05a-root/gates-01')[1], '05a');
  receipt.root_gate = { commit: git('rev-parse', '47f0cd5'), sha256: sha(gate), scope: 'static source acceptance; 05a output selects aegisgate-05a-root; no gate execution' };
  run('fixture-clean-inventory', ['docker', 'ps', '-a', '--filter', 'name=^/aegis-envoy-', '--filter', 'name=^/aegis-sprint05a-a-', '--format', '{{.ID}} {{.Names}}']);
  run('fsck', ['git', 'fsck', '--connectivity-only', '--no-reflogs']);
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  const baseArgs = ['docker', 'run', '--rm', '--pull', 'never', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`, '-v', `${process.cwd()}:/repo:ro`];
  run('scanner-version', [...baseArgs, scanner, 'version']);
  for (const scope of ['spikes/envoy', 'evidence/sprint05a-a', 'evidence/sprint05a-d', 'evidence/sprint05a-f'])
    run(`secrets-${path.basename(scope)}`, [...baseArgs, scanner, 'dir', `/repo/${scope}`, '--config', '/repo/.github/gitleaks.toml', '--redact', '--no-banner']);
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  run('branch-history-secrets', [...baseArgs, '-v', `${common}:/git-common:ro`, '-e', 'GIT_DIR=/git-common', '-e', 'GIT_WORK_TREE=/repo',
    scanner, 'git', '/repo', '--config', '/repo/.github/gitleaks.toml', '--redact', '--no-banner', `--log-opts=541d1d9..${receipt.source_commit}`]);
  run('whitespace', ['git', 'diff', '--check', '541d1d9', '--', 'spikes/envoy/sprint05a-f-*', 'docs/reports/sprint05a-f-plan.md']);
  receipt.completed = true;
  }
} catch (error) { receipt.error = error.stack; process.exitCode = 1; }
finally {
  fs.mkdirSync(output, { recursive: true });
  for (const [file, bytes] of pending) fs.writeFileSync(file, bytes);
  assertLock(); receipt.ended_at = new Date().toISOString(); receipt.lock_held_through_capture = true;
  fs.writeFileSync(`${output}/commands.json`, JSON.stringify(receipt, null, 2) + '\n');
  const files = fs.readdirSync(output).sort();
  fs.writeFileSync(`${output}/SHA256SUMS`, files.map((f) => `${sha(fs.readFileSync(`${output}/${f}`))}  ${output}/${f}`).join('\n') + '\n');
}
