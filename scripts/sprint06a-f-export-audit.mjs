import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const [revision, prefix, rawDirectory, output, reviewerRevision = "HEAD"] =
  process.argv.slice(2);
assert.match(prefix ?? "", /^evidence\/sprint06a-root\/gates-\d+$/);
assert.match(output ?? "", /^evidence\/sprint06a-f\/export-audit-\d+$/);
assert.ok(path.isAbsolute(rawDirectory ?? ""));
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync("git", args, { maxBuffer: 64 << 20 });
const str = (...args) =>
  git(...args)
    .toString()
    .trim();
const get = (file) => git("show", `${revision}:${file}`);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(str("status", "--porcelain"), "");
fs.mkdirSync(output, { recursive: true });
const record = {
  reviewer: str("rev-parse", "HEAD"),
  reviewed: str("rev-parse", `${revision}^{commit}`),
  reviewerBytesSource: str("rev-parse", `${reviewerRevision}^{commit}`),
  argv: process.argv,
  collectorSha256: sha(fs.readFileSync(import.meta.filename)),
  started: new Date().toISOString(),
  files: [],
  runtimeComplete: false,
  runtimePass: false,
};
try {
  record.finalChanges = [];
  for (const line of str(
    "diff",
    "--name-status",
    "c4a2fc529688ef53ef213e07a6567aeab3fe4fcf",
    revision,
  )
    .split("\n")
    .filter(Boolean)) {
    const [status, file] = line.split("\t");
    assert.ok(["A", "M"].includes(status), line);
    const bytes = get(file),
      row = { file, status, bytes: bytes.length, sha256: sha(bytes) };
    if (
      /^(?:scripts\/sprint06a-f-|evidence\/sprint06a-f\/|docs\/reports\/sprint06a-f-security-review\.md$)/.test(
        file,
      )
    ) {
      assert.deepEqual(bytes, git("show", `${reviewerRevision}:${file}`), file);
      row.reviewerOwnedBytesMatch = true;
    } else {
      assert.ok(
        [
          "IMPLEMENTATION_STATUS.md",
          "docs/RISK_REGISTER.md",
          "docs/reports/sprint06a-completion.md",
          "docs/sprints/06a-execution.md",
        ].includes(file) || file.startsWith("evidence/sprint06a-root/"),
        file,
      );
      row.rootDeliveryOnly = true;
    }
    record.finalChanges.push(row);
  }
  const rootReport = get("docs/reports/sprint06a-completion.md").toString();
  for (const marker of [
    "Outcome B",
    "73 PASS,2 FAIL",
    "19 PASS,4 FAIL",
    "NO-GO",
    "LOCKED",
    "BLOCKED",
    "NOT EFFECTIVE",
    "PENDING",
  ])
    assert.ok(rootReport.includes(marker), marker);
  record.gatedImplementationUnchanged = true;
  const rawBytes = fs.readFileSync(`${rawDirectory}/commands.json`),
    raw = JSON.parse(rawBytes),
    metadata = JSON.parse(get(`${prefix}/export.json`)),
    derived = JSON.parse(get(`${prefix}/commands.json`));
  assert.equal(raw.source_commit, "c4a2fc529688ef53ef213e07a6567aeab3fe4fcf");
  assert.equal(raw.passed, true);
  assert.equal(metadata.original_commands_sha256, sha(rawBytes));
  assert.equal(derived.export.kind, "sanitized derivative");
  assert.equal(derived.export.original_commands_sha256, sha(rawBytes));
  const sensitive = new Set([
      "code",
      "state",
      "token",
      "access_token",
      "id_token",
      "refresh_token",
      "client_secret",
      "code_verifier",
    ]),
    privateValues = new Set(),
    declaredRedactions = [];
  for (const entry of metadata.files) {
    assert.ok(!entry.relative.split("/").includes(".."));
    const bytes = fs.readFileSync(path.join(rawDirectory, entry.relative));
    assert.equal(bytes.length, entry.original_bytes);
    assert.equal(sha(bytes), entry.original_sha256);
    if (["commands.json", "SHA256SUMS"].includes(entry.relative)) continue;
    let fields = 0;
    const expected = Buffer.from(
      bytes.toString().replace(/https?:\/\/[^\s"'<>]+/g, (text) => {
        let url;
        try {
          url = new URL(text);
        } catch {
          return text;
        }
        let changed = false;
        for (const key of [...url.searchParams.keys()]) {
          if (!sensitive.has(key.toLowerCase())) continue;
          for (const value of url.searchParams.getAll(key)) {
            if (value) privateValues.add(value);
            fields++;
          }
          url.searchParams.set(key, "REDACTED");
          changed = true;
        }
        if (url.username || url.password) {
          if (url.username) privateValues.add(url.username);
          if (url.password) privateValues.add(url.password);
          url.username = "REDACTED";
          url.password = "";
          fields++;
          changed = true;
        }
        return changed ? url.href : text;
      }),
    );
    const exported = get(`${prefix}/${entry.relative}`);
    assert.deepEqual(exported, expected, entry.relative);
    if (fields)
      declaredRedactions.push({
        relative: entry.relative,
        fields,
        original_sha256: sha(bytes),
        sanitized_sha256: sha(exported),
      });
    record.files.push({
      relative: entry.relative,
      bytes: exported.length,
      sha256: sha(exported),
    });
  }
  assert.deepEqual(metadata.redactions, declaredRedactions);
  for (const entry of record.files)
    for (const value of privateValues)
      assert.ok(
        !get(`${prefix}/${entry.relative}`).includes(Buffer.from(value)),
        "original private URL field retained",
      );
  const normalized = structuredClone(derived);
  delete normalized.export;
  for (let i = 0; i < normalized.commands.length; i++)
    for (let j = 0; j < (normalized.commands[i].streams ?? []).length; j++) {
      const stream = normalized.commands[i].streams[j],
        original = raw.commands[i].streams[j];
      assert.equal(stream.sha256, sha(get(stream.file)));
      assert.equal(stream.original_sha256, original.sha256);
      stream.sha256 = original.sha256;
      stream.file = original.file;
      delete stream.original_sha256;
    }
  assert.deepEqual(normalized, raw);
  let manifestArtifacts = 0;
  for (const line of get(`${prefix}/SHA256SUMS`)
    .toString()
    .trim()
    .split("\n")) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.ok(match && match[2].startsWith(prefix + "/"));
    assert.equal(sha(get(match[2])), match[1]);
    manifestArtifacts++;
  }
  record.originalCommandsSha256 = sha(rawBytes);
  record.rawFiles = metadata.files.length;
  record.manifestArtifacts = manifestArtifacts;
  record.redactedFields = declaredRedactions.reduce(
    (sum, row) => sum + row.fields,
    0,
  );
  record.privateURLValuesAbsent = privateValues.size;
  record.commandsPreservedExceptDeclaredExportFields = true;
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
      reviewed: record.reviewed,
      files: record.files.length,
      error: record.error,
    }),
  );
}
