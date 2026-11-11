import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validator, root } from "./contracts.mjs";
import assert from "node:assert/strict";
const output = execFileSync(
  "go",
  ["run", "./apps/config-publisher/cmd/config-publisher", "--check"],
  { cwd: root, encoding: "utf8" },
);
const valid = await validator();
assert.equal(valid(JSON.parse(output)), true, JSON.stringify(valid.errors));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "aegis-wire-"));
try {
  const input = path.join(temporary, "generated-error.json");
  await fs.writeFile(input, output, { mode: 0o600 });
  execFileSync(
    "cargo",
    [
      "+1.99.1",
      "run",
      "--locked",
      "--quiet",
      "-p",
      "config-agent",
      "--",
      "check-error",
      input,
    ],
    { cwd: root + "/apps/edge", stdio: "pipe" },
  );
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
console.log(
  "PASS: actual OpenAPI-generated Go envelope consumed by Rust CLI and validated against JSON Schema",
);
