import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

assertLock();
process.umask(0o077);
const [source, output] = process.argv.slice(2);
assert.ok(path.isAbsolute(source));
assert.match(output ?? "", /^evidence\/sprint05b-f\/focused-\d+$/);
assert.ok(!fs.existsSync(output));
fs.mkdirSync(output, { recursive: true });
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(
  git("-C", source, "rev-parse", "HEAD"),
  git("rev-parse", "7755f7a^{commit}"),
);
assert.equal(
  git("-C", source, "status", "--porcelain", "--untracked-files=no"),
  "",
);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const node =
  "/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node";
const env = {
  ...process.env,
  PATH: `${path.dirname(node)}:/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin:${process.env.PATH}`,
  GOTOOLCHAIN: "go1.27.4",
  AEGIS_NODE_BIN: node,
  AEGIS_TENANCY_INTEGRATION: "1",
  COMPOSE_PROJECT_NAME: `aegisgate-05b-e-attempt-91-${randomBytes(6).toString("hex")}`,
};
const record = {
  reviewer_commit: git("rev-parse", "HEAD"),
  source_commit: git("-C", source, "rev-parse", "HEAD"),
  source_tree: git("-C", source, "rev-parse", "HEAD^{tree}"),
  argv: process.argv,
  started_at: new Date().toISOString(),
  commands: [],
  complete: false,
  scope:
    "Focused regression reproduction; e-01 private Postgres image-readiness failure remains unresolved",
};
const save = () =>
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
async function run(label, program, args) {
  assertLock();
  const started_at = new Date().toISOString(),
    streams = [[], []];
  const child = spawn(program, args, {
    cwd: source,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (b) => streams[0].push(b));
  child.stderr.on("data", (b) => streams[1].push(b));
  const timer = setTimeout(() => child.kill("SIGTERM"), 600000);
  const [exit_code, signal] = await new Promise((resolve) =>
    child.once("close", (...args) => resolve(args)),
  );
  clearTimeout(timer);
  const files = ["stdout", "stderr"].map((name, i) => {
    const bytes = Buffer.concat(streams[i]),
      file = `${output}/${label}.${name}`;
    fs.writeFileSync(file, bytes);
    return { file, sha256: sha(bytes), bytes: bytes.length };
  });
  record.commands.push({
    label,
    program,
    args,
    cwd: source,
    started_at,
    ended_at: new Date().toISOString(),
    exit_code,
    signal,
    streams: files,
  });
  save();
  console.log(`${label}: exit=${exit_code}`);
  assert.equal(exit_code, 0, label);
  return Buffer.concat(streams[0]).toString();
}
let started = false;
const privateFiles = [
  "pki",
  "compose.env",
  "postgres-password",
  "redis-password",
  "nats-token",
  "redis.conf",
  "nats.conf",
];
try {
  started = true;
  await run("fixtures-up", "make", ["dev-up"]);
  await run("fixture-tls-credentials", "python3", ["scripts/integration.py"]);
  const result = await run("go-race-all", "go", [
    "test",
    "-race",
    "-v",
    "./apps/control-api/...",
    "./apps/config-publisher/...",
    "./internal/...",
    "./packages/test-fixtures/...",
    "-count=1",
  ]);
  assert.ok(!/--- (FAIL|SKIP):/.test(result));
  record.go = {
    packages: (result.match(/^ok\s/gm) ?? []).length,
    top_level: (result.match(/^--- PASS:/gm) ?? []).length,
    subtests: (result.match(/^\s+--- PASS:/gm) ?? []).length,
    skips: 0,
  };
  const npm = path.join(path.dirname(node), "npm");
  await run("contracts", npm, ["run", "contracts:check"]);
  await run("contract-integration", node, ["scripts/contract-integration.mjs"]);
  for (const target of ["lint", "typecheck", "test", "build", "integration"])
    await run(`dashboard-${target}`, npm, [
      "--prefix",
      "apps/dashboard",
      "run",
      target,
    ]);
  record.complete = true;
} catch (error) {
  record.error = error.stack;
} finally {
  assertLock();
  if (started)
    try {
      await run("cleanup", "docker", [
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
    } catch (error) {
      record.cleanup_error = error.stack;
    }
  for (const kind of ["container", "network", "volume"])
    try {
      assert.equal(
        (
          await run(`remaining-${kind}`, "docker", [
            kind,
            "ls",
            "--filter",
            `label=com.docker.compose.project=${env.COMPOSE_PROJECT_NAME}`,
            "--format",
            "{{.ID}}",
          ])
        ).trim(),
        "",
      );
    } catch (error) {
      record.cleanup_error = error.stack;
    }
  const values = [
    "postgres-password",
    "redis-password",
    "nats-token",
    "pki/valid.jwt",
  ]
    .filter((file) => fs.existsSync(`${source}/.local/${file}`))
    .map((file) =>
      fs.readFileSync(`${source}/.local/${file}`).toString().trim(),
    )
    .filter(Boolean);
  const privateMatches = fs
    .readdirSync(output)
    .filter((file) =>
      values.some((value) =>
        fs.readFileSync(`${output}/${file}`).includes(value),
      ),
    );
  record.private_output_matches = privateMatches.length;
  for (const file of privateFiles)
    fs.rmSync(`${source}/.local/${file}`, { force: true, recursive: true });
  record.private_material_removed = privateFiles.every(
    (file) => !fs.existsSync(`${source}/.local/${file}`),
  );
  record.lock_held_through_cleanup_hashing = true;
  record.ended_at = new Date().toISOString();
  save();
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    fs
      .readdirSync(output)
      .sort()
      .map(
        (file) =>
          `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}\n`,
      )
      .join(""),
  );
}
process.exitCode =
  record.complete &&
  !record.cleanup_error &&
  record.private_output_matches === 0
    ? 0
    : 1;
