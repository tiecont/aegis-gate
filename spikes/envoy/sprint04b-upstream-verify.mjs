import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { receipt, hash, git } from './sprint04b-receipts.mjs';

const proof = receipt(process.argv[2]);
try {
  proof.record.verified = [];
  for (const dir of ['upstream-01', 'upstream-02', 'repro-01', 'repro-02', 'repro-03']) {
    const folder = `evidence/sprint04b-b/${dir}`;
    const collected = JSON.parse(fs.readFileSync(`${folder}/commands.json`));
    assert.equal(collected.tracked_clean, true);
    assert.equal(git('rev-parse', `${collected.source_commit}^{tree}`), collected.source_tree);
    for (const entry of collected.sources) {
      assert.equal(hash(execFileSync('git', ['show', `${collected.source_commit}:${entry.file}`])), entry.sha256);
    }
    let files = 0;
    for (const line of fs.readFileSync(`${folder}/SHA256SUMS`, 'utf8').trim().split('\n')) {
      const [, expected, file] = /^(\w{64})  (.+)$/.exec(line);
      assert.equal(hash(fs.readFileSync(file)), expected, file); files++;
    }
    for (const row of collected.commands) for (const entry of [row.stdout, row.stderr].filter(Boolean)) {
      assert.equal(hash(fs.readFileSync(entry.file)), entry.sha256);
    }
    proof.record.verified.push({ directory: folder, source_commit: collected.source_commit, files,
      retained_error: collected.error ?? null, nonzero_commands: collected.commands.filter((r) => r.exit_code !== 0).length });
  }
  const upstream = JSON.parse(fs.readFileSync('evidence/sprint04b-b/upstream-02/commands.json'));
  assert.ok(upstream.releases.every((r) => r.same_revision));
  const repro = JSON.parse(fs.readFileSync('evidence/sprint04b-b/repro-03/commands.json'));
  assert.match(repro.error, /undefined/); assert.equal(repro.probes.length, 4);
  assert.equal(repro.observer_control.exact_match, true);
  assert.equal(repro.observer_control.observed_bytes, 76);
  assert.equal(repro.probes[1].origin.decrypted_bytes, 177);
  assert.equal(repro.probes[1].origin.handlers.length, 1);
  assert.deepEqual(repro.probes[3].origin.handlers[0].trailers, []);
  assert.equal(repro.cleanup.container_absent, true); assert.equal(repro.cleanup.fixture_removed, true);
  assert.equal(repro.cleanup.lock_held_through_cleanup, true);
  for (const file of ['sprint04b-receipts.mjs', 'sprint04b-upstream.mjs', 'sprint04b-repro.mjs', 'sprint04b-upstream-verify.mjs'])
    proof.command(`syntax-${file}`, [process.execPath, '--check', `spikes/envoy/${file}`]);
  proof.command('immutable-extraction', [process.execPath, 'spikes/edge-comparison/extract-baseline.mjs', '--check']);
  const original = git('ls-tree', '-r', '--name-only', 'cbb5f71', '--', 'spikes', 'apps', 'internal',
    'docs/THREAT_MODEL.md', 'docs/QUALITY_GATES.md').split('\n').filter(Boolean);
  proof.command('unchanged-existing-runtime-and-contract', ['git', 'diff', '--exit-code', 'cbb5f71', '--', ...original]);
  proof.command('whitespace', ['git', 'diff', '--check', 'cbb5f71', '--', 'spikes/envoy/sprint04b-*',
    'evidence/sprint04b-b/PLAN.md', 'evidence/sprint04b-b/upstream-requests.md', 'docs/reports/sprint04b-b-upstream.md']);
  const root = process.cwd();
  proof.command('scoped-secrets', ['flock', '-w', '600', '/tmp/aegisgate-sprint02-fixtures.lock',
    'docker', 'run', '--rm', '--pull', 'never', '--network', 'none', '--memory', '128m',
    '--user', `${process.getuid()}:${process.getgid()}`, '-v', `${root}/evidence/sprint04b-b:/review/evidence:ro`,
    ...['receipts', 'upstream', 'repro', 'upstream-verify'].flatMap((n) => ['-v', `${root}/spikes/envoy/sprint04b-${n}.mjs:/review/${n}.mjs:ro`]),
    '-v', `${root}/docs/reports/sprint04b-b-upstream.md:/review/report.md:ro`,
    '-v', `${root}/.github/gitleaks.toml:/config.toml:ro`, '-v', `${root}/${process.argv[2]}:/reports`,
    'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f',
    'dir', '/review', '--config', '/config.toml', '--redact', '--no-banner', '--report-format', 'json',
    '--report-path', '/reports/secrets.json'], { timeout: 650000 });
} catch (error) { proof.record.error = error.stack; }
finally {
  proof.finish();
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
  const files = [...walk('evidence/sprint04b-b'), 'docs/reports/sprint04b-b-upstream.md',
    ...git('ls-files', 'spikes/envoy/sprint04b-*').split('\n')].filter((f) => f !== 'evidence/sprint04b-b/SHA256SUMS');
  fs.writeFileSync('evidence/sprint04b-b/SHA256SUMS', files.sort().map((f) => `${hash(fs.readFileSync(f))}  ${f}`).join('\n') + '\n', { flag: 'wx' });
}
