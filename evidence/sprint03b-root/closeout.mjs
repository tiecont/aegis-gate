import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const directory = "evidence/sprint03b-root/closeout";
if (fs.existsSync(directory)) throw new Error("Do not overwrite an immutable closeout run");
fs.mkdirSync(directory);
const source = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
const commands = [];
const specifications = [
  ["check", "flock", ["/tmp/aegisgate-sprint02-fixtures.lock", "make", "check"]],
  ["security-scan", "flock", ["/tmp/aegisgate-sprint02-fixtures.lock", "make", "security-scan"]],
  ["golden-vector", process.execPath, ["internal/configsnapshot/testdata/verify-vector.mjs"]],
  ["cleanup", "flock", ["/tmp/aegisgate-sprint02-fixtures.lock", "make", "dev-down"]],
];
for (const [name, executable, args] of specifications) {
  const started = new Date().toISOString();
  const result = spawnSync(executable, args, { encoding: "utf8", timeout: 900000, maxBuffer: 32 << 20 });
  const log = (result.stdout ?? "") + (result.stderr ?? "");
  const file = path.join(directory, `${name}.log`);
  fs.writeFileSync(file, log);
  commands.push({ source_commit: source, argv: [executable, ...args], started_at: started, ended_at: new Date().toISOString(), exit_code: result.status, signal: result.signal, log: file, sha256: crypto.createHash("sha256").update(log).digest("hex") });
  fs.writeFileSync(path.join(directory, "commands.json"), JSON.stringify(commands, null, 2) + "\n");
  console.log(`${name}: exit ${result.status}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
for (const name of ["history-gitleaks.log", "history-git-preflight.log", "history-secrets.log", "worktree-secrets.log", "go-vulnerabilities.log", "pingora-spike-vulnerabilities.log"]) {
  fs.copyFileSync(path.join(".local/evidence/security", name), path.join(directory, name));
}
