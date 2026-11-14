import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { evaluate } from '../../spikes/edge-comparison/evaluate.mjs';
import { assertLock } from '../../spikes/envoy/wire-fixtures.mjs';

const base = 'a325b9ecc086e09467f61b49f17da241bf8e43ea';
const integration = 'dd5b48441982bf76a53982a16c53b948e59b175e';
const rejected = '551591395880ce87863b4e861c05d266c719b91f';
const root = process.cwd();
const [output] = process.argv.slice(2);
assert.match(output ?? '', /^evidence\/sprint04c-integration-audit\/final-\d+$/);
assert.ok(!fs.existsSync(output), 'fresh output required');
assertLock();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { maxBuffer: 32 << 20 });
const value = (...args) => git(...args).toString().trim();
const tree = revision => new Map(git('ls-tree', '-rz', revision).toString().split('\0').filter(Boolean).map(row => {
  const [metadata, file] = row.split('\t');
  return [file, metadata];
}));
const source = value('rev-parse', 'HEAD');
assert.equal(value('status', '--porcelain', '--untracked-files=no'), '');
assert.equal(sha(fs.readFileSync(import.meta.filename)), sha(git('show', `${source}:evidence/sprint04c-integration-audit/final-source.mjs`)));
const files = tree(integration), baseline = tree(base);
const cache = new Map();
function read(file) {
  assert.ok(files.has(file), `untracked integration evidence: ${file}`);
  if (!cache.has(file)) cache.set(file, git('show', `${integration}:${file}`));
  return cache.get(file);
}
const json = file => JSON.parse(read(file));
const shared = ['IMPLEMENTATION_STATUS.md', 'docs/RISK_REGISTER.md', 'docs/ADR-012-strict-ingress-decision-proposed.md'];
const owners = {
  A: '02bad67b51a8171493ad3ff1eee245e3f07d6e2f',
  B: '12abd255b754b553480544edbf9452b7f65d9a4d',
  C: '49f2d554d30fd9002f6d15e7ee39999a6e866d5c',
  D: 'd9a2004167a178a3a1d4549cc97378fe4b02c360',
  E: '212677805416a3e38d44724bfaf1101c8e11a0d5',
};
const receipt = {
  verifier_commit: source, verifier_tree: value('rev-parse', `${source}^{tree}`),
  verifier_sha256: sha(fs.readFileSync(import.meta.filename)),
  source_commit: integration, source_tree: value('rev-parse', `${integration}^{tree}`), baseline: base,
  argv: process.argv, cwd: root, started_at: new Date().toISOString(),
  node: process.version, node_binary: process.execPath, node_sha256: sha(fs.readFileSync(process.execPath)),
  git: value('--version'), fixture_lock: '/tmp/aegisgate-sprint02-fixtures.lock',
  scope: 'independent final integration SOURCE audit; no helper fault tests or full gates',
  final_integration_accepted: false, commands: [],
};
fs.mkdirSync(output, { recursive: true });
function run(label, program, args, expected = 0) {
  assertLock();
  const started_at = new Date().toISOString();
  const p = spawnSync(program, args, { cwd: root, timeout: 60000, maxBuffer: 16 << 20 });
  const streams = ['stdout', 'stderr'].map(name => {
    const file = `${output}/${label}.${name}`, bytes = p[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes);
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  receipt.commands.push({ label, program, args, cwd: root, started_at, ended_at: new Date().toISOString(), exit_code: p.status, signal: p.signal, streams });
  assert.equal(p.status, expected, label);
  assert.equal(p.signal, null, label);
  assertLock();
  return p.stdout;
}

const omissions = new Map([
  ['evidence/sprint04c-e/attempt-01/SHA256SUMS', 'evidence/sprint04c-e/attempt-01/stdout.log'],
  ['evidence/sprint04c-f/receipts-01/SHA256SUMS', 'evidence/sprint04c-f/receipts-01/secrets.json'],
]);
const ineligible = new Map([
  ['evidence/sprint04c-b/reprot-01', 'missed valid response completion'],
  ['evidence/sprint04c-c/source-01', 'optional archive member collection failed'],
  ['evidence/sprint04c-d/verification-01', 'historical source equality assertion failed'],
  ['evidence/sprint04c-e/attempt-01', 'omitted flagged document stdout; superseded'],
  ['evidence/sprint04c-f/ace-01', 'stale owner-head assertion failed'],
  ['evidence/sprint04c-f/ace-02', 'historical E acceptance superseded; A/C scope retained'],
  ['evidence/sprint04c-f/receipts-01', 'failed scan with deliberately omitted raw report'],
  ['evidence/sprint04c-helper/proof-01', 'historical synthetic test does not accept replacement helper'],
]);
function manifest(file, inventory = files, get = read) {
  const targets = new Set(), missing = [];
  let verified = 0;
  for (const line of get(file).toString().trim().split('\n')) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.ok(match, `malformed manifest: ${file}`);
    const [, expected, entry] = match;
    assert.equal(path.posix.normalize(entry), entry);
    assert.ok(!entry.startsWith('/') && !entry.startsWith('../'));
    const target = entry.includes('/') ? entry : `${path.posix.dirname(file)}/${entry}`;
    assert.ok(!targets.has(target), `duplicate manifest target: ${target}`);
    targets.add(target);
    if (!inventory.has(target)) {
      assert.equal(target, omissions.get(file), `unexpected missing evidence: ${target}`);
      missing.push(target);
    } else {
      assert.notEqual(target, omissions.get(file), 'deliberately omitted evidence must stay absent');
      assert.equal(sha(get(target)), expected, `manifest hash: ${target}`);
      verified++;
    }
  }
  assert.deepEqual(missing, omissions.has(file) ? [omissions.get(file)] : []);
  const reason = ineligible.get(path.posix.dirname(file));
  return { file, verified, missing, hash_complete: missing.length === 0,
    eligible_for_original_scoped_use: !reason && missing.length === 0,
    restriction: reason ?? 'integrity only; does not grant runtime or final-gate acceptance' };
}
function resolveStream(receiptFile, entry) {
  assert.equal(typeof entry, 'string', `missing stream location: ${receiptFile}`);
  if (path.isAbsolute(entry)) {
    assert.ok(entry.startsWith('/tmp/aegisgate-04c-b/evidence/sprint04b-b/'), 'unexpected external stream reference');
    return entry.slice('/tmp/aegisgate-04c-b/'.length);
  }
  return entry.startsWith('evidence/') ? entry : `${path.posix.dirname(receiptFile)}/${entry}`;
}
function auditReceipt(file) {
  const r = json(file);
  const revision = r.source_commit ?? r.reviewer_commit;
  const revisionTree = r.source_tree ?? r.reviewer_tree;
  assert.equal(value('rev-parse', `${revision}^{tree}`), revisionTree, file);
  let sources = 0, streams = 0;
  for (const s of [...(r.sources ?? []), ...(r.immutable ?? [])]) {
    assert.equal(sha(git('show', `${revision}:${s.file}`)), s.sha256, `${file}: ${s.file}`);
    sources++;
  }
  for (const c of r.commands) {
    assert.equal(c.exit_code, 0, `${file}: ${c.label ?? c.name}`);
    assert.ok(c.signal == null);
    for (const s of c.streams ?? [c.stdout, c.stderr]) {
      const location = s.file ?? s.retained_reference;
      const bytes = read(resolveStream(file, location));
      assert.equal(sha(bytes), s.sha256, `${file}: ${location}`);
      if (s.bytes !== undefined) assert.equal(bytes.length, s.bytes);
      streams++;
    }
  }
  if (r.node_sha256) assert.equal(r.node_sha256, receipt.node_sha256, `${file}: Node binary`);
  return { file, source_commit: revision, source_tree: revisionTree, sources, commands: r.commands.length, streams };
}
let stage;
try {
  run('baseline-ancestor', 'git', ['merge-base', '--is-ancestor', base, integration]);
  run('rejected-E-not-ancestor', 'git', ['merge-base', '--is-ancestor', rejected, integration], 1);
  run('integration-ancestor', 'git', ['merge-base', '--is-ancestor', integration, source]);
  receipt.rejected_E_ancestor_absent = true;
  const protectedFiles = [...baseline.keys()].filter(file => !shared.includes(file));
  for (const file of protectedFiles) assert.equal(files.get(file), baseline.get(file), `protected baseline: ${file}`);
  receipt.protected_baseline_objects = protectedFiles.length;
  receipt.allowed_shared_documents = shared;
  for (const [file, metadata] of files) {
    assert.equal(treeWorkingMode(file), metadata.split(' ')[0], `working mode: ${file}`);
    assert.equal(value('hash-object', '--no-filters', '--', file), metadata.split(' ')[2], `working bytes: ${file}`);
  }
  receipt.exact_working_objects = files.size;
  receipt.owners = [];
  for (const [owner, revision] of Object.entries(owners)) {
    const component = tree(revision);
    const changed = value('diff', '--name-only', base, revision).split('\n');
    for (const file of changed) assert.equal(files.get(file), component.get(file), `${owner}: ${file}`);
    receipt.owners.push({ owner, revision, tree: value('rev-parse', `${revision}^{tree}`), exact_objects: changed.length });
  }
  const fHead = 'cede69eb3e11c42cc66c21b5e7b5d7c55ea037a1', fTree = tree(fHead);
  const fFiles = [...fTree.keys()].filter(file => file.startsWith('evidence/sprint04c-f/') || /^docs\/reports\/sprint04c-f-/.test(file));
  for (const file of fFiles) assert.equal(files.get(file), fTree.get(file), `accepted F review: ${file}`);
  receipt.prior_independent_review = { revision: fHead, exact_objects: fFiles.length };
  const delta = [...files.keys()].filter(file => files.get(file) !== baseline.get(file));
  const docs = new Set([...shared, 'docs/sprints/04c-execution.md', 'docs/ADR-012-sprint04c-decision-addendum-proposed.md']);
  assert.ok(delta.every(file => docs.has(file) || /^docs\/reports\/sprint04c-/.test(file) || /^evidence\/sprint04c-/.test(file) || file.startsWith('spikes/envoy/sprint04c-') || file === 'scripts/sprint04c-gates.mjs'));
  assert.equal(delta.filter(file => baseline.has(file)).length, 3);
  receipt.delta_files = delta.length;
  receipt.manifests = [...files.keys()].filter(file => /^evidence\/sprint04c-.*\/SHA256SUMS$/.test(file)).map(file => manifest(file));
  assert.equal(receipt.manifests.filter(m => !m.hash_complete).length, 2);
  assert.ok(json('evidence/sprint04c-f/receipts-01/verification.json').exit_code === 1);
  for (const file of omissions.keys()) assert.match(read(`${path.posix.dirname(file)}/REDACTION.md`).toString(), /ineligible/i);
  const metadata = json('evidence/sprint04c-f/receipts-01/redaction.json');
  assert.ok(read('evidence/sprint04c-f/receipts-01/SHA256SUMS').includes(metadata.original_report_sha256));
  assert.ok(read('evidence/sprint04c-e/attempt-01/SHA256SUMS').includes('8992edbdc9711c445bcf8cd811d3288feb08d299479f7544bdfe37eb2df9b3a1'));
  // These pure mutations test eligibility and hash boundaries without touching owner evidence.
  const eManifest = 'evidence/sprint04c-e/attempt-01/SHA256SUMS';
  assert.throws(() => manifest(eManifest, new Map([...files, [omissions.get(eManifest), 'synthetic']])));
  const validManifest = 'evidence/sprint04c-e/attempt-02/SHA256SUMS';
  assert.throws(() => manifest(validManifest, files, file => file === validManifest ? read(file) : Buffer.from('synthetic mismatch')));
  const absent = new Map(files); absent.delete('evidence/sprint04c-e/attempt-02/stdout.log');
  assert.throws(() => manifest(validManifest, absent));
  receipt.verifier_negative_controls = ['restored omitted evidence rejected', 'hash mismatch rejected', 'unexpected missing evidence rejected'];
  receipt.receipts = [
    'a/verification-01/receipt.json', 'a/verification-02/receipt.json',
    'b/upstream-01/commands.json', 'b/reproh-01/commands.json', 'b/reprot-01/commands.json', 'b/reprot-02/commands.json', 'b/checks-01/commands.json',
    'c/source-02/receipt.json', 'c/verification-01/receipt.json', 'c/verification-02/receipt.json',
    'd/attempt-01/commands.json', 'd/verification-02/commands.json',
    'f/ace-02/verification.json', 'f/bd-01/verification.json', 'f/receipts-bd-02/verification.json', 'f/final-01/verification.json',
  ].map(suffix => auditReceipt(`evidence/sprint04c-${suffix}`));
  const e = json('evidence/sprint04c-e/attempt-02/commands.json');
  assert.equal(value('rev-parse', `${e.source_commit}^{tree}`), e.source_tree);
  assert.ok(e.passed && e.tracked_clean && e.lock_held_through_cleanup);
  assert.equal(e.node_sha256, receipt.node_sha256);
  const offsets = { stdout: 0, stderr: 0 }, byLabel = new Map();
  for (const c of e.commands) {
    assert.equal(c.exit_code, c.label.startsWith('lock-') || c.label === 'typescript7-strict-resolution' ? 1 : 0, c.label);
    assert.equal(c.signal, null); assert.equal(c.error_code, null);
    byLabel.set(c.label, c);
    for (const [name, s] of Object.entries(c.streams)) {
      assert.equal(s.offset, offsets[name]);
      const bytes = read(`evidence/sprint04c-e/attempt-02/${s.file}`).subarray(s.offset, s.offset + s.length);
      assert.equal(bytes.length, s.length); assert.equal(sha(bytes), s.sha256);
      offsets[name] += s.length;
    }
  }
  const eRaw = (label, name = 'stdout') => {
    const s = byLabel.get(label).streams[name];
    return read(`evidence/sprint04c-e/attempt-02/${s.file}`).subarray(s.offset, s.offset + s.length).toString();
  };
  for (const name of Object.keys(offsets)) assert.equal(offsets[name], read(`evidence/sprint04c-e/attempt-02/${name}.log`).length);
  const tests = eRaw('go-full-race-integration');
  assert.doesNotMatch(tests, /--- (FAIL|SKIP):/);
  const go = { packages: (tests.match(/^ok\s/gm) ?? []).length, top_level: (tests.match(/^--- PASS:/gm) ?? []).length, subtests: (tests.match(/^\s+--- PASS:/gm) ?? []).length };
  assert.deepEqual(go, { packages: 11, top_level: 88, subtests: 151 });
  for (const label of ['cleanup-container', 'cleanup-network', 'cleanup-volume']) assert.equal(eRaw(label).trim(), '');
  receipt.corrected_E = { commands: e.commands.length, stream_slices: e.commands.length * 2, complete_contiguous_stream_bytes: offsets, go, credential_matches: null, scope: 'historical receipts; deleted credentials not reconstructed' };
  const original75 = json('evidence/sprint04b-c/attempt01/unchanged75-results.json');
  const summary = evaluate(original75);
  assert.equal(summary.mandatory_tests, 75); assert.equal(summary.passed, 69); assert.equal(summary.protocol_proof_pass, false);
  const h2 = original75.tests.find(t => t.name === 'HTTP2-authority-Host-and-SNI-confusion-rejected');
  assert.equal(h2.status, 'fail'); assert.equal(h2.origin.decrypted_bytes, 9); assert.equal(h2.origin.handler_invocations, 0);
  const supplemental = json('evidence/sprint04b-c/attempt01/unchanged23.json');
  assert.equal(supplemental.tests.length, 23); assert.equal(supplemental.failures.length, 7);
  assert.deepEqual(supplemental.failures, json('evidence/sprint04a-b/attempt04/probes.json').failures);
  assert.deepEqual(original75.tests.map(t => t.name), json('evidence/sprint04a-b/attempt02/diagnostic75-results.json').tests.map(t => t.name));
  receipt.original_gates = { original75: summary, original23: { tests: 23, passed: 16, failures: supplemental.failures }, nine_byte_failure_retained: true };
  assert.equal(json('evidence/sprint04c-d/attempt-01/attribution-summary.json').semantic_security_pass, false);
  const duplicates = new Map(), binary = [], large = [], syntheticMarkers = [];
  for (const file of delta) {
    const bytes = read(file), hash = sha(bytes);
    if (bytes.includes(0) || bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) || /\.(?:tar|gz|zip|wasm|exe|so|a)$/.test(file)) binary.push(file);
    if (bytes.length >= 1024 && file.startsWith('evidence/')) duplicates.set(hash, [...(duplicates.get(hash) ?? []), file]);
    if (bytes.length > 1 << 20) large.push({ file, bytes: bytes.length, sha256: hash });
    const text = bytes.toString();
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) {
      assert.ok(['evidence/sprint04c-f/final-01/independent-helper-harness.mjs', 'evidence/sprint04c-helper/cleanup-test.mjs'].includes(file), `unexpected private-key marker: ${file}`);
      const marker = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
      assert.equal(text.split(marker).length - 1, 1);
      assert.ok(text.includes(`Buffer.from(mode === 'synthetic-value-leak' ? synthetic : '${marker}')`));
      assert.doesNotMatch(text, /-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
      syntheticMarkers.push({ file, sha256: hash, kind: 'literal synthetic BEGIN marker in immutable test harness; no key block' });
    }
  }
  assert.deepEqual(binary, []);
  receipt.artifacts = { binary_files: binary, files_over_1MiB: large, synthetic_key_markers: syntheticMarkers, duplicate_payloads_over_1KiB: [...duplicates].filter(([, paths]) => paths.length > 1).map(([sha256, paths]) => ({ sha256, paths })), note: 'identical payloads are storage duplicates, never independent executions' };
  for (const file of ['IMPLEMENTATION_STATUS.md', 'docs/reports/sprint04c-completion.md', 'docs/ADR-012-sprint04c-decision-addendum-proposed.md']) {
    for (const marker of ['NO-GO', 'LOCKED', 'BLOCKED', 'PENDING']) assert.ok(read(file).includes(marker), `${file}: ${marker}`);
  }
  assert.match(read('docs/ADR-012-sprint04c-decision-addendum-proposed.md').toString(), /Status: PROPOSED/);
  run('immutable75', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']);
  run('original-evaluator-tests', process.execPath, ['--test', 'spikes/edge-comparison/contract.test.mjs', 'spikes/edge-comparison/evaluate.test.mjs']);
  run('original75-still-fails', process.execPath, ['spikes/edge-comparison/evaluate.mjs', 'evidence/sprint04b-c/attempt01/unchanged75-results.json'], 1);
  run('authored-whitespace', 'git', ['diff', '--check', base, source, '--', 'docs', 'scripts', 'spikes/envoy/sprint04c-*', 'evidence/sprint04c-integration-audit/*.mjs']);
  const syntax = [...files.keys()].filter(file => file.endsWith('.mjs') && (file.startsWith('spikes/envoy/sprint04c-') || file === 'scripts/sprint04c-gates.mjs'));
  for (const file of syntax) run(`syntax-${path.basename(file)}`, process.execPath, ['--check', file]);
  // This bounded dir scan cannot see rejected local refs or the Git object store.
  stage = fs.mkdtempSync('/tmp/aegisgate-04c-f-integration-scan-');
  const scanFiles = [...new Set([...delta, ...value('ls-files', 'evidence/sprint04c-integration-audit').split('\n')])];
  for (const file of scanFiles) {
    const target = path.join(stage, file); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, fs.readFileSync(file));
  }
  receipt.scan_input = { files: scanFiles.length, scope: 'integration delta plus committed F audit; no Git history or refs', scanner_config_sha256: sha(fs.readFileSync('.github/gitleaks.toml')) };
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  run('scoped-secrets', 'docker', ['run', '--rm', '--pull=never', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`, '-v', `${stage}:/input:ro`, '-v', `${root}/.github/gitleaks.toml:/config:ro`, '-v', `${path.resolve(output)}:/reports`, scanner, 'dir', '/input', '--config', '/config', '--redact', '--report-format', 'json', '--report-path', '/reports/secrets.json', '--no-banner']);
  assert.deepEqual(JSON.parse(fs.readFileSync(`${output}/secrets.json`)), []);
  receipt.result = 'ACCEPT exact integration source within stated audit scope';
  receipt.remaining = ['separate independent helper578d78f fault-path verdict', 'locked full gates and cleanup in /tmp/aegisgate-04c-gates', 'publishable clean-clone history scan', 'exact PR-head and merge hosted receipts', 'followup exact-source/receipt binding'];
  receipt.exit_code = 0;
} catch (error) {
  receipt.result = 'FAIL'; receipt.error = error.stack; receipt.exit_code = 1;
} finally {
  if (stage) { fs.rmSync(stage, { recursive: true, force: true }); receipt.scanner_stage_removed = !fs.existsSync(stage); }
  assertLock(); receipt.lock_held_through_cleanup = true;
  receipt.ended_at = new Date().toISOString();
  fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(`${output}/SHA256SUMS`, fs.readdirSync(output).filter(file => file !== 'SHA256SUMS').sort().map(file => `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}\n`).join(''));
  console.log(JSON.stringify({ result: receipt.result, error: receipt.error, exit_code: receipt.exit_code, final_integration_accepted: false }));
}
process.exitCode = receipt.exit_code;

function treeWorkingMode(file) {
  const stat = fs.lstatSync(file);
  assert.ok(stat.isFile(), `regular file required: ${file}`);
  return stat.mode & 0o111 ? '100755' : '100644';
}
