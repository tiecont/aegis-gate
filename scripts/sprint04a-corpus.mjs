import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const output = process.argv[2];
assert.ok(output && !fs.existsSync(output), "fresh output required");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(
  git("status", "--porcelain", "--untracked-files=no"),
  "",
  "commit source before proof",
);
const files = [
  [
    "Pingora0.9.1",
    "evidence/sprint03a-e/observed-pingora/results.json",
    "historical",
  ],
  [
    "Envoy1.40.2",
    "evidence/sprint03a-e/observed-envoy/results.json",
    "historical",
  ],
  [
    "Hyper1.12.0",
    "evidence/sprint03a-e/observed-hyper/results.json",
    "historical",
  ],
  [
    "Envoy1.40.2-retain-Host",
    "evidence/sprint03b-f/parser-runtime-host-retention/results.json",
    "historical",
  ],
];
for (const name of ["unchanged75", "diagnostic75"]) {
  const file = `evidence/sprint04a-b/attempt02/${name}-results.json`;
  if (fs.existsSync(file))
    files.push([`Sprint04-A-B-${name}`, file, "retained-current-sprint"]);
}
const records = files.map(([candidate, file, provenance]) => {
  const bytes = fs.readFileSync(file);
  const result = JSON.parse(bytes);
  assert.equal(result.tests.length, 75);
  assert.equal(new Set(result.tests.map((test) => test.name)).size, 75);
  assert.ok(
    result.tests.every((test) => ["pass", "fail"].includes(test.status)),
  );
  return {
    candidate,
    file,
    provenance,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    total: result.tests.length,
    passed: result.tests.filter((test) => test.status === "pass").length,
    failures: result.tests
      .filter((test) => test.status === "fail")
      .map((test) => ({
        name: test.name,
        error: test.error,
        origin: test.origin,
      })),
    note: "Evidence inventory only; this command does not execute or accept a candidate.",
  };
});
fs.mkdirSync(path.dirname(output), {
  recursive: true,
});
fs.writeFileSync(
  output,
  JSON.stringify(
    {
      source_commit: git("rev-parse", "HEAD"),
      source_clean: true,
      timestamp: new Date().toISOString(),
      argv: process.argv,
      records,
      module01: "NO-GO",
      human_architecture_approval: null,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `PASS inventory of ${records.length} complete retained75-case results; no candidate execution`,
);
