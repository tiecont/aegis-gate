// Test-only module selection, not a source transform or changed test assertion.
import { registerHooks } from 'node:module';
const launcher = new URL('./recovery-launcher.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === launcher && specifier === './recovery-config.mjs') {
      return nextResolve(new URL('./sprint05a-d-config.mjs', import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
