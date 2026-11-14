import { compile as base } from './sprint05a-combined-config.mjs';
export { validateManifest, readBounded } from './sprint05a-combined-config.mjs';
export function compile(...args) {
  const result = base(...args);
  const mode = process.env.AEGIS_05B_C_MODE;
  if (!['flush-zero', 'flush-long', 'header-timeout'].includes(mode)) throw new Error('explicit diagnostic mode required');
  for (const listener of result.bootstrap.static_resources.listeners) for (const chain of listener.filter_chains) {
    const hcm = chain.filters[0].typed_config;
    if (mode === 'flush-zero') hcm.delayed_close_timeout = '0s';
    if (mode === 'flush-long') hcm.delayed_close_timeout = '1s';
    if (mode === 'header-timeout') hcm.request_headers_timeout = '0.500s';
  }
  return result;
}
