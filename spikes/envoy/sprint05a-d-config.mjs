// Isolated feasibility policy; original23 requests and assertions stay unchanged.
import { compile as baseline } from './recovery-config.mjs';
export { validateManifest, readBounded } from './recovery-config.mjs';

export function compile(...args) {
  const result = baseline(...args);
  const mode = process.env.AEGIS_05A_D_POLICY;
  if (!['windows', 'stream-errors', 'flush-errors'].includes(mode)) {
    throw new Error('explicit supported diagnostic policy required');
  }
  for (const resource of Object.values(result.files)) {
    for (const cluster of resource.resources ?? []) {
      const options = cluster.typed_extension_protocol_options?.['envoy.extensions.upstreams.http.v3.HttpProtocolOptions'];
      const h2 = options?.explicit_http_config?.http2_protocol_options;
      if (h2) Object.assign(h2, {
        initial_stream_window_size: 65535,
        initial_connection_window_size: 65535,
      });
    }
  }
  for (const listener of result.bootstrap.static_resources.listeners) {
    for (const chain of listener.filter_chains) {
      const hcm = chain.filters[0].typed_config;
      if (mode === 'stream-errors') {
        hcm.http2_protocol_options.override_stream_error_on_invalid_http_message = true;
      }
      if (mode === 'flush-errors') hcm.delayed_close_timeout = '0s';
    }
  }
  return result;
}
