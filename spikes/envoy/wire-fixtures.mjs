import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export function assertLock() {
  const inode = fs.statSync('/tmp/aegisgate-sprint02-fixtures.lock').ino;
  const ancestors = new Set(); let pid = process.ppid;
  while (pid > 1 && !ancestors.has(pid)) {
    ancestors.add(pid);
    pid = Number(fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/^PPid:\s+(\d+)/m)[1]);
  }
  assert.ok(fs.readFileSync('/proc/locks', 'utf8').split('\n').some((line) => {
    const f = line.trim().split(/\s+/);
    return f[1] === 'FLOCK' && f[3] === 'WRITE' && ancestors.has(Number(f[4])) && f[5]?.endsWith(`:${inode}`);
  }), 'fixture lifetime must be under the shared flock');
}

export async function listen(server, port = 0) {
  server.listen(port, '127.0.0.1'); await once(server, 'listening'); return server.address().port;
}
export async function freePort() {
  const server = net.createServer(); const port = await listen(server);
  await new Promise((resolve) => server.close(resolve)); return port;
}
export async function until(predicate, ms = 3000) {
  const start = Date.now();
  while (!predicate()) { assert.ok(Date.now() - start < ms, 'bounded observation deadline'); await delay(10); }
}
export function pki(dir) {
  assertLock();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const write = (name, bytes) => fs.writeFileSync(path.join(dir, name), bytes, { mode: 0o600 });
  const openssl = (...args) => execFileSync('openssl', args, { cwd: dir, stdio: 'ignore' });
  openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '2',
    '-subj', '/CN=disposable wire observer CA', '-addext', 'basicConstraints=critical,CA:TRUE');
  write('index.txt', ''); write('serial', '1000\n');
  write('ca.cnf', '[ca]\ndefault_ca=lab\n[lab]\ndatabase=index.txt\nserial=serial\nnew_certs_dir=.\ncertificate=ca.pem\nprivate_key=ca.key\ndefault_md=sha256\ndefault_days=1\npolicy=policy\ncopy_extensions=copy\n[policy]\ncommonName=supplied\n');
  for (const [name, host] of [['edge-a', 'edge-a.test'], ['edge-b', 'edge-b.test'], ['origin', 'lab-origin.test'],
    ['wrong', 'wrong.test'], ['expired', 'lab-origin.test']]) {
    openssl('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.csr`,
      '-subj', `/CN=${host}`, '-addext', `subjectAltName=DNS:${host}`);
    if (name === 'expired') openssl('ca', '-batch', '-config', 'ca.cnf', '-in', `${name}.csr`, '-out', `${name}.pem`,
      '-notext', '-startdate', '20200101000000Z', '-enddate', '20200102000000Z');
    else openssl('x509', '-req', '-in', `${name}.csr`, '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial',
      '-out', `${name}.pem`, '-days', '1', '-copy_extensions', 'copy');
  }
  openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'untrusted.key', '-out', 'untrusted.pem',
    '-days', '1', '-subj', '/CN=lab-origin.test', '-addext', 'subjectAltName=DNS:lab-origin.test');
  fs.unlinkSync(path.join(dir, 'ca.key'));
  return { read: (name) => fs.readFileSync(path.join(dir, name)), file: (name) => path.join(dir, name) };
}
