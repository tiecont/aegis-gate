import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const baseline = "8758b1c84b4186449cd79fabae461ca53ee05100";
const git = (...args) => execFileSync("git", args, { maxBuffer: 16 << 20 });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = [
  "spikes/pingora/lab.mjs",
  ...[
    "manifest.json",
    "contract.mjs",
    "supplemental.mjs",
    "evaluate.mjs",
    "run.mjs",
    "tls-observer.mjs",
    "extract-baseline.mjs",
  ].map((f) => `spikes/edge-comparison/${f}`),
  ...["wire-probes.mjs", "wire-observer.mjs", "wire-fixtures.mjs"].map(
    (f) => `spikes/envoy/${f}`,
  ),
];
const protectedFiles = files.map((file) => {
  const pinned = git("show", `${baseline}:${file}`);
  assert.deepEqual(fs.readFileSync(file), pinned, file);
  return { file, sha256: sha(pinned), bytes: pinned.length };
});
const historical = [
  "evidence/sprint05a-root/candidate-02/commands.json",
  "evidence/sprint05a-root/candidate-02/original75.json",
  "evidence/sprint05a-root/candidate-02/original23.json",
  "evidence/sprint05a-root/candidate-02/SHA256SUMS",
  "evidence/sprint05a-b/source-01/sources.json",
].map((file) => ({ file, sha256: sha(fs.readFileSync(file)) }));
const results = JSON.parse(fs.readFileSync(historical[1].file));
const extra = JSON.parse(fs.readFileSync(historical[2].file));
assert.equal(results.tests.length, 75);
assert.equal(extra.tests.length, 23);
assert.equal(results.tests.filter((t) => t.status === "pass").length, 73);
assert.equal(extra.tests.filter((t) => t.status === "pass").length, 19);
console.log(
  JSON.stringify(
    {
      baseline,
      tree: git("rev-parse", `${baseline}^{tree}`).toString().trim(),
      protectedFiles,
      protected_inventory_sha256: sha(JSON.stringify(protectedFiles)),
      historical,
      previous75: {
        passed: 73,
        failures: results.tests.filter((t) => t.status !== "pass"),
      },
      previous23: { passed: 19, failures: extra.failures },
    },
    null,
    2,
  ),
);
