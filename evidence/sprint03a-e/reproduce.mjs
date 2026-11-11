import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.umask(0o077);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'evidence/sprint03a-e');
const privateRoot = path.join(root, '.local');
fs.mkdirSync(privateRoot, { recursive: true, mode: 0o700 });
fs.chmodSync(privateRoot, 0o700);
const lock = '/tmp/aegisgate-sprint02-fixtures.lock';
const inode = fs.statSync(lock).ino;
assert.ok(fs.readFileSync('/proc/locks', 'utf8').split('\n').some((line) => {
  const f = line.trim().split(/\s+/);
  return f[1] === 'FLOCK' && f[3] === 'WRITE' && f[4] === String(process.ppid) && f[5]?.endsWith(`:${inode}`);
}), 'invoke directly under flock for the entire command');
const shared = '/home/tiecont/Projects/aegis-gate';
const node = path.join(shared, '.local/toolchains/node/bin/node');
const env = { ...process.env, PATH: `${path.dirname(node)}:${process.env.PATH}` };
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const commands = [];
const mode = process.argv[2];
assert.match(mode, /^[a-z0-9-]+$/);
const destination = path.join(output, mode);
fs.mkdirSync(destination, { recursive: true });
function capture(label, program, args, extra = {}) {
  const started_at = new Date().toISOString();
  const r = spawnSync(program, args, { cwd: root, env: { ...env, ...extra }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(destination, `${label}.stdout.txt`), r.stdout ?? '');
  fs.writeFileSync(path.join(destination, `${label}.stderr.txt`), r.stderr ?? String(r.error ?? ''));
  commands.push({ label, program, args, cwd: root, environment: extra, started_at,
    ended_at: new Date().toISOString(), exit_code: r.status, signal: r.signal, error: r.error?.message,
    stdout_sha256: hash(path.join(destination, `${label}.stdout.txt`)), stderr_sha256: hash(path.join(destination, `${label}.stderr.txt`)) });
  fs.writeFileSync(path.join(destination, 'commands.json'), JSON.stringify({ lock, parent_pid: process.ppid, commands }, null, 2) + '\n');
  console.log(`${label}: exit=${r.status} signal=${r.signal}`);
  return r;
}
const sourceFiles = ['spikes/pingora/Cargo.toml', 'spikes/pingora/Cargo.lock', 'spikes/pingora/src/main.rs', 'spikes/pingora/src/config.rs'];
if (mode === 'prepare') {
  capture('npm-ci', path.join(shared, '.local/toolchains/node/bin/npm'), ['ci', '--prefix', 'spikes/pingora', '--ignore-scripts']);
  capture('manifest', node, ['spikes/edge-comparison/extract-baseline.mjs', '--check']);
  capture('harness-unit', node, ['--test', 'spikes/edge-comparison/contract.test.mjs', 'spikes/edge-comparison/evaluate.test.mjs']);
  capture('pingora-audit', path.join(shared, '.local/tools/bin/cargo-audit'), ['audit', '--file', 'spikes/pingora/Cargo.lock', '--json']);
  capture('npm-audit', path.join(shared, '.local/toolchains/node/bin/npm'), ['audit', '--prefix', 'spikes/pingora', '--json']);
  const binding = sourceFiles.map((file) => {
    const own = hash(path.join(root, file));
    const retained = hash(path.join(shared, file));
    assert.equal(own, retained);
    return { file, own, retained };
  });
  const binary = path.join(shared, 'spikes/pingora/target/release/aegisgate-pingora-feasibility');
  const prior = JSON.parse(fs.readFileSync(path.join(root, 'evidence/sprint02-d/pingora-results.json')));
  fs.writeFileSync(path.join(destination, 'binding.json'), JSON.stringify({ sourceFiles: binding,
    retained_binary: { path: binary, sha256: hash(binary), independently_rebuilt: false },
    original_evidence_sha256: hash(path.join(root, 'evidence/sprint02-d/pingora-results.json')),
    original_candidate: prior.candidate ?? null,
    original_binary_sha256: prior.binary_sha256 ?? null }, null, 2) + '\n');
} else if (mode === 'image-review') {
  const image = 'envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded';
  const scanner = 'aquasec/trivy:0.69.1@sha256:1c78ed1ef824ab8bb05b04359d186e4c1229d0b3e67005faacb54a7d71974f73';
  const cache = path.join(privateRoot, 'trivy-cache');
  fs.cpSync(path.join(shared, '.local/trivy-cache'), cache, { recursive: true });
  capture('image-inspect', 'docker', ['image', 'inspect', image]);
  capture('scanner-inspect', 'docker', ['image', 'inspect', scanner]);
  capture('version', 'docker', ['run', '--rm', '--network', 'none', '--read-only', '--user', `${process.getuid()}:${process.getgid()}`,
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--entrypoint', '/usr/local/bin/envoy', image, '--version']);
  const scannerArgs = ['run', '--rm', '--user', `${process.getuid()}:${process.getgid()}`, '-e', 'TRIVY_CACHE_DIR=/cache',
    '-v', `${cache}:/cache`, '-v', `${destination}:/reports`, scanner, 'image', '--image-src', 'remote'];
  capture('image-scan', 'docker', [...scannerArgs, '--severity', 'HIGH,CRITICAL', '--exit-code', '1', '--format', 'json',
    '--output', '/reports/image-vulnerabilities.json', image]);
  capture('image-sbom', 'docker', [...scannerArgs, '--format', 'cyclonedx', '--output', '/reports/image-sbom.cdx.json', image]);
} else if (mode === 'summary-attempt-01' || mode === 'summary') {
  capture('export', node, ['evidence/sprint03a-e/summarize.mjs']);
} else if (mode === 'source-check') {
  capture('source-doc-json-whitespace', 'git', ['diff', '--check', '--cached', '--', '*.mjs', '*.md', '*.json', '*.jsonl']);
} else if (mode === 'final-check' || mode === 'final-check-02') {
  const scanner = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
  capture('evidence-secrets', 'docker', ['run', '--rm', '--user', `${process.getuid()}:${process.getgid()}`,
    '-v', `${root}:/repo:ro`, '-v', `${destination}:/reports`, scanner, 'dir', '/repo/evidence/sprint03a-e',
    '--config', '/repo/.github/gitleaks.toml', '--redact', '--report-format', 'json', '--report-path', '/reports/evidence-secrets.json', '--no-banner']);
  const reportDir = path.join(privateRoot, 'report-scan');
  fs.mkdirSync(reportDir, { recursive: true, mode: 0o700 });
  fs.copyFileSync(path.join(root, 'docs/reports/sprint03a-e-independent-review.md'), path.join(reportDir, 'sprint03a-e-independent-review.md'));
  capture('report-secrets', 'docker', ['run', '--rm', '--user', `${process.getuid()}:${process.getgid()}`,
    '-v', `${root}:/repo:ro`, '-v', `${reportDir}:/review:ro`, '-v', `${destination}:/reports`, scanner, 'dir', '/review',
    '--config', '/repo/.github/gitleaks.toml', '--redact', '--report-format', 'json', '--report-path', '/reports/report-secrets.json', '--no-banner']);
  capture('diff-check', 'git', ['diff', '--check', '--cached']);
} else if (mode === 'image-binding') {
  const image = 'envoyproxy/envoy@sha256:09ca6f2140a61ad8df11779a4a30d52b48433d444466328494f9188c9c35eded';
  const archive = path.join(privateRoot, 'envoy-image.tar');
  capture('save', 'docker', ['image', 'save', '-o', archive, image]);
  const imageId = JSON.parse(fs.readFileSync(path.join(output, 'image-review/image-inspect.stdout.txt')))[0].Id;
  capture('bind', 'python3', ['scripts/image_identity.py', path.join(output, 'image-review/image-vulnerabilities.json'), archive, imageId]);
  fs.writeFileSync(path.join(destination, 'archive.json'), JSON.stringify({ path: archive, sha256: hash(archive), image, imageId }, null, 2) + '\n');
} else if (mode === 'envoy-benchmark') {
  capture('unit', node, ['--test', 'spikes/envoy/config.test.mjs']);
  capture('benchmark', node, ['spikes/envoy/benchmark.mjs', path.join(output, 'envoy/results.json'), path.join(destination, 'results.json')]);
} else if (mode === 'hyper-build') {
  const cargoHome = path.join(privateRoot, 'cargo-home');
  assert.ok(!fs.existsSync(cargoHome), 'fresh reviewer Cargo cache required');
  fs.mkdirSync(path.join(cargoHome, 'registry'), { recursive: true });
  const registry = '/home/tiecont/Projects/aegis-gate-sprint03-c/.local/cargo-home/registry';
  for (const directory of ['cache', 'index']) fs.cpSync(path.join(registry, directory), path.join(cargoHome, 'registry', directory), { recursive: true });
  const buildEnv = { CARGO_HOME: cargoHome, CARGO_TARGET_DIR: path.join(privateRoot, 'hyper-target') };
  capture('rustc', 'rustc', ['+1.99.1', '-Vv'], buildEnv);
  capture('cargo', 'cargo', ['+1.99.1', '-V'], buildEnv);
  capture('revision', 'git', ['rev-parse', 'HEAD']);
  const manifestArgs = ['--manifest-path', 'spikes/hyper/Cargo.toml'];
  capture('metadata', 'cargo', ['+1.99.1', 'metadata', '--locked', '--offline', '--format-version', '1', ...manifestArgs], buildEnv);
  capture('fmt', 'cargo', ['+1.99.1', 'fmt', '--check', ...manifestArgs], buildEnv);
  capture('release', 'cargo', ['+1.99.1', 'build', '--release', '--locked', '--offline', ...manifestArgs], buildEnv);
  capture('test', 'cargo', ['+1.99.1', 'test', '--locked', '--offline', ...manifestArgs], buildEnv);
  capture('clippy', 'cargo', ['+1.99.1', 'clippy', '--locked', '--offline', ...manifestArgs, '--', '-D', 'warnings'], buildEnv);
  capture('audit', path.join(shared, '.local/tools/bin/cargo-audit'), ['audit', '--file', 'spikes/hyper/Cargo.lock', '--json']);
  const metadata = fs.readFileSync(path.join(destination, 'metadata.stdout.txt'), 'utf8');
  const integrity = spawnSync('python3', ['spikes/hyper/registry_integrity.py', root], { cwd: root, input: metadata, encoding: 'utf8' });
  fs.writeFileSync(path.join(destination, 'registry-integrity.json'), integrity.stdout ?? '');
  fs.writeFileSync(path.join(destination, 'registry-integrity.stderr.txt'), integrity.stderr ?? '');
  assert.equal(integrity.status, 0);
  assert.ok(JSON.parse(integrity.stdout).every((r) => r.archive_matches && !r.mismatches.length && !r.extra_files.length));
  const binary = path.join(privateRoot, 'hyper-target/release/aegisgate-hyper-feasibility');
  capture('ldd', 'ldd', [binary]);
  fs.writeFileSync(path.join(destination, 'binary.json'), JSON.stringify({ path: binary, sha256: hash(binary), freshly_built: true,
    cache: 'Copied only published crate archives and sparse index into fresh reviewer cache; unpacked source and target built here' }, null, 2) + '\n');
} else if (['pingora', 'hyper', 'envoy'].includes(mode)) {
  const runRoot = path.join(privateRoot, mode);
  fs.mkdirSync(runRoot, { mode: 0o700 });
  const binary = mode === 'pingora' ? path.join(shared, 'spikes/pingora/target/release/aegisgate-pingora-feasibility')
    : mode === 'hyper' ? path.join(privateRoot, 'hyper-target/release/aegisgate-hyper-feasibility')
    : path.join(root, 'spikes/envoy/launch');
  const artifacts = mode === 'pingora' ? sourceFiles.map((f) => path.join(root, f))
    : mode === 'hyper' ? ['Cargo.toml', 'Cargo.lock', 'src/main.rs', 'src/config.rs', 'src/body.rs'].map((f) => path.join(root, 'spikes/hyper', f))
    : ['launcher.mjs', 'config.mjs', 'image.lock.json'].map((f) => path.join(root, 'spikes/envoy', f));
  capture('revision', 'git', ['rev-parse', 'HEAD']);
  const result = capture('lab', node, ['spikes/edge-comparison/run.mjs'], {
    PINGORA_SPIKE_PROFILE: 'release', AEGIS_CANDIDATE_NAME: `${mode}-independent-e`,
    AEGIS_RUN_ROOT: runRoot, AEGIS_CANDIDATE_COMMAND: binary,
    AEGIS_CANDIDATE_ARTIFACTS: JSON.stringify(artifacts),
  });
  const resultPath = result.stdout?.match(/^Evidence: (.+\/results\.json)$/m)?.[1];
  if (resultPath) {
    assert.ok(resultPath.startsWith(`${runRoot}/`));
    fs.copyFileSync(resultPath, path.join(destination, 'results.json'));
    const proxyLog = path.join(path.dirname(resultPath), 'proxy.log');
    fs.copyFileSync(proxyLog, path.join(destination, 'proxy.log'));
    if (mode === 'envoy') {
      for (const line of fs.readFileSync(proxyLog, 'utf8').split('\n')) {
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        if (entry.resources?.startsWith(`${privateRoot}/envoy-run-`) && fs.existsSync(entry.resources))
          fs.copyFileSync(entry.resources, path.join(destination, 'resources.jsonl'));
      }
    }
    capture('evaluate', node, ['spikes/edge-comparison/evaluate.mjs', path.join(destination, 'results.json')]);
  } else fs.writeFileSync(path.join(destination, 'INCOMPLETE.txt'), 'No completed results file was emitted. Retain this failed or interrupted attempt.\n');
} else throw new Error('unknown mode');
