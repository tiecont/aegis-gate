// Isolated maintained-runtime experiment. No production adapter or parser change.
import { compile as baseCompile } from './config.mjs';
export { validateManifest, readBounded } from './config.mjs';

export function compile(...args) {
  const result = baseCompile(...args);
  // Keep the original Host visible to the existing strict authority policy.
  result.bootstrap.layered_runtime = { layers: [{ name: 'strict-identity-experiment',
    static_layer: { 'envoy.reloadable_features.http2_discard_host_header': false } }] };
  return result;
}
