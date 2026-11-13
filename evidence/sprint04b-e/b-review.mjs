import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
const [root, output] = process.argv.slice(2);
const head = '5de81795963d07486d0621822131d4e1554ccadc';
const baseline = 'cbb5f71db84b9489bf4a6260696bbba29ab4a561';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const gb = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32 << 20 });
const git = (...args) => gb(...args).toString().trim();
const read = f => fs.readFileSync(path.join(root, f));
const json = f => JSON.parse(read(f));
assert.ok(root && output && !fs.existsSync(output));
assert.equal(git('rev-parse', 'HEAD'), head); assert.equal(git('status', '--porcelain'), '');
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no']).toString().trim(), '');
fs.mkdirSync(output, { recursive: true });
const receipt = { head, tree: git('rev-parse', 'HEAD^{tree}'), reviewer: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(),
  argv: process.argv, node: process.version, node_sha256: hash(fs.readFileSync(process.execPath)), started_at: new Date().toISOString(), commands: [], manifests: [], attempts: [] };
function run(label, program, args) {
  const started_at = new Date().toISOString(); const c = spawnSync(program, args, { cwd: root, maxBuffer: 16 << 20 }); const streams = {};
  for (const stream of ['stdout', 'stderr']) { const file = path.join(output, `${label}.${stream}`); fs.writeFileSync(file, c[stream] ?? '', { flag: 'wx' }); streams[stream] = { file, sha256: hash(fs.readFileSync(file)) }; }
  receipt.commands.push({ label, program, args, cwd: root, started_at, ended_at: new Date().toISOString(), exit_code: c.status, signal: c.signal, streams });
  assert.equal(c.status, 0, label); return c.stdout;
}
try {
  const changed = git('diff', '--name-only', baseline, head).split('\n');
  assert.ok(changed.every(f => /^(spikes\/envoy\/sprint04b-(receipts|repro|upstream|upstream-verify)\.mjs|evidence\/sprint04b-b\/|docs\/reports\/sprint04b-b-upstream.md)/.test(f)));
  receipt.files = changed.map(file => ({ file, sha256: hash(read(file)) }));
  for (const f of git('ls-files', 'evidence/sprint04b-b').split('\n').filter(f => f.endsWith('SHA256SUMS'))) {
    const lines = read(f).toString().trim().split('\n');
    for (const line of lines) { const [, expected, target] = /^([a-f0-9]{64})  (.+)$/.exec(line); assert.equal(hash(read(target)), expected, target); }
    receipt.manifests.push({ file: f, entries: lines.length, sha256: hash(read(f)) });
  }
  for (const dir of ['upstream-01', 'upstream-02', 'repro-01', 'repro-02', 'repro-03', 'verify-01']) {
    const r = json(`evidence/sprint04b-b/${dir}/commands.json`); assert.equal(r.tracked_clean, true);
    assert.equal(git('rev-parse', `${r.source_commit}^{tree}`), r.source_tree);
    for (const f of r.sources) assert.equal(hash(gb('show', `${r.source_commit}:${f.file}`)), f.sha256);
    for (const c of r.commands) for (const stream of [c.stdout, c.stderr]) assert.equal(hash(read(stream.file)), stream.sha256);
    if (r.cleanup) { assert.equal(r.cleanup.container_absent, true); assert.equal(r.cleanup.fixture_removed, true); assert.equal(r.cleanup.lock_held_through_cleanup, true); }
    if (dir === 'upstream-01' || dir === 'repro-02' || dir === 'repro-03') assert.ok(r.error);
    if (dir === 'upstream-02' || dir === 'verify-01') { assert.ok(!r.error); assert.ok(r.commands.every(c => c.exit_code === 0)); }
    receipt.attempts.push({ dir, source: r.source_commit, source_count: r.sources.length, error: r.error ?? null, cleanup: r.cleanup, commands: r.commands.map(c => [c.name, c.exit_code]) });
  }
  const first = json('evidence/sprint04b-b/repro-01/commands.json');
  assert.equal(first.probes.length, 29); assert.ok(first.probes.every(p => p.origin.decrypted_bytes === 0));
  const mapper = first.probes.filter(p => p.listener === 'DPE-501-to-400' && p.expected === 400);
  assert.equal(mapper.length, 8); assert.ok(mapper.every(p => p.status.at(-1) === 501 && p.peer_end && !p.matches_observation));
  const second = json('evidence/sprint04b-b/repro-02/commands.json'); assert.ok(!second.probes?.length); assert.ok(second.cleanup.wall_ms > 90000);
  const third = json('evidence/sprint04b-b/repro-03/commands.json'); assert.equal(third.probes.length, 4);
  assert.equal(third.observer_control.exact_match, true); assert.equal(third.observer_control.observed_bytes, 76);
  assert.equal(Buffer.from(third.observer_control.raw_hex, 'hex').length, 76);
  for (const [i, p] of third.probes.entries()) {
    assert.equal(p.origin.decrypted_bytes, Buffer.from(p.origin.decrypted_hex, 'hex').length);
    assert.equal(p.origin.decrypted_bytes, i < 2 ? 177 : 214); assert.deepEqual(p.status, [200]); assert.equal(p.origin.handlers.length, 1);
    assert.equal(p.origin.parser_errors, 0); assert.equal(p.origin.transport_errors, 0);
    if (i < 2) { const h = p.origin.handlers[0].headers; assert.equal(h[h.findIndex(v => v.toLowerCase() === 'x-folded') + 1], 'first second'); }
    else assert.deepEqual(p.origin.handlers[0].trailers, []);
  }
  receipt.observations = { invalid_first_byte_tap: true, failed_mapper_observations: mapper.length, second_lifecycle_ms: second.cleanup.wall_ms,
    third_control_bytes: 76, third_probes: third.probes.map(p => ({ name: p.name, status: p.status, origin: p.origin })), trailers_unproven: true };
  const upstream = json('evidence/sprint04b-b/upstream-02/commands.json'); receipt.upstream = [];
  const inspect = new Map([
    ['envoy', ['source/common/http/http1/balsa_parser.cc', 'source/common/http/http1/balsa_parser.h', 'envoy/http/header_validator.h', 'source/common/http/http1/codec_impl.cc', 'source/common/http/http2/codec_impl.cc', 'source/common/local_reply/local_reply.cc']],
    ['pingora', ['pingora-core/src/protocols/http/v1/server.rs']], ['hyper', ['src/proto/h1/role.rs']],
  ]);
  for (const project of upstream.releases) {
    assert.equal(project.same_revision, true); assert.match(project.revision, /^[a-f0-9]{40}$/);
    const freshRelease = JSON.parse(run(`release-${project.project}`, 'gh', ['api', `repos/${project.repo}/releases/latest`, '--jq', '{tag_name,draft,prerelease,published_at}']));
    assert.equal(freshRelease.tag_name, project.tag); assert.equal(freshRelease.draft, false); assert.equal(freshRelease.prerelease, false);
    const freshCommit = run(`commit-${project.project}`, 'gh', ['api', `repos/${project.repo}/commits/${project.tag}`, '--jq', '.sha']).toString().trim(); assert.equal(freshCommit, project.revision);
    for (const f of project.files) assert.equal(hash(read(`evidence/sprint04b-b/upstream-02/${project.project}/released/${f.path}.stdout`)), f.sha256);
    for (const [i, file] of inspect.get(project.project).entries()) {
      const bytes = run(`upstream-${project.project}-${i}`, 'curl', ['--fail-with-body', '--silent', '--show-error', '--proto', '=https', '--tlsv1.2', '--connect-timeout', '10', '--max-time', '30', '--max-filesize', '8388608', `https://raw.githubusercontent.com/${project.repo}/${project.revision}/${file}`]);
      assert.equal(hash(bytes), hash(read(`evidence/sprint04b-b/upstream-02/${project.project}/released/${file}.stdout`)));
    }
    receipt.upstream.push({ project: project.project, revision: project.revision, tag: project.tag, retained_files: project.files.length, independently_fetched: inspect.get(project.project) });
  }
  run('immutable75', process.execPath, ['spikes/edge-comparison/extract-baseline.mjs', '--check']);
  run('source-whitespace', 'git', ['diff', '--check', baseline, head, '--', 'spikes/envoy/sprint04b-*', 'docs/reports/sprint04b-b-upstream.md', 'evidence/sprint04b-b/PLAN.md', 'evidence/sprint04b-b/upstream-requests.md']);
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  run('scoped-secrets', 'flock', ['/tmp/aegisgate-sprint02-fixtures.lock', 'docker', 'run', '--rm', '--pull=never', '--network', 'none', '--user', `${process.getuid()}:${process.getgid()}`, '-v', `${root}/evidence/sprint04b-b:/review/evidence:ro`, '-v', `${root}/spikes/envoy:/review/source:ro`, '-v', `${root}/docs/reports/sprint04b-b-upstream.md:/review/report.md:ro`, '-v', `${root}/.github/gitleaks.toml:/config.toml:ro`, scanner, 'dir', '/review', '--config', '/config.toml', '--redact', '--no-banner']);
  assert.equal(git('status', '--porcelain'), ''); receipt.verdict = 'ACCEPT upstream NO-GO research and explicitly unsuccessful standalone evidence; no runtime eligibility'; receipt.exit_code = 0;
} catch (error) { receipt.error = error.stack; receipt.exit_code = 1; process.exitCode = 1; }
finally {
  receipt.ended_at = new Date().toISOString(); receipt.scope = 'Read-only exact B source/receipt review, independent official metadata/eight pinned source fetches, immutable75 and offline scan. No runtime experiment, upstream publication or GO.';
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), fs.readdirSync(output).sort().map(f => `${hash(fs.readFileSync(path.join(output, f)))}  ${path.join(output, f)}`).join('\n') + '\n');
  console.log(JSON.stringify({ output, exit_code: receipt.exit_code, verdict: receipt.verdict, error: receipt.error ?? null }));
}
