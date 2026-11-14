import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

process.umask(0o077);
const output = "evidence/sprint05b-f/export-01";
assert.ok(!fs.existsSync(output));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const get = (file) =>
  execFileSync("git", ["show", `5151150:${file}`], { maxBuffer: 16 << 20 });
const prefix = "evidence/sprint05b-root/gates-01";
const rawDir = `/home/tiecont/Projects/aegis-gate/.local/sprint05b-gates/${prefix}`;
const metadata = JSON.parse(get(`${prefix}/export.json`));
const rawCommands = fs.readFileSync(`${rawDir}/commands.json`);
assert.equal(sha(rawCommands), metadata.original_commands_sha256);
const commands = JSON.parse(rawCommands);
const derived = JSON.parse(get(`${prefix}/commands.json`));
assert.ok(commands.ended_at);
assert.equal(derived.export.kind, "sanitized derivative");
assert.equal(derived.export.original_commands_sha256, sha(rawCommands));
let redactedFields = 0;
const privateValues = new Set();
const files = [];
const sensitive = new Set([
  "code",
  "state",
  "token",
  "access_token",
  "id_token",
  "refresh_token",
  "client_secret",
  "code_verifier",
]);
for (const entry of metadata.files) {
  const raw = fs.readFileSync(`${rawDir}/${entry.relative}`);
  assert.equal(sha(raw), entry.original_sha256);
  assert.equal(raw.length, entry.original_bytes);
  if (["commands.json", "SHA256SUMS"].includes(entry.relative)) continue;
  let fields = 0;
  const expected = Buffer.from(
    raw.toString().replace(/https?:\/\/[^\s"'<>]+/g, (text) => {
      let parsed;
      try {
        parsed = new URL(text);
      } catch {
        return text;
      }
      for (const key of [...parsed.searchParams.keys()]) {
        if (!sensitive.has(key.toLowerCase())) continue;
        for (const value of parsed.searchParams.getAll(key)) {
          if (value) privateValues.add(value);
          fields++;
        }
        parsed.searchParams.set(key, "REDACTED");
      }
      if (parsed.username || parsed.password) {
        if (parsed.username) privateValues.add(parsed.username);
        if (parsed.password) privateValues.add(parsed.password);
        parsed.username = "REDACTED";
        parsed.password = "";
        fields++;
      }
      return fields && parsed.href !== text ? parsed.href : text;
    }),
  );
  const exported = get(`${prefix}/${entry.relative}`);
  assert.deepEqual(exported, expected, entry.relative);
  if (fields) {
    const redaction = metadata.redactions.find(
      (row) => row.relative === entry.relative,
    );
    assert.equal(redaction.fields, fields);
    assert.equal(redaction.sanitized_sha256, sha(exported));
    redactedFields += fields;
  }
  files.push({ relative: entry.relative, sha256: sha(exported) });
}
for (const entry of files)
  for (const value of privateValues)
    assert.ok(
      !get(`${prefix}/${entry.relative}`).includes(Buffer.from(value)),
      "original private callback material retained",
    );
const normalized = structuredClone(derived);
delete normalized.export;
for (const command of normalized.commands)
  for (const stream of command.streams ?? []) {
    assert.equal(stream.sha256, sha(get(stream.file)));
    stream.sha256 = stream.original_sha256;
    delete stream.original_sha256;
  }
assert.deepEqual(normalized, commands);
const outcomes = commands.commands.map((row) => ({
  label: row.label,
  exit_code: row.exit_code,
}));
assert.equal(redactedFields, 2);
const receipt = {
  scope:
    "Independent raw-to-sanitized derivative validation; no raw callback values retained",
  reviewed_commit: execFileSync("git", ["rev-parse", "5151150^{commit}"])
    .toString()
    .trim(),
  reviewer_commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  original_commands_sha256: sha(rawCommands),
  raw_files_verified: metadata.files.length,
  exported_files_verified: files.length,
  private_callback_values_absent: privateValues.size,
  redacted_fields: redactedFields,
  commands_preserved_exactly_except_declared_export_fields: true,
  outcomes,
  complete: true,
  ended_at: new Date().toISOString(),
};
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(
  `${output}/receipt.json`,
  JSON.stringify(receipt, null, 2) + "\n",
);
fs.writeFileSync(
  `${output}/SHA256SUMS`,
  `${sha(fs.readFileSync(`${output}/receipt.json`))}  ${output}/receipt.json\n`,
);
console.log(JSON.stringify(receipt));
