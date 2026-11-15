import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const [revision, clone, output] = process.argv.slice(2);
assert.match(output ?? "", /^evidence\/sprint05d-f\/integration-\d+$/);
assert.ok(path.isAbsolute(clone) && !fs.existsSync(output));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) => execFileSync("git", args, { maxBuffer: 32 << 20 });
const text = (...args) =>
  git(...args)
    .toString()
    .trim();
assert.equal(text("status", "--porcelain"), "");
const source = text("rev-parse", `${revision}^{commit}`),
  get = (rev, file) => git("show", `${rev}:${file}`);
const record = {
  argv: process.argv,
  reviewerCommit: text("rev-parse", "HEAD"),
  sourceCommit: source,
  sourceTree: text("rev-parse", `${source}^{tree}`),
  started: new Date().toISOString(),
  boundFiles: [],
  componentManifests: [],
  runtimeAccepted: false,
  productionAccepted: false,
  hostedPending: true,
};
try {
  const rootFiles = new Set([
    "IMPLEMENTATION_STATUS.md",
    "docs/ADR-012-sprint05d-contract-v2-proposed.md",
    "docs/ADR-012-strict-ingress-decision-proposed.md",
    "docs/RISK_REGISTER.md",
    "docs/reports/sprint05d-completion.md",
    "docs/sprints/05d-execution.md",
    "scripts/sprint04c-gates.mjs",
    "scripts/sprint05a-receipt.mjs",
    "scripts/sprint05b-export-gates.mjs",
  ]);
  const accepted = new Map();
  for (const revision of [
    "a005a23",
    "044afc6",
    "5bc9489",
    "661f0d5",
    "f155927",
    "538820f",
  ]) {
    const commit = text("rev-parse", `${revision}^{commit}`);
    for (const file of text("diff", "--name-only", "aa289da", commit)
      .split("\n")
      .filter((file) => file && !file.startsWith("evidence/"))) {
      if (rootFiles.has(file)) continue;
      assert.ok(!accepted.has(file), `overlapping component file ${file}`);
      accepted.set(file, commit);
    }
  }
  for (const file of text("diff", "--name-only", "aa289da", source)
    .split("\n")
    .filter((file) => file && !file.startsWith("evidence/"))) {
    if (rootFiles.has(file)) {
      record.boundFiles.push({
        file,
        scope: "reviewed root documentation/namespace",
        sha256: sha(get(source, file)),
      });
      continue;
    }
    const owner = accepted.get(file);
    assert.ok(owner, `unreviewed source ${file}`);
    assert.deepEqual(get(source, file), get(owner, file), file);
    record.boundFiles.push({
      file,
      acceptedSource: owner,
      sha256: sha(get(source, file)),
    });
  }
  const dependencies = text("diff", "--name-only", "aa289da", source)
    .split("\n")
    .filter((file) =>
      /(?:^|\/)(?:go\.(?:mod|sum)|Cargo\.(?:toml|lock)|package(?:-lock)?\.json|pnpm-lock\.yaml)$/.test(
        file,
      ),
    );
  assert.deepEqual(dependencies, []);
  record.dependencyChanges = dependencies;
  const protectedFiles = JSON.parse(
    fs.readFileSync("evidence/sprint05d-f/gate-run-01/protected-before.stdout"),
  ).protectedFiles;
  assert.equal(protectedFiles.length, 11);
  for (const pin of protectedFiles)
    assert.equal(sha(get(source, pin.file)), pin.sha256);
  record.protectedFiles = protectedFiles;
  for (const [revision, prefix] of [
    ["a005a23", "evidence/sprint05d-a"],
    ["a419dcd", "evidence/sprint05d-b"],
    ["661f0d5", "evidence/sprint05d-d"],
  ]) {
    const row = { source: text("rev-parse", revision), prefix, hashes: 0 };
    for (const manifest of text(
      "ls-tree",
      "-r",
      "--name-only",
      revision,
      prefix,
    )
      .split("\n")
      .filter((file) => file.endsWith("/SHA256SUMS")))
      for (const line of get(revision, manifest)
        .toString()
        .trim()
        .split("\n")) {
        const [digest, file] = line.split("  ");
        assert.equal(sha(get(revision, file)), digest, file);
        row.hashes++;
      }
    record.componentManifests.push(row);
  }
  const laterB = text("diff", "--name-only", "044afc6", "a419dcd").split("\n");
  assert.ok(
    laterB.every((file) => file.startsWith("evidence/sprint05d-b/verify-02/")),
  );
  const b = JSON.parse(
    get("a419dcd", "evidence/sprint05d-b/verify-02/receipt.json"),
  );
  assert.equal(b.source_commit, text("rev-parse", "044afc6"));
  assert.ok(b.commands.every((c) => c.exit_code === 0 && c.signal === null));
  assert.equal(b.integrity_verified, true);
  assert.equal(b.semantic_security_pass, false);
  for (const name of ["source", "evidence", "report"])
    assert.deepEqual(
      JSON.parse(
        get("a419dcd", `evidence/sprint05d-b/verify-02/${name}-secrets.json`),
      ),
      [],
    );
  record.bEvidenceOnlyAccepted = "a419dcd";
  const raw = path.join(clone, "evidence/sprint05d-root/gates-01"),
    gateBytes = fs.readFileSync(`${raw}/commands.json`),
    gate = JSON.parse(gateBytes);
  assert.equal(gate.source_commit, source);
  assert.equal(gate.source_tree, record.sourceTree);
  assert.equal(gate.passed, true);
  assert.equal(gate.lock_held_through_cleanup, true);
  record.gateReceiptSha256 = sha(gateBytes);
  record.gateCommands = gate.commands.map(({ label, exit_code }) => ({
    label,
    exit_code,
  }));
  assert.deepEqual(
    gate.commands.map((row) => row.label),
    ["check", "security-scan", "cleanup", "cleanup-volumes"],
  );
  assert.ok(
    gate.commands.every((row) => row.exit_code === 0 && row.signal === null),
  );
  const scanner = fs.readFileSync(`${raw}/security-scan.stdout.log`, "utf8"),
    quality = fs.readFileSync(`${raw}/check.stdout.log`, "utf8");
  assert.ok(!/^FAIL /m.test(scanner));
  assert.ok(!/^FAIL\s|^--- FAIL:/m.test(quality));
  record.scannerPassLabels = [...scanner.matchAll(/^PASS (.+)$/gm)].map(
    (match) => match[1],
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
    const blocking = (r.Results ?? [])
      .flatMap((row) => row.Vulnerabilities ?? [])
      .filter((v) => ["HIGH", "CRITICAL"].includes(v.Severity));
    assert.equal(blocking.length, 0);
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
  record.qualityScope =
    "Executed real management fixtures/integration/race, contracts/dashboard, negatives and gate selftests; no full ingress runtime eligibility";
  record.ownManifestHashes = 0;
  for (const manifest of text("ls-files", "evidence/sprint05d-f")
    .split("\n")
    .filter((file) => file.endsWith("/SHA256SUMS")))
    for (const line of fs.readFileSync(manifest, "utf8").trim().split("\n")) {
      const [digest, original] = line.split("  ");
      const file = original.startsWith("evidence/sprint05d-f/")
        ? original
        : path.join(path.dirname(manifest), path.basename(original));
      assert.equal(sha(fs.readFileSync(file)), digest, file);
      record.ownManifestHashes++;
    }
  record.localIntegrationAccepted = true;
  record.complete = true;
} catch (e) {
  record.error = e.stack;
  process.exitCode = 1;
} finally {
  assertLock();
  record.ended = new Date().toISOString();
  record.lockHeldThroughAuditAndHashes = true;
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
      boundFiles: record.boundFiles.length,
      localIntegrationAccepted: record.localIntegrationAccepted,
      error: record.error,
    }),
  );
}
