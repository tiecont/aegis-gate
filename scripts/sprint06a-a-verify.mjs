import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {
  command,
  hash,
  rawCommand,
} from "../spikes/envoy/sprint05d-a-build.mjs";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const [run, output] = process.argv.slice(2);
assert.match(run ?? "", /^evidence\/sprint06a-a\/run-\d+$/);
assert.match(output ?? "", /^evidence\/sprint06a-a\/verify-\d+$/);
assert.ok(!fs.existsSync(output));
const record = {
  started: new Date().toISOString(),
  argv: process.argv,
  commands: [],
  integrityPass: false,
  runtimeGO: false,
  streamingPass: false,
};
const git = async (...args) =>
  (await command(record, ["/usr/bin/git", ...args])).trim();
assert.equal(await git("status", "--porcelain", "--untracked-files=all"), "");
record.sourceCommit = await git("rev-parse", "HEAD");
record.sourceTree = await git("rev-parse", "HEAD^{tree}");
fs.mkdirSync(output);
const fixture = fs.mkdtempSync(path.resolve(".local/sprint06a-a-verify-"));
fs.mkdirSync(path.join(fixture, "tmp"));
process.env.TMPDIR = path.join(fixture, "tmp");
record.tmpdir = process.env.TMPDIR;
try {
  record.artifacts = [];
  for (const directory of fs
    .readdirSync("evidence/sprint06a-a")
    .filter((name) => /^run-\d+$/.test(name))) {
    const root = `evidence/sprint06a-a/${directory}`;
    for (const line of fs
      .readFileSync(`${root}/SHA256SUMS`, "utf8")
      .trim()
      .split("\n")) {
      const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
      assert.ok(match);
      assert.ok(match[2].startsWith(root + "/"));
      assert.equal(hash(fs.readFileSync(match[2])), match[1]);
      record.artifacts.push({ file: match[2], sha256: match[1] });
    }
  }
  const receipt = JSON.parse(fs.readFileSync(`${run}/receipt.json`)),
    collector = JSON.parse(fs.readFileSync(`${run}/collector.json`));
  record.reviewedSource = receipt.sourceCommit;
  record.reviewedTree = receipt.sourceTree;
  assert.equal(collector.sourceCommit, receipt.sourceCommit);
  assert.equal(collector.sourceTree, receipt.sourceTree);
  assert.equal(
    await git("rev-parse", `${receipt.sourceCommit}^{tree}`),
    receipt.sourceTree,
  );
  for (const { file, sha256 } of [...receipt.sources, ...collector.sources]) {
    const pinned = await rawCommand([
      "/usr/bin/git",
      "show",
      `${receipt.sourceCommit}:${file}`,
    ]);
    assert.equal(pinned.exit, 0);
    assert.equal(hash(Buffer.from(pinned.stdout)), sha256);
    assert.equal(hash(fs.readFileSync(file)), sha256);
  }
  assert.equal(collector.finiteControlsPass, true);
  assert.equal(receipt.completeValidationPass, true);
  assert.equal(receipt.streamingPass, false);
  assert.equal(receipt.streamingPositive.pass, false);
  assert.equal(receipt.runtimeGO, false);
  assert.equal(receipt.productionEligible, false);
  assert.equal(collector.run.exit, 0);
  assert.equal(collector.inspectAfter.State.ExitCode, 0);
  assert.equal(collector.inspectAfter.State.OOMKilled, true);
  assert.equal(receipt.resourceChild.signal, "SIGKILL");
  assert.equal(
    collector.run.stdout,
    fs.readFileSync(`${run}/run.stdout`, "utf8"),
  );
  assert.equal(
    collector.run.stderr,
    fs.readFileSync(`${run}/run.stderr`, "utf8"),
  );
  assert.equal(collector.remainingContainers.stdout, "");
  assert.equal(collector.removeContainer.exit, 0);
  assert.equal(collector.lockHeldThroughCleanupAndHash, true);
  assert.equal(receipt.lockHeldThroughCleanup, true);
  assert.equal(receipt.privateFixtureRemoved, true);
  assert.ok(!fs.existsSync(path.dirname(receipt.tmpdir)));
  assert.deepEqual(receipt.baselineBefore, receipt.baselineAfter);
  assert.deepEqual(collector.baselineBefore, collector.baselineAfter);
  assert.equal(
    collector.baselineBefore.protected_inventory_sha256,
    "85de42e7d2ac54b0f199bcced46760bec41b7687dd7c7016dd580ea4a300c1fa",
  );
  for (const value of Object.values(receipt.cleanup)) assert.equal(value, 0);
  assert.equal(receipt.probes.length, 67);
  const byName = new Map(receipt.probes.map((p) => [p.name, p]));
  assert.equal(byName.size, 67);
  for (const name of [
    "CL-common-prefix-EOF",
    "chunk-common-prefix-EOF",
    "chunk-common-prefix-late-fold",
    "ciphertext-tamper-auth-before-dial",
    "FileHandle-zero-write",
    "FileHandle-EIO-write",
    "pre-admission-truncate-rejected",
    "pre-admission-hardlink-rejected",
    "pre-admission-symlink-replace-rejected",
    "pre-admission-mode-rejected",
    "actual-tmpfs-ENOSPC-before-origin",
  ]) {
    const row = byName.get(name);
    assert.ok(row);
    assert.equal(row.origin.bytes, 0);
    assert.equal(row.origin.dials, 0);
    assert.equal(row.origin.handlers.length, 0);
    assert.equal(row.origin.connections, 0);
  }
  for (const row of receipt.probes) {
    if (
      row.response?.statuses.length === 1 &&
      row.response.statuses[0] === 200 &&
      row.inputSha256
    ) {
      assert.equal(row.origin.raw.length, 1);
      assert.equal(row.origin.raw[0].sha256, row.inputSha256);
      assert.equal(row.origin.bytes, row.inputBytes);
      assert.equal(row.origin.handlers.length, 1);
      assert.equal(row.origin.handlers[0].ended, true);
    }
  }
  const cpu = byName.get("kernel-CPU-quota-enforced"),
    pids = byName.get("kernel-PID-cap-enforced"),
    memory = byName.get("kernel-memory-OOM-killed-child-ingress-survived");
  assert.ok(cpu.after.nr_throttled > cpu.before.nr_throttled);
  assert.ok(pids.after.max > pids.before.max);
  assert.equal(pids.peak, "64");
  assert.ok(memory.after.oom_kill > memory.before.oom_kill);
  assert.equal(memory.peak, "402653184");
  assert.deepEqual(receipt.cgroupFinal.controls, {
    memoryMax: "402653184",
    swapMax: "0",
    cpuMax: "75000 100000",
    pidsMax: "64",
  });
  const disk = byName.get("actual-tmpfs-ENOSPC-before-origin").tmpfs;
  assert.equal(disk.failure, "ENOSPC");
  assert.equal(disk.fillerBytes, 8388608);
  assert.ok(disk.flags.some((line) => line.includes("size=8192k")));
  assert.equal(collector.inspectBefore.HostConfig.NetworkMode, "none");
  assert.equal(collector.inspectBefore.HostConfig.PidMode, "host");
  assert.deepEqual(collector.inspectBefore.HostConfig.PortBindings, {});
  record.probes = receipt.probes.length;
  record.checkedSourceBindings =
    receipt.sources.length + collector.sources.length;
  const owned = (
    await git("ls-files", "scripts/sprint06a-a-*", "spikes/envoy/sprint06a-a-*")
  ).split("\n");
  await command(record, [
    process.execPath,
    "/home/tiecont/Projects/aegis-gate/node_modules/prettier/bin/prettier.cjs",
    "--check",
    ...owned,
  ]);
  for (const file of owned)
    await command(record, [process.execPath, "--check", file]);
  await command(record, [
    "/usr/bin/git",
    "diff",
    "--check",
    "8929adfd10f245ec0dac70b5304f1a2b445e7357",
  ]);
  record.protected = JSON.parse(
    await command(record, [process.execPath, "scripts/sprint05b-baseline.mjs"]),
  );
  const scanSource = path.join(fixture, "scan");
  fs.mkdirSync(scanSource);
  for (const file of [...owned, "docs/reports/sprint06a-a-finite-ingress.md"])
    fs.copyFileSync(file, path.join(scanSource, path.basename(file)));
  fs.cpSync("evidence/sprint06a-a", path.join(scanSource, "evidence"), {
    recursive: true,
  });
  const scanner =
    "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f";
  await command(record, [
    "/usr/bin/docker",
    "run",
    "--rm",
    "--pull=never",
    "--network=none",
    "--name",
    `aegisgate-sprint06a-a-scan-${process.pid}`,
    "--user",
    `${process.getuid()}:${process.getgid()}`,
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--mount",
    `type=bind,src=${scanSource},dst=/scan,readonly`,
    "--mount",
    `type=bind,src=${path.resolve(output)},dst=/reports`,
    "--mount",
    `type=bind,src=${path.resolve(".github/gitleaks.toml")},dst=/config.toml,readonly`,
    scanner,
    "dir",
    "/scan",
    "--config",
    "/config.toml",
    "--redact",
    "--report-format=json",
    "--report-path=/reports/secrets.json",
    "--no-banner",
  ]);
  assert.deepEqual(JSON.parse(fs.readFileSync(`${output}/secrets.json`)), []);
  record.integrityPass = true;
} catch (e) {
  record.error = { message: e.message, stack: e.stack };
  process.exitCode = 1;
} finally {
  assertLock();
  fs.rmSync(fixture, { recursive: true, force: true });
  record.privateFixtureRemoved = !fs.existsSync(fixture);
  record.ended = new Date().toISOString();
  record.lockHeldThroughCleanupAndHashes = true;
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    fs
      .readdirSync(output)
      .filter((n) => n !== "SHA256SUMS")
      .sort()
      .map(
        (name) =>
          `${hash(fs.readFileSync(`${output}/${name}`))}  ${output}/${name}\n`,
      )
      .join(""),
  );
  console.log(
    JSON.stringify({
      output,
      integrityPass: record.integrityPass,
      probes: record.probes,
      error: record.error,
    }),
  );
}
