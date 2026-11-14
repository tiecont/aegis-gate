import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

const [output] = process.argv.slice(2);
assert.ok(output?.startsWith("evidence/sprint04c-root/gates-"));
assert.ok(!fs.existsSync(output), "fresh evidence required");
assertLock();
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
fs.mkdirSync(output, { recursive: true });
process.env.COMPOSE_PROJECT_NAME = "aegisgate-04c-root";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const receipt = {
  source_commit: git("rev-parse", "HEAD"),
  source_tree: git("rev-parse", "HEAD^{tree}"),
  tracked_clean: true,
  argv: process.argv,
  cwd: process.cwd(),
  started_at: new Date().toISOString(),
  node: process.version,
  node_binary: process.execPath,
  node_sha256: sha(fs.readFileSync(process.execPath)),
  fixture_lock: "/tmp/aegisgate-sprint02-fixtures.lock",
  compose_project: process.env.COMPOSE_PROJECT_NAME,
  commands: [],
};
const save = () =>
  fs.writeFileSync(
    path.join(output, "commands.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
async function run(label, command, args) {
  assertLock();
  const record = {
    label,
    command,
    args,
    cwd: process.cwd(),
    started_at: new Date().toISOString(),
  };
  const streams = ["stdout", "stderr"].map((name) => ({
    file: path.join(output, `${label}.${name}.log`),
  }));
  const descriptors = streams.map(({ file }) => fs.openSync(file, "wx"));
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
    streams: streams.map(({ file }) => ({
      file,
      sha256: sha(fs.readFileSync(file)),
    })),
  });
  receipt.commands.push(record);
  save();
  console.log(JSON.stringify({ label, ...result }));
  assertLock();
  return result.exit_code === 0;
}
let passed = true;
try {
  passed = (await run("check", "make", ["check"])) && passed;
  passed = (await run("security-scan", "make", ["security-scan"])) && passed;
} catch (error) {
  receipt.error = error.stack;
  passed = false;
} finally {
  passed = (await run("cleanup", "make", ["dev-down"])) && passed;
  passed =
    (await run("cleanup-volumes", "docker", [
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
    ])) && passed;
  const remaining = execFileSync(
    "docker",
    [
      "ps",
      "-aq",
      "--filter",
      "label=com.docker.compose.project=aegisgate-04c-root",
    ],
    { encoding: "utf8" },
  ).trim();
  receipt.remaining_project_containers = remaining.split("\n").filter(Boolean);
  passed = !remaining && passed;
  // Rendered Compose contains credentials; retain only safe scanner outputs.
  const security = ".local/evidence/security";
  if (fs.existsSync(security)) {
    fs.mkdirSync(path.join(output, "security"));
    for (const entry of fs.readdirSync(security)) {
      if (/\.(json|log|tsv)$/.test(entry) && entry !== "compose-config.json") {
        fs.copyFileSync(
          path.join(security, entry),
          path.join(output, "security", entry),
        );
      }
    }
  }
  // Only this isolated worktree's generated private fixtures are removed.
  // Compare in memory before removal; never retain secret values or their hashes.
  try {
    assertLock();
    const secretFiles = [
      ".local/postgres-password",
      ".local/redis-password",
      ".local/nats-token",
      ".local/pki/valid.jwt",
    ];
    const secrets = secretFiles
      .filter((file) => fs.existsSync(file))
      .map((file) => fs.readFileSync(file).toString().trim())
      .filter(Boolean);
    const retained = [];
    const collect = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(file);
        else retained.push(file);
      }
    };
    collect(output);
    for (const file of retained) {
      const bytes = fs.readFileSync(file);
      assert.ok(
        !secrets.some((secret) => bytes.includes(Buffer.from(secret))),
        "generated private fixture value present in retained gate evidence",
      );
      assert.ok(
        !/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(
          bytes.toString(),
        ),
        "private key present in retained gate evidence",
      );
    }
    receipt.private_material_check = {
      files_checked: retained.length,
      matches: 0,
    };
  } catch (error) {
    receipt.private_material_error = error.message;
    passed = false;
  }
  // Cleanup must run even when evidence validation fails.
  try {
    assertLock();
    const paths = [
      ".local/pki",
      ".local/postgres-password",
      ".local/redis-password",
      ".local/nats-token",
      ".local/redis.conf",
      ".local/nats.conf",
      ".local/compose.env",
      ".local/evidence/security/compose-config.json",
    ];
    for (const file of paths) fs.rmSync(file, { recursive: true, force: true });
    receipt.private_fixture_cleanup = paths.map((file) => ({
      file,
      exists: fs.existsSync(file),
    }));
    for (const kind of ["network", "volume"]) {
      const ids = execFileSync(
        "docker",
        [
          kind,
          "ls",
          "-q",
          "--filter",
          "label=com.docker.compose.project=aegisgate-04c-root",
        ],
        { encoding: "utf8" },
      )
        .trim()
        .split("\n")
        .filter(Boolean);
      receipt[`remaining_project_${kind}s`] = ids;
      passed = !ids.length && passed;
    }
    assertLock();
  } catch (error) {
    receipt.private_cleanup_error = error.message;
    passed = false;
  }
  assertLock();
  receipt.ended_at = new Date().toISOString();
  receipt.passed = passed;
  receipt.lock_held_through_cleanup = true;
  save();
  const files = [];
  const inventory = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) inventory(file);
      else files.push(`${sha(fs.readFileSync(file))}  ${file}`);
    }
  };
  inventory(output);
  fs.writeFileSync(
    path.join(output, "SHA256SUMS"),
    files.sort().join("\n") + "\n",
  );
}
process.exitCode = passed ? 0 : 1;
