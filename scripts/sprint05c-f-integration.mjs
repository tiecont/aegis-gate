import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

assertLock();
process.umask(0o077);
const [revision, rawDir, output] = process.argv.slice(2);
assert.match(output ?? "", /^evidence\/sprint05c-f\/integration-\d+$/);
assert.ok(path.isAbsolute(rawDir ?? "") && !fs.existsSync(output));
const upstream = "/home/tiecont/Projects/aegis-gate";
const require = createRequire(`${upstream}/package.json`);
const prettier = require("prettier");
assert.equal(prettier.version, "3.9.10");
const git = (...args) => execFileSync("git", args, { maxBuffer: 32 << 20 });
const g = (...args) =>
  git(...args)
    .toString()
    .trim();
const sha = (b) => createHash("sha256").update(b).digest("hex");
const get = (rev, file) => git("show", `${rev}:${file}`);
assert.equal(g("status", "--porcelain", "--untracked-files=no"), "");
const reviewed = g("rev-parse", `${revision}^{commit}`);
const source = g("rev-parse", "cd32311^{commit}");
const prefix = "evidence/sprint05c-root/gates-04";
const record = {
  reviewer_commit: g("rev-parse", "HEAD"),
  reviewer_tree: g("rev-parse", "HEAD^{tree}"),
  collector_sha256: sha(fs.readFileSync(import.meta.filename)),
  argv: process.argv,
  reviewed_commit: reviewed,
  reviewed_tree: g("rev-parse", `${reviewed}^{tree}`),
  gate_source: source,
  gate_tree: g("rev-parse", `${source}^{tree}`),
  started_at: new Date().toISOString(),
  raw_directory: rawDir,
  accepted_scope: "Safe research/test integration and exact local gates only",
  runtime_accepted: false,
  production_accepted: false,
  hosted_acceptance_pending: true,
  formatter: {
    version: prettier.version,
    entry: require.resolve("prettier"),
    entry_sha256: sha(fs.readFileSync(require.resolve("prettier"))),
  },
  formats: [],
  bound_files: [],
  protected: [],
  commands: [],
};
function run(label, program, args) {
  assertLock();
  const started_at = new Date().toISOString();
  const bytes = execFileSync(program, args, { maxBuffer: 16 << 20 });
  record.commands.push({
    label,
    program,
    args,
    started_at,
    ended_at: new Date().toISOString(),
    exit_code: 0,
    stdout_sha256: sha(bytes),
    stdout: bytes.toString(),
  });
  return bytes;
}
function manifest(bytes, read) {
  let count = 0;
  for (const line of bytes.toString().trim().split("\n")) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.ok(match);
    assert.ok(match[2].startsWith(`${prefix}/`));
    assert.equal(
      sha(read(match[2].slice(prefix.length + 1))),
      match[1],
      match[2],
    );
    count++;
  }
  return count;
}
async function formatted(rev, file) {
  const config = (await prettier.resolveConfig(`${upstream}/${file}`)) ?? {};
  return prettier.format(get(rev, file).toString(), {
    ...config,
    filepath: file,
  });
}
try {
  for (const [rev, expected] of [
    [
      "cfdc51c",
      ["scripts/sprint05a-receipt.mjs", "scripts/sprint05c-e-regressions.mjs"],
    ],
    [
      "cd32311",
      [
        "scripts/sprint05c-f-checks.mjs",
        "scripts/sprint05c-f-ingress.mjs",
        "scripts/sprint05c-f-review.mjs",
      ],
    ],
  ]) {
    assert.deepEqual(
      g("diff", "--name-only", `${rev}^`, rev).split("\n"),
      expected,
    );
    for (const file of expected) {
      const canonical = await formatted(`${rev}^`, file);
      assert.equal(
        get(rev, file).toString(),
        canonical,
        `exact pinned Prettier transformation: ${file}`,
      );
      assert.equal(await formatted(rev, file), canonical);
      record.formats.push({
        commit: g("rev-parse", rev),
        file,
        before_sha256: sha(get(`${rev}^`, file)),
        after_sha256: sha(get(rev, file)),
        exact_prettier_transform: true,
      });
    }
  }
  const rootFiles = new Set([
    "IMPLEMENTATION_STATUS.md",
    "docs/RISK_REGISTER.md",
    "docs/reports/sprint05c-completion.md",
    "docs/sprints/05c-execution.md",
    "scripts/sprint04c-gates.mjs",
    "scripts/sprint05a-receipt.mjs",
    "scripts/sprint05b-export-gates.mjs",
  ]);
  const accepted = new Map();
  for (const rev of [
    "dc5d966",
    "0444023",
    "7255fa2",
    "cbc73f5",
    "dd1eaa4",
    "1c99633",
  ])
    for (const file of g("diff", "--name-only", "078d83c", rev)
      .split("\n")
      .filter(Boolean)) {
      if (!file.startsWith("evidence/")) {
        assert.ok(!accepted.has(file), `overlapping source ownership: ${file}`);
        accepted.set(file, rev);
      }
    }
  const changed = g("diff", "--name-only", "078d83c", source)
    .split("\n")
    .filter((file) => !file.startsWith("evidence/"));
  for (const file of changed) {
    if (rootFiles.has(file)) continue;
    const rev = accepted.get(file);
    assert.ok(rev, `unreviewed integration file: ${file}`);
    const before = get(rev, file),
      after = get(source, file);
    if (!before.equals(after)) {
      assert.ok(
        record.formats.some((row) => row.file === file),
        `unreviewed byte delta: ${file}`,
      );
      assert.equal(await formatted(rev, file), await formatted(source, file));
    }
    record.bound_files.push({
      file,
      accepted_revision: g("rev-parse", rev),
      accepted_sha256: sha(before),
      integrated_sha256: sha(after),
    });
  }
  assert.equal(
    g(
      "diff",
      "--name-only",
      "078d83c",
      source,
      "--",
      "go.mod",
      "go.sum",
      "Cargo.toml",
      "Cargo.lock",
      "package.json",
      "package-lock.json",
      "apps/dashboard/package.json",
      "apps/dashboard/package-lock.json",
    ),
    "",
  );
  const protect = JSON.parse(
    fs.readFileSync("evidence/sprint05c-f/checks-03/protected.stdout"),
  ).protectedFiles;
  assert.equal(protect.length, 11);
  for (const pin of protect) {
    assert.equal(sha(get(source, pin.file)), pin.sha256);
    assert.equal(sha(get(reviewed, pin.file)), pin.sha256);
    record.protected.push(pin);
  }
  const laterFiles = g("diff", "--name-only", source, reviewed)
    .split("\n")
    .filter(Boolean);
  assert.ok(
    laterFiles.every(
      (file) =>
        [
          "IMPLEMENTATION_STATUS.md",
          "docs/reports/sprint05c-completion.md",
        ].includes(file) || file.startsWith("evidence/sprint05c-root/"),
    ),
  );
  record.delta_after_gate_source = laterFiles.filter(
    (file) => !file.startsWith("evidence/"),
  );
  for (const file of record.delta_after_gate_source)
    record.bound_files.push({
      file,
      integrated_sha256: sha(get(reviewed, file)),
      scope: "Reviewed truthful delivery documentation; no executable change",
    });
  run("whitespace", "/usr/bin/git", [
    "diff",
    "--check",
    "078d83c",
    reviewed,
    "--",
    ...changed,
  ]);
  run("exporter-selftest", process.execPath, [
    `${upstream}/scripts/sprint05b-export-gates.mjs`,
    "--selftest",
  ]);
  const read = (file) => get(reviewed, `${prefix}/${file}`);
  const rawBytes = fs.readFileSync(`${rawDir}/commands.json`),
    raw = JSON.parse(rawBytes);
  const exported = JSON.parse(read("commands.json")),
    meta = JSON.parse(read("export.json"));
  assert.equal(raw.source_commit, source);
  assert.equal(raw.source_tree, "3826a32fa26365d0dd3a8d4519efadffc448912b");
  assert.equal(raw.source_tree, record.gate_tree);
  assert.ok(
    raw.tracked_clean &&
      raw.passed &&
      raw.ended_at &&
      raw.lock_held_through_cleanup,
  );
  assert.equal(raw.error, undefined);
  assert.equal(raw.cleanup_errors, undefined);
  assert.equal(
    raw.node_sha256,
    "0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b",
  );
  assert.equal(meta.original_commands_sha256, sha(rawBytes));
  assert.deepEqual(meta.redactions, []);
  record.raw_commands_sha256 = sha(rawBytes);
  record.raw_files_verified = 0;
  for (const file of meta.files) {
    const bytes = fs.readFileSync(path.join(rawDir, file.relative));
    assert.equal(sha(bytes), file.original_sha256);
    assert.equal(bytes.length, file.original_bytes);
    if (!["SHA256SUMS", "commands.json"].includes(file.relative))
      assert.deepEqual(read(file.relative), bytes);
    record.raw_files_verified++;
  }
  record.raw_manifest_hashes = manifest(
    fs.readFileSync(`${rawDir}/SHA256SUMS`),
    (file) => fs.readFileSync(`${rawDir}/${file}`),
  );
  record.export_manifest_hashes = manifest(read("SHA256SUMS"), read);
  const normalized = structuredClone(exported);
  delete normalized.export;
  assert.equal(exported.export.kind, "sanitized derivative");
  assert.equal(exported.export.original_commands_sha256, sha(rawBytes));
  assert.deepEqual(
    raw.commands.map((row) => row.label),
    ["check", "security-scan", "cleanup", "cleanup-volumes"],
  );
  for (const command of normalized.commands) {
    assert.equal(command.exit_code, 0);
    assert.equal(command.signal, null);
    assert.equal(command.error, undefined);
    for (const stream of command.streams) {
      assert.ok(stream.file.startsWith(`${prefix}/`));
      assert.equal(
        sha(read(stream.file.slice(prefix.length + 1))),
        stream.sha256,
      );
      assert.equal(stream.sha256, stream.original_sha256);
      delete stream.original_sha256;
    }
  }
  assert.deepEqual(normalized, raw);
  record.outcomes = raw.commands.map(({ label, exit_code }) => ({
    label,
    exit_code,
  }));
  record.cleanup = {
    project: raw.compose_project,
    private_paths: raw.private_fixture_cleanup.length,
    private_check: raw.private_material_check,
    inventories: [],
  };
  assert.equal(raw.compose_project, "aegisgate-05c-root");
  assert.equal(raw.private_material_check.matches, 0);
  for (const row of raw.private_fixture_cleanup) {
    assert.equal(row.exists, false);
    assert.equal(fs.existsSync(path.join(raw.cwd, row.file)), false);
  }
  for (const [kind, args] of [
    ["containers", ["ps", "-aq"]],
    ["networks", ["network", "ls", "-q"]],
    ["volumes", ["volume", "ls", "-q"]],
  ]) {
    assert.deepEqual(raw[`remaining_project_${kind}`], []);
    const bytes = run(`current-${kind}`, "/usr/bin/docker", [
      ...args,
      "--filter",
      `label=com.docker.compose.project=${raw.compose_project}`,
    ]);
    assert.equal(bytes.toString().trim(), "");
    record.cleanup.inventories.push({ kind, remaining: 0 });
  }
  const tree = git("ls-tree", "-r", source)
    .toString()
    .trim()
    .split("\n")
    .map((line) => {
      const [info, file] = line.split("\t");
      return { file, object: info.split(" ")[2] };
    });
  const working = execFileSync("git", ["hash-object", "--stdin-paths"], {
    cwd: raw.cwd,
    input: tree.map((entry) => entry.file).join("\n") + "\n",
    encoding: "utf8",
    maxBuffer: 16 << 20,
  })
    .trim()
    .split("\n");
  for (const [i, entry] of tree.entries())
    assert.equal(working[i], entry.object, entry.file);
  record.current_gate_clone_source_files = tree.length;
  const scanner = read("security-scan.stdout.log").toString();
  const expected = [
    "rust-vulnerabilities",
    "pingora-spike-vulnerabilities",
    "hyper-spike-vulnerabilities",
    "go-scanner-gate-selftest",
    "go-vulnerabilities",
    "npm-root-vulnerabilities",
    "npm-dashboard-vulnerabilities",
    "npm-spike-vulnerabilities",
    "worktree-secrets",
    "history-git-preflight",
    "history-secrets",
    "repository-sbom",
    "filesystem-vulnerabilities",
    "image-identity-selftest",
    "envoy-spike-vulnerabilities",
    "envoy-spike-sbom",
  ];
  for (let i = 1; i <= 4; i++)
    expected.push(`image-${i}-vulnerabilities`, `image-${i}-sbom`);
  expected.push("image-1-identity", "image-3-identity");
  for (const label of expected)
    assert.ok(scanner.split("\n").includes(`PASS ${label}`), label);
  assert.ok(!/^FAIL /m.test(scanner));
  record.scanner_pass_labels = expected;
  for (const file of ["secrets.json", "history-secrets.json"])
    assert.deepEqual(JSON.parse(read(`security/${file}`)), []);
  record.vulnerabilities = [];
  for (const file of [
    "filesystem-vulnerabilities.json",
    "envoy-spike-vulnerabilities.json",
    ...[1, 2, 3, 4].map((i) => `image-${i}-vulnerabilities.json`),
  ]) {
    const report = JSON.parse(read(`security/${file}`));
    const blocking = (report.Results ?? [])
      .flatMap((row) => row.Vulnerabilities ?? [])
      .filter((entry) => ["HIGH", "CRITICAL"].includes(entry.Severity));
    assert.equal(blocking.length, 0);
    record.vulnerabilities.push({ file, high_critical: 0 });
  }
  const quality = read("check.stdout.log").toString();
  for (const marker of [
    "go test -p 1 -race",
    "-run Integration -count=1",
    "PASS: exact local Postgres image fresh initialization",
    "PASS: local Postgres transaction",
    "PASS: actual OpenAPI-generated Go envelope",
    "PASS: formatting, Go vet, schema compatibility",
  ])
    assert.ok(quality.includes(marker), marker);
  assert.ok(!/^FAIL\s|^--- FAIL:/m.test(quality));
  record.failed_history = [];
  for (const attempt of ["01", "02", "03"]) {
    const dir = `evidence/sprint05c-root/gates-${attempt}`;
    const receipt = JSON.parse(get(reviewed, `${dir}/commands.json`));
    assert.equal(receipt.passed, false);
    assert.notEqual(
      receipt.commands.find((row) => row.label === "check").exit_code,
      0,
    );
    record.failed_history.push({
      directory: dir,
      source: receipt.source_commit,
      passed: false,
      commands_sha256: sha(get(reviewed, `${dir}/commands.json`)),
    });
  }
  record.local_gates_accepted = true;
  record.complete = true;
} catch (error) {
  record.error = error.stack;
  process.exitCode = 1;
} finally {
  assertLock();
  record.lock_held_through_readonly_audit = true;
  record.ended_at = new Date().toISOString();
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    `${sha(fs.readFileSync(`${output}/receipt.json`))}  ${output}/receipt.json\n`,
  );
  console.log(
    JSON.stringify({
      complete: record.complete,
      error: record.error,
      formats: record.formats.length,
      bound_files: record.bound_files.length,
      protected: record.protected.length,
      raw_files: record.raw_files_verified,
      clone_files: record.current_gate_clone_source_files,
      local_gates_accepted: record.local_gates_accepted,
      production_accepted: false,
    }),
  );
}
