import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";
assertLock();
const name = process.argv[2];
assert.equal(name, "aegis-sprint05a-a-2138196");
const mounts = JSON.parse(
  execFileSync("docker", ["inspect", "--format", "{{json .Mounts}}", name]),
);
assert.ok(
  mounts.length &&
    mounts.every((m) => m.Source.startsWith(path.resolve(".local") + "/")),
);
assert.ok(mounts.some((m) => m.Source.includes("sprint05a-combined-iZQlfJ")));
execFileSync("docker", ["rm", "--force", name]);
assert.equal(
  execFileSync("docker", ["ps", "-aq", "--filter", `name=^/${name}$`])
    .toString()
    .trim(),
  "",
);
console.log(
  JSON.stringify({
    name,
    exact_mount_ownership_verified: true,
    removed: true,
    lock_held: true,
    receipt_correction:
      "candidate-01 cleanup_complete was invalid for a never-started Created container; superseded by this explicit removal",
  }),
);
