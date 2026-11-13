import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";

const [output, command, ...args] = process.argv.slice(2);
assert.ok(
  output && command && !fs.existsSync(output),
  "fresh output and command required",
);
const git = (...argv) => execFileSync("git", argv, { encoding: "utf8" }).trim();
assert.equal(
  git("status", "--porcelain", "--untracked-files=no"),
  "",
  "commit source before proof",
);
fs.mkdirSync(output, { recursive: true });
const record = {
  source_commit: git("rev-parse", "HEAD"),
  source_tree: git("rev-parse", "HEAD^{tree}"),
  source_clean: true,
  started_at: new Date().toISOString(),
  cwd: process.cwd(),
  command,
  args,
  node_version: process.version,
  node_binary: process.execPath,
  environment: Object.fromEntries(
    ["AEGIS_NODE_BIN", "AEGIS_TENANCY_INTEGRATION", "GOTOOLCHAIN"]
      .filter((key) => process.env[key])
      .map((key) => [key, process.env[key]]),
  ),
};
const streams = {};
for (const name of ["stdout", "stderr"])
  streams[name] = fs.openSync(path.join(output, `${name}.log`), "wx");
const child = spawn(command, args, {
  stdio: ["ignore", streams.stdout, streams.stderr],
});
const result = await new Promise((resolve) => {
  child.once("error", (error) =>
    resolve({ exit_code: null, error: error.message }),
  );
  child.once("exit", (exit_code, signal) => resolve({ exit_code, signal }));
});
for (const fd of Object.values(streams)) fs.closeSync(fd);
const hash = (file) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");
Object.assign(record, result, {
  ended_at: new Date().toISOString(),
  stdout_sha256: hash(path.join(output, "stdout.log")),
  stderr_sha256: hash(path.join(output, "stderr.log")),
});
fs.writeFileSync(
  path.join(output, "command.json"),
  JSON.stringify(record, null, 2) + "\n",
);
console.log(
  JSON.stringify({ output, source_commit: record.source_commit, ...result }),
);
process.exitCode = Number.isInteger(result.exit_code) ? result.exit_code : 1;
