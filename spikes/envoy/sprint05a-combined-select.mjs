// Select candidate config without editing or transforming any original test.
import { registerHooks } from 'node:module';
const launchers = new Set(['./recovery-launcher.mjs', './sprint05a-a-launcher.mjs']
  .map((file) => new URL(file, import.meta.url).href));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (launchers.has(context.parentURL) &&
      ['./recovery-config.mjs', './sprint05a-a-config.mjs'].includes(specifier)) {
      return nextResolve(new URL('./sprint05a-combined-config.mjs', import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
