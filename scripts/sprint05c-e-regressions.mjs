import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

assertLock();
process.umask(0o077);
const output = process.argv[2];
assert.match(output ?? "", /^evidence\/sprint05c-e\/attempt-\d+$/);
assert.ok(!fs.existsSync(output), "fresh evidence only");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
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
  assert.ok(
    !fs.existsSync(`.local/${file}`),
    `existing private fixture ${file}`,
  );
fs.mkdirSync(output, { recursive: true });
const env = {
  ...process.env,
  PATH: `${path.dirname(process.execPath)}:/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin:${process.env.PATH}`,
  AEGIS_NODE_BIN: process.execPath,
  GOTOOLCHAIN: "go1.27.4",
  COMPOSE_PROJECT_NAME: `aegisgate-05c-e-attempt-01-${randomBytes(6).toString("hex")}`,
};
const record = {
  source_commit: git("rev-parse", "HEAD"),
  source_tree: git("rev-parse", "HEAD^{tree}"),
  argv: process.argv,
  cwd: process.cwd(),
  started_at: new Date().toISOString(),
  node: process.version,
  node_binary_sha256: sha(fs.readFileSync(process.execPath)),
  environment: Object.fromEntries(
    ["PATH", "AEGIS_NODE_BIN", "GOTOOLCHAIN", "COMPOSE_PROJECT_NAME"].map(
      (k) => [k, env[k]],
    ),
  ),
  fixture_lock: "/tmp/aegisgate-sprint02-fixtures.lock",
  commands: [],
  passed: false,
};
const save = () =>
  fs.writeFileSync(
    `${output}/commands.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
function run(label, command, args, extra = {}) {
  assertLock();
  const started_at = new Date().toISOString();
  const p = spawnSync(command, args, {
    env: { ...env, ...extra },
    timeout: 600000,
    maxBuffer: 32 << 20,
  });
  const streams = ["stdout", "stderr"].map((stream) => {
    const file = `${output}/${label}.${stream}`;
    const bytes = p[stream] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes);
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  record.commands.push({
    label,
    command,
    args,
    extra,
    started_at,
    ended_at: new Date().toISOString(),
    exit_code: p.status,
    signal: p.signal,
    error: p.error?.message,
    streams,
  });
  save();
  console.log(`${label}: exit=${p.status}`);
  assert.equal(p.status, 0, label);
  return p;
}
const compose = [
  "compose",
  "--env-file",
  ".local/compose.env",
  "--env-file",
  ".local/fixture-images.env",
  "-f",
  "infra/compose/compose.yaml",
];
let started = false;
try {
  for (const [name, command, args] of [
    ["git", "git", ["--version"]],
    ["go", "go", ["version"]],
    ["python", "python3", ["--version"]],
    ["docker", "docker", ["version", "--format", "{{.Server.Version}}"]],
    ["compose", "docker", ["compose", "version"]],
    ["openssl", "openssl", ["version"]],
  ])
    run(`version-${name}`, command, args);
  const npm = path.join(path.dirname(process.execPath), "npm");
  for (const dir of [".", "apps/dashboard", "spikes/pingora"]) {
    run(`install-${dir.replaceAll("/", "-").replace(".", "root")}`, npm, [
      "--prefix",
      dir,
      "ci",
      "--ignore-scripts",
      "--strict-peer-deps",
    ]);
  }
  run("baseline-extraction", process.execPath, [
    "spikes/edge-comparison/extract-baseline.mjs",
    "--check",
  ]);
  started = true;
  run("fixtures-up", "make", ["dev-up"]);
  run("fixture-credentials-tls", "python3", ["scripts/integration.py"]);
  run("fixture-images", "python3", ["scripts/fixture-image-integration.py"]);
  run("fixture-stale-volume", "python3", ["scripts/sprint05a-e-fixtures.py"]);
  const packages = [
    "./apps/control-api/...",
    "./apps/config-publisher/...",
    "./internal/...",
    "./packages/test-fixtures/...",
  ];
  const go = run(
    "go-race-all",
    "go",
    ["test", "-p", "1", "-race", "-v", ...packages, "-count=1"],
    { AEGIS_TENANCY_INTEGRATION: "1" },
  ).stdout.toString();
  assert.ok(!/--- (FAIL|SKIP):/.test(go));
  record.go = {
    packages: (go.match(/^ok\s/gm) ?? []).length,
    top_level: (go.match(/^--- PASS:/gm) ?? []).length,
    subtests: (go.match(/^\s+--- PASS:/gm) ?? []).length,
    skipped: 0,
  };
  run("contracts", npm, ["run", "contracts:check"]);
  run("contract-integration", process.execPath, [
    "scripts/contract-integration.mjs",
  ]);
  for (const target of ["lint", "typecheck", "test", "build", "integration"])
    run(`dashboard-${target}`, npm, [
      "--prefix",
      "apps/dashboard",
      "run",
      target,
    ]);
  run("dependency-tree", npm, [
    "--prefix",
    "apps/dashboard",
    "ls",
    "typescript",
    "typescript-eslint",
    "minimatch",
    "--all",
  ]);
  run("typescript-eslint-peers", npm, [
    "view",
    "typescript-eslint",
    "version",
    "peerDependencies",
    "dist.integrity",
    "--json",
  ]);
  record.passed = true;
} catch (error) {
  record.error = error.stack;
} finally {
  const clean = (label, fn) => {
    try {
      fn();
    } catch (error) {
      record.passed = false;
      (record.cleanup_errors ??= []).push({ label, error: error.message });
    }
  };
  if (started)
    clean("compose-down", () =>
      run("cleanup", "docker", [
        ...compose,
        "down",
        "--volumes",
        "--remove-orphans",
      ]),
    );
  for (const kind of ["container", "network", "volume"])
    clean(kind, () => {
      const result = run(`remaining-${kind}`, "docker", [
        kind,
        "ls",
        "--filter",
        `label=com.docker.compose.project=${env.COMPOSE_PROJECT_NAME}`,
        "--format",
        "{{.ID}}",
      ]);
      assert.equal(result.stdout.toString().trim(), "");
    });
  clean("private-material", () => {
    const values = [
      "postgres-password",
      "redis-password",
      "nats-token",
      "pki/valid.jwt",
    ]
      .filter((f) => fs.existsSync(`.local/${f}`))
      .map((f) => fs.readFileSync(`.local/${f}`).toString().trim())
      .filter(Boolean);
    for (const file of fs.readdirSync(output)) {
      const bytes = fs.readFileSync(`${output}/${file}`);
      assert.ok(
        !values.some((value) => bytes.includes(value)),
        "private fixture value in output",
      );
      assert.ok(
        !/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(
          bytes.toString(),
        ),
      );
    }
    record.private_matches = 0;
  });
  for (const file of privateFiles)
    clean(`remove-${file}`, () =>
      fs.rmSync(`.local/${file}`, { force: true, recursive: true }),
    );
  record.private_material_removed = privateFiles.every(
    (file) => !fs.existsSync(`.local/${file}`),
  );
  record.lock_held_through_hashing = true;
  record.ended_at = new Date().toISOString();
  save();
  const files = fs.readdirSync(output).sort();
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    files
      .map(
        (file) =>
          `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}\n`,
      )
      .join(""),
  );
}
process.exitCode = record.passed && record.private_material_removed ? 0 : 1;

