// Compose separately measured supported policies for an isolated candidate.
import { compile as transferEncoding } from './sprint05a-a-config.mjs';
import { compile as protocol } from './sprint05a-d-config.mjs';
export { validateManifest, readBounded } from './recovery-config.mjs';

export function compile(...args) {
  const result = protocol(...args);
  const te = transferEncoding(...args);
  const listeners = result.bootstrap.static_resources.listeners;
  for (const [i, listener] of listeners.entries()) {
    for (const [j, chain] of listener.filter_chains.entries()) {
      chain.filters[0].typed_config.local_reply_config =
        te.bootstrap.static_resources.listeners[i].filter_chains[j].filters[0].typed_config.local_reply_config;
    }
  }
  return result;
}
