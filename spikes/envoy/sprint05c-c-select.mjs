import { registerHooks } from 'node:module';
const original = new URL('./recovery-launcher.mjs', import.meta.url);
const launcher = new URL('./sprint05b-native-launcher.mjs', import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) {
  if (!context.parentURL && [original.href, original.pathname].includes(specifier)) {
    return nextResolve(launcher.href, context);
  }
  if (context.parentURL === launcher.href && specifier === './sprint05a-combined-config.mjs' &&
      process.env.AEGIS_05C_C_MODE === 'oghttp2') {
    return nextResolve(new URL('./sprint05c-c-config.mjs', import.meta.url).href, context);
  }
  return nextResolve(specifier, context);
} });
