import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

process.umask(0o077);
const root = process.cwd();
const output = path.join(root, 'evidence/sprint03a-e/published');
const scratch = path.join(root, '.local/published');
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });
const digest = (v) => createHash('sha256').update(v).digest('hex');
const result = { started_at: new Date().toISOString(), packages: [] };
const locked = spawnSync('python3', ['-c', 'import json,tomllib; print(json.dumps(tomllib.load(open("spikes/pingora/Cargo.lock","rb"))))'], { encoding: 'utf8' });
assert.equal(locked.status, 0);
const lock = JSON.parse(locked.stdout);
for (const [name, files] of Object.entries({
  'pingora-core': ['Cargo.toml', 'src/protocols/http/v1/server.rs', 'src/protocols/http/custom/server.rs', 'src/server/configuration/mod.rs'],
  'pingora-proxy': ['Cargo.toml', 'src/lib.rs', 'src/proxy_trait.rs'],
  'pingora-load-balancing': ['Cargo.toml'],
})) {
  const pkg = lock.package.find((p) => p.name === name);
  assert.ok(pkg);
  const prefix = `${name}-${pkg.version}`;
  const url = `https://static.crates.io/crates/${name}/${prefix}.crate`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  const archive = Buffer.from(await response.arrayBuffer());
  assert.equal(digest(archive), pkg.checksum);
  const archivePath = path.join(scratch, `${prefix}.crate`);
  fs.writeFileSync(archivePath, archive);
  const entry = { name, version: pkg.version, url, fetched_at: new Date().toISOString(), archive_sha256: digest(archive), lock_checksum: pkg.checksum, files: [] };
  for (const file of files) {
    const unpacked = spawnSync('tar', ['-xOf', archivePath, `${prefix}/${file}`], { maxBuffer: 16 * 1024 * 1024 });
    assert.equal(unpacked.status, 0);
    const cached = fs.readFileSync(`/home/tiecont/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/${prefix}/${file}`);
    assert.ok(unpacked.stdout.equals(cached));
    entry.files.push({ file, published_sha256: digest(unpacked.stdout), cached_sha256: digest(cached), equal: true });
  }
  result.packages.push(entry);
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
}
result.completed_at = new Date().toISOString();
fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
console.log('PASS exact-lock published Pingora archives and selected parser/proxy/config source bytes');
