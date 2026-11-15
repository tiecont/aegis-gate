import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

assertLock();
process.umask(0o077);
const [input, output] = process.argv.slice(2);
assert.match(input ?? "", /^evidence\/sprint06a-b\/attempt-\d+$/);
assert.match(output ?? "", /^evidence\/sprint06a-b\/verify-\d+$/);
assert.ok(!fs.existsSync(output));
const sha = (raw) => createHash("sha256").update(raw).digest("hex");
const git = (...args) =>
  execFileSync("/usr/bin/git", args, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain", "--untracked-files=all"), "");
fs.mkdirSync(output, { recursive: true });
const receipt = {
  sourceCommit: git("rev-parse", "HEAD"),
  sourceTree: git("rev-parse", "HEAD^{tree}"),
  argv: process.argv,
  nodeSha256: sha(fs.readFileSync(process.execPath)),
  started: new Date().toISOString(),
  commands: [],
  passed: false,
};
function run(label, command, args) {
  assertLock();
  const p = spawnSync(command, args, {
    env: { ...process.env, TMPDIR: path.resolve(".local/tmp") },
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 8 << 20,
  });
  for (const stream of ["stdout", "stderr"])
    fs.writeFileSync(`${output}/${label}.${stream}`, p[stream] ?? "");
  receipt.commands.push({
    label,
    argv: [command, ...args],
    exit: p.status,
    signal: p.signal,
    error: p.error?.message,
  });
  assert.equal(p.status, 0, label);
  return p.stdout;
}
try {
  const record = JSON.parse(fs.readFileSync(`${input}/receipt.json`));
  assert.equal(record.passed, true);
  assert.equal(record.module01Pass, false);
  assert.equal(record.productionEligible, false);
  assert.equal(record.privateFixtureAbsent, true);
  assert.equal(record.privateMatches, 0);
  assert.equal(record.sourcesUnchanged, true);
  assert.equal(record.lockHeldThroughCleanupAndHashes, true);
  assert.equal(
    git("rev-parse", `${record.sourceCommit}^{tree}`),
    record.sourceTree,
  );
  receipt.reviewedSource = record.sourceCommit;
  receipt.reviewedTree = record.sourceTree;
  const lines = fs
    .readFileSync(`${input}/SHA256SUMS`, "utf8")
    .trim()
    .split("\n");
  for (const line of lines) {
    const [expected, file] = line.split("  ");
    assert.ok(file.startsWith(`${input}/`));
    assert.equal(sha(fs.readFileSync(file)), expected, file);
  }
  receipt.artifactHashes = lines.length;
  for (const { file, sha256 } of record.sources) {
    assert.equal(
      sha(
        execFileSync("/usr/bin/git", [
          "show",
          `${record.sourceCommit}:${file}`,
        ]),
      ),
      sha256,
      file,
    );
    assert.equal(sha(fs.readFileSync(file)), sha256, file);
  }
  for (const command of record.commands) {
    assert.equal(command.exit, 0, command.label);
    assert.equal(command.error, undefined);
    for (const stream of command.streams)
      assert.equal(sha(fs.readFileSync(stream.file)), stream.sha256);
  }
  for (const command of record.build.commands) assert.equal(command.exit, 0);
  assert.equal(record.build.upstream.length, 5);
  assert.equal(record.admissionTests.skipped, 0);
  assert.ok(record.admissionTests.topLevel >= 6);
  assert.ok(record.admissionTests.subtests >= 42);
  const raw = fs.readFileSync(`${input}/signed-finite-race.stdout`, "utf8");
  for (const marker of [
    "signed_finite_positive tenant=a generation=7 status=200",
    "signed_finite_positive tenant=b generation=7 status=200",
    "rollback_capture old_deployment=7 new_deployment=9 rollback_resource=7 status=200",
    "TestConcurrentCaptureAndCancelledNewerRollback",
  ])
    assert.ok(raw.includes(marker), marker);
  const packageNames = [
    "configsnapshot",
    "configconsumer",
    "configpublish",
    "configrollout",
  ];
  receipt.module03 = {};
  for (const name of packageNames) {
    const text = fs.readFileSync(`${input}/module03-${name}.stdout`, "utf8");
    assert.ok(!/--- (FAIL|SKIP):/.test(text));
    assert.match(text, /\nPASS\n$/);
    receipt.module03[name] = {
      topLevel: (text.match(/^--- PASS:/gm) ?? []).length,
      subtests: (text.match(/^\s+--- PASS:/gm) ?? []).length,
      skipped: 0,
    };
  }
  const protectedNow = JSON.parse(
    run("protected-current", process.execPath, [
      "scripts/sprint05b-baseline.mjs",
    ]),
  );
  assert.deepEqual(protectedNow, record.protectedBefore);
  assert.deepEqual(protectedNow, record.protectedAfter);
  const goDir =
    "/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin";
  const files = git(
    "ls-files",
    "internal/configsnapshot/sprint06a_experimental.go",
    "spikes/sprint06a-admission/*.go",
  ).split("\n");
  assert.equal(run("gofmt", `${goDir}/gofmt`, ["-l", ...files]).trim(), "");
  for (const file of [
    "scripts/sprint06a-b-run.mjs",
    "scripts/sprint06a-b-verify.mjs",
    "spikes/sprint06a-admission/sprint06a-b-finite.mjs",
  ])
    run(`syntax-${path.basename(file)}`, process.execPath, ["--check", file]);
  run("prettier", process.execPath, [
    "/home/tiecont/Projects/aegis-gate/node_modules/prettier/bin/prettier.cjs",
    "--check",
    "scripts/sprint06a-b-run.mjs",
    "scripts/sprint06a-b-verify.mjs",
  ]);
  run("whitespace", "/usr/bin/git", [
    "diff",
    "--check",
    "8929adf",
    "--",
    "internal/configsnapshot/sprint06a_experimental.go",
    "spikes/sprint06a-admission",
    "scripts/sprint06a-b-run.mjs",
    "scripts/sprint06a-b-verify.mjs",
    "docs/reports/sprint06a-b-signed-admission.md",
  ]);
  const hook = fs.readFileSync(
    "internal/configsnapshot/sprint06a_experimental.go",
    "utf8",
  );
  assert.ok(hook.startsWith("//go:build aegisgate_sprint06a_feasibility\n"));
  assert.ok(hook.includes("s.key(keyID, createdAt, now)"));
  assert.ok(hook.includes("ed25519.Verify"));
  assert.ok(hook.includes("canonicalRaw(raw)"));
  for (const file of fs.readdirSync(input)) {
    const content = fs.readFileSync(`${input}/${file}`, "utf8");
    assert.ok(
      !/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer eyJ/.test(
        content,
      ),
    );
  }
  receipt.passed = true;
} catch (error) {
  receipt.error = error.stack;
} finally {
  assertLock();
  receipt.ended = new Date().toISOString();
  receipt.lockHeldThroughHashes = true;
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(receipt, null, 2) + "\n",
  );
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
console.log(JSON.stringify(receipt));
process.exitCode = receipt.passed ? 0 : 1;
