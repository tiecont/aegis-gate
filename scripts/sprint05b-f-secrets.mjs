import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

assertLock();
process.umask(0o077);
const output = "evidence/sprint05b-f/secrets-01";
assert.ok(!fs.existsSync(output));
fs.mkdirSync(output, { recursive: true });
const stage = fs.mkdtempSync(path.resolve(".local/sprint05b-f-scan-"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const record = {
  reviewer_commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  started_at: new Date().toISOString(),
  scope:
    "F scripts, report and evidence; staged at /scan so ignored .local fixture policy cannot exclude them",
  inputs: [],
};
const name = `aegisgate-05b-f-scan-${process.pid}`;
const copy = (file) => {
  const destination = path.join(stage, file);
  if (fs.statSync(file).isDirectory()) {
    for (const entry of fs.readdirSync(file)) copy(path.join(file, entry));
  } else {
    const bytes = fs.readFileSync(file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
    record.inputs.push({ file, sha256: sha(bytes), bytes: bytes.length });
  }
};
try {
  for (const file of fs
    .readdirSync("scripts")
    .filter((file) => file.startsWith("sprint05b-f-")))
    copy(`scripts/${file}`);
  copy("docs/reports/sprint05b-f-security-review.md");
  copy("evidence/sprint05b-f");
  const image =
    "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f";
  const args = [
    "run",
    "--rm",
    "--name",
    name,
    "--user",
    `${process.getuid()}:${process.getgid()}`,
    "-v",
    `${stage}:/scan:ro`,
    "-v",
    `${path.resolve(".github/gitleaks.toml")}:/policy/gitleaks.toml:ro`,
    "-v",
    `${path.resolve(output)}:/reports`,
    image,
    "dir",
    "/scan",
    "--config",
    "/policy/gitleaks.toml",
    "--redact",
    "--report-format",
    "json",
    "--report-path",
    "/reports/secrets.json",
    "--no-banner",
  ];
  record.args = args;
  const result = spawnSync("docker", args, {
    timeout: 180000,
    maxBuffer: 8 << 20,
  });
  record.exit_code = result.status;
  record.signal = result.signal;
  for (const stream of ["stdout", "stderr"])
    fs.writeFileSync(
      `${output}/scanner.${stream}`,
      result[stream] ?? Buffer.alloc(0),
    );
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(`${output}/secrets.json`)), []);
  record.complete = true;
} catch (error) {
  record.error = error.message;
} finally {
  assertLock();
  spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
  record.scanner_container_absent =
    spawnSync("docker", ["container", "inspect", name], { stdio: "ignore" })
      .status !== 0;
  fs.rmSync(stage, { recursive: true, force: true });
  record.stage_removed = !fs.existsSync(stage);
  record.ended_at = new Date().toISOString();
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    fs
      .readdirSync(output)
      .filter((file) => file !== "SHA256SUMS")
      .sort()
      .map(
        (file) =>
          `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}\n`,
      )
      .join(""),
  );
}
console.log(
  JSON.stringify({
    complete: record.complete,
    exit_code: record.exit_code,
    files: record.inputs.length,
    scanner_container_absent: record.scanner_container_absent,
    stage_removed: record.stage_removed,
  }),
);
process.exitCode =
  record.complete && record.scanner_container_absent && record.stage_removed
    ? 0
    : 1;
