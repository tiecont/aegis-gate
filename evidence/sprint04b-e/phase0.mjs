import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

const source = "219cfa7676976772644bcdc8aad9c4d01ee8beca";
const baseline = "3e03940848c81751c87bbcec131238abb7d28e1b";
const [root, output] = process.argv.slice(2);
assert.ok(root && output && !fs.existsSync(output), "fresh receipt required");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, maxBuffer: 32 * 1024 * 1024 }).toString().trim();
assert.equal(git(root, "rev-parse", "HEAD"), source);
assert.equal(git(root, "status", "--porcelain"), "");
assert.equal(git(process.cwd(), "status", "--porcelain", "--untracked-files=no"), "");
fs.mkdirSync(output, { recursive: true });
const record = {
  source, source_tree: git(root, "rev-parse", "HEAD^{tree}"),
  reviewer: git(process.cwd(), "rev-parse", "HEAD"),
  reviewer_tree: git(process.cwd(), "rev-parse", "HEAD^{tree}"),
  source_clean: true, reviewer_tracked_clean: true,
  reviewer_untracked: git(process.cwd(), "ls-files", "--others", "--exclude-standard"),
  argv: process.argv, started_at: new Date().toISOString(),
  node: process.version, node_sha256: sha(fs.readFileSync(process.execPath)), commands: [],
};
const read = (file) => fs.readFileSync(path.join(root, file));
const json = (file) => JSON.parse(read(file));
const run = (label, program, args) => {
  const started_at = new Date().toISOString();
  const result = spawnSync(program, args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  const streams = {};
  for (const stream of ["stdout", "stderr"]) {
    const bytes = result[stream] ?? Buffer.alloc(0);
    const file = path.join(output, `${label}.${stream}`);
    fs.writeFileSync(file, bytes, { flag: "wx" });
    streams[stream] = { file, sha256: sha(bytes) };
  }
  record.commands.push({ label, program, args, started_at, ended_at: new Date().toISOString(), exit_code: result.status, signal: result.signal, streams });
  assert.equal(result.status, 0, `${label} failed; preserve receipt`);
  return result.stdout.toString();
};
try {
  const historical = new Map([
    ["evidence/sprint04a-a/SHA256SUMS", "4d2d0c751cdc22cb06ec1bb305b321921a06ba7e"],
    ["evidence/sprint04a-a/boundary-checks-02/SHA256SUMS", "141490831c76fd5ad0ef3db5be8f8650b68c1d5e"],
    ["evidence/sprint04a-c/historical-SHA256SUMS", "a795e619e528c08b5f22b0a3f8701e7284e96b52"],
  ]);
  record.manifests = [];
  record.historical = [];
  for (const file of git(root, "ls-files", "evidence/sprint04a-*").split("\n").filter((file) => file.endsWith("SHA256SUMS"))) {
    const lines = read(file).toString().trim().split("\n");
    for (const line of lines) {
      const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
      assert.ok(match, file);
      const [, expected, entry] = match;
      const target = /^(evidence|docs|spikes)\//.test(entry) ? entry : path.join(path.dirname(file), entry);
      assert.ok(!path.isAbsolute(target) && !target.split(path.sep).includes(".."));
      if (sha(read(target)) !== expected) {
        const revision = historical.get(file);
        assert.ok(revision, `unexpected mismatch: ${target}`);
        const bytes = execFileSync("git", ["show", `${revision}:${target}`], { cwd: root });
        assert.equal(sha(bytes), expected, `historical mismatch: ${target}`);
        record.historical.push({ manifest: file, target, revision, sha256: expected });
      }
    }
    record.manifests.push({ file, sha256: sha(read(file)), entries: lines.length });
  }
  assert.equal(record.historical.length, 6);
  const prior = json("evidence/sprint04a-e/integration-final-01/verification.json");
  record.owner_files = [];
  for (const owner of prior.owners) {
    for (const file of owner.files) {
      assert.equal(git(root, "ls-tree", source, "--", file.file), file.tree_entry);
      assert.equal(sha(read(file.file)), file.sha256);
    }
    record.owner_files.push({ owner: owner.owner, head: owner.accepted_head, count: owner.files.length });
  }
  for (const file of prior.protected) {
    assert.equal(git(root, "ls-tree", source, "--", file.file), file.tree_entry);
    assert.equal(sha(read(file.file)), file.sha256);
  }
  record.protected_files = prior.protected.length;
  record.gates = [];
  for (const directory of ["gates-01", "gates-02", "gates-03"]) {
    const gate = json(`evidence/sprint04a-root/${directory}/commands.json`);
    assert.equal(git(root, "rev-parse", `${gate.source_commit}^{tree}`), gate.source_tree);
    assert.ok(gate.ended_at);
    for (const command of gate.commands) for (const stream of command.streams) assert.equal(sha(read(stream.file)), stream.sha256);
    record.gates.push({ directory, source: gate.source_commit, passed: gate.passed, commands: gate.commands.map((c) => [c.label, c.exit_code]) });
  }
  assert.deepEqual(record.gates.map((g) => g.passed), [false, false, true]);
  record.corpus = prior.corpus_inventory.map((item) => {
    assert.equal(sha(read(item.file)), item.sha256);
    const tests = json(item.file).tests;
    assert.equal(tests.length, 75);
    assert.equal(new Set(tests.map((t) => t.name)).size, 75);
    assert.deepEqual(tests.filter((t) => t.status === "fail").map((t) => t.name), item.failed_ids);
    assert.equal(tests.filter((t) => t.status === "pass").length, item.passed);
    return item;
  });
  for (const command of prior.root_command_receipts) {
    const actual = json(command.file);
    assert.equal(git(root, "rev-parse", `${actual.source_commit}^{tree}`), actual.source_tree);
    for (const stream of ["stdout", "stderr"]) assert.equal(sha(read(path.join(path.dirname(command.file), `${stream}.log`))), actual[`${stream}_sha256`]);
  }
  record.executable_diff = git(root, "diff", "--name-only", "2133b6303c05158c37ed539c23347376d67b0b3c", source, "--", ".", ":!evidence", ":!docs/reports", ":!IMPLEMENTATION_STATUS.md", ":!docs/RISK_REGISTER.md");
  assert.equal(record.executable_diff, "");
  const files = git(root, "diff", "--name-only", baseline, source).split("\n");
  const groups = new Map();
  record.inventory = files.map((file) => {
    const bytes = read(file);
    assert.ok(!bytes.includes(0), `binary file: ${file}`);
    assert.ok(bytes.length <= 1024 * 1024, `large file: ${file}`);
    const hash = sha(bytes);
    if (bytes.length) groups.set(hash, [...(groups.get(hash) ?? []), file]);
    return { file, bytes: bytes.length, sha256: hash };
  });
  record.duplicates = [...groups].filter(([, files]) => files.length > 1).map(([sha256, files]) => ({ sha256, files }));
  assert.ok(record.duplicates.every((g) => g.files.every((f) => f.startsWith("evidence/"))));
  assert.equal(git(root, "diff", "--name-only", "--diff-filter=D", baseline, source), "");
  record.pr = JSON.parse(run("pr12", "gh", ["pr", "view", "12", "--repo", "tiecont/aegis-gate", "--json", "number,state,headRefOid,headRefName,baseRefName,mergeCommit,statusCheckRollup,url"]));
  assert.equal(record.pr.headRefOid, source);
  record.hosted = JSON.parse(run("hosted", "gh", ["run", "view", "43457905154", "--repo", "tiecont/aegis-gate", "--json", "headSha,status,conclusion,jobs,url,event,workflowName"]));
  assert.equal(record.hosted.headSha, source);
  assert.equal(record.hosted.status, "completed");
  assert.equal(record.hosted.conclusion, "success");
  for (const name of ["foundation-quality", "supply-chain-security"]) {
    const jobs = record.hosted.jobs.filter((j) => j.name === name);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].status, "completed");
    assert.equal(jobs[0].conclusion, "success");
  }
  const scanner = "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f";
  run("secrets", "flock", ["/tmp/aegisgate-sprint02-fixtures.lock", "docker", "run", "--rm", "--pull=never", "--network", "none", "--user", `${process.getuid()}:${process.getgid()}`, "-v", `${path.resolve(root)}:/repo:ro`, "-v", `${path.resolve(output)}:/reports`, scanner, "dir", "/repo", "--config", "/repo/.github/gitleaks.toml", "--redact", "--report-format", "json", "--report-path", "/reports/secrets.json", "--no-banner"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, "secrets.json"))), []);
  assert.equal(git(root, "rev-parse", "HEAD"), source);
  assert.equal(git(root, "status", "--porcelain"), "");
  record.verdict = "ACCEPT phase0 exact PR12 source; no merge or production authorization";
  record.exit_code = 0;
} catch (error) {
  record.error = error.stack;
  record.exit_code = 1;
  process.exitCode = 1;
} finally {
  record.ended_at = new Date().toISOString();
  record.scope = "Read-only exact source/evidence/hosted verification and offline secrets scan. No fixtures, gate reruns, dispatch, merge, publish or GO.";
  fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(record, null, 2) + "\n");
  fs.writeFileSync(path.join(output, "SHA256SUMS"), fs.readdirSync(output).sort().map((name) => `${sha(fs.readFileSync(path.join(output, name)))}  ${path.join(output, name)}`).join("\n") + "\n");
  console.log(JSON.stringify({ output, verdict: record.verdict ?? null, exit_code: record.exit_code, error: record.error ?? null }));
}
