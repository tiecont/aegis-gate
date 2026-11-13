import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const attempt = process.argv[2];
if (!/^attempt-[0-9]{2}$/.test(attempt ?? "")) {
  throw new Error(
    "Supply a fresh attempt-NN under the full-lifetime fixture lock",
  );
}
const directory = path.join("evidence/sprint04a-f", attempt);
if (fs.existsSync(directory)) throw new Error("Attempt already exists");
const git = (args) => {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Git preflight failed");
  return result.stdout.trim();
};
const status = git(["status", "--porcelain", "--untracked-files=all"]);
if (
  status
    .split("\n")
    .some((line) => line && !line.slice(3).startsWith("evidence/sprint04a-f/"))
) {
  throw new Error("Commit source before proving it");
}
const source = git(["rev-parse", "HEAD"]);
fs.mkdirSync(directory, { recursive: true });
const records = [];
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const tracked = git(["ls-files"])
  .split("\n")
  .filter(
    (name) =>
      name.startsWith("internal/config") ||
      name.startsWith("apps/control-api/internal/persistence/") ||
      name === "go.mod" ||
      name === "go.sum" ||
      name === "docs/CONFIG_PROTOCOL.md" ||
      name === "docs/CONFIG_RECOVERY_RUNBOOK.md" ||
      name === "scripts/sprint04a-f-evidence.mjs",
  );
fs.writeFileSync(
  path.join(directory, "source.json"),
  JSON.stringify(
    {
      source_commit: source,
      initial_status: status,
      fixture_lock:
        "/tmp/aegisgate-sprint02-fixtures.lock (caller holds entire recorder lifetime)",
      files: tracked.map((name) => ({
        path: name,
        sha256: hash(fs.readFileSync(name)),
      })),
    },
    null,
    2,
  ) + "\n",
);
const run = (name, argv, timeout = 300000) => {
  const started = new Date().toISOString();
  const result = spawnSync(argv[0], argv.slice(1), {
    encoding: "utf8",
    timeout,
    maxBuffer: 16 << 20,
    env: { ...process.env, GOTOOLCHAIN: "go1.27.4" },
  });
  const log = (result.stdout ?? "") + (result.stderr ?? "");
  fs.writeFileSync(path.join(directory, `${name}.log`), log);
  const record = {
    source_commit: source,
    argv,
    started_at: started,
    ended_at: new Date().toISOString(),
    exit_code: result.status,
    signal: result.signal,
    error_code: result.error?.code ?? null,
    log_sha256: hash(log),
  };
  records.push(record);
  fs.writeFileSync(
    path.join(directory, "commands.json"),
    JSON.stringify(records, null, 2) + "\n",
  );
  console.log(JSON.stringify({ name, ...record }));
  return result.status === 0;
};
const compose = [
  "docker",
  "compose",
  "-p",
  "aegisgate-04a-f",
  "--env-file",
  ".local/compose.env",
  "--env-file",
  ".local/fixture-images.env",
  "-f",
  "infra/compose/compose.yaml",
];
let ok = false;
let fixtureAttempted = false;
try {
  const preflight =
    run("go-version", ["go", "version"]) &&
    run("node-version", [process.execPath, "--version"]) &&
    run("docker-version", [
      "docker",
      "version",
      "--format",
      "{{.Client.Version}} {{.Server.Version}}",
    ]);
  if (
    preflight &&
    run("unit", [
      "go",
      "test",
      "-race",
      "-v",
      "./internal/configconsumer",
      "./internal/configpublish",
      "./internal/configsnapshot",
      "./internal/configreview",
      "-count=1",
    ])
  ) {
    if (run("fixture-images", ["make", "fixture-images"])) {
      fixtureAttempted = true;
      if (
        run("postgres-up", [
          ...compose,
          "up",
          "-d",
          "--wait",
          "--wait-timeout",
          "90",
          "postgres",
        ])
      ) {
        ok = run("module03-integration", [
          "env",
          "AEGIS_TENANCY_INTEGRATION=1",
          "go",
          "test",
          "-race",
          "-v",
          "./apps/control-api/internal/persistence",
          "./apps/control-api/internal/transport",
          "./internal/configreview",
          "./internal/configconsumer",
          "./internal/configsnapshot",
          "./internal/configrollout",
          "./internal/configpublish",
          "-count=1",
        ]);
      }
    }
  }
  const vet = run("vet", [
    "go",
    "vet",
    "./apps/control-api/internal/persistence",
    "./internal/configconsumer",
    "./internal/configpublish",
    "./internal/configsnapshot",
    "./internal/configrollout",
    "./internal/configreview",
  ]);
  const golden = run("golden", [
    process.execPath,
    "internal/configsnapshot/testdata/verify-vector.mjs",
  ]);
  const whitespace = run("source-whitespace", [
    "git",
    "diff",
    "HEAD",
    "--check",
  ]);
  ok = ok && vet && golden && whitespace;
} finally {
  if (fixtureAttempted)
    ok = run("postgres-down", [...compose, "down"], 90000) && ok;
  const files = fs
    .readdirSync(directory)
    .filter((name) => name !== "SHA256SUMS");
  fs.writeFileSync(
    path.join(directory, "SHA256SUMS"),
    files
      .sort()
      .map(
        (name) =>
          `${hash(fs.readFileSync(path.join(directory, name)))}  ${path.join(directory, name)}\n`,
      )
      .join(""),
  );
}
process.exitCode = ok ? 0 : 1;
