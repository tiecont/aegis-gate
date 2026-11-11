import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const spike = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(spike, '../..');
const output = path.join(root, '.local/evidence/pingora');
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
function capture(name, program, args) {
  const result = execFileSync(program, args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(output, name), result, { mode: 0o600 });
  return result;
}
const metadata = JSON.parse(capture('metadata.json', 'cargo', ['+1.99.1', 'metadata', '--locked', '--manifest-path', 'spikes/pingora/Cargo.toml', '--format-version', '1']));
capture('features.txt', 'cargo', ['+1.99.1', 'tree', '--locked', '--manifest-path', 'spikes/pingora/Cargo.toml', '-e', 'features', '--edges', 'normal']);
const rustAudit = JSON.parse(capture('audit.json', path.join(root, '.local/tools/bin/cargo-audit'), ['audit', '--file', 'spikes/pingora/Cargo.lock', '--json']));
const npmAudit = JSON.parse(capture('npm-audit.json', 'npm', ['audit', '--prefix', 'spikes/pingora', '--json']));
const lock = JSON.parse(fs.readFileSync(path.join(spike, 'package-lock.json'), 'utf8'));
const licenses = { rust: metadata.packages.map(({ name, version, license }) => ({ name, version, license })),
  node: Object.entries(lock.packages).filter(([name]) => name).map(([name, item]) => ({ name: name.replace(/^node_modules\//, ''), version: item.version, license: item.license ?? null })) };
fs.writeFileSync(path.join(output, 'licenses.json'), JSON.stringify(licenses, null, 2), { mode: 0o600 });
for (const [name, url] of Object.entries({ 'release.json': 'https://api.github.com/repos/cloudflare/pingora/releases/latest',
  'crate.json': 'https://crates.io/api/v1/crates/pingora/0.9.1' })) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'AegisGate-local-feasibility' } });
  if (!response.ok) throw new Error(`metadata fetch failed: ${response.status}`);
  fs.writeFileSync(path.join(output, name), JSON.stringify({ fetched_at: new Date().toISOString(), source: url, data: await response.json() }, null, 2), { mode: 0o600 });
}
console.log(JSON.stringify({ rust_packages: metadata.packages.length, rust_vulnerabilities: rustAudit.vulnerabilities.count,
  rust_warnings: Object.fromEntries(Object.entries(rustAudit.warnings).map(([key, items]) => [key, items.length])),
  npm_vulnerabilities: npmAudit.metadata.vulnerabilities.total,
  missing_license_metadata: [...licenses.rust, ...licenses.node].filter((p) => !p.license).map((p) => p.name),
  rust_license_expressions: [...new Set(licenses.rust.map((p) => p.license))].sort(), output }, null, 2));
