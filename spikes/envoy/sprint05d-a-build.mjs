import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { rawCommand, hash } from './sprint05b-a-build.mjs';
import { assertLock } from './wire-fixtures.mjs';
export { rawCommand, hash };
export async function command(record, argv, options = {}) {
  const started = new Date().toISOString();
  const result = await rawCommand(argv, options);
  record.commands.push({ ...result, started, ended: new Date().toISOString(),
    tmpdir: process.env.TMPDIR ?? null,
    executableSha256: hash(fs.readFileSync(fs.realpathSync(argv[0]))) });
  assert.equal(result.error, undefined); assert.equal(result.exit, 0, result.stderr);
  return result.stdout;
}
export async function build(directory, record) {
  assertLock(); assert.ok(process.env.TMPDIR.startsWith('/home/'));
  const pins = JSON.parse(fs.readFileSync('evidence/sprint05a-b/source-01/sources.json'));
  const upstream = path.join(directory, 'upstream'); fs.mkdirSync(upstream);
  record.upstream = [];
  for (const name of ['include/llhttp.h', 'src/api.c', 'src/http.c', 'src/llhttp.c', 'LICENSE-MIT']) {
    const pin = pins.downloads.find((p) => p.name === `llhttp/${name}`);
    assert.ok(pin.url.includes('/816485216511b86459b2e6478190e14c38c14891/'));
    const destination = path.join(upstream, path.basename(name));
    await command(record, ['/usr/bin/curl', '--fail', '--silent', '--show-error', '--location',
      '--proto', '=https', '--proto-redir', '=https', '--tlsv1.2', '--connect-timeout', '10',
      '--max-time', '30', '--max-filesize', '1048576', '--output', destination, pin.url]);
    const bytes = fs.readFileSync(destination); assert.equal(hash(bytes), pin.sha256);
    record.upstream.push({ name, url: pin.url, sha256: pin.sha256, bytes: bytes.length });
  }
  const include = path.resolve(path.dirname(process.execPath), '../include/node');
  record.nodeApiHeader = { file: path.join(include, 'node_api.h'), sha256: hash(fs.readFileSync(path.join(include, 'node_api.h'))) };
  record.compiler = await command(record, ['/usr/bin/cc', '--version']);
  record.addonSource = { file: 'spikes/envoy/sprint05c-a-llhttp.c', sha256: hash(fs.readFileSync('spikes/envoy/sprint05c-a-llhttp.c')) };
  const output = path.join(directory, 'sprint05d-a-llhttp.node');
  await command(record, ['/usr/bin/cc', '-std=c11', '-O2', '-shared', '-fPIC', '-Wall', '-Wextra', '-Werror',
    `-I${include}`, `-I${upstream}`, record.addonSource.file,
    ...['api.c', 'http.c', 'llhttp.c'].map((name) => path.join(upstream, name)), '-o', output]);
  record.addonSha256 = hash(fs.readFileSync(output));
  const addon = createRequire(import.meta.url)(output);
  assert.deepEqual([addon.llhttpVersionMajor, addon.llhttpVersionMinor, addon.llhttpVersionPatch], [9, 4, 4]);
  return { addon, output };
}
