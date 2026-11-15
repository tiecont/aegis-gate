import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const [clone, revision, output] = process.argv.slice(2);
assert.ok(path.isAbsolute(clone));
assert.match(output ?? "", /^evidence\/sprint05d-f\/gate-run-\d+$/);
assert.ok(!fs.existsSync(output));
const reviewer = process.cwd(),
  node = process.execPath;
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
fs.mkdirSync(output, { recursive: true });
const record = {
  reviewerCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  collectorSha256: sha(fs.readFileSync(import.meta.filename)),
  argv: process.argv,
  sourceCommit: commit,
  sourceTree: git("rev-parse", "HEAD^{tree}"),
  clone,
  started: new Date().toISOString(),
  environment: Object.fromEntries(
    [
      "PATH",
      "TMPDIR",
      "HOME",
      "GOTOOLCHAIN",
      "GOAMD64",
      "CARGO_HOME",
      "RUSTUP_HOME",
    ].map((key) => [key, process.env[key] ?? null]),
  ),
  commands: [],
  tools: [],
  runtimePass: false,
  productionPass: false,
};
assert.ok(record.environment.TMPDIR?.startsWith("/home/"));
const rawRelative = "evidence/sprint05d-root/gates-01";
const raw = path.join(clone, rawRelative);
assert.ok(!fs.existsSync(raw));
const save = () =>
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
const tree = git("ls-tree", "-r", "HEAD")
  .split("\n")
  .map((line) => {
    const [info, file] = line.split("\t");
    return { file, object: info.split(" ")[2] };
  });
function checkSource() {
  const actual = execFileSync("git", ["hash-object", "--stdin-paths"], {
    cwd: clone,
    input: tree.map((entry) => entry.file).join("\n") + "\n",
    encoding: "utf8",
    maxBuffer: 32 << 20,
  })
    .trim()
    .split("\n");
  for (const [i, entry] of tree.entries())
    assert.equal(actual[i], entry.object, entry.file);
  return tree.length;
}
async function run(label, executable, args, checked = true) {
  assertLock();
  const resolved = path.isAbsolute(executable)
    ? executable
    : process.env.PATH.split(path.delimiter)
        .map((dir) => path.join(dir, executable))
        .find((file) => fs.existsSync(file));
  assert.ok(resolved, executable);
  const started = new Date().toISOString(),
    child = spawn(resolved, args, {
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
    started,
    ended: new Date().toISOString(),
    exit,
    signal,
    error,
    streams,
  });
  save();
  console.log(`${label}: exit=${exit}`);
  if (checked) {
    assert.equal(exit, 0, label);
    assert.equal(signal, null);
    assert.equal(error, undefined);
  }
  return Buffer.concat(stdout);
}
try {
  record.sourceFilesBefore = checkSource();
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
      .map((dir) => path.join(dir, name))
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
  const before = JSON.parse(
    await run("protected-before", node, ["scripts/sprint05b-baseline.mjs"]),
  );
  assert.equal(before.protectedFiles.length, 11);
  record.protectedFiles = before.protectedFiles;
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
  record.gateOutcome = gate.passed;
  assert.equal(gate.source_commit, commit);
  assert.equal(gate.source_tree, record.sourceTree);
  record.rawArtifacts = [];
  for (const line of fs
    .readFileSync(`${raw}/SHA256SUMS`, "utf8")
    .trim()
    .split("\n")) {
    const [digest, file] = line.split("  ");
    assert.ok(file.startsWith(`${rawRelative}/`));
    const bytes = fs.readFileSync(path.join(clone, file));
    assert.equal(sha(bytes), digest, file);
    record.rawArtifacts.push({ file, sha256: digest, bytes: bytes.length });
  }
  for (const command of gate.commands)
    for (const stream of command.streams)
      assert.equal(
        sha(fs.readFileSync(path.join(clone, stream.file))),
        stream.sha256,
      );
  record.gateCommands = gate.commands.map(({ label, exit_code, signal }) => ({
    label,
    exit_code,
    signal,
  }));
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
  record.sourceFilesAfter = checkSource();
  assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
  assert.deepEqual(
    JSON.parse(
      await run("protected-after", node, ["scripts/sprint05b-baseline.mjs"]),
    ).protectedFiles,
    before.protectedFiles,
  );
  assert.equal(gate.lock_held_through_cleanup, true);
  assert.equal(gate.private_material_check.matches, 0);
  assert.equal(gate.passed, true);
  assert.equal(
    record.commands.find((c) => c.label === "full-locked-gates").exit,
    0,
  );
  assert.ok(gate.commands.every((c) => c.exit_code === 0 && c.signal === null));
  record.localGatesAccepted = true;
  record.complete = true;
} catch (e) {
  record.error = e.stack;
  process.exitCode = 1;
} finally {
  assertLock();
  record.ended = new Date().toISOString();
  record.lockHeldThroughCleanupAndHashes = true;
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
  console.log(
    JSON.stringify({
      complete: record.complete,
      gateOutcome: record.gateOutcome,
      error: record.error,
      sourceCommit: commit,
      raw,
    }),
  );
  assert.equal(process.cwd(), reviewer);
}
