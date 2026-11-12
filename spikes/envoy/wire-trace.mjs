// Diagnostic import hook: the lab and immutable assertions stay byte-identical.
import { registerHooks } from 'node:module';
import fs from 'node:fs';
import { createTlsObserver as observe } from './wire-observer.mjs';

const observers = [];
export function createTlsObserver(options) {
  const server = observe(options); observers.push(server); return server;
}
if (process.env.AEGIS_WIRE_TRACE) {
  registerHooks({ resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/spikes/pingora/lab.mjs') && specifier === '../edge-comparison/tls-observer.mjs') {
      return { url: import.meta.url, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  } });
  process.once('exit', () => fs.writeFileSync(process.env.AEGIS_WIRE_TRACE,
    JSON.stringify(observers.map((server) => server.wireSnapshot()), null, 2) + '\n', { flag: 'wx', mode: 0o600 }));
}
