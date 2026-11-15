import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const [
  clone,
  revision,
  output,
  rawRelative = "evidence/sprint06a-root/gates-01",
] = process.argv.slice(2);
assert.ok(path.isAbsolute(clone));
assert.match(output ?? "", /^evidence\/sprint06a-f\/gate-run-\d+$/);
assert.match(rawRelative, /^evidence\/sprint06a-root\/gates-\d+$/);
assert.ok(!fs.existsSync(output));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, {
    cwd: clone,
    encoding: "utf8",
    maxBuffer: 32 << 20,
  }).trim();
const commit = git("rev-parse", `${revision}^{commit}`);
assert.equal(git("rev-parse", "HEAD"), commit);
assert.equal(git("status", "--porcelain"), "");
const node = process.execPath,
  raw = path.join(clone, rawRelative);
assert.ok(!fs.existsSync(raw));
fs.mkdirSync(output, { recursive: true });
const record = {
  reviewerCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  argv: process.argv,
  collectorSha256: sha(fs.readFileSync(import.meta.filename)),
  sourceCommit: commit,
  sourceTree: git("rev-parse", "HEAD^{tree}"),
  clone,
  rawRelative,
  started: new Date().toISOString(),
  commands: [],
  tools: [],
  runtimeComplete: false,
  runtimePass: false,
  module01Pass: false,
  productionPass: false,
  environment: Object.fromEntries(
    [
      "PATH",
      "TMPDIR",
      "GOTOOLCHAIN",
      "GOAMD64",
      "GOFLAGS",
      "CARGO_HOME",
      "RUSTUP_HOME",
    ].map((k) => [k, process.env[k] ?? null]),
  ),
};
assert.ok(record.environment.TMPDIR?.startsWith("/home/"));
assert.equal(record.environment.GOAMD64, "v1");
const save = () =>
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
const inventory = () =>
  execFileSync("git", ["ls-files", "-z"], { cwd: clone, maxBuffer: 32 << 20 })
    .toString()
    .split("\0")
    .filter(Boolean)
    .map((file) => ({
      file,
      sha256: sha(fs.readFileSync(path.join(clone, file))),
    }));
async function run(label, executable, args, checked = true) {
  assertLock();
  const resolved = path.isAbsolute(executable)
    ? executable
    : process.env.PATH.split(path.delimiter)
        .map((d) => path.join(d, executable))
        .find((f) => fs.existsSync(f));
  assert.ok(resolved, executable);
  const begun = new Date().toISOString();
  const child = spawn(resolved, args, {
    cwd: clone,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = [],
    stderr = [];
  let error;
  child.stdout.on("data", (b) => stdout.push(b));
  child.stderr.on("data", (b) => stderr.push(b));
  child.on("error", (e) => {
    error = e.message;
  });
  const [exit, signal] = await new Promise((resolve) =>
    child.once("close", (...values) => resolve(values)),
  );
  const streams = ["stdout", "stderr"].map((name, i) => {
    const b = Buffer.concat(i ? stderr : stdout),
      file = `${label}.${name}`;
    fs.writeFileSync(`${output}/${file}`, b);
    return { file, bytes: b.length, sha256: sha(b) };
  });
  record.commands.push({
    label,
    executable: fs.realpathSync(resolved),
    executableSha256: sha(fs.readFileSync(resolved)),
    args,
    cwd: clone,
    begun,
    ended: new Date().toISOString(),
    exit,
    signal,
    error,
    streams,
  });
  save();
  console.log(JSON.stringify({ label, exit, signal }));
  if (checked) {
    assert.equal(exit, 0, label);
    assert.equal(signal, null, label);
    assert.equal(error, undefined, label);
  }
  return Buffer.concat(stdout);
}
let before;
try {
  before = inventory();
  record.sourceFilesBefore = before.length;
  record.inventorySha256 = sha(JSON.stringify(before));
  for (const name of [
    "git",
    "flock",
    "make",
    "bash",
    "go",
    "gofmt",
    "cargo",
    "rustc",
    "python3",
    "docker",
    "openssl",
    "cc",
    "curl",
  ]) {
    const file = process.env.PATH.split(path.delimiter)
      .map((p) => path.join(p, name))
      .find((p) => fs.existsSync(p));
    assert.ok(file, name);
    record.tools.push({
      name,
      file: fs.realpathSync(file),
      sha256: sha(fs.readFileSync(file)),
    });
  }
  for (const file of [
    node,
    "/home/tiecont/.rustup/toolchains/1.99.1-x86_64-unknown-linux-gnu/bin/cargo",
    "/home/tiecont/.rustup/toolchains/1.99.1-x86_64-unknown-linux-gnu/bin/rustc",
    `${clone}/node_modules/prettier/bin/prettier.cjs`,
  ])
    record.tools.push({
      file: fs.realpathSync(file),
      sha256: sha(fs.readFileSync(file)),
    });
  for (const [name, executable, args] of [
    ["go", "go", ["version"]],
    ["cargo", "cargo", ["+1.99.1", "--version"]],
    ["rustc", "rustc", ["+1.99.1", "--version"]],
    ["docker", "docker", ["version", "--format", "{{.Server.Version}}"]],
    ["compose", "docker", ["compose", "version"]],
  ])
    await run(`version-${name}`, executable, args);
  record.protectedBefore = JSON.parse(
    await run("protected-before", node, ["scripts/sprint05b-baseline.mjs"]),
  );
  assert.equal(
    record.protectedBefore.protected_inventory_sha256,
    "85de42e7d2ac54b0f199bcced46760bec41b7687dd7c7016dd580ea4a300c1fa",
  );
  record.gateSourceHashes = [
    "scripts/sprint04c-gates.mjs",
    "scripts/security-scan.sh",
    "Makefile",
  ].map((file) => ({
    file,
    sha256: sha(fs.readFileSync(path.join(clone, file))),
  }));
  record.running = true;
  save();
  await run(
    "full-locked-gates",
    node,
    ["scripts/sprint04c-gates.mjs", rawRelative],
    false,
  );
  record.running = false;
  const gate = JSON.parse(fs.readFileSync(`${raw}/commands.json`));
  record.gateReceiptSha256 = sha(fs.readFileSync(`${raw}/commands.json`));
  assert.equal(gate.source_commit, commit);
  assert.equal(gate.source_tree, record.sourceTree);
  record.rawArtifacts = [];
  for (const line of fs
    .readFileSync(`${raw}/SHA256SUMS`, "utf8")
    .trim()
    .split("\n")) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.ok(match);
    assert.ok(match[2].startsWith(rawRelative + "/"));
    const b = fs.readFileSync(path.join(clone, match[2]));
    assert.equal(sha(b), match[1]);
    record.rawArtifacts.push({
      file: match[2],
      bytes: b.length,
      sha256: match[1],
    });
  }
  for (const command of gate.commands)
    for (const s of command.streams)
      assert.equal(sha(fs.readFileSync(path.join(clone, s.file))), s.sha256);
  assert.deepEqual(
    gate.commands.map((c) => c.label),
    ["check", "security-scan", "cleanup", "cleanup-volumes"],
  );
  assert.ok(
    gate.commands.every(
      (c) => c.exit_code === 0 && c.signal === null && c.error === undefined,
    ),
  );
  record.gateCommands = gate.commands;
  record.privateCleanup = gate.private_fixture_cleanup;
  record.privateCheck = gate.private_material_check;
  for (const row of gate.private_fixture_cleanup) {
    assert.equal(row.exists, false);
    assert.equal(fs.existsSync(path.join(clone, row.file)), false);
  }
  for (const [kind, args] of [
    ["containers", ["ps", "-aq"]],
    ["networks", ["network", "ls", "-q"]],
    ["volumes", ["volume", "ls", "-q"]],
  ]) {
    assert.deepEqual(gate[`remaining_project_${kind}`], []);
    assert.equal(
      (
        await run(`current-${kind}`, "docker", [
          ...args,
          "--filter",
          `label=com.docker.compose.project=${gate.compose_project}`,
        ])
      )
        .toString()
        .trim(),
      "",
    );
  }
  const scanner = fs.readFileSync(`${raw}/security-scan.stdout.log`, "utf8"),
    quality = fs.readFileSync(`${raw}/check.stdout.log`, "utf8");
  assert.ok(!/^FAIL /m.test(scanner));
  assert.ok(!/^FAIL\s|^--- FAIL:/m.test(quality));
  record.scannerPassLabels = [...scanner.matchAll(/^PASS (.+)$/gm)].map(
    (m) => m[1],
  );
  for (const label of [
    "rust-vulnerabilities",
    "go-vulnerabilities",
    "npm-root-vulnerabilities",
    "npm-dashboard-vulnerabilities",
    "worktree-secrets",
    "history-secrets",
    "repository-sbom",
    "filesystem-vulnerabilities",
    "envoy-spike-vulnerabilities",
    "envoy-spike-sbom",
    ...[1, 2, 3, 4].flatMap((i) => [
      `image-${i}-vulnerabilities`,
      `image-${i}-sbom`,
    ]),
  ])
    assert.ok(record.scannerPassLabels.includes(label), label);
  for (const file of ["secrets.json", "history-secrets.json"])
    assert.deepEqual(
      JSON.parse(fs.readFileSync(`${raw}/security/${file}`)),
      [],
    );
  record.vulnerabilityReports = [];
  for (const file of [
    "filesystem-vulnerabilities.json",
    "envoy-spike-vulnerabilities.json",
    ...[1, 2, 3, 4].map((i) => `image-${i}-vulnerabilities.json`),
  ]) {
    const r = JSON.parse(fs.readFileSync(`${raw}/security/${file}`));
    const blocked = (r.Results ?? [])
      .flatMap((v) => v.Vulnerabilities ?? [])
      .filter((v) => ["HIGH", "CRITICAL"].includes(v.Severity));
    assert.equal(blocked.length, 0);
    record.vulnerabilityReports.push({ file, highCritical: 0 });
  }
  for (const marker of [
    "go test -p 1 -race",
    "-run Integration -count=1",
    "PASS: local Postgres transaction",
    "PASS: exact local Postgres image fresh initialization",
    "PASS: actual OpenAPI-generated Go envelope",
    "PASS: formatting, Go vet, schema compatibility",
  ])
    assert.ok(quality.includes(marker), marker);
  assert.equal(gate.private_material_check.matches, 0);
  assert.equal(gate.lock_held_through_cleanup, true);
  assert.equal(gate.passed, true);
  assert.equal(
    record.commands.find((c) => c.label === "full-locked-gates").exit,
    0,
  );
  assert.equal(git("rev-parse", "HEAD"), commit, "exact source HEAD changed");
  record.localGatesAccepted = true;
  record.complete = true;
} catch (error) {
  record.error = error.stack;
  process.exitCode = 1;
} finally {
  assertLock();
  if (before) {
    try {
      assert.equal(git("rev-parse", "HEAD"), commit, "exact source HEAD changed");
      assert.deepEqual(inventory(), before);
      record.sourceFilesAfter = before.length;
      record.protectedAfter = JSON.parse(
        await run("protected-after", node, ["scripts/sprint05b-baseline.mjs"]),
      );
      assert.deepEqual(record.protectedAfter, record.protectedBefore);
      assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
      record.sourceIntegrityAfter = true;
    } catch (error) {
      record.postcheckError = error.stack;
      record.complete = false;
      process.exitCode = 1;
    }
  }
  record.ended = new Date().toISOString();
  record.lockHeldThroughCleanupAndHashes = true;
  save();
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    fs
      .readdirSync(output)
      .sort()
      .map((f) => `${sha(fs.readFileSync(`${output}/${f}`))}  ${output}/${f}\n`)
      .join(""),
  );
  console.log(
    JSON.stringify({
      complete: record.complete,
      localGatesAccepted: record.localGatesAccepted,
      source: commit,
      error: record.error,
      postcheckError: record.postcheckError,
      raw,
    }),
  );
  assertLock();
}
