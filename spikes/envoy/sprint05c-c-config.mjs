import { compile as base } from './sprint05a-combined-config.mjs';
export { validateManifest, readBounded } from './sprint05a-combined-config.mjs';

export function compile(...args) {
  const result = base(...args);
  const mode = process.env.AEGIS_05C_C_MODE;
  if (!['oghttp2', 'oghttp2-runtime'].includes(mode)) throw new Error('explicit codec candidate required');
  if (mode === 'oghttp2-runtime') {
    result.bootstrap.layered_runtime.layers.push({ name: 'sprint05c-c-codec',
      static_layer: { 'envoy.reloadable_features.http2_use_oghttp2': true } });
    return result;
  }
  for (const listener of result.bootstrap.static_resources.listeners) {
    for (const chain of listener.filter_chains) {
      chain.filters[0].typed_config.http2_protocol_options.use_oghttp2_codec = true;
    }
  }
  for (const resource of Object.values(result.files)) {
    for (const cluster of resource.resources ?? []) {
      const options = cluster.typed_extension_protocol_options?.['envoy.extensions.upstreams.http.v3.HttpProtocolOptions'];
      const h2 = options?.explicit_http_config?.http2_protocol_options;
      if (h2) h2.use_oghttp2_codec = true;
    }
  }
  return result;
}
