import { registerHooks } from 'node:module';
const launcher = new URL('./recovery-launcher.mjs', import.meta.url).href;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL === launcher && specifier === './recovery-config.mjs') {
    return nextResolve(new URL('./sprint05b-c-config.mjs', import.meta.url).href, context);
  }
  return nextResolve(specifier, context);
} });
