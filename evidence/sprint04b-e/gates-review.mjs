import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [root, output] = process.argv.slice(2);
const head = 'a58f4cc628e8c56f0c7ccf105b26581ceb9484e1';
const tested = '0cf24f494001711bfb87695536db20732dcb7b1a';
const e = 'a48ad72aa9628774b472b86f900e1009778b01d8';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const gb = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32 << 20 });
const git = (...args) => gb(...args).toString().trim();
const read = file => fs.readFileSync(path.join(root, file));
const json = file => JSON.parse(read(file));
const prefix = 'evidence/sprint04b-root/gates-01';
const security = `${prefix}/security`;
assert.ok(root && output && !fs.existsSync(output));
assert.equal(git('rev-parse', 'HEAD'), head); assert.equal(git('status', '--porcelain'), '');
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no']).toString().trim(), '');
fs.mkdirSync(output, { recursive: true });
const receipt = { head, tree: git('rev-parse', 'HEAD^{tree}'), tested, reviewer: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(),
  argv: process.argv, node: process.version, node_sha256: sha(fs.readFileSync(process.execPath)), started_at: new Date().toISOString(), manifests: [], scanners: [] };
try {
  const additions = git('diff', '--name-only', tested, head).split('\n');
  assert.ok(additions.every(file => /^(docs\/reports\/sprint04b-(completion|e-b-review)\.md$|evidence\/sprint04b-(e\/|root\/gates-01\/))/.test(file)));
  assert.equal(git('diff', '--name-only', tested, head, '--', '.', ':!docs', ':!evidence'), '');
  receipt.receipt_only_diff = additions.map(file => {
    if (file.startsWith('evidence/sprint04b-e/') || file === 'docs/reports/sprint04b-e-b-review.md') assert.equal(sha(read(file)), sha(gb('show', `${e}:${file}`)), file);
    assert.equal(sha(read(file)), sha(gb('show', `${head}:${file}`)), file);
    return { file, sha256: sha(read(file)) };
  });
  const inventory = directory => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? inventory(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);
  const files = inventory(prefix); const listed = [];
  for (const line of read(`${prefix}/SHA256SUMS`).toString().trim().split('\n')) {
    const [, expected, file] = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.ok(file.startsWith(`${prefix}/`) && !listed.includes(file)); listed.push(file);
    assert.equal(sha(read(file)), expected, file);
    receipt.manifests.push({ file, sha256: expected });
  }
  assert.equal(listed.length, 56);
  assert.deepEqual(files.filter(file => !file.endsWith('/SHA256SUMS')).sort(), listed.sort());
  assert.ok(files.every(file => !/compose-config|\.(tar|gz|zip)$/.test(file)));
  const r = json(`${prefix}/commands.json`);
  assert.equal(r.source_commit, tested); assert.equal(r.source_tree, git('rev-parse', `${tested}^{tree}`));
  assert.equal(r.tracked_clean, true); assert.equal(r.passed, true); assert.equal(r.lock_held_through_cleanup, true);
  assert.equal(r.fixture_lock, '/tmp/aegisgate-sprint02-fixtures.lock'); assert.equal(r.compose_project, 'aegisgate-04b-root');
  assert.deepEqual(r.remaining_project_containers, []); assert.ok(!r.error);
  assert.deepEqual(r.commands.map(c => c.label), ['check', 'security-scan', 'cleanup', 'cleanup-volumes']);
  for (const c of r.commands) {
    assert.equal(c.exit_code, 0); assert.equal(c.signal, null);
    assert.ok(Date.parse(c.ended_at) >= Date.parse(c.started_at));
    for (const stream of c.streams) assert.equal(sha(read(stream.file)), stream.sha256);
  }
  assert.equal(sha(fs.readFileSync(r.node_binary)), r.node_sha256);
  receipt.gate = r;
  const scanlog = read(`${prefix}/security-scan.stdout.log`).toString();
  const labels = [...scanlog.matchAll(/^Running (.+)$/gm)].map(m => m[1]);
  assert.equal(labels.length, 26); assert.equal(new Set(labels).size, labels.length);
  for (const label of labels) assert.ok(scanlog.includes(`PASS ${label}\n`), label);
  assert.ok(!/^FAIL /m.test(scanlog)); receipt.scanner_labels = labels;
  for (const family of ['rust', 'pingora-spike', 'hyper-spike']) {
    const j = json(`${security}/${family}-vulnerabilities.log`);
    assert.equal(j.vulnerabilities.found, false); assert.equal(j.vulnerabilities.count, 0);
    assert.deepEqual(j.vulnerabilities.list, []); assert.ok(j.lockfile['dependency-count'] > 0);
    assert.deepEqual(j.settings.ignore, []);
    receipt.scanners.push({ family, dependencies: j.lockfile['dependency-count'], vulnerabilities: 0, database: j.database });
  }
  for (const family of ['root', 'dashboard', 'spike']) {
    const j = json(`${security}/npm-${family}-vulnerabilities.log`);
    assert.equal(j.metadata.vulnerabilities.total, 0); assert.ok(j.metadata.dependencies.total > 0);
    receipt.scanners.push({ family: `npm-${family}`, dependencies: j.metadata.dependencies.total, vulnerabilities: 0 });
  }
  assert.match(read(`${security}/go-vulnerabilities.log`).toString(), /No vulnerabilities found\./);
  for (const name of ['secrets', 'history-secrets']) assert.deepEqual(json(`${security}/${name}.json`), []);
  const worktree = read(`${security}/worktree-secrets.log`).toString(); assert.match(worktree, /scanned ~\d+ bytes/); assert.match(worktree, /no leaks found/);
  const history = read(`${security}/history-gitleaks.log`).toString(); assert.match(history, /282 commits scanned/); assert.match(history, /no leaks found/);
  assert.match(read(`${security}/history-git-preflight.log`).toString(), /311 commits available/);
  assert.match(read(`${security}/history-secrets.log`).toString(), /282 commits scanned/);
  receipt.secret_inputs = { worktree_bytes: Number(/scanned ~(\d+) bytes/.exec(worktree)[1]), history_bytes: Number(/scanned ~(\d+) bytes/.exec(history)[1]), history_commits: 282, available_commits: 311 };
  for (const family of ['filesystem', 'envoy-spike', 'image-1', 'image-2', 'image-3', 'image-4']) {
    const j = json(`${security}/${family}-vulnerabilities.json`); assert.equal(j.SchemaVersion, 2); assert.ok(j.Results.length > 0);
    const packages = j.Results.reduce((n, result) => n + (result.Packages?.length ?? 0), 0); assert.ok(packages > 0);
    const findings = j.Results.flatMap(result => result.Vulnerabilities ?? []); assert.ok(findings.every(f => !['HIGH', 'CRITICAL'].includes(f.Severity)));
    receipt.scanners.push({ family, artifact: j.ArtifactName, config_id: j.Metadata?.ImageID, packages, high_critical: 0, findings: findings.length });
  }
  receipt.sboms = [];
  for (const family of ['repository', 'envoy-spike', 'image-1', 'image-2', 'image-3', 'image-4']) {
    const j = json(`${security}/${family}.cdx.json`); assert.equal(j.bomFormat, 'CycloneDX'); assert.ok(j.components.length > 0);
    receipt.sboms.push({ family, components: j.components.length });
  }
  const lock = json(`${security}/fixture-images.lock.json`);
  receipt.images = read(`${security}/image-inventory.tsv`).toString().trim().split('\n').map(line => line.split('\t'));
  assert.deepEqual(receipt.images.map(row => row[0]), ['demo-origin', 'nats', 'postgres', 'redis']);
  for (const [i, [service, source, image]] of receipt.images.entries()) {
    if (source === 'local') {
      assert.equal(lock[service].image_id, image);
      assert.equal(sha(read(`infra/compose/Dockerfile.${service === 'demo-origin' ? 'origin' : 'postgres'}`)), lock[service].dockerfile_sha256);
      const bytes = Buffer.concat(lock[service].source_files.flatMap(file => [Buffer.from(`${file}\0`), read(`infra/compose/${file}`), Buffer.from('\0')]));
      assert.equal(sha(bytes), lock[service].source_sha256);
      assert.match(read(`${security}/image-${i + 1}-identity.log`).toString(), /PASS: scanned config digest is bound to immutable image through verified archive hashes/);
    } else assert.match(image, /@sha256:[a-f0-9]{64}$/);
  }
  assert.equal(json(`${security}/envoy-spike-vulnerabilities.json`).ArtifactName, json('spikes/envoy/image.lock.json').image);
  const check = read(`${prefix}/check.stdout.log`).toString();
  for (const marker of ['PASS immutable baseline', 'PASS: actual OpenAPI-generated Go envelope', 'PASS: local Postgres transaction', 'PASS: exact local Postgres image fresh initialization', 'PASS: formatting, Go vet, schema compatibility', 'new relay preserves native H2 body', 'native H2 direct and observed controls', 'go test -race', 'negative_runtime_cannot_be_enabled_by_untrusted_flags']) assert.ok(check.includes(marker), marker);
  assert.ok(!/^FAIL\s|--- FAIL:|^test result: FAILED|^\s*ℹ fail [1-9]/m.test(check));
  assert.equal(git('status', '--porcelain'), '');
  receipt.exit_code = 0; receipt.verdict = 'ACCEPT a58f4cc receipt/docs integration and full local gates at identical executable source0cf24f4; exact final hosted/main jobs remain pending';
} catch (error) { receipt.error = error.stack; receipt.exit_code = 1; process.exitCode = 1; }
finally {
  receipt.ended_at = new Date().toISOString(); receipt.scope = 'Read-only finalized source/receipt equality, complete manifest/streams, structured scanner inputs/findings/SBOM/image locks, raw test/cleanup logs. No scanner rerun, live fixture access, hosted success assertion, runtime GO or contract change.';
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(receipt, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), fs.readdirSync(output).sort().map(file => `${sha(fs.readFileSync(path.join(output, file)))}  ${path.join(output, file)}`).join('\n') + '\n');
  console.log(JSON.stringify({ output, exit_code: receipt.exit_code, verdict: receipt.verdict, error: receipt.error ?? null }));
}
