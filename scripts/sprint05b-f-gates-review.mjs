import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

process.umask(0o077);
const revision = "dfe69c72471770d78fef7deddd30e151e5b91c1b";
const source = "7725063dd65e07d26b7579f428a29424e1f8f4f8";
const finalSource = "fe63aacc3d7df106c99a2119f096c6474dea9857";
const prefix = "evidence/sprint05b-root/gates-02";
const rawDir = `/home/tiecont/Projects/aegis-gate/.local/sprint05b-gates/${prefix}`;
const clone = "/home/tiecont/Projects/aegis-gate/.local/sprint05b-gates";
const output = process.argv[2] ?? "evidence/sprint05b-f/gates-review-02";
assert.match(output, /^evidence\/sprint05b-f\/gates-review-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync("git", args, { maxBuffer: 32 << 20 });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const get = (relative) => git("show", `${revision}:${prefix}/${relative}`);
const original = fs.readFileSync(`${rawDir}/commands.json`);
const commands = JSON.parse(original);
const derived = JSON.parse(get("commands.json"));
const metadata = JSON.parse(get("export.json"));
assert.equal(commands.source_commit, source);
assert.equal(
  commands.source_tree,
  git("rev-parse", `${source}^{tree}`).toString().trim(),
);
assert.equal(commands.source_tree, "dcc33021cbac83a1f106b95d9ddd18ca5dfb1386");
assert.ok(
  commands.tracked_clean &&
    commands.passed &&
    commands.ended_at &&
    commands.lock_held_through_cleanup,
);
assert.equal(commands.cleanup_errors, undefined);
assert.equal(commands.error, undefined);
assert.equal(sha(original), metadata.original_commands_sha256);
assert.equal(derived.export.kind, "sanitized derivative");
assert.equal(derived.export.original_commands_sha256, sha(original));
assert.deepEqual(metadata.redactions, []);
let rawFiles = 0,
  bodies = 0,
  rawHashes = 0,
  publicHashes = 0;
for (const entry of metadata.files) {
  const raw = fs.readFileSync(path.join(rawDir, entry.relative));
  assert.equal(sha(raw), entry.original_sha256, entry.relative);
  assert.equal(raw.length, entry.original_bytes, entry.relative);
  rawFiles++;
  if (["SHA256SUMS", "commands.json"].includes(entry.relative)) continue;
  assert.deepEqual(get(entry.relative), raw, entry.relative);
  bodies++;
}
for (const [manifest, read] of [
  [
    fs.readFileSync(`${rawDir}/SHA256SUMS`, "utf8"),
    (file) =>
      fs.readFileSync(path.join(rawDir, path.posix.relative(prefix, file))),
  ],
  [
    get("SHA256SUMS").toString(),
    (file) => get(path.posix.relative(prefix, file)),
  ],
]) {
  for (const line of manifest.trim().split("\n")) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.ok(match);
    assert.ok(match[2].startsWith(`${prefix}/`));
    assert.equal(sha(read(match[2])), match[1], match[2]);
    if (manifest === get("SHA256SUMS").toString()) publicHashes++;
    else rawHashes++;
  }
}
const normalized = structuredClone(derived);
delete normalized.export;
for (const command of normalized.commands) {
  assert.equal(command.exit_code, 0);
  assert.equal(command.signal, null);
  for (const stream of command.streams) {
    assert.equal(
      sha(get(path.posix.relative(prefix, stream.file))),
      stream.sha256,
    );
    assert.equal(stream.sha256, stream.original_sha256);
    delete stream.original_sha256;
  }
}
assert.deepEqual(normalized, commands);
assert.deepEqual(
  commands.commands.map((row) => row.label),
  ["check", "security-scan", "cleanup", "cleanup-volumes"],
);
for (const kind of ["containers", "networks", "volumes"])
  assert.deepEqual(commands[`remaining_project_${kind}`], []);
assert.deepEqual(commands.private_material_check, {
  files_checked: 57,
  matches: 0,
});
for (const entry of commands.private_fixture_cleanup) {
  assert.equal(entry.exists, false);
  assert.equal(fs.existsSync(path.join(clone, entry.file)), false);
}
const inventories = [];
for (const [kind, args] of [
  ["containers", ["ps", "-aq"]],
  ["networks", ["network", "ls", "-q"]],
  ["volumes", ["volume", "ls", "-q"]],
]) {
  const found = execFileSync(
    "docker",
    [
      ...args,
      "--filter",
      "label=com.docker.compose.project=aegisgate-05b-root",
    ],
    { encoding: "utf8" },
  ).trim();
  assert.equal(found, "");
  inventories.push({ kind, remaining: 0 });
}
const scanner = get("security-scan.stdout.log").toString();
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
assert.deepEqual(JSON.parse(get("security/secrets.json")), []);
assert.deepEqual(JSON.parse(get("security/history-secrets.json")), []);
const vulnerabilities = [];
for (const file of [
  "filesystem-vulnerabilities.json",
  "envoy-spike-vulnerabilities.json",
  ...[1, 2, 3, 4].map((i) => `image-${i}-vulnerabilities.json`),
]) {
  const report = JSON.parse(get(`security/${file}`));
  const blocking = (report.Results ?? [])
    .flatMap((row) => row.Vulnerabilities ?? [])
    .filter((entry) => ["HIGH", "CRITICAL"].includes(entry.Severity));
  assert.equal(blocking.length, 0, file);
  vulnerabilities.push({ file, high_critical: blocking.length });
}
const quality = get("check.stdout.log").toString();
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
assert.equal(
  git(
    "diff",
    "--name-only",
    source,
    revision,
    "--",
    ".",
    ":(exclude)evidence/sprint05b-root/gates-02",
  )
    .toString()
    .trim(),
  "",
);
const record = {
  reviewer_commit: git("rev-parse", "HEAD").toString().trim(),
  reviewed_commit: revision,
  source_commit: source,
  source_tree: commands.source_tree,
  argv: process.argv,
  scope:
    "Independent offline local gate acceptance and read-only current cleanup inventory; safe integration only",
  original_commands_sha256: sha(original),
  raw_files_verified: rawFiles,
  byte_identical_published_bodies: bodies,
  raw_manifest_hashes: rawHashes,
  public_manifest_hashes: publicHashes,
  redacted_fields: 0,
  outcomes: commands.commands.map(({ label, exit_code }) => ({
    label,
    exit_code,
  })),
  scanner_pass_labels: expected.length,
  vulnerabilities,
  current_inventories: inventories,
  private_paths_absent: commands.private_fixture_cleanup.length,
  retained_private_check: commands.private_material_check,
  declared_cleanup_lock_continuity_source_reviewed: true,
  completed_at: commands.ended_at,
  complete: true,
  production_accepted: false,
  hosted_acceptance_pending: true,
};
const docs = [
  "IMPLEMENTATION_STATUS.md",
  "docs/RISK_REGISTER.md",
  "docs/reports/sprint05b-completion.md",
  "docs/sprints/05b-execution.md",
];
assert.deepEqual(
  git("diff", "--name-only", revision, finalSource)
    .toString()
    .trim()
    .split("\n"),
  docs,
);
assert.equal(
  git(
    "diff",
    "--name-only",
    source,
    finalSource,
    "--",
    ".",
    `:(exclude)${prefix}`,
    ...docs.map((file) => `:(exclude)${file}`),
  )
    .toString()
    .trim(),
  "",
);
const prior = JSON.parse(
  fs.readFileSync("evidence/sprint05b-f/source-delta-01/receipt.json"),
);
for (const entry of prior.protected)
  assert.equal(sha(git("show", `${finalSource}:${entry.file}`)), entry.sha256);
record.final_source = {
  commit: finalSource,
  tree: git("rev-parse", `${finalSource}^{tree}`).toString().trim(),
  delta_from_gate_source:
    "Only gates02 evidence and four reviewed documentation files",
  protected_files_verified: prior.protected.length,
  documents: docs.map((file) => ({
    file,
    sha256: sha(git("show", `${finalSource}:${file}`)),
  })),
};
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(
  `${output}/receipt.json`,
  JSON.stringify(record, null, 2) + "\n",
);
fs.writeFileSync(
  `${output}/SHA256SUMS`,
  `${sha(fs.readFileSync(`${output}/receipt.json`))}  ${output}/receipt.json\n`,
);
console.log(JSON.stringify(record));
