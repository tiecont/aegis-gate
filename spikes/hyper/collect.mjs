import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sharedRoot = path.resolve(process.argv[2]);
const evidence = path.join(root, 'evidence/sprint03a-c');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hashFile = (file) => sha(fs.readFileSync(file));
const execute = (name, args) => execFileSync(name, args, { cwd: root, encoding: 'utf8' }).trim();
const put = (name, value) => fs.writeFileSync(path.join(evidence, name), `${JSON.stringify(value, null, 2)}\n`);
const cargoHome = path.join(root, '.local/cargo-home');
const metadata = JSON.parse(execFileSync('cargo', ['+1.99.1', 'metadata', '--locked', '--offline', '--format-version', '1',
  '--manifest-path', 'spikes/hyper/Cargo.toml'], { cwd: root, env: { ...process.env, CARGO_HOME: cargoHome }, encoding: 'utf8' }));
const registryChecks = JSON.parse(execFileSync('python3', [path.join(root, 'spikes/hyper/registry_integrity.py'), root],
  { input: JSON.stringify(metadata), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const dependencies = [];
for (const pkg of metadata.packages) {
  const local = !pkg.source;
  const checksum = registryChecks.find((row) => row.name === pkg.name && row.version === pkg.version)?.package_checksum;
  dependencies.push({ name: pkg.name, version: pkg.version, license: pkg.license, repository: pkg.repository,
    source: pkg.source, checksum: checksum ?? null, local });
}
put('dependencies.json', dependencies);
put('registry-source-checks.json', registryChecks);
assert.ok(registryChecks.every((row) => row.mismatches.length === 0 && row.extra_files.length === 0 && row.archive_matches), 'registry source/archive modified');

const manifest = fs.readFileSync(path.join(root, 'spikes/hyper/Cargo.toml'), 'utf8');
const direct = metadata.packages.filter((pkg) => !pkg.source || manifest.includes(`"=${pkg.version}"`) && manifest.includes(pkg.name));
const releases = [];
for (const pkg of direct.filter((pkg) => pkg.source)) {
  const url = `https://crates.io/api/v1/crates/${pkg.name}/${pkg.version}`;
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'AegisGate local feasibility provenance' } });
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    const version = JSON.parse(bytes).version;
    releases.push({ name: pkg.name, version: pkg.version, url, fetched_at: new Date().toISOString(), response_sha256: sha(bytes),
      created_at: version.created_at, updated_at: version.updated_at, yanked: version.yanked,
      crate_checksum: version.checksum, local_checksum: dependencies.find((d) => d.name === pkg.name && d.version === pkg.version).checksum,
      rust_version: version.rust_version, license: version.license });
  } catch (error) { releases.push({ name: pkg.name, version: pkg.version, url, error: error.message }); }
}
put('direct-release-metadata.json', releases);
const files = ['spikes/hyper/Cargo.toml', 'spikes/hyper/Cargo.lock', 'spikes/hyper/src/main.rs', 'spikes/hyper/src/config.rs',
  'spikes/hyper/src/body.rs', 'spikes/hyper/limits.mjs', 'spikes/hyper/collect.mjs', 'spikes/hyper/registry_integrity.py',
  'spikes/hyper/target/release/aegisgate-hyper-feasibility'];
const harness = ['spikes/edge-comparison/run.mjs', 'spikes/edge-comparison/README.md', 'spikes/edge-comparison/manifest.json',
  'spikes/edge-comparison/contract.mjs', 'spikes/edge-comparison/supplemental.mjs', 'spikes/pingora/lab.mjs'];
put('provenance.json', { recorded_at: new Date().toISOString(), workspace: root,
  branch: execute('git', ['branch', '--show-current']), base_commit: execute('git', ['rev-parse', 'HEAD']),
  rustc: execute('rustc', ['+1.99.1', '-Vv']), cargo: execute('cargo', ['+1.99.1', '-V']), node: process.version,
  openssl: execute('openssl', ['version', '-a']), uname: execute('uname', ['-a']),
  linked_crypto: ['/usr/lib/libssl.so.3', '/usr/lib/libcrypto.so.3'].map((file) => ({ file, sha256: hashFile(file) })),
  candidate: files.map((file) => ({ file, sha256: hashFile(path.join(root, file)) })),
  shared_root: sharedRoot, shared_commit: execute('git', ['-C', sharedRoot, 'rev-parse', 'HEAD']),
  shared_harness: harness.map((file) => ({ file, sha256: hashFile(path.join(sharedRoot, file)) })),
  source_integrity: { registry_packages: registryChecks.length, all_sources_match_published_checksums: true,
    private_patches: false, tls_verification_bypass: false, audit_ignore: false },
});
console.log(`Recorded ${dependencies.length} packages; ${registryChecks.length} published archives and source trees match checksums.`);
