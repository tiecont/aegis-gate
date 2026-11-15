// Static finite transport fixture. Signed admission and JWT run on the Go hop.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { runtime } from '../envoy/sprint05d-a-runtime.mjs';
import { assertLock } from '../envoy/wire-fixtures.mjs';
assertLock(); process.umask(0o077);
const [input, ready, metricsFile] = process.argv.slice(2);
const fixture = JSON.parse(fs.readFileSync(input));
const read = (name) => fs.readFileSync(path.join(fixture.pki, name));
const routes = new Map(['a', 'b'].map((id) => {
  const hostname = `api-${id}.example.com`;
  return [hostname, { tenant: `tenant-${id}`, enabled: true, generation: 1,
    port: fixture.port, ca: read('ca.pem'), originName: 'admission.example.com',
    edge: { key: read(`${hostname}.key`), cert: read(`${hostname}.pem`) } }];
}));
const front = await runtime({ addon: createRequire(import.meta.url)(process.env.AEGIS_SPRINT06A_ADDON),
  edgeTLS: routes.get('api-a.example.com').edge, routes,
  directory: fixture.directory });
fs.writeFileSync(ready, JSON.stringify({ port: front.port }), { mode: 0o600 });
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  await front.close();
  fs.writeFileSync(metricsFile, JSON.stringify(front.metrics), { mode: 0o600 });
  process.stdin.destroy();
}
process.stdin.once('data', stop);
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
