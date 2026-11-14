import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

assertLock();
process.umask(0o077);
const [source, output] = process.argv.slice(2);
const causeOnly = process.argv[4] === "--migration-cause-only";
const serial = process.argv[4] === "--serial";
assert.ok(path.isAbsolute(source));
assert.match(output ?? "", /^evidence\/sprint05b-f\/focused-\d+$/);
assert.ok(!fs.existsSync(output));
fs.mkdirSync(output, { recursive: true });
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(
  git("-C", source, "rev-parse", "HEAD"),
  git("rev-parse", `${serial ? "8f60c2a" : "7755f7a"}^{commit}`),
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
  serial_package_scheduling: serial,
  scope:
    "Focused regression reproduction; e-01 private Postgres image-readiness failure remains unresolved",
};
const save = () =>
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
record.collector_sources = [];
for (const file of [
  "scripts/sprint05b-f-focused.mjs",
  "scripts/sprint05b-f-locks.go",
  "scripts/sprint05b-f-readiness.py",
  ...(causeOnly ? ["scripts/sprint05b-f-migration-cause.go"] : []),
]) {
  const bytes = fs.readFileSync(file);
  const retained = `${output}/${path.basename(file)}`;
  fs.writeFileSync(retained, bytes);
  record.collector_sources.push({ file, retained, sha256: sha(bytes) });
}
save();
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
    const raw = Buffer.concat(streams[i]);
    let redacted = 0;
    const bytes = Buffer.from(
        raw.toString().replace(/https?:\/\/[^\s"<>]+/g, (value) => {
          let parsed;
          try {
            parsed = new URL(value);
          } catch {
            return value;
          }
          let changed = false;
          for (const key of ["code", "state"])
            if (parsed.searchParams.has(key)) {
              parsed.searchParams.set(key, "REDACTED");
              changed = true;
            }
          if (changed) {
            redacted++;
            return parsed.href;
          }
          return value;
        }),
      ),
      file = `${output}/${label}.${name}`;
    fs.writeFileSync(file, bytes);
    return {
      file,
      sha256: sha(bytes),
      bytes: bytes.length,
      raw_sha256: sha(raw),
      raw_bytes: raw.length,
      redacted_callback_urls: redacted,
      retention: redacted
        ? "sanitized derivative; raw bytes not retained"
        : "unchanged",
    };
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
let observer;
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
  if (serial) {
    const npm = path.join(path.dirname(node), "npm");
    await run("root-npm-ci", npm, ["ci", "--no-audit", "--no-fund"]);
    await run("dashboard-npm-ci", npm, [
      "--prefix",
      "apps/dashboard",
      "ci",
      "--no-audit",
      "--no-fund",
    ]);
  }
  started = true;
  await run("fixtures-up", "make", ["dev-up"]);
  await run("fixtures-ready", "python3", [
    path.resolve("scripts/sprint05b-f-readiness.py"),
  ]);
  await run("fixture-tls-credentials", "python3", ["scripts/integration.py"]);
  const observerProgram = path.resolve(".local/sprint05b-f-locks");
  record.observer = {
    file: observerProgram,
    sha256: sha(fs.readFileSync(observerProgram)),
    scope:
      "Read-only pg_locks/allowlisted pg_stat_activity fields; no SQL text or credentials",
  };
  observer = spawn(
    observerProgram,
    [source, path.resolve(output, "lock-samples.jsonl")],
    { stdio: ["ignore", "ignore", "ignore"] },
  );
  if (causeOnly) {
    const overlay = path.resolve(output, "migration-overlay.json");
    const helper = path.resolve("scripts/sprint05b-f-migration-cause.go");
    record.migration_helper = {
      file: helper,
      sha256: sha(fs.readFileSync(helper)),
    };
    fs.writeFileSync(
      overlay,
      JSON.stringify({
        Replace: {
          [path.join(source, "apps/control-api/cmd/control-api/main.go")]:
            helper,
        },
      }),
    );
    await run("migration-cause", "go", [
      "run",
      "-overlay",
      overlay,
      "./apps/control-api/cmd/control-api",
    ]);
    record.complete = true;
  } else {
    const result = await run("go-race-all", "go", [
      "test",
      ...(serial ? ["-p", "1"] : []),
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
    await run("contract-integration", node, [
      "scripts/contract-integration.mjs",
    ]);
    for (const target of ["lint", "typecheck", "test", "build", "integration"])
      await run(`dashboard-${target}`, npm, [
        "--prefix",
        "apps/dashboard",
        "run",
        target,
      ]);
    record.complete = true;
  }
} catch (error) {
  record.error = error.stack;
} finally {
  assertLock();
  if (observer && observer.exitCode === null) {
    const closed = new Promise((resolve) => observer.once("close", resolve));
    observer.kill("SIGTERM");
    await closed;
    record.observer.exit_code = observer.exitCode;
  }
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
