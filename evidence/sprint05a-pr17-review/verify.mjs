import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from '../../spikes/envoy/wire-fixtures.mjs';

const head = '12b870eac50925e1b5e086617975069995129c95';
const prior = 'c117d96a0216de301c2a8033e79edee21a936f4a';
const base = '541d1d915ce6a3b679dc3fed3ea0a98f908ce001';
const output = 'evidence/sprint05a-pr17-review/checks-01';
const git = (...args) => execFileSync('git', args, { maxBuffer: 64 << 20 });
const text = (...args) => git(...args).toString().trim();
const hash = b => createHash('sha256').update(b).digest('hex');
const cache = new Map();
function blob(commit, file) {
  const key = `${commit}:${file}`;
  if (!cache.has(key)) cache.set(key, git('show', key));
  return cache.get(key);
}
const read = file => blob(head, file);
const json = file => JSON.parse(read(file));
const files = text('ls-tree', '-r', '--name-only', head).split('\n');
const tracked = new Set(files);
function resolve(file, manifest) {
  for (const [from, to] of [
    ['evidence/sprint05a-b/llhttp-90/', 'evidence/sprint05a-f/extended-01/b-llhttp/'],
    ['evidence/sprint05a-f/candidate-90/', 'evidence/sprint05a-f/extended-01/combined/'],
  ]) if (file.startsWith(from)) return to + file.slice(from.length);
  return /^(evidence|docs|scripts|spikes)\//.test(file) ? file : path.join(path.dirname(manifest), file);
}
assertLock();
assert.equal(text('status', '--porcelain', '--untracked-files=no'), '');
assert.ok(!fs.existsSync(output));
process.umask(0o077);
fs.mkdirSync(output, { recursive: true });
const receipt = {
  source_commit: text('rev-parse', 'HEAD'), source_tree: text('rev-parse', 'HEAD^{tree}'),
  reviewed_commit: head, reviewed_tree: text('rev-parse', `${head}^{tree}`),
  started_at: new Date().toISOString(), node: process.version,
  verifier_sha256: hash(fs.readFileSync(import.meta.filename)), checks: [], commands: [],
};
function check(name, fn) {
  try { receipt.checks.push({ name, passed: true, result: fn() }); }
  catch (error) { receipt.checks.push({ name, passed: false, error: error.message }); process.exitCode = 1; }
}
function run(name, argv) {
  assertLock();
  const start = new Date().toISOString();
  const p = spawnSync(argv[0], argv.slice(1), { timeout: 60000, maxBuffer: 8 << 20 });
  const streams = ['stdout', 'stderr'].map(s => {
    const file = `${output}/${name}.${s}.log`, bytes = p[s] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes, { flag: 'wx' });
    return { file, bytes: bytes.length, sha256: hash(bytes) };
  });
  receipt.commands.push({ name, argv, started_at: start, ended_at: new Date().toISOString(), exit_code: p.status, signal: p.signal, error: p.error?.code, streams });
  assert.equal(p.status, 0, name);
  assert.equal(p.signal, null, name);
  return p.stdout.toString().trim();
}
try {
  check('exact-source-and-protected-equality', () => {
    const delta = text('diff', '--name-status', prior, head).split('\n');
    const authored = delta.filter(s => !s.split('\t')[1].startsWith('evidence/'));
    assert.deepEqual(authored, ['M\tIMPLEMENTATION_STATUS.md', 'M\tdocs/reports/sprint05a-completion.md', 'A\tdocs/reports/sprint05a-f-gate-review.md', 'A\tscripts/sprint05a-gate-audit.mjs']);
    for (const line of delta) {
      const [status, file] = line.split('\t');
      assert.ok(['A', 'M'].includes(status));
      if (file.startsWith('evidence/')) assert.equal(status, 'A');
      const b = read(file);
      assert.ok(!b.includes(0), file);
      assert.doesNotMatch(b.toString(), /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/, file);
      assert.doesNotMatch(file, /(^|\/)(node_modules|target|\.local|\.next)(\/|$)|\.(exe|so|tar|zip|pem|key)$/i);
    }
    const before = text('ls-tree', '-r', base).split('\n');
    const now = new Set(text('ls-tree', '-r', head).split('\n'));
    const exceptions = before.filter(s => !now.has(s)).map(s => s.split('\t')[1]);
    assert.equal(before.length, 4003);
    assert.deepEqual(exceptions, ['IMPLEMENTATION_STATUS.md', 'README.md', 'docs/RISK_REGISTER.md', 'scripts/sprint04c-gates.mjs']);
    const protectedPaths = ['spikes/edge-comparison', 'spikes/pingora/lab.mjs', 'spikes/envoy/config.mjs', 'spikes/envoy/recovery-config.mjs', 'spikes/envoy/recovery-launcher.mjs', 'spikes/envoy/wire-probes.mjs', 'spikes/envoy/wire-fixtures.mjs', 'docs/THREAT_MODEL.md', 'docs/QUALITY_GATES.md', 'docs/ARCHITECTURE.md', 'docs/CONFIG_PROTOCOL.md', '.github', 'scripts/security-scan.sh', 'scripts/history_scan_evidence.py'];
    const inventory = git('ls-tree', '-r', base, '--', ...protectedPaths);
    assert.deepEqual(git('ls-tree', '-r', head, '--', ...protectedPaths), inventory);
    for (const f of ['scripts/sprint04c-gates.mjs', 'scripts/sprint05a-f-final-verify.mjs', 'scripts/sprint05a-f-final-scan.mjs', 'scripts/sprint05a-receipt.mjs']) assert.deepEqual(read(f), blob(prior, f));
    for (const c of ['c5cd051', '8ce5aef', prior]) assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', c, head]).status, 0);
    for (const c of ['551591395880ce87863b4e861c05d266c719b91f', 'cd8f4a760239086616809db8b55a651d3cc28d8e']) assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', c, head]).status, 1);
    return { incremental_files: delta.length, authored, baseline_objects: before.length, identical: before.length - exceptions.length, exceptions, protected_inventory_sha256: hash(inventory) };
  });
  check('committed-manifests', () => {
    let entries = 0;
    const manifests = files.filter(f => /^evidence\/sprint05a-/.test(f) && /\/SHA256(SUMS|\.json)$/.test(f)).map(file => {
      const b = read(file);
      const list = file.endsWith('.json') ? JSON.parse(b) : b.toString().trim().split('\n').map(line => {
        const m = /^([a-f0-9]{64})  (.+)$/.exec(line); assert.ok(m, file); return { file: m[2], sha256: m[1] };
      });
      for (const p of list) assert.equal(hash(read(resolve(p.file, file))), p.sha256, `${file}: ${p.file}`);
      entries += list.length;
      return { file, entries: list.length, sha256: hash(b) };
    });
    return { count: manifests.length, entries, manifests };
  });
  check('committed-source-and-stream-hashes', () => {
    const withheld = new Map(['01', '02'].flatMap(n => json(`evidence/sprint05a-a/attempt-${n}/withheld.json`).streams.map(s => [s.file, s])));
    assert.equal(withheld.size, 4);
    for (const f of withheld.keys()) assert.ok(!tracked.has(f) && !fs.existsSync(f));
    const used = new Set(), trees = new Set(), unique = new Set();
    let sources = 0, summaries = 0, streams = 0, retired = 0;
    for (const file of files.filter(f => /^evidence\/sprint05a-/.test(f) && /\/(receipt|commands)\.json$/.test(f))) {
      const r = json(file); let source = r.source_commit;
      if (file === 'evidence/sprint05a-a/attempt-02/commands.json') {
        assert.equal(source, '02b0a6582997aeb8ed7992ae4c6f9af34d6a0d11');
        assert.notEqual(spawnSync('git', ['cat-file', '-e', source]).status, 0);
        source = '1626bf4249554dfc6a6721aa3a3702630a1ca50b'; retired++;
      } else if (r.source_commit && r.source_tree) {
        assert.equal(text('rev-parse', `${source}^{tree}`), r.source_tree, file); trees.add(source);
      }
      for (const s of r.sources ?? r.source_hashes ?? []) {
        if (!s.file) { const t = text('rev-parse', `${s.commit}^{tree}`); if (s.tree) assert.equal(t, s.tree); assert.ok(s.files > 0); summaries++; continue; }
        assert.equal(hash(blob(source, s.file)), s.sha256, `${file}: ${s.file}`); unique.add(`${source}:${s.file}`); sources++;
      }
      for (const c of r.commands ?? [r]) {
        if (c.streams && !Array.isArray(c.streams)) for (const [name, s] of Object.entries(c.streams)) {
          assert.ok(['stdout', 'stderr'].includes(name));
          const b = read(`${path.dirname(file)}/${name}.log`).subarray(s.offset, s.offset + s.length);
          assert.equal(b.length, s.length); assert.equal(hash(b), s.sha256); streams++;
        }
        for (const s of Array.isArray(c.streams) ? c.streams : [c.stdout, c.stderr].filter(s => s?.file)) {
          if (!s?.file || !s.sha256) continue;
          const f = resolve(s.file, file);
          if (withheld.has(f)) { assert.equal(s.sha256, withheld.get(f).sha256); assert.equal(s.bytes, withheld.get(f).bytes); used.add(f); continue; }
          const b = read(f); assert.equal(hash(b), s.sha256, f); if (s.bytes !== undefined) assert.equal(b.length, s.bytes); streams++;
        }
      }
    }
    assert.equal(used.size, 4); assert.equal(retired, 1);
    return { sources, unique_source_blobs: unique.size, source_trees: trees.size, summaries, streams, withheld: 4, withheld_eligible: false, retired_tree_verified: false };
  });
  check('final-local-gates-installs-and-handoff', () => {
    const dir = 'evidence/sprint05a-root/gates-02', r = json(`${dir}/commands.json`);
    assert.equal(r.source_commit, prior); assert.equal(r.source_tree, text('rev-parse', `${prior}^{tree}`));
    assert.ok(r.passed && r.ended_at && r.tracked_clean && r.lock_held_through_cleanup);
    assert.deepEqual(r.commands.map(c => [c.label, c.exit_code, c.signal]), ['check', 'security-scan', 'cleanup', 'cleanup-volumes'].map(n => [n, 0, null]));
    assert.deepEqual(r.commands.slice(0, 3).map(c => [c.command, c.args]), [['make', ['check']], ['make', ['security-scan']], ['make', ['dev-down']]]);
    assert.equal(r.private_material_check.matches, 0);
    for (const k of ['containers', 'networks', 'volumes']) assert.deepEqual(r[`remaining_project_${k}`], []);
    for (const f of ['secrets.json', 'history-secrets.json']) assert.deepEqual(json(`${dir}/security/${f}`), []);
    const vulnerabilityReports = files.filter(f => f.startsWith(`${dir}/security/`) && /vulnerabilities\.json$/.test(f));
    assert.equal(vulnerabilityReports.length, 6);
    for (const f of vulnerabilityReports) for (const result of json(f).Results ?? []) for (const v of result.Vulnerabilities ?? []) assert.ok(!['HIGH', 'CRITICAL'].includes(v.Severity));
    assert.match(read(`${dir}/security/history-gitleaks.log`).toString(), /336 commits scanned/);
    assert.match(read(`${dir}/security/history-gitleaks.log`).toString(), /no leaks found/);
    assert.equal(json('evidence/sprint05a-root/gates-01/commands.json').passed, false);
    for (const scope of ['root', 'dashboard', 'spike']) {
      const i = json(`evidence/sprint05a-root/gate-install-${scope}/receipt.json`);
      assert.equal(i.source_commit, prior); assert.equal(i.source_tree, r.source_tree); assert.equal(i.exit_code, 0); assert.equal(i.signal, null);
      for (const a of ['ci', '--ignore-scripts', '--strict-peer-deps', '--engine-strict']) assert.ok(i.args.includes(a));
      assert.ok(!i.args.includes('--force') && !i.args.includes('--legacy-peer-deps'));
    }
    const handoff = json('evidence/sprint05a-gate-review/HANDOFF.json');
    assert.equal(handoff.reviewed_root, prior); assert.equal(handoff.reviewed_tree, r.source_tree);
    assert.equal(hash(blob(handoff.report_commit, handoff.report.file)), handoff.report.sha256);
    assert.equal(hash(read(handoff.report.file)), handoff.report.sha256);
    for (const [key, receiptName] of [['audit', 'receipt.json'], ['report_scan', 'receipt.json']]) {
      const p = handoff[key]; assert.equal(hash(read(`${p.directory}/${receiptName}`)), p.receipt_sha256); assert.equal(hash(read(`${p.directory}/SHA256SUMS`)), p.manifest_sha256);
      assert.equal(json(`${p.directory}/receipt.json`).passed, true);
    }
    assert.equal(handoff.report_scan.source_commit, handoff.report_commit);
    assert.equal(hash(read(`${dir}/commands.json`)), handoff.root_gates02.receipt_sha256);
    assert.equal(hash(read(`${dir}/SHA256SUMS`)), handoff.root_gates02.manifest_sha256);
    return { gate_source: prior, gate_tree: r.source_tree, gate_receipt_sha256: hash(read(`${dir}/commands.json`)), gate_manifest_sha256: hash(read(`${dir}/SHA256SUMS`)), strict_installs: 3, vulnerability_reports: 6, high_critical: 0, handoff_commit: text('rev-parse', '8ce5aef'), handoff_sha256: hash(read('evidence/sprint05a-gate-review/HANDOFF.json')) };
  });
  check('independent-offline-secret-scan', () => {
    const name = `aegisgate-pr17-review-${process.pid}`;
    run('gitleaks', ['docker', 'run', '--rm', '--pull', 'never', '--network', 'none', '--name', name, '--user', `${process.getuid()}:${process.getgid()}`, '-v', `${process.cwd()}:/repo:ro`, 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f', 'dir', '/repo', '--config', '/repo/.github/gitleaks.toml', '--redact', '--no-banner']);
    assert.equal(run('scanner-inventory', ['docker', 'ps', '-aq', '--filter', `name=^/${name}$`]), '');
    return { network: 'none', exit_code: 0, container_absent: true };
  });
} finally {
  assertLock(); receipt.ended_at = new Date().toISOString();
  receipt.lock_held_through_scanner_inventory_hashing = true;
  receipt.passed = receipt.checks.every(c => c.passed);
  fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(`${output}/SHA256SUMS`, fs.readdirSync(output).sort().map(f => `${hash(fs.readFileSync(`${output}/${f}`))}  ${output}/${f}\n`).join(''));
}
console.log(JSON.stringify({ passed: receipt.passed, reviewed_tree: receipt.reviewed_tree, checks: receipt.checks.map(({ name, passed, error, result }) => ({ name, passed, error, result: name === 'committed-manifests' ? { count: result?.count, entries: result?.entries } : result })) }, null, 2));
