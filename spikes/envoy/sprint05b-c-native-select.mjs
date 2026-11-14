import { registerHooks } from 'node:module';
const original = new URL('./recovery-launcher.mjs', import.meta.url);
registerHooks({ resolve(specifier, context, nextResolve) {
  if (!context.parentURL && [original.href, original.pathname].includes(specifier)) {
    return nextResolve(new URL('./sprint05b-c-native-launcher.mjs', import.meta.url).href, context);
  }
  return nextResolve(specifier, context);
} });
