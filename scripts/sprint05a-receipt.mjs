import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

const [output, command, ...args] = process.argv.slice(2);
assert.match(output ?? "", /^evidence\/sprint05[ab]-root\/[a-z][a-z0-9-]+$/);
assert.ok(
  command && !fs.existsSync(output),
  "command and fresh output required",
);
const git = (...argv) => execFileSync("git", argv, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
fs.mkdirSync(output, { recursive: true });
const receipt = {
  source_commit: git("rev-parse", "HEAD"),
  source_tree: git("rev-parse", "HEAD^{tree}"),
  tracked_clean: true,
  cwd: process.cwd(),
  argv: process.argv,
  node: process.version,
  node_sha256: hash(fs.readFileSync(process.execPath)),
  command,
  args,
  started_at: new Date().toISOString(),
};
const child = spawnSync(command, args, {
  timeout: 600000,
  maxBuffer: 16 << 20,
});
Object.assign(receipt, {
  ended_at: new Date().toISOString(),
  exit_code: child.status,
  signal: child.signal,
  error: child.error?.message,
  streams: ["stdout", "stderr"].map((name) => {
    const file = `${output}/${name}.log`;
    const bytes = child[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes, { flag: "wx" });
    return { file, bytes: bytes.length, sha256: hash(bytes) };
  }),
});
fs.writeFileSync(
  `${output}/receipt.json`,
  JSON.stringify(receipt, null, 2) + "\n",
);
fs.writeFileSync(
  `${output}/SHA256SUMS`,
  ["receipt.json", "stdout.log", "stderr.log"]
    .map(
      (name) =>
        `${hash(fs.readFileSync(`${output}/${name}`))}  ${output}/${name}\n`,
    )
    .join(""),
);
console.log(JSON.stringify({ output, exit_code: child.status }));
process.exitCode = child.status ?? 1;
