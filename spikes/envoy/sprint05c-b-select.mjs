import { registerHooks } from 'node:module';
const original = new URL('./recovery-launcher.mjs', import.meta.url);
registerHooks({ resolve(specifier, context, next) {
  if (!context.parentURL && [original.href, original.pathname].includes(specifier))
    return next(new URL('./sprint05c-b-launcher.mjs', import.meta.url).href, context);
  return next(specifier, context);
} });
