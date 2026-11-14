import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

assertLock();
process.umask(0o077);
const source = "/tmp/aegisgate-05b-f/.local/sprint05b-f-sources/e-7755f7ae51d9";
const output = "evidence/sprint05b-f/focused-01";
const project = "aegisgate-05b-e-attempt-91-48a4808c973b";
const record = {
  scope:
    "Fresh-lock recovery of interrupted focused-01; original lock continuity and completion are not claimed",
  project,
  started_at: new Date().toISOString(),
  commands: [],
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function run(label, args) {
  assertLock();
  const child = spawnSync("docker", args, {
    cwd: source,
    env: { ...process.env, COMPOSE_PROJECT_NAME: project },
    timeout: 120000,
    maxBuffer: 4 << 20,
  });
  const streams = ["stdout", "stderr"].map((name) => {
    const file = `${output}/recovery-${label}.${name}`;
    const bytes = child[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes);
    return { file, sha256: sha(bytes), bytes: bytes.length };
  });
  record.commands.push({ label, args, exit_code: child.status, streams });
  assert.equal(child.status, 0, label);
  return child.stdout.toString().trim();
}
run("cleanup", [
  "compose",
  "--env-file",
  ".local/compose.env",
  "--env-file",
  ".local/fixture-images.env",
  "-f",
  "infra/compose/compose.yaml",
  "down",
  "--volumes",
  "--remove-orphans",
]);
for (const kind of ["container", "network", "volume"])
  assert.equal(
    run(`remaining-${kind}`, [
      kind,
      "ls",
      "--filter",
      `label=com.docker.compose.project=${project}`,
      "--format",
      "{{.ID}}",
    ]),
    "",
  );
const privateFiles = [
  "pki",
  "compose.env",
  "postgres-password",
  "redis-password",
  "nats-token",
  "redis.conf",
  "nats.conf",
];
for (const file of privateFiles)
  fs.rmSync(`${source}/.local/${file}`, { force: true, recursive: true });
record.private_material_removed = privateFiles.every(
  (file) => !fs.existsSync(`${source}/.local/${file}`),
);
assert.ok(record.private_material_removed);
assertLock();
record.ended_at = new Date().toISOString();
record.recovery_complete = true;
fs.writeFileSync(
  `${output}/recovery.json`,
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
console.log(
  "PASS fresh-lock owned-project recovery; original attempt remains incomplete",
);
