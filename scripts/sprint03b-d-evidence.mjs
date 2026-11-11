import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const directory = "evidence/sprint03b-d";
fs.mkdirSync(directory, { recursive: true });
const source = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).stdout.trim();
const commands = [
  [
    "integration",
    "flock",
    [
      "/tmp/aegisgate-sprint02-fixtures.lock",
      "env",
      "AEGIS_TENANCY_INTEGRATION=1",
      "go",
      "test",
      "-race",
      "-v",
      "./internal/configrollout",
      "-count=1",
    ],
  ],
  ["vet", "go", ["vet", "./internal/configrollout"]],
  [
    "node-syntax",
    process.execPath,
    ["--check", "internal/configsnapshot/testdata/verify-vector.mjs"],
  ],
  ["whitespace", "git", ["diff", "--check"]],
];
const records = [];
for (const [name, executable, args] of commands) {
  const started = new Date().toISOString();
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 8 << 20,
  });
  const log = (result.stdout ?? "") + (result.stderr ?? "");
  fs.writeFileSync(path.join(directory, `${name}.log`), log);
  const record = {
    source_commit: source,
    argv: [executable, ...args],
    started_at: started,
    ended_at: new Date().toISOString(),
    exit_code: result.status,
    signal: result.signal,
    log_sha256: crypto.createHash("sha256").update(log).digest("hex"),
  };
  records.push(record);
  console.log(JSON.stringify(record));
  if (result.status !== 0) break;
}
fs.writeFileSync(
  path.join(directory, "commands.json"),
  JSON.stringify(records, null, 2) + "\n",
);
const files = fs
  .readdirSync(directory)
  .filter((name) => name !== "SHA256SUMS")
  .map((name) => path.join(directory, name));
for (const name of fs.readdirSync("internal/configrollout"))
  files.push(path.join("internal/configrollout", name));
files.push(
  "docs/CONFIG_ROLLOUT_RUNBOOK.md",
  "docs/reports/sprint03b-d-rollout.md",
  "scripts/sprint03b-d-evidence.mjs",
);
fs.writeFileSync(
  path.join(directory, "SHA256SUMS"),
  files
    .sort()
    .map(
      (file) =>
        `${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}  ${file}\n`,
    )
    .join(""),
);
process.exitCode = records.every((record) => record.exit_code === 0) ? 0 : 1;
