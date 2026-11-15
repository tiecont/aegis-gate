import { registerHooks } from 'node:module';
const original = new URL('./recovery-launcher.mjs', import.meta.url);
const rootLauncher = new URL('./sprint05b-c-root-launcher.mjs', import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) {
  if (!context.parentURL && [original.href, original.pathname].includes(specifier)) {
    return nextResolve(process.env.AEGIS_05B_C_ROOT_LAUNCHER === '1' ? rootLauncher.href :
      new URL('./sprint05b-c-native-launcher.mjs', import.meta.url).href, context);
  }
  if (context.parentURL === rootLauncher.href && specifier === './sprint05a-combined-config.mjs' &&
    !['baseline', 'untapped'].includes(process.env.AEGIS_05B_C_MODE)) {
    return nextResolve(new URL('./sprint05b-c-config.mjs', import.meta.url).href, context);
  }
  return nextResolve(specifier, context);
} });
