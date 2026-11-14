// Isolated TE experiment: retain immutable recovery behavior and map local replies only.
import { compile as baselineCompile } from './recovery-config.mjs';
export { validateManifest, readBounded } from './recovery-config.mjs';

export function compile(...args) {
  const result = baselineCompile(...args);
  for (const listener of result.bootstrap.static_resources.listeners) {
    for (const chain of listener.filter_chains) {
      for (const filter of chain.filters) {
        if (filter.name !== 'envoy.filters.network.http_connection_manager') continue;
        filter.typed_config.local_reply_config = { mappers: [{
          filter: { status_code_filter: { comparison: {
            op: 'EQ', value: { default_value: 501, runtime_key: 'sprint05a_a_local_501' },
          } } },
          status_code: 400,
        }] };
      }
    }
  }
  return result;
}
