// Isolated supported-policy experiments; no production adapter or codec.
import assert from 'node:assert/strict';
import { compile as recoveryCompile } from './recovery-config.mjs';
export { validateManifest, readBounded } from './recovery-config.mjs';

export const strategies = ['recovery', 'windows', 'identity', 'partition', 'bounded'];
export function compile(...args) {
  const mode = process.env.AEGIS_SPRINT05A_C_POLICY ?? 'windows';
  assert.ok(strategies.includes(mode), 'unknown C strategy');
  const result = recoveryCompile(...args);
  const windows = { initial_stream_window_size: 65535, initial_connection_window_size: 65535, hpack_table_size: 0 };
  for (const chain of result.bootstrap.static_resources.listeners[0].filter_chains) {
    const hcm = chain.filters[0].typed_config;
    if (mode !== 'recovery') Object.assign(hcm.http2_protocol_options, windows);
    if (['identity', 'partition', 'bounded'].includes(mode)) {
      const lua = hcm.http_filters[0].typed_config.default_source_code;
      // The chain is already selected by exact authenticated TLS SNI. Check
      // retained Host before the router can acquire an upstream stream.
      const host = chain.filter_chain_match.server_names[0];
      lua.inline_string = lua.inline_string.replace('  local length =', `  local host = headers:get("host")
  if host and host ~= "${host}" and host ~= "${host}:443" then
    deny(h, "421")
    return
  end
  local length =`);
    }
  }
  for (const resource of Object.values(result.files).flatMap((f) => f.resources)) {
    if (!resource.typed_extension_protocol_options) continue;
    const protocol = resource.typed_extension_protocol_options['envoy.extensions.upstreams.http.v3.HttpProtocolOptions'];
    if (protocol.explicit_http_config.http2_protocol_options && mode !== 'recovery') {
      Object.assign(protocol.explicit_http_config.http2_protocol_options, windows);
      if (mode === 'bounded') protocol.common_http_protocol_options.max_requests_per_connection = 32;
      if (mode === 'partition') resource.connection_pool_per_downstream_connection = true;
    }
  }
  return result;
}
