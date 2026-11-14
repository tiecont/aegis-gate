import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { hash } from './sprint05a-b-receipts.mjs';

// Rehydrate omitted generated upstream files from immutable pinned official URLs.
const pins = JSON.parse(fs.readFileSync('evidence/sprint05a-b/source-01/sources.json'));
for (const p of pins.downloads) {
  if (fs.existsSync(p.cache) && hash(fs.readFileSync(p.cache)) === p.sha256) continue;
  const bytes = execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--proto', '=https',
    '--proto-redir', '=https', '--tlsv1.2', '--connect-timeout', '10', '--max-time', '30', '--max-filesize', '8388608', p.url], { maxBuffer: 8 << 20 });
  assert.equal(hash(bytes), p.sha256, p.url);
  fs.mkdirSync(path.dirname(p.cache), { recursive: true }); fs.writeFileSync(p.cache, bytes);
  console.log(`${p.name} ${p.sha256}`);
}
