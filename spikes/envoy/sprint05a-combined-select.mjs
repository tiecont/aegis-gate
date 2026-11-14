// Select candidate config without editing or transforming any original test.
import { registerHooks } from 'node:module';
const launchers = new Set(['./recovery-launcher.mjs', './sprint05a-a-launcher.mjs']
  .map((file) => new URL(file, import.meta.url).href));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (process.env.AEGIS_05B_NATIVE_BINARY && [...launchers].some((url) =>
      specifier === url || new URL(specifier, context.parentURL ?? import.meta.url).href === url)) {
      return nextResolve(new URL('./sprint05b-native-launcher.mjs', import.meta.url).href, context);
    }
    if (launchers.has(context.parentURL) &&
      ['./recovery-config.mjs', './sprint05a-a-config.mjs'].includes(specifier)) {
      return nextResolve(new URL('./sprint05a-combined-config.mjs', import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
