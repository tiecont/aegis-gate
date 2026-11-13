import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";

const [output] = process.argv.slice(2);
assert.ok(output && !fs.existsSync(output), "fresh output required");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
fs.mkdirSync(output, { recursive: true });
const composeProject = "aegisgate-04a-root";
process.env.COMPOSE_PROJECT_NAME = composeProject;
const receipt = {
  source_commit: git("rev-parse", "HEAD"),
  source_tree: git("rev-parse", "HEAD^{tree}"),
  source_clean: true,
  started_at: new Date().toISOString(),
  lock: "/tmp/aegisgate-sprint02-fixtures.lock",
  invocation:
    "flock /tmp/aegisgate-sprint02-fixtures.lock node scripts/sprint04a-gates.mjs <fresh-output>",
  node: process.version,
  compose_project: composeProject,
  commands: [],
};
const hash = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");
async function run(label, command, args) {
  const record = { label, command, args, started_at: new Date().toISOString() };
  const files = ["stdout", "stderr"].map((name) =>
    path.join(output, `${label}.${name}.log`),
  );
  const descriptors = files.map((file) => fs.openSync(file, "wx"));
  const child = spawn(command, args, { stdio: ["ignore", ...descriptors] });
  const result = await new Promise((resolve) => {
    child.once("error", (error) =>
      resolve({ exit_code: null, error: error.message }),
    );
    child.once("exit", (exit_code, signal) => resolve({ exit_code, signal }));
  });
  descriptors.forEach((fd) => fs.closeSync(fd));
  Object.assign(record, result, {
    ended_at: new Date().toISOString(),
    streams: files.map((file) => ({ file, sha256: hash(file) })),
  });
  receipt.commands.push(record);
  fs.writeFileSync(
    path.join(output, "commands.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  console.log(JSON.stringify(record));
  return result.exit_code === 0;
}

let passed = true;
try {
  passed = (await run("check", "make", ["check"])) && passed;
  passed = (await run("security-scan", "make", ["security-scan"])) && passed;
} finally {
  passed = (await run("cleanup", "make", ["dev-down"])) && passed;
  passed =
    (await run("cleanup-volumes", "docker", [
      "compose",
      "-p",
      composeProject,
      "--env-file",
      ".local/compose.env",
      "--env-file",
      ".local/fixture-images.env",
      "-f",
      "infra/compose/compose.yaml",
      "down",
      "--volumes",
    ])) && passed;
}
// Compose's rendered config contains disposable credentials. Retain scanner
// results and provenance, never the rendered service environment or archives.
const security = ".local/evidence/security";
if (fs.existsSync(security)) {
  const destination = path.join(output, "security");
  fs.mkdirSync(destination);
  for (const entry of fs.readdirSync(security)) {
    if (!/\.(json|log|tsv)$/.test(entry) || entry === "compose-config.json")
      continue;
    fs.copyFileSync(path.join(security, entry), path.join(destination, entry));
  }
}
receipt.ended_at = new Date().toISOString();
receipt.passed = passed;
fs.writeFileSync(
  path.join(output, "commands.json"),
  JSON.stringify(receipt, null, 2) + "\n",
);
const manifest = [];
function inventory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) inventory(file);
    else manifest.push(`${hash(file)}  ${file}`);
  }
}
inventory(output);
fs.writeFileSync(
  path.join(output, "SHA256SUMS"),
  manifest.sort().join("\n") + "\n",
);
process.exitCode = passed ? 0 : 1;
