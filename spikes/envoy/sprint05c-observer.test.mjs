// Additive bounded fixture proof; the immutable acceptance evaluators are separate.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("Sprint05C authenticated H2 observer rejects deliberate effects and lost attribution", { timeout: 90000 }, () => {
  const child = spawnSync("go", ["test", "-race", "./spikes/envoy/sprint05c-attribution", "-count=1"], {
    env: { ...process.env, GOTOOLCHAIN: "go1.27.4" },
    timeout: 85000, encoding: "utf8", maxBuffer: 4 << 20,
  });
  assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);
});
