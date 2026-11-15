// Select only additive diagnostic launchers, never rewrite tests or frames.
import { registerHooks } from 'node:module';
const launchers = new Set(['./recovery-launcher.mjs', './sprint05a-a-launcher.mjs']
  .flatMap((file) => { const url = new URL(file, import.meta.url); return [url.href, url.pathname]; }));
registerHooks({ resolve(specifier, context, nextResolve) {
  if (!context.parentURL && launchers.has(specifier))
    return nextResolve(new URL('./sprint05b-b-native-launcher.mjs', import.meta.url).href, context);
  return nextResolve(specifier, context);
} });
