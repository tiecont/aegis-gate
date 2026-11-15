import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { assertLock } from "./wire-fixtures.mjs";

assertLock();
assert.equal(
  execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
    encoding: "utf8",
  }).trim(),
  "",
);
const go =
  "/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go";
const sha = (b) => createHash("sha256").update(b).digest("hex");
fs.mkdirSync(".local", { recursive: true });
const stage = fs.mkdtempSync(path.resolve(".local/sprint05d-d-overlay-"));
const virtual = path.resolve(
  "spikes/envoy/sprint05c-attribution/sprint05d_finding_regressions_test.go",
);
const source = path.resolve("scripts/sprint05c-f-observer_test.go.txt");
const overlay = path.join(stage, "overlay.json");
fs.writeFileSync(overlay, JSON.stringify({ Replace: { [virtual]: source } }), {
  mode: 0o600,
});
const args = [
  "test",
  "-race",
  "-json",
  "-overlay",
  overlay,
  "./spikes/envoy/sprint05c-attribution",
  "-count=1",
];
console.log(
  JSON.stringify({
    go,
    go_sha256: sha(fs.readFileSync(go)),
    version: execFileSync(go, ["version"], { encoding: "utf8" }).trim(),
    args,
    overlay_source_sha256: sha(fs.readFileSync(source)),
  }),
);
try {
  const child = spawnSync(go, args, {
    env: { ...process.env, GOTOOLCHAIN: "local", GOAMD64: "v1" },
    stdio: "inherit",
    timeout: 85000,
  });
  assertLock();
  assert.equal(child.signal, null);
  assert.equal(child.status, 0);
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
  assertLock();
  console.log(
    JSON.stringify({
      overlay_private_stage_absent: !fs.existsSync(stage),
      runtime_gate_eligible: false,
    }),
  );
}
