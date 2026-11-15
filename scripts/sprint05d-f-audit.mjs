import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const [output, ...pairs] = process.argv.slice(2);
assert.match(output ?? "", /^evidence\/sprint05d-f\/audit-\d+$/);
assert.equal(pairs.length % 2, 0);
assert.ok(!fs.existsSync(output));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (...args) => execFileSync("git", args, { maxBuffer: 32 << 20 });
assert.equal(git("status", "--porcelain").toString().trim(), "");
fs.mkdirSync(output, { recursive: true });
const stage = fs.mkdtempSync(
  "/home/tiecont/.cache/aegisgate-sprint05d-f-audit-",
);
const record = {
  argv: process.argv,
  sourceCommit: git("rev-parse", "HEAD").toString().trim(),
  sourceTree: git("rev-parse", "HEAD^{tree}").toString().trim(),
  started: new Date().toISOString(),
  reviews: [],
  commands: [],
  runtimePass: false,
};
const show = (rev, file) => git("show", `${rev}:${file}`);
function run(label, program, args) {
  assertLock();
  const resolved = path.isAbsolute(program)
    ? program
    : process.env.PATH.split(path.delimiter)
        .map((p) => path.join(p, program))
        .find((p) => fs.existsSync(p));
  assert.ok(resolved);
  const r = spawnSync(resolved, args, {
    timeout: 180000,
    maxBuffer: 32 << 20,
    env: { ...process.env, TMPDIR: stage },
  });
  const streams = ["stdout", "stderr"].map((name) => {
    const file = `${label}.${name}`,
      b = r[name] ?? Buffer.alloc(0);
    fs.writeFileSync(`${output}/${file}`, b);
    return { file, bytes: b.length, sha256: sha(b) };
  });
  record.commands.push({
    label,
    program: resolved,
    executableSha256: sha(fs.readFileSync(resolved)),
    args,
    exit: r.status,
    signal: r.signal,
    error: r.error?.message,
    streams,
  });
  assert.equal(r.status, 0, label);
  assert.equal(r.signal, null, label);
  return r.stdout;
}
function preservedManifest(rev, file) {
  let count = 0;
  for (const line of show(rev, file).toString().trim().split("\n")) {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    assert.ok(match, file);
    assert.equal(sha(show(rev, match[2])), match[1], match[2]);
    count++;
  }
  return count;
}
try {
  const protectedFiles = JSON.parse(
    run("protected-before", process.execPath, [
      "scripts/sprint05b-baseline.mjs",
    ]),
  ).protectedFiles;
  for (let i = 0; i < pairs.length; i += 2) {
    const [letter, revision] = pairs.slice(i, i + 2);
    assert.ok(["b", "c", "e"].includes(letter));
    const commit = git("rev-parse", `${revision}^{commit}`).toString().trim();
    const row = {
      letter,
      commit,
      tree: git("rev-parse", `${commit}^{tree}`).toString().trim(),
      manifests: [],
      sourceFiles: [],
    };
    for (const pin of protectedFiles)
      assert.equal(sha(show(commit, pin.file)), pin.sha256);
    row.protectedFiles = protectedFiles.length;
    const changes = git("diff", "--name-only", "aa289da", commit)
      .toString()
      .trim()
      .split("\n");
    row.dependencyChanges = changes.filter((f) =>
      /(?:^|\/)(?:go\.(?:mod|sum)|Cargo\.(?:toml|lock)|package(?:-lock)?\.json|pnpm-lock\.yaml)$/.test(
        f,
      ),
    );
    assert.deepEqual(row.dependencyChanges, []);
    for (const file of changes.filter((f) => !f.startsWith("evidence/"))) {
      const b = show(commit, file);
      row.sourceFiles.push({ file, sha256: sha(b), bytes: b.length });
      const target = path.join(stage, "reviewed-source", letter, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, b);
    }
    const files = git(
      "ls-tree",
      "-r",
      "--name-only",
      commit,
      `evidence/sprint05d-${letter}`,
    )
      .toString()
      .trim()
      .split("\n");
    for (const file of files.filter((f) => f.endsWith("/SHA256SUMS")))
      row.manifests.push({
        file,
        sha256: sha(show(commit, file)),
        checked: preservedManifest(commit, file),
      });
    if (letter === "e") {
      const base = "evidence/sprint05d-e/attempt-01",
        receiptBytes = show(commit, `${base}/commands.json`),
        r = JSON.parse(receiptBytes);
      assert.equal(r.source_commit, "01fdaacb8b6debf2f382422f5d790401cbb28d3f");
      assert.equal(r.passed, true);
      assert.equal(r.commands.length, 28);
      assert.equal(r.private_matches, 0);
      assert.equal(r.private_material_removed, true);
      assert.equal(r.lock_held_through_hashing, true);
      for (const command of r.commands) {
        assert.equal(command.exit_code, 0);
        assert.equal(command.signal, null);
        assert.equal(command.error, undefined);
        for (const stream of command.streams) {
          const b = show(commit, stream.file);
          assert.equal(b.length, stream.bytes);
          assert.equal(sha(b), stream.sha256);
        }
      }
      const raw = show(commit, `${base}/go-race-all.stdout`).toString();
      assert.ok(!/--- (?:FAIL|SKIP):/.test(raw));
      const counts = {
        packages: (raw.match(/^ok\s/gm) ?? []).length,
        top_level: (raw.match(/^--- PASS:/gm) ?? []).length,
        subtests: (raw.match(/^\s+--- PASS:/gm) ?? []).length,
        skipped: 0,
      };
      assert.deepEqual(counts, r.go);
      assert.deepEqual(counts, {
        packages: 11,
        top_level: 89,
        subtests: 151,
        skipped: 0,
      });
      const project = r.environment.COMPOSE_PROJECT_NAME;
      assert.match(project, /^aegisgate-05d-e-attempt-01-[a-f0-9]{12}$/);
      row.currentCleanup = [];
      for (const kind of ["container", "network", "volume"]) {
        const bytes = run(`e-current-${kind}`, "docker", [
          kind,
          "ls",
          ...(kind === "container" ? ["--all"] : []),
          "--filter",
          `label=com.docker.compose.project=${project}`,
          "--format",
          "{{.ID}}",
        ]);
        assert.equal(bytes.toString().trim(), "");
        assert.equal(
          show(commit, `${base}/remaining-${kind}.stdout`).length,
          0,
        );
        row.currentCleanup.push({ kind, absent: true });
      }
      row.privatePathsAbsent = [
        "pki",
        "compose.env",
        "postgres-password",
        "redis-password",
        "nats-token",
        "redis.conf",
        "nats.conf",
      ].every(
        (file) =>
          !fs.existsSync(`/home/tiecont/.cache/aegisgate-05d/e/.local/${file}`),
      );
      assert.equal(row.privatePathsAbsent, true);
      const old = show(
        "aa289da",
        "scripts/sprint05c-e-regressions.mjs",
      ).toString();
      const current = show(commit, "scripts/sprint05d-e-regressions.mjs")
        .toString()
        .replaceAll("sprint05d", "sprint05c")
        .replaceAll("aegisgate-05d", "aegisgate-05c");
      assert.equal(current, old, "E copied collector changes beyond namespace");
      row.receiptSha256 = sha(receiptBytes);
      row.counts = counts;
      row.childExits = r.commands.map((c) => [c.label, c.exit_code]);
      row.provenanceLimit =
        "E receipt hashes Node plus streams; other child binary versions are retained but per-binary SHA256 and TMPDIR are not embedded in that receipt. F verifies exact final integration separately.";
    } else {
      row.evidenceReceipts = [];
      for (const file of files.filter((f) => f.endsWith("/receipt.json"))) {
        const r = JSON.parse(show(commit, file));
        row.evidenceReceipts.push({
          file,
          sha256: sha(show(commit, file)),
          sourceCommit: r.source_commit,
          recordingComplete: r.recording_complete,
          error: r.error,
          securityPass: r.semantic_security_pass ?? r.security_pass,
          resourceEligible: r.resource_eligible,
          observation: r.observation,
          technicalStop: r.technical_stop,
        });
        if (r.historical_reference) {
          assert.equal(r.historical_reference.fresh_execution, false);
          assert.equal(
            sha(show(commit, r.historical_reference.file)),
            r.historical_reference.sha256,
          );
          row.historicalReference = r.historical_reference;
        }
        if (letter === "c") {
          assert.equal(r.recording_complete, true);
          assert.equal(r.targeted3_executed, false);
          assert.equal(r.fixture_executed, false);
          assert.equal(r.full23_executed, false);
          assert.equal(r.supported_candidate_found, false);
          assert.equal(r.checks.length, 8);
          assert.ok(r.checks.every((c) => c.pass));
        }
      }
    }
    record.reviews.push(row);
  }
  const ownFiles = git(
    "ls-files",
    "scripts/sprint05d-f-*",
    "docs/reports/sprint05d-f-security-review.md",
    "evidence/sprint05d-f",
  )
    .toString()
    .trim()
    .split("\n");
  record.ownFiles = ownFiles.map((file) => {
    const b = fs.readFileSync(file),
      target = path.join(stage, "F", file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, b);
    return { file, sha256: sha(b), bytes: b.length };
  });
  const image =
    "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f";
  run("scanner-image", "docker", [
    "image",
    "inspect",
    image,
    "--format",
    "{{.Id}} {{json .RepoDigests}}",
  ]);
  run("secrets", "docker", [
    "run",
    "--rm",
    "--pull",
    "never",
    "--network",
    "none",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--user",
    `${process.getuid()}:${process.getgid()}`,
    "-v",
    `${stage}:/scan:ro`,
    "-v",
    `${path.resolve(".github/gitleaks.toml")}:/policy/gitleaks.toml:ro`,
    "-v",
    `${path.resolve(output)}:/reports`,
    image,
    "dir",
    "/scan",
    "--config",
    "/policy/gitleaks.toml",
    "--redact",
    "--report-format",
    "json",
    "--report-path",
    "/reports/secrets.json",
    "--no-banner",
  ]);
  assert.deepEqual(JSON.parse(fs.readFileSync(`${output}/secrets.json`)), []);
  record.protectedAfter = JSON.parse(
    run("protected-after", process.execPath, [
      "scripts/sprint05b-baseline.mjs",
    ]),
  ).protectedFiles;
  assert.deepEqual(record.protectedAfter, protectedFiles);
  record.complete = true;
} catch (e) {
  record.error = e.stack;
  process.exitCode = 1;
} finally {
  assertLock();
  fs.rmSync(stage, { recursive: true, force: true });
  record.privateStageAbsent = !fs.existsSync(stage);
  record.lockHeldThroughCleanupAndHashes = true;
  record.ended = new Date().toISOString();
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
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
  console.log(
    JSON.stringify({
      complete: record.complete,
      reviews: record.reviews.length,
      error: record.error,
      privateStageAbsent: record.privateStageAbsent,
    }),
  );
  assertLock();
}
