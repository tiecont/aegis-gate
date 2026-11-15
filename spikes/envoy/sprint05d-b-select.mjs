// Bounded selection only: original probe bodies, assertions and deadlines stay intact.
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";

const original = new URL("./recovery-launcher.mjs", import.meta.url);
const launcher = new URL("./sprint05b-native-launcher.mjs", import.meta.url);
const probes = new URL("./wire-probes.mjs", import.meta.url).href;
const selected = [
  "settled-reuse-identity-and-three-authority-negatives",
  "individual-settled-Host-denial",
  "individual-settled-authority-denial",
  "individual-settled-userinfo-denial",
  "valid-identity-and-pool-reuse-after-negative-frames",
];
const sha = (b) => createHash("sha256").update(b).digest("hex");
registerHooks({
  resolve(specifier, context, next) {
    if (
      !context.parentURL &&
      [original.href, original.pathname].includes(specifier)
    )
      return next(launcher.href, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    const result = next(url, context);
    if (url !== probes) return result;
    const source = String(result.source);
    const anchor = "async function probe(name, fn) {";
    assert.equal(source.split(anchor).length, 2);
    const guard = `${anchor}\n  if (!${JSON.stringify(selected)}.includes(name)) return;`;
    const transformed = source.replace(anchor, guard);
    fs.writeFileSync(
      process.env.AEGIS_05D_B_SELECTION,
      JSON.stringify(
        {
          scope: "selected original bodies; not original23 aggregate execution",
          url,
          selected,
          original_sha256: sha(source),
          transformed_sha256: sha(transformed),
          single_insertion: guard.slice(anchor.length),
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    return { ...result, source: transformed };
  },
});
