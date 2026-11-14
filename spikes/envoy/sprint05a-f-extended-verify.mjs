import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { assertLock } from './wire-fixtures.mjs';

process.umask(0o077); assertLock();
const output = process.argv[2];
assert.match(output ?? '', /^evidence\/sprint05a-f\/extendedchecks-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 << 20 }).trim();
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
fs.mkdirSync(output, { recursive: true });
const sha = (b) => createHash('sha256').update(b).digest('hex');
const json = (f) => JSON.parse(fs.readFileSync(f));
const evidence = 'evidence/sprint05a-f/extended-01';
const record = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  argv: process.argv, started_at: new Date().toISOString(), commands: [], sources: [], manifests: [], security_pass: false };
function run(label, argv, expected = [0]) {
  assertLock(); const started_at = new Date().toISOString();
  const r = spawnSync(argv[0], argv.slice(1), { timeout: 60000, maxBuffer: 16 << 20 });
  const streams = ['stdout', 'stderr'].map((name) => {
    const file = `${output}/${label}.${name}`; const bytes = r[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes); return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  record.commands.push({ label, argv, started_at, ended_at: new Date().toISOString(), exit_code: r.status,
    signal: r.signal, error: r.error?.message, streams });
  console.log(`${label}: exit=${r.status}`); assert.ok(expected.includes(r.status), label); return r.stdout.toString();
}
function source(receipt, field, prefix = '') {
  for (const s of receipt[field]) {
    const actual = execFileSync('git', ['show', `${receipt.source_commit}:${s.file}`], { maxBuffer: 8 << 20 });
    assert.equal(sha(actual), s.sha256, s.file);
  }
  record.sources.push({ commit: receipt.source_commit, files: receipt[field].length, scope: prefix });
}
try {
  const lines = fs.readFileSync(`${evidence}/SHA256SUMS`, 'utf8').trim().split('\n');
  for (const line of lines) { const [digest, file] = line.split('  '); assert.equal(sha(fs.readFileSync(file)), digest, file); }
  record.manifests.push({ file: `${evidence}/SHA256SUMS`, sha256: sha(fs.readFileSync(`${evidence}/SHA256SUMS`)), entries: lines.length });
  const extended = json(`${evidence}/receipt.json`); assert.equal(extended.completed, true);
  for (const checkout of extended.checkouts) {
    const current = git('ls-tree', '-r', checkout.commit).split('\n'); const names = new Map(current.map((l) => [l.split('\t')[1], l]));
    const baseline = git('ls-tree', '-r', '541d1d9').split('\n');
    for (const l of baseline) assert.equal(names.get(l.split('\t')[1]), l);
    assert.equal(baseline.length, 4003);
    run(`clean-${checkout.name}`, ['git', '-C', checkout.cwd, 'diff', '--exit-code', checkout.commit]);
  }
  const b = json(`${evidence}/b-llhttp/receipt.json`); source(b, 'sources', 'B llhttp');
  for (const p of b.pins.downloads) {
    const cached = path.resolve('/tmp/aegisgate-05a-f-exact-b', p.cache);
    assert.equal(sha(fs.readFileSync(cached)), p.sha256, p.name);
  }
  for (const p of b.parses) {
    if (p.result.error !== 'HPE_INVALID_HEADER_TOKEN') continue;
    const bytes = Buffer.from(p.input_hex, 'hex');
    assert.ok([32, 9].includes(bytes[p.result.consumed]));
    assert.equal(bytes.subarray(p.result.consumed - 2, p.result.consumed).toString(), '\r\n');
    for (const e of p.result.events) assert.ok(e.offset + e.hex.length / 2 <= p.result.consumed);
  }
  for (const p of b.fragment_checks.filter((p) => p.name !== 'valid-trailer')) assert.equal(p.complete_count, 0);
  const delayed = b.probes.find((p) => p.name === 'delayed-folded-trailer');
  assert.deepEqual(delayed.before_final_fragment, { origin_bytes: 0, new_connections: 0, handlers: [] });
  const mixed = b.probes.find((p) => p.name === 'valid-then-folded-pipeline');
  assert.deepEqual(mixed.status, [200, 400]); assert.equal(mixed.origin.bytes, 52); assert.equal(mixed.origin.handlers.length, 1);
  assert.equal(Buffer.from(mixed.origin.hex, 'hex').toString(), 'GET /first%2Fsegment HTTP/1.1\r\nHost: edge-a.test\r\n\r\n');
  const c = json(`${evidence}/c-original75/receipt.json`); source(c, 'source_hashes', 'C original75');
  const raw = json(`${evidence}/c-original75/raw-h2.json`); assert.equal(raw.incomplete, false);
  const i = raw.boundaries.findIndex((b) => b.message.startsWith('FAIL HTTP2-authority-Host-and-SNI-confusion-rejected'));
  const before = raw.boundaries[i - 1]; const after = raw.boundaries[i];
  const chunks = raw.connections.flatMap((c) => c.chunks.filter((p) => BigInt(p.time_ns) > BigInt(before.time_ns) && BigInt(p.time_ns) < BigInt(after.time_ns)).map((p) => ({ connection: c.id, ...p })));
  assert.equal(chunks.map((c) => c.hex).join(''), '000000040100000000');
  record.h2 = { before, after, chunks, ack_sha256: sha(Buffer.from(chunks[0].hex, 'hex')), repaired: false };
  const combined = json(`${evidence}/combined/commands.json`); source(combined, 'sources', 'combined');
  assert.equal(combined.original75.passed, 73); assert.equal(combined.original23.passed, 19);
  const extra = json(`${evidence}/combined/original23.json`);
  record.header_repairs = [];
  for (const name of ['raw-H2-uppercase-header-name', 'raw-H2-connection-specific-header']) {
    const p = extra.tests.find((t) => t.name === name); assert.equal(p.status, 'pass');
    for (const k of ['connections', 'bytes', 'handlers', 'parser_errors', 'transport_errors']) assert.equal(p.origin[k], 0);
    assert.ok(p.error_frames.some((f) => f.hex === '00000403000000000100000001'));
    record.header_repairs.push(p);
  }
  const controls = json(`${evidence}/combined/controls.json`); assert.equal(controls.semantic_security_pass, false);
  assert.ok(controls.tests.length === 17 && controls.tests.every((p) => p.status === 'observation-complete'));
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  const heads = [...extended.checkouts, { name: 'b-final', cwd: '/tmp/aegisgate-05a-b', commit: git('rev-parse', 'feat/sprint05a-strict-parser') },
    { name: 'f', cwd: process.cwd(), commit: record.source_commit }];
  for (const head of heads) {
    const args = ['docker', 'run', '--rm', '--pull', 'never', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`,
      '-v', `${head.cwd}:/repo:ro`];
    run(`secrets-tree-${head.name}`, [...args, scanner, 'dir', '/repo', '--config', '/repo/.github/gitleaks.toml', '--redact', '--no-banner']);
    run(`secrets-history-${head.name}`, [...args, '-v', `${common}:/git-common:ro`, '-e', 'GIT_DIR=/git-common', '-e', 'GIT_WORK_TREE=/repo',
      scanner, 'git', '/repo', '--config', '/repo/.github/gitleaks.toml', '--redact', '--no-banner', `--log-opts=541d1d9..${head.commit}`]);
  }
  run('baseline', [process.execPath, 'spikes/edge-comparison/extract-baseline.mjs', '--check']);
  run('immutable-tests', [process.execPath, '--test', 'spikes/edge-comparison/contract.test.mjs', 'spikes/edge-comparison/evaluate.test.mjs', 'spikes/edge-comparison/tls-observer.test.mjs']);
  const listing = run('cleanup-inventory', ['docker', 'ps', '-a', '--filter', 'name=^/aegis-envoy-', '--filter', 'name=^/aegis-sprint05a-', '--format', '{{.ID}} {{.Names}}']);
  assert.equal(listing.trim(), '');
  for (const head of extended.checkouts) if (fs.existsSync(`${head.cwd}/.local`)) {
    const dirs = fs.readdirSync(`${head.cwd}/.local`).filter((p) => p !== 'sprint05a-b-sources');
    assert.deepEqual(dirs, [], head.name);
  }
  run('authored-whitespace', ['git', 'diff', '--check', '541d1d9', '--', 'spikes/envoy/sprint05a-f-*', 'docs/reports/sprint05a-f*']);
  record.completed = true;
} catch (error) { record.error = error.stack; process.exitCode = 1; }
finally {
  assertLock(); record.ended_at = new Date().toISOString(); record.lock_held_through_hashing = true;
  fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(record, null, 2) + '\n');
  const files = fs.readdirSync(output).sort();
  fs.writeFileSync(`${output}/SHA256SUMS`, files.map((f) => `${sha(fs.readFileSync(`${output}/${f}`))}  ${output}/${f}\n`).join(''));
}
