import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { runtime } from './sprint05d-a-runtime.mjs';
import { assertLock } from './wire-fixtures.mjs';
assertLock(); process.umask(0o077);
const [fixture, binary, originPort, directory] = process.argv.slice(2);
const read = (name) => fs.readFileSync(path.join(fixture, 'pki', name));
const edgeTLS = { key: read('edge.key'), cert: read('edge.pem') };
const routes = new Map([['edge-a.test', { tenant: 'tenant-a', enabled: true, generation: 7,
  port: Number(originPort), ca: read('ca.pem'), originName: 'lab-origin.test', edge: edgeTLS }]]);
const front = await runtime({ addon: createRequire(import.meta.url)(binary), edgeTLS, routes, directory });
process.send({ ready: true, port: front.port, reclaimedFiles: front.quota.reclaimedFiles, reclaimedBytes: front.quota.reclaimedBytes });
process.on('message', async (message) => {
  if (message === 'stop') {
    await front.close(); process.send({ stopped: true, metrics: front.metrics }); process.disconnect();
  }
});
