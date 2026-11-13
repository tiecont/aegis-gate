import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const [root, attempt, expectedRoot] = process.argv.slice(2);
assert.ok(root && /^integration-[a-z0-9-]+$/.test(attempt) && expectedRoot);
const output = path.resolve("evidence/sprint04a-e", attempt);
assert.ok(!fs.existsSync(output), "fresh E output required");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const baseline = "3e03940848c81751c87bbcec131238abb7d28e1b";
assert.equal(git(process.cwd(), "status", "--porcelain", "--untracked-files=no"), "", "commit verifier before proof");
assert.equal(git(root, "rev-parse", "HEAD"), expectedRoot);
assert.equal(git(root, "status", "--porcelain", "--untracked-files=no"), "", "root source must be committed");
const receipt = {
  argv: process.argv,
  reviewer_commit: git(process.cwd(), "rev-parse", "HEAD"),
  reviewer_tree: git(process.cwd(), "rev-parse", "HEAD^{tree}"),
  root_commit: expectedRoot,
  root_tree: git(root, "rev-parse", "HEAD^{tree}"),
  tracked_clean: true,
  untracked_root_paths: git(root, "ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean),
  started_at: new Date().toISOString(),
  node: process.version,
  node_binary: process.execPath,
  node_sha256: sha(fs.readFileSync(process.execPath)),
  owners: [],
  gates: [],
  root_files: [],
};
const owners = [
  ["a", "fix/module01-envoy-codec-boundary", "8d83ece166290b7c81e757281e5b1778e83dede4"],
  ["b", "test/module01-origin-boundary", "93dc1223ae09d2562a9b4c5b307b173f960b9ea4"],
  ["c", "research/module01-upstream-capability", "6acbe0f55d50334a14b95c4d3e9888f5d1aebecf"],
  ["d", "fix/dashboard-dependency-resolution", "b42bae1e9ffa63b4dfd4c94c9a6376f7129077ce"],
  ["f", "hardening/module03-local-recovery", "bf5785eb8bd6449fc34915b7c2f392bd1d46350f"],
  ["e", "review/sprint04a-security", "be7fd31"],
];
for (const [owner, branch, head] of owners) {
  const exact = git(root, "rev-parse", head);
  if (owner !== "e") assert.equal(git(root, "rev-parse", branch), exact);
  const changed = git(root, "diff", "--name-only", baseline, exact).split("\n").filter(Boolean);
  const record = { owner, branch, accepted_head: exact, excluded_shared: [], files: [] };
  for (const file of changed) {
    if (file === "docs/sprints/04a-execution.md") {
      record.excluded_shared.push(file);
      continue;
    }
    const original = git(root, "ls-tree", exact, "--", file);
    const integrated = git(root, "ls-tree", expectedRoot, "--", file);
    assert.ok(original, `missing owner object: ${file}`);
    assert.equal(integrated, original, `integration changed accepted owner file: ${file}`);
    const blob = original.split(/\s+/)[2];
    const bytes = fs.readFileSync(path.join(root, file));
    assert.equal(git(root, "hash-object", "--", file), blob, `working copy changed: ${file}`);
    record.files.push({ file, tree_entry: original, sha256: sha(bytes) });
  }
  receipt.owners.push(record);
}

const protectedFiles = [
  ...git(root, "ls-tree", "-r", "--name-only", baseline, "--", "spikes/edge-comparison", "spikes/pingora/lab.mjs", "internal/configsnapshot").split("\n"),
  "docs/CONFIG_PROTOCOL.md", "package.json", "package-lock.json",
  "apps/dashboard/package.json", "apps/dashboard/package-lock.json", "go.mod", "go.sum",
];
receipt.protected = [];
for (const file of protectedFiles) {
  const original = git(root, "ls-tree", baseline, "--", file);
  assert.ok(original, `invalid protected path: ${file}`);
  assert.equal(git(root, "ls-tree", expectedRoot, "--", file), original, `protected object changed: ${file}`);
  receipt.protected.push({ file, tree_entry: original, sha256: sha(fs.readFileSync(path.join(root, file))) });
}

function verifyManifest(file) {
  const lines = fs.readFileSync(path.join(root, file), "utf8").trim().split("\n");
  for (const line of lines) {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    assert.ok(match, `invalid manifest line: ${file}`);
    const target = path.resolve(root, match[2]);
    assert.ok(target.startsWith(path.resolve(root) + path.sep));
    assert.equal(sha(fs.readFileSync(target)), match[1], `manifest mismatch: ${match[2]}`);
  }
  return { file, sha256: sha(fs.readFileSync(path.join(root, file))), entries: lines.length };
}
receipt.original_e_manifest = verifyManifest("evidence/sprint04a-e/SHA256SUMS");
receipt.root_command_receipts = [];
for (const directory of fs.readdirSync(path.join(root, "evidence/sprint04a-root"))) {
  const file = `evidence/sprint04a-root/${directory}/command.json`;
  if (!fs.existsSync(path.join(root, file))) continue;
  const bytes = fs.readFileSync(path.join(root, file));
  const command = JSON.parse(bytes);
  assert.equal(git(root, "rev-parse", `${command.source_commit}^{tree}`), command.source_tree);
  for (const stream of ["stdout", "stderr"]) assert.equal(sha(fs.readFileSync(path.join(root, "evidence/sprint04a-root", directory, `${stream}.log`))), command[`${stream}_sha256`]);
  receipt.root_command_receipts.push({ file, sha256: sha(bytes), ...command });
}
for (const directory of fs.readdirSync(path.join(root, "evidence/sprint04a-root"))) {
  if (!/^gates-\d+$/.test(directory)) continue;
  const prefix = `evidence/sprint04a-root/${directory}`;
  const file = `${prefix}/commands.json`;
  if (!fs.existsSync(path.join(root, file))) continue;
  const bytes = fs.readFileSync(path.join(root, file));
  const gate = JSON.parse(bytes);
  assert.equal(git(root, "rev-parse", `${gate.source_commit}^{tree}`), gate.source_tree);
  for (const command of gate.commands) {
    for (const stream of command.streams) assert.equal(sha(fs.readFileSync(path.join(root, stream.file))), stream.sha256);
  }
  const manifest = `${prefix}/SHA256SUMS`;
  receipt.gates.push({
    directory, commands_sha256: sha(bytes), source_commit: gate.source_commit,
    source_tree: gate.source_tree, complete: Boolean(gate.ended_at), passed: gate.passed ?? null,
    started_at: gate.started_at, ended_at: gate.ended_at ?? null,
    compose_project: gate.compose_project ?? "default",
    commands: gate.commands,
    manifest: fs.existsSync(path.join(root, manifest)) ? verifyManifest(manifest) : null,
  });
}

receipt.corpus_inventory = [];
for (const file of [
  "evidence/sprint03a-e/observed-pingora/results.json",
  "evidence/sprint03a-e/observed-envoy/results.json",
  "evidence/sprint03a-e/observed-hyper/results.json",
  "evidence/sprint03b-f/parser-runtime-host-retention/results.json",
  ...["02", "05"].flatMap((attempt) => ["unchanged75", "diagnostic75"].map((kind) => `evidence/sprint04a-b/attempt${attempt}/${kind}-results.json`)),
  ...["unchanged75", "diagnostic75"].map((kind) => `evidence/sprint04a-e/b-01/wire/${kind}-results.json`),
]) {
  const bytes = fs.readFileSync(path.join(root, file));
  const result = JSON.parse(bytes);
  assert.equal(result.tests.length, 75);
  assert.equal(new Set(result.tests.map((test) => test.name)).size, 75);
  assert.ok(result.tests.every((test) => ["pass", "fail"].includes(test.status)));
  receipt.corpus_inventory.push({ file, sha256: sha(bytes), passed: result.tests.filter((test) => test.status === "pass").length,
    failed_ids: result.tests.filter((test) => test.status === "fail").map((test) => test.name) });
}
for (const file of [
  "scripts/sprint04a-gates.mjs", "scripts/sprint04a-evidence.mjs", "scripts/sprint04a-corpus.mjs",
  "scripts/fixture-image-integration.py", ".github/workflows/ci.yml", "IMPLEMENTATION_STATUS.md", "docs/RISK_REGISTER.md",
  "docs/ADR-011-pingora-evaluation.md", "docs/reports/sprint04a-architecture-decision.md",
  "docs/reports/sprint04a-completion.md", "docs/sprints/04a-execution.md",
]) receipt.root_files.push({ file, tree_entry: git(root, "ls-tree", expectedRoot, "--", file), sha256: sha(fs.readFileSync(path.join(root, file))) });
assert.equal(git(root, "rev-parse", "HEAD"), expectedRoot, "root moved during snapshot; rerun on stable head");
assert.equal(git(root, "status", "--porcelain", "--untracked-files=no"), "");
receipt.ended_at = new Date().toISOString();
receipt.exit_code = 0;
receipt.scope = "Read-only integrated source and retained receipt verification; no fixtures, candidate execution, hosted gates or GO.";
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(receipt, null, 2) + "\n");
fs.writeFileSync(path.join(output, "SHA256SUMS"), `${sha(fs.readFileSync(path.join(output, "verification.json")))}  evidence/sprint04a-e/${attempt}/verification.json\n`);
console.log(JSON.stringify({ output, root_commit: expectedRoot, root_tree: receipt.root_tree, owner_files: receipt.owners.map((owner) => [owner.owner, owner.files.length]), gates: receipt.gates.map((gate) => [gate.directory, gate.complete, gate.passed]), exit_code: 0 }));
