import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { command, hash } from './sprint05b-a-build.mjs';
import { assertLock } from './wire-fixtures.mjs';
export { command, hash, rawCommand } from './sprint05b-a-build.mjs';

export async function build(directory, record) {
  assertLock();
  const pins = JSON.parse(fs.readFileSync('evidence/sprint05a-b/source-01/sources.json'));
  const upstream = path.join(directory, 'upstream'); fs.mkdirSync(upstream);
  record.upstream = [];
  for (const name of ['include/llhttp.h', 'src/api.c', 'src/http.c', 'src/llhttp.c', 'LICENSE-MIT']) {
    const pin = pins.downloads.find((p) => p.name === `llhttp/${name}`);
    assert.ok(pin.url.includes('/816485216511b86459b2e6478190e14c38c14891/'));
    const destination = path.join(upstream, path.basename(name));
    const cache = path.join('/tmp/aegisgate-05b-a/.local/sprint05b-a-sources', path.basename(name));
    let b = fs.existsSync(cache) ? fs.readFileSync(cache) : undefined;
    if (!b || hash(b) !== pin.sha256) {
      await command(record, ['/usr/bin/curl', '--fail', '--silent', '--show-error', '--location',
        '--proto', '=https', '--proto-redir', '=https', '--tlsv1.2', '--connect-timeout', '10',
        '--max-time', '30', '--max-filesize', '1048576', '--output', destination, pin.url]);
      b = fs.readFileSync(destination);
    }
    assert.equal(hash(b), pin.sha256); fs.writeFileSync(destination, b, { mode: 0o600 });
    record.upstream.push({ name, url: pin.url, sha256: hash(b), bytes: b.length });
  }
  const include = path.resolve(path.dirname(process.execPath), '../include/node');
  assert.ok(fs.existsSync(path.join(include, 'node_api.h')));
  record.nodeApiHeader = { file: path.join(include, 'node_api.h'), sha256: hash(fs.readFileSync(path.join(include, 'node_api.h'))) };
  record.compiler = (await command(record, ['/usr/bin/cc', '--version'])).toString();
  const output = path.join(directory, 'sprint05c-a-llhttp.node');
  await command(record, ['/usr/bin/cc', '-std=c11', '-Wall', '-Wextra', '-Werror', '-fsyntax-only',
    `-I${include}`, `-I${upstream}`, 'spikes/envoy/sprint05c-a-llhttp.c']);
  const argv = ['/usr/bin/cc', '-std=c11', '-O2', '-shared', '-fPIC', '-Wall', '-Werror',
    `-I${include}`, `-I${upstream}`, 'spikes/envoy/sprint05c-a-llhttp.c',
    ...['api.c', 'http.c', 'llhttp.c'].map((f) => path.join(upstream, f)), '-o', output];
  await command(record, argv);
  record.addonSha256 = hash(fs.readFileSync(output));
  const addon = createRequire(import.meta.url)(output);
  assert.deepEqual([addon.llhttpVersionMajor, addon.llhttpVersionMinor, addon.llhttpVersionPatch], [9, 4, 4]);
  record.native = { stateBytes: addon.stateBytes, maxFeedBytes: addon.maxFeedBytes, maxWireBytes: addon.maxWireBytes };
  return addon;
}
