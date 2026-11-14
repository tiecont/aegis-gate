import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { assertLock } from './wire-fixtures.mjs';

export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function command(record, argv, options = {}) {
  const result = spawnSync(argv[0], argv.slice(1), { timeout: 30000, maxBuffer: 2 << 20, ...options });
  (record.commands ??= []).push({ argv, cwd: options.cwd ?? process.cwd(), exit: result.status,
    signal: result.signal, error: result.error?.message, stdout: result.stdout?.toString(), stderr: result.stderr?.toString() });
  assert.equal(result.status, 0, `${argv[0]}: ${result.stderr?.toString()}`);
  return result.stdout;
}
export function build(directory, record) {
  assertLock();
  const pins = JSON.parse(fs.readFileSync('evidence/sprint05a-b/source-01/sources.json'));
  const upstream = path.join(directory, 'upstream');
  fs.mkdirSync(upstream);
  record.upstream = [];
  for (const name of ['include/llhttp.h', 'src/api.c', 'src/http.c', 'src/llhttp.c', 'LICENSE-MIT']) {
    const pin = pins.downloads.find((p) => p.name === `llhttp/${name}`);
    assert.ok(pin.url.includes('/816485216511b86459b2e6478190e14c38c14891/'));
    const cache = path.resolve('.local/sprint05b-a-sources', path.basename(name));
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    let bytes = fs.existsSync(cache) ? fs.readFileSync(cache) : null;
    if (!bytes || hash(bytes) !== pin.sha256) {
      command(record, ['curl', '--fail', '--silent', '--show-error', '--location',
        '--proto', '=https', '--proto-redir', '=https', '--tlsv1.2', '--connect-timeout', '10',
        '--max-time', '30', '--max-filesize', '1048576', '--output', cache + '.download', pin.url]);
      bytes = fs.readFileSync(cache + '.download');
      assert.equal(hash(bytes), pin.sha256);
      fs.mkdirSync(path.dirname(cache), { recursive: true });
      fs.writeFileSync(cache, bytes, { mode: 0o600 });
      fs.unlinkSync(cache + '.download');
    }
    assert.equal(hash(bytes), pin.sha256);
    fs.writeFileSync(path.join(upstream, path.basename(name)), bytes);
    record.upstream.push({ name, url: pin.url, sha256: pin.sha256, bytes: bytes.length });
  }
  const include = process.env.AEGIS_NODE_INCLUDE ?? path.resolve(path.dirname(process.execPath), '../include/node');
  assert.ok(fs.existsSync(path.join(include, 'node_api.h')), 'use the installed Node headers');
  record.compiler = command(record, ['cc', '--version']).toString().split('\n')[0];
  record.nodeApiHeader = { file: path.join(include, 'node_api.h'), sha256: hash(fs.readFileSync(path.join(include, 'node_api.h'))) };
  const output = path.join(directory, 'llhttp.node');
  command(record, ['cc', '-std=c11', '-Wall', '-Wextra', '-Werror', '-fsyntax-only',
    `-I${include}`, `-I${upstream}`, 'spikes/envoy/sprint05b-llhttp-addon.c']);
  record.buildArgv = ['cc', '-std=c11', '-O2', '-shared', '-fPIC', '-Wall', '-Werror',
    `-I${include}`, `-I${upstream}`, 'spikes/envoy/sprint05b-llhttp-addon.c',
    ...['api.c', 'http.c', 'llhttp.c'].map((f) => path.join(upstream, f)), '-o', output];
  command(record, record.buildArgv);
  record.addonSha256 = hash(fs.readFileSync(output));
  const addon = createRequire(import.meta.url)(output);
  assert.equal(addon.llhttpVersion, '9.4.4');
  record.native = { version: addon.llhttpVersion, stateBytes: addon.stateBytes, maxFeedBytes: addon.maxFeedBytes };
  return addon;
}
