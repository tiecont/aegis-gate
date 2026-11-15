import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

process.umask(0o077);
const source = "7725063dd65e07d26b7579f428a29424e1f8f4f8";
const output = "evidence/sprint05b-f/source-delta-01";
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync("git", args, { maxBuffer: 16 << 20 });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const previousFile = "evidence/sprint05b-f/audit-04/receipt.json";
const previousBytes = git("show", `1d8769b:${previousFile}`);
const previous = JSON.parse(previousBytes);
assert.ok(previous.complete && previous.errors.length === 0);
const sourceTree = git("rev-parse", `${source}^{tree}`).toString().trim();
const protectedFiles = previous.packages.find(
  (entry) => entry.label === "integrated",
).protected;
for (const entry of protectedFiles) {
  const actual = git("show", `${source}:${entry.file}`);
  assert.equal(sha(actual), entry.sha256, entry.file);
  assert.deepEqual(actual, git("show", `8758b1c:${entry.file}`));
}
const fPaths = [
  "scripts/sprint05b-f-*",
  "evidence/sprint05b-f",
  "docs/reports/sprint05b-f-security-review.md",
];
assert.equal(
  git("diff", "--name-only", "1d8769b", source, "--", ...fPaths)
    .toString()
    .trim(),
  "",
);
const changed = git("diff", "--name-only", "5b10996", source)
  .toString()
  .trim()
  .split("\n");
const docs = [
  "IMPLEMENTATION_STATUS.md",
  "docs/RISK_REGISTER.md",
  "docs/reports/sprint05b-completion.md",
  "docs/sprints/05b-execution.md",
];
for (const file of changed)
  assert.ok(
    docs.includes(file) ||
      file.startsWith("scripts/sprint05b-f-") ||
      file.startsWith("evidence/sprint05b-f/") ||
      file === "docs/reports/sprint05b-f-security-review.md",
    file,
  );
assert.equal(
  git("rev-parse", "8f60c2a^{tree}").toString().trim(),
  "2a77d531afa273ee04df680177099af7dea04c98",
);
const record = {
  source_commit: source,
  source_tree: sourceTree,
  reviewer_commit: git("rev-parse", "HEAD").toString().trim(),
  argv: process.argv,
  scope:
    "Offline delta verification reusing audit04; no live fixture or protocol matrix executed",
  previous_audit: {
    file: previousFile,
    sha256: sha(previousBytes),
    source_commit: previous.integrated.commit,
    reused_manifests: previous.manifests,
    reused_artifact_hashes: previous.hashes,
    reused_source_hashes: previous.source_hashes,
  },
  protected: protectedFiles,
  f_checkpoint_bytes_unchanged: true,
  delta_from_reviewed_5b10996: {
    files: changed.length,
    only_unchanged_f_checkpoint_and_four_documents: true,
  },
  documents: docs.map((file) => ({
    file,
    sha256: sha(git("show", `${source}:${file}`)),
  })),
  complete: true,
  ended_at: new Date().toISOString(),
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
