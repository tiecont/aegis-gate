import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

const [name] = process.argv.slice(2);
assert.match(name ?? "", /^integration-closeout-\d{2}$/);
const root = process.cwd();
const base = "evidence/sprint04a-e";
const output = path.join(base, name);
const report = "docs/reports/sprint04a-e-integration-review.md";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
assert.ok(!fs.existsSync(output));
fs.mkdirSync(output);
const receipt = {
  reviewer_commit: git("rev-parse", "HEAD"),
  reviewer_tree: git("rev-parse", "HEAD^{tree}"),
  argv: process.argv,
  started_at: new Date().toISOString(),
  node: process.version,
  node_sha256: hash(fs.readFileSync(process.execPath)),
  report_sha256: hash(fs.readFileSync(report)),
  commands: [],
};
function run(label, program, args) {
  const startedAt = new Date().toISOString();
  const child = spawnSync(program, args, {
    timeout: 120000,
    maxBuffer: 8 << 20,
  });
  const command = {
    label,
    program,
    args,
    cwd: root,
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    exit_code: child.status,
    signal: child.signal,
    error: child.error?.message ?? null,
  };
  for (const stream of ["stdout", "stderr"]) {
    const bytes = child[stream] ?? Buffer.alloc(0);
    fs.writeFileSync(path.join(output, `${label}.${stream}`), bytes);
    command[`${stream}_sha256`] = hash(bytes);
  }
  receipt.commands.push(command);
  assert.equal(child.status, 0, `${label} failed; retain attempt`);
  return child.stdout.toString("utf8");
}
try {
  const finalFile = path.join(base, "integration-final-01/verification.json");
  const finalBytes = fs.readFileSync(finalFile);
  const final = JSON.parse(finalBytes);
  assert.equal(final.exit_code, 0);
  assert.equal(final.root_commit, "638d4936d2c2efc902630ef3f18c6a8cf475db7d");
  assert.equal(final.root_tree, "54d8f2ebb404889d2a434fb2e7a116b31efc1500");
  assert.equal(
    final.owners.reduce((total, owner) => total + owner.files.length, 0),
    1160,
  );
  assert.equal(final.protected.length, 30);
  assert.equal(final.original_e_manifest.entries, 228);
  const gates = final.gates;
  assert.equal(gates.length, 3);
  assert.deepEqual(
    gates.map((gate) => gate.passed),
    [false, false, true],
  );
  assert.ok(gates.every((gate) => gate.complete && gate.manifest));
  assert.deepEqual(
    gates[2].commands.map((command) => [command.label, command.exit_code]),
    [
      ["check", 0],
      ["security-scan", 0],
      ["cleanup", 0],
      ["cleanup-volumes", 0],
    ],
  );
  assert.equal(
    gates[2].source_commit,
    "2133b6303c05158c37ed539c23347376d67b0b3c",
  );
  receipt.final_verification = {
    file: finalFile,
    sha256: hash(finalBytes),
    root_commit: final.root_commit,
    root_tree: final.root_tree,
  };
  const changes = run("root-change-inventory", "git", [
    "diff",
    "--name-only",
    "2133b63",
    final.root_commit,
  ])
    .trim()
    .split("\n");
  assert.ok(
    changes.every(
      (file) =>
        file.startsWith("evidence/sprint04a-root/") ||
        [
          "IMPLEMENTATION_STATUS.md",
          "docs/RISK_REGISTER.md",
          "docs/reports/sprint04a-completion.md",
        ].includes(file),
    ),
  );
  for (const file of ["integration-review.mjs", "integration-closeout.mjs"])
    run(`syntax-${file}`, process.execPath, ["--check", path.join(base, file)]);
  run("source-whitespace", "git", [
    "diff",
    "--check",
    "be7fd31",
    "--",
    report,
    `${base}/integration-*.mjs`,
  ]);
  receipt.hosted = [];
  for (const [id, head, expected] of [
    [
      "43408513539",
      "9beace00414f8eb8a9dd9ebc00f8abe8e9ee29ee",
      ["failure", "success"],
    ],
    [
      "43409167346",
      "2133b6303c05158c37ed539c23347376d67b0b3c",
      ["success", "success"],
    ],
  ]) {
    const result = JSON.parse(
      run(`hosted-${id}`, "gh", [
        "run",
        "view",
        id,
        "--repo",
        "tiecont/aegis-gate",
        "--json",
        "headSha,status,conclusion,jobs,url",
      ]),
    );
    assert.equal(result.headSha, head);
    assert.equal(result.status, "completed");
    const jobs = ["foundation-quality", "supply-chain-security"].map(
      (name, index) => {
        const matching = result.jobs.filter((job) => job.name === name);
        assert.equal(matching.length, 1);
        assert.equal(matching[0].status, "completed");
        assert.equal(matching[0].conclusion, expected[index]);
        return {
          name,
          id: matching[0].databaseId,
          conclusion: matching[0].conclusion,
          url: matching[0].url,
        };
      },
    );
    receipt.hosted.push({
      id,
      head,
      conclusion: result.conclusion,
      jobs,
      url: result.url,
    });
  }
  receipt.final_head_hosted =
    "Not claimed: verified hosted head2133b63 precedes reviewed documentation head638d493 and this E report integration.";
  const scanner =
    "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f";
  run("scoped-secrets", "flock", [
    "/tmp/aegisgate-sprint02-fixtures.lock",
    "docker",
    "run",
    "--rm",
    "--pull=never",
    "--network",
    "none",
    "--user",
    `${process.getuid()}:${process.getgid()}`,
    "-v",
    `${root}/${base}:/review/evidence:ro`,
    "-v",
    `${root}/${report}:/review/report.md:ro`,
    "-v",
    `${root}/.github/gitleaks.toml:/config.toml:ro`,
    "-v",
    `${root}/${output}:/reports`,
    scanner,
    "dir",
    "/review",
    "--config",
    "/config.toml",
    "--redact",
    "--report-format",
    "json",
    "--report-path",
    "/reports/secrets.json",
    "--no-banner",
  ]);
  receipt.exit_code = 0;
} catch (error) {
  receipt.error = error.stack;
  receipt.exit_code = 1;
  process.exitCode = 1;
} finally {
  receipt.ended_at = new Date().toISOString();
  receipt.scope =
    "E-only source/receipt/hosted-metadata read and offline scoped secret scan; no hosted dispatch, fixtures, public tests, merge or GO.";
  fs.writeFileSync(
    path.join(output, "commands.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  const walk = (directory) =>
    fs
      .readdirSync(directory, { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? walk(path.join(directory, entry.name))
          : [path.join(directory, entry.name)],
      );
  fs.writeFileSync(
    path.join(output, "SHA256SUMS"),
    walk(output)
      .sort()
      .map((file) => `${hash(fs.readFileSync(file))}  ${file}`)
      .join("\n") + "\n",
  );
  const selected = fs
    .readdirSync(base)
    .filter((entry) => entry.startsWith("integration-"))
    .flatMap((entry) =>
      fs.statSync(path.join(base, entry)).isDirectory()
        ? walk(path.join(base, entry))
        : [path.join(base, entry)],
    )
    .filter((file) => file !== path.join(base, "integration-SHA256SUMS"));
  fs.writeFileSync(
    path.join(base, "integration-SHA256SUMS"),
    [...selected, report]
      .sort()
      .map((file) => `${hash(fs.readFileSync(file))}  ${file}`)
      .join("\n") + "\n",
  );
  console.log(
    JSON.stringify({
      output,
      exit_code: receipt.exit_code,
      hosted: receipt.hosted,
      error: receipt.error ?? null,
    }),
  );
}
