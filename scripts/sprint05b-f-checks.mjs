import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

process.umask(0o077);
const [output, rootSource] = process.argv.slice(2);
assert.match(output ?? "", /^evidence\/sprint05b-f\/checks-\d+$/);
assert.ok(!fs.existsSync(output));
fs.mkdirSync(output, { recursive: true });
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const node =
  "/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node";
const go =
  "/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go";
const record = {
  source_commit: git("rev-parse", "HEAD"),
  source_tree: git("rev-parse", "HEAD^{tree}"),
  argv: process.argv,
  started_at: new Date().toISOString(),
  commands: [],
  hashes: 0,
  scope:
    "Offline source/evidence checks and pure URL-redaction unit; no live fixtures",
  complete: false,
};
function run(label, program, args, cwd = process.cwd()) {
  const started_at = new Date().toISOString();
  const p = spawnSync(program, args, {
    cwd,
    env: { ...process.env, GOTOOLCHAIN: "go1.27.4" },
    timeout: 180000,
    maxBuffer: 8 << 20,
  });
  const streams = ["stdout", "stderr"].map((name) => {
    const file = `${output}/${label}.${name}`,
      bytes = p[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes);
    return { file, sha256: sha(bytes), bytes: bytes.length };
  });
  record.commands.push({
    label,
    program,
    args,
    cwd,
    started_at,
    ended_at: new Date().toISOString(),
    exit_code: p.status,
    signal: p.signal,
    streams,
  });
  assert.equal(p.status, 0, label);
}
try {
  const scripts = git("ls-files", "scripts/sprint05b-f-*.mjs").split("\n");
  for (const file of scripts)
    run(`syntax-${path.basename(file)}`, node, ["--check", file]);
  run("format", node, [
    "/home/tiecont/Projects/aegis-gate/node_modules/prettier/bin/prettier.cjs",
    "--check",
    ...scripts,
  ]);
  run("whitespace", "git", [
    "diff",
    "--check",
    "8758b1c",
    "--",
    ...scripts,
    "scripts/sprint05b-f-locks.go",
    "docs/reports/sprint05b-f-security-review.md",
  ]);
  run(
    "go-format",
    "/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/gofmt",
    [
      "-d",
      "scripts/sprint05b-f-locks.go",
      "scripts/sprint05b-f-migration-cause.go",
    ],
  );
  run("python-syntax", "python3", [
    "-c",
    "import ast; from pathlib import Path; ast.parse(Path('scripts/sprint05b-f-readiness.py').read_text()); print('PASS Python AST syntax')",
  ]);
  for (const name of fs.readdirSync("evidence/sprint05b-f")) {
    const manifest = `evidence/sprint05b-f/${name}/SHA256SUMS`;
    if (!fs.existsSync(manifest)) continue;
    for (const line of fs
      .readFileSync(manifest, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)) {
      const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
      assert.ok(match, manifest);
      assert.equal(sha(fs.readFileSync(match[2])), match[1], match[2]);
      record.hashes++;
    }
  }
  if (rootSource) {
    const source = git("-C", rootSource, "rev-parse", "HEAD");
    assert.equal(source, git("rev-parse", "de6265d^{commit}"));
    assert.equal(
      git("-C", rootSource, "status", "--porcelain", "--untracked-files=no"),
      "",
    );
    record.root_source = {
      commit: source,
      tree: git("-C", rootSource, "rev-parse", "HEAD^{tree}"),
    };
    run(
      "callback-disclosure-unit",
      go,
      [
        "test",
        "-race",
        "./apps/control-api/internal/transport",
        "-run",
        "^TestFixtureHTTPErrorDoesNotExposeOIDCCallback$",
        "-count=1",
        "-v",
      ],
      rootSource,
    );
  }
  record.complete = true;
} catch (error) {
  record.error = error.stack;
}
record.ended_at = new Date().toISOString();
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
    hashes: record.hashes,
    commands: record.commands.map((c) => ({
      label: c.label,
      exit: c.exit_code,
    })),
    error: record.error,
  }),
);
process.exitCode = record.complete ? 0 : 1;
