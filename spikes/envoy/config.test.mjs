import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateManifest, readBounded, compile } from './config.mjs';

const fixture = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-envoy-unit-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'key'),
    '-out', path.join(dir, 'cert'), '-days', '1', '-subj', '/CN=edge-a.test', '-addext', 'subjectAltName=DNS:edge-a.test'], { stdio: 'ignore' });
  fs.chmodSync(path.join(dir, 'key'), 0o600);
  const manifest = path.join(dir, 'manifest.json');
  const value = { generation: 1, ca_file: path.join(dir, 'cert'), routes: [{ host: 'edge-a.test', origin_name: 'origin.test',
    origin_port: 12345, cert_file: path.join(dir, 'cert'), key_file: path.join(dir, 'key'), h2: false }] };
  const write = (v = value) => fs.writeFileSync(manifest, JSON.stringify(v));
  write();
  return { dir, manifest, value, write, close: () => fs.rmSync(dir, { recursive: true, force: true }) };
};

test('manifest rejects replay, unknown fields, duplicate hosts, invalid ports and weights', () => {
  const f = fixture();
  try {
    assert.equal(validateManifest(f.manifest).generation, 1);
    assert.throws(() => validateManifest(f.manifest, 1));
    for (const value of [
      { ...f.value, insecure: true },
      { ...f.value, routes: [f.value.routes[0], f.value.routes[0]] },
      { ...f.value, routes: [{ ...f.value.routes[0], origin_port: 80 }] },
      { ...f.value, routes: [{ ...f.value.routes[0], backends: [{ port: 12345, weight: 0 }] }] },
    ]) { f.write(value); assert.throws(() => validateManifest(f.manifest)); }
  } finally { f.close(); }
});

test('private key permissions, SAN mismatch, symlinks and fixture bounds fail closed', () => {
  const f = fixture();
  try {
    fs.chmodSync(f.value.routes[0].key_file, 0o644);
    assert.throws(() => validateManifest(f.manifest));
    fs.chmodSync(f.value.routes[0].key_file, 0o600);
    f.write({ ...f.value, routes: [{ ...f.value.routes[0], host: 'edge-b.test' }] });
    assert.throws(() => validateManifest(f.manifest));
    fs.symlinkSync(f.value.ca_file, path.join(f.dir, 'link'));
    assert.throws(() => readBounded(path.join(f.dir, 'link'), f.dir));
    assert.throws(() => readBounded('/etc/hosts', f.dir));
    fs.writeFileSync(path.join(f.dir, 'large'), Buffer.alloc(65537));
    assert.throws(() => readBounded(path.join(f.dir, 'large'), f.dir));
  } finally { f.close(); }
});

test('compiled origin trust and pools change across route and generation boundaries', () => {
  const f = fixture();
  try {
    const first = compile(validateManifest(f.manifest), 12346, f.dir);
    const other = compile({ ...f.value, generation: 2, routes: [f.value.routes[0], { ...f.value.routes[0], host: 'edge-b.test' }] }, 12346, f.dir);
    const clusters = (v) => v.files[path.join(f.dir, 'clusters.json')].resources;
    assert.notEqual(clusters(first)[0].name, clusters(other)[0].name);
    assert.notEqual(clusters(other)[0].name, clusters(other)[1].name);
    for (const c of clusters(other)) {
      const tls = c.transport_socket.typed_config;
      assert.equal(tls.sni, 'origin.test');
      assert.equal(tls.common_tls_context.validation_context.trusted_ca.filename, f.value.ca_file);
      assert.equal(tls.common_tls_context.validation_context.match_typed_subject_alt_names[0].matcher.exact, 'origin.test');
    }
    assert.equal(first.bootstrap.static_resources.listeners[0].address.socket_address.address, '127.0.0.1');
    assert.equal(first.bootstrap.admin, undefined);
  } finally { f.close(); }
});
