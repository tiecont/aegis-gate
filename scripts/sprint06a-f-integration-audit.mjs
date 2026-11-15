import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const [revision, output, clone] = process.argv.slice(2);
assert.ok(path.isAbsolute(clone ?? ""));
assert.match(output ?? "", /^evidence\/sprint06a-f\/integration-audit-\d+$/);
assert.ok(!fs.existsSync(output));
assert.equal(execFileSync("git", ["status", "--porcelain"]).toString(), "");
const git = (...args) => execFileSync("git", args, { maxBuffer: 32 << 20 });
const str = (...args) =>
  git(...args)
    .toString()
    .trim();
const show = (ref, file) => git("show", `${ref}:${file}`);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const baseline = "8929adfd10f245ec0dac70b5304f1a2b445e7357";
const source = str("rev-parse", `${revision}^{commit}`);
const owners = [
  [
    "a",
    "20e4d29",
    /^(?:spikes\/envoy\/sprint06a-a-|scripts\/sprint06a-a-|evidence\/sprint06a-a\/|docs\/reports\/sprint06a-a-)/,
  ],
  [
    "b",
    "e18922a",
    /^(?:spikes\/sprint06a-admission\/|scripts\/sprint06a-b-|evidence\/sprint06a-b\/|docs\/reports\/sprint06a-b-|internal\/configsnapshot\/sprint06a_experimental\.go$)/,
  ],
  [
    "c",
    "0bce723",
    /^(?:spikes\/envoy\/sprint06a-c-|scripts\/sprint06a-c-|evidence\/sprint06a-c\/|docs\/reports\/sprint06a-c-|docs\/upstream\/sprint06a-)/,
  ],
  [
    "d",
    "716780c",
    /^(?:spikes\/envoy\/sprint05c-attribution\/sprint06a_runtime_test\.go$|scripts\/sprint06a-d-|evidence\/sprint06a-d\/|docs\/reports\/sprint06a-d-)/,
  ],
  [
    "e",
    "6a8280e",
    /^docs\/(?:ADR-012-sprint06a-|contracts\/sprint06a-|reports\/sprint06a-e-)/,
  ],
  [
    "f",
    "6b3d721",
    /^(?:scripts\/sprint06a-f-|evidence\/sprint06a-f\/|docs\/reports\/sprint06a-f-)/,
  ],
];
const rootDocs = [
  "IMPLEMENTATION_STATUS.md",
  "docs/RISK_REGISTER.md",
  "docs/reports/sprint06a-completion.md",
  "docs/sprints/06a-execution.md",
];
const collectorEdits = [
  [
    "scripts/sprint04c-gates.mjs",
    "04c|05a|05b|05c|05d",
    "04c|05a|05b|05c|05d|06a",
  ],
  ["scripts/sprint05a-receipt.mjs", "sprint05[abcd]", "sprint(?:05[abcd]|06a)"],
  [
    "scripts/sprint05b-export-gates.mjs",
    '  assert.match(output ?? "", /^evidence\\/sprint05[bcd]-root\\/gates-\\d+$/);',
    '  assert.match(\n    output ?? "",\n    /^evidence\\/sprint(?:05[bcd]|06a)-root\\/gates-\\d+$/,\n  );',
  ],
];
fs.mkdirSync(output, { recursive: true });
const record = {
  reviewer: str("rev-parse", "HEAD"),
  source,
  tree: str("rev-parse", `${source}^{tree}`),
  argv: process.argv,
  collectorSha256: sha(fs.readFileSync(import.meta.filename)),
  started: new Date().toISOString(),
  files: [],
  owners: owners.map(([track, ref]) => ({
    track,
    commit: str("rev-parse", ref),
  })),
  runtimeComplete: false,
  runtimePass: false,
  productionPass: false,
};
try {
  const storageGit = (args, original = false) => {
    const env = { ...process.env };
    delete env.GIT_ALTERNATE_OBJECT_DIRECTORIES;
    delete env.GIT_OBJECT_DIRECTORY;
    if (original)
      env.GIT_OBJECT_DIRECTORY =
        "/home/tiecont/Projects/aegis-gate/.git/objects";
    return execFileSync("git", ["-C", clone, ...args], {
      env,
      maxBuffer: 32 << 20,
    });
  };
  assert.equal(storageGit(["rev-parse", "HEAD"]).toString().trim(), source);
  assert.equal(fs.existsSync(`${clone}/.git/objects/info/alternates`), false);
  assert.equal(
    fs
      .readFileSync(
        `${clone}/.local/sprint06a-git-alternates-preserved`,
        "utf8",
      )
      .trim(),
    "/home/tiecont/Projects/aegis-gate/.git/objects",
  );
  const objectInventory = (original) =>
    storageGit(["rev-list", "--all", "--objects"], original)
      .toString()
      .trim()
      .split("\n")
      .map((line) => line.split(" ")[0])
      .sort();
  const ownObjects = objectInventory(false),
    originalObjects = objectInventory(true);
  assert.deepEqual(ownObjects, originalObjects);
  const ownCommits = storageGit(["rev-list", "--all", "--count"]),
    originalCommits = storageGit(["rev-list", "--all", "--count"], true);
  assert.deepEqual(ownCommits, originalCommits);
  const fsck = storageGit(["fsck", "--full", "--no-dangling"]);
  record.gitStorage = {
    clone,
    selfContained: true,
    originalAlternatePreserved: true,
    inventoryCommand: ["git", "-C", clone, "rev-list", "--all", "--objects"],
    originalObjectDirectory: "/home/tiecont/Projects/aegis-gate/.git/objects",
    comparison:
      "Same clone refs, standalone objects versus original backing objects through GIT_OBJECT_DIRECTORY; exact sorted object IDs match",
    reachableObjects: ownObjects.length,
    objectInventorySha256: sha(JSON.stringify(ownObjects)),
    reachableCommits: Number(ownCommits.toString().trim()),
    fsckCommand: ["git", "-C", clone, "fsck", "--full", "--no-dangling"],
    fsckExit: 0,
    fsckStdoutSha256: sha(fsck),
    historyMissingObjects: false,
  };
  for (const entry of str("diff", "--name-status", baseline, source).split(
    "\n",
  )) {
    const [status, file] = entry.split("\t");
    assert.ok(["A", "M"].includes(status), entry);
    const bytes = show(source, file);
    const row = { file, status, bytes: bytes.length, sha256: sha(bytes) };
    const owner = owners.find(([, , pattern]) => pattern.test(file));
    if (owner) {
      assert.equal(status, "A", file);
      assert.deepEqual(bytes, show(owner[1], file), file);
      row.acceptedTrack = owner[0];
      row.acceptedSource = owner[1];
    } else {
      const edit = collectorEdits.find(([name]) => name === file);
      if (edit) {
        assert.equal(status, "M");
        const old = show(baseline, file).toString();
        assert.equal(old.split(edit[1]).length, 2);
        assert.equal(bytes.toString(), old.replace(edit[1], edit[2]), file);
        row.namespaceOnly = true;
      } else {
        assert.ok(
          rootDocs.includes(file) ||
            file.startsWith("evidence/sprint06a-root/"),
          file,
        );
        row.rootOwned = true;
      }
    }
    record.files.push(row);
  }
  const report = show(
    source,
    "docs/reports/sprint06a-completion.md",
  ).toString();
  for (const marker of [
    "Outcome B",
    "73 PASS,2 FAIL",
    "19 PASS,4 FAIL",
    "No complete gateway or architecture GO",
    "NOT EFFECTIVE",
    "Human owners",
    "PENDING",
    "|01 / M0-PROXY-GO-NOGO|NO-GO|",
    "|04-12|LOCKED|",
    "|Production|BLOCKED|",
    "security-scan",
    "both nine bytes000000040100000000",
    "actually FAILs",
    "Full integrated Module00/02/03 gate replay remains pending",
  ])
    assert.ok(report.includes(marker), marker);
  const manifest = JSON.parse(
    show(source, "docs/contracts/sprint06a-finite-admission-research-v1.json"),
  );
  assert.equal(manifest.status, "PROPOSED_NOT_EFFECTIVE");
  assert.equal(manifest.production_enabled, false);
  assert.equal(manifest.opens_module01, false);
  assert.equal(manifest.original75_23_authoritative, true);
  record.rootDocsReviewed = rootDocs.map((file) => ({
    file,
    sha256: sha(show(source, file)),
  }));
  record.complete = true;
} catch (error) {
  record.error = error.stack;
  process.exitCode = 1;
} finally {
  assertLock();
  record.ended = new Date().toISOString();
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
      source,
      tree: record.tree,
      files: record.files.length,
      error: record.error,
    }),
  );
}
