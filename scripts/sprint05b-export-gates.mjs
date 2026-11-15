import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const privateParameters = new Set([
  "code",
  "state",
  "token",
  "access_token",
  "id_token",
  "refresh_token",
  "client_secret",
  "code_verifier",
]);
function sanitize(text) {
  let fields = 0;
  const output = text.replace(/https?:\/\/[^\s"'<>]+/g, (raw) => {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return raw;
    }
    let changed = false;
    for (const key of [...url.searchParams.keys()]) {
      if (!privateParameters.has(key.toLowerCase())) continue;
      fields += url.searchParams.getAll(key).length;
      url.searchParams.set(key, "REDACTED");
      changed = true;
    }
    if (url.username || url.password) {
      url.username = "REDACTED";
      url.password = "";
      fields++;
      changed = true;
    }
    return changed ? url.href : raw;
  });
  return { bytes: Buffer.from(output), fields };
}

if (process.argv[2] === "--selftest") {
  const input =
    'Get "https://127.0.0.1/callback?code=code-sentinel&state=state-sentinel": timeout';
  const result = sanitize(input);
  assert.equal(result.fields, 2);
  assert.ok(!result.bytes.includes(Buffer.from("sentinel")));
  assert.match(result.bytes.toString(), /code=REDACTED&state=REDACTED/);
  assert.equal(sanitize("https://github.com/tiecont/aegis-gate").fields, 0);
  assert.equal(sanitize("https://user:password@example.invalid/").fields, 1);
  console.log(
    "PASS structured URL sanitization and unchanged public references",
  );
} else {
  const [input, output] = process.argv.slice(2);
  assert.ok(path.isAbsolute(input ?? ""));
  assert.match(
    output ?? "",
    /^evidence\/sprint(?:05[bcd]|06a)-root\/gates-\d+$/,
  );
  assert.ok(!fs.existsSync(output));
  const original = JSON.parse(
    fs.readFileSync(path.join(input, "commands.json")),
  );
  assert.ok(
    original.ended_at,
    "only completed gate lifecycles may be exported",
  );
  const entries = [];
  const collect = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(file);
      else {
        assert.ok(entry.isFile());
        entries.push(file);
      }
    }
  };
  collect(input);
  assert.ok(entries.length < 1024);
  const record = {
    exporter_commit: execFileSync("git", ["rev-parse", "HEAD"])
      .toString()
      .trim(),
    argv: process.argv,
    created_at: new Date().toISOString(),
    scope:
      "Explicit sanitized derivative; original private outputs are not published",
    original_commands_sha256: hash(
      fs.readFileSync(path.join(input, "commands.json")),
    ),
    files: [],
    redactions: [],
  };
  fs.mkdirSync(output, { recursive: true });
  for (const file of entries) {
    const relative = path.relative(input, file);
    const bytes = fs.readFileSync(file);
    assert.ok(bytes.length < 64 << 20);
    record.files.push({
      relative,
      original_sha256: hash(bytes),
      original_bytes: bytes.length,
    });
    if (["SHA256SUMS", "commands.json"].includes(relative)) continue;
    const result = sanitize(bytes.toString());
    const destination = path.join(output, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, result.bytes);
    if (result.fields)
      record.redactions.push({
        relative,
        fields: result.fields,
        original_sha256: hash(bytes),
        sanitized_sha256: hash(result.bytes),
      });
  }
  const derived = structuredClone(original);
  derived.export = {
    kind: "sanitized derivative",
    original_commands_sha256: record.original_commands_sha256,
    original_outputs_preserved_by_digest: true,
    redaction_manifest: `${output}/export.json`,
  };
  for (const command of derived.commands)
    for (const stream of command.streams ?? []) {
      const prefix = `${path.posix.dirname(output)}/${path.basename(input)}/`;
      assert.ok(
        stream.file.startsWith(prefix),
        "unexpected original stream path",
      );
      const safeRelative = stream.file.slice(prefix.length);
      assert.ok(
        !safeRelative.split("/").includes("..") &&
          fs.existsSync(path.join(output, safeRelative)),
        "missing exported stream",
      );
      stream.original_sha256 = stream.sha256;
      stream.sha256 = hash(fs.readFileSync(path.join(output, safeRelative)));
      stream.file = `${output}/${safeRelative}`;
    }
  fs.writeFileSync(
    `${output}/commands.json`,
    JSON.stringify(derived, null, 2) + "\n",
  );
  fs.writeFileSync(
    `${output}/export.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
  const exported = [];
  const inventory = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) inventory(file);
      else exported.push(`${hash(fs.readFileSync(file))}  ${file}\n`);
    }
  };
  inventory(output);
  fs.writeFileSync(`${output}/SHA256SUMS`, exported.sort().join(""));
  console.log(
    JSON.stringify({
      output,
      files: record.files.length,
      redacted_fields: record.redactions.reduce((n, row) => n + row.fields, 0),
    }),
  );
}
