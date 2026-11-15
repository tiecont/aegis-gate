import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { packageData } from "../spikes/envoy/sprint06a-c-package.mjs";

const output = process.argv[2];
assert.match(output ?? "", /^evidence\/sprint06a-c\/verify-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const record = {
  source: git("rev-parse", "HEAD"),
  tree: git("rev-parse", "HEAD^{tree}"),
  argv: process.argv,
  node: process.version,
  node_sha256: sha(fs.readFileSync(process.execPath)),
  commands: [],
  artifact_hashes: 0,
  source_bindings: [],
  runtime_executed: false,
  security_pass: false,
};
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(".local", { recursive: true });
const stage = fs.mkdtempSync(path.resolve(".local/sprint06a-c-package-"));
function run(label, args) {
  const r = spawnSync(process.execPath, args, {
    timeout: 30000,
    maxBuffer: 2 << 20,
  });
  const streams = ["stdout", "stderr"].map((name) => {
    const file = `${label}.${name}`,
      bytes = r[name] ?? Buffer.alloc(0);
    fs.writeFileSync(`${output}/${file}`, bytes, { flag: "wx" });
    return { file, sha256: sha(bytes), bytes: bytes.length };
  });
  record.commands.push({
    label,
    command: process.execPath,
    args,
    exit_code: r.status,
    signal: r.signal,
    streams,
  });
  assert.equal(r.status, 0, label);
  assert.equal(r.signal, null, label);
}
try {
  for (const name of ["audit-01", "audit-02"]) {
    const root = `evidence/sprint06a-c/${name}`,
      receipt = JSON.parse(fs.readFileSync(`${root}/receipt.json`));
    assert.equal(receipt.passed, true);
    assert.equal(receipt.new_runtime_executed, false);
    for (const line of fs
      .readFileSync(`${root}/SHA256SUMS`, "utf8")
      .trim()
      .split("\n")) {
      const [hash, file] = line.split("  ");
      assert.equal(sha(fs.readFileSync(file)), hash);
      record.artifact_hashes++;
    }
    for (const s of receipt.source_files) {
      assert.equal(
        sha(
          execFileSync("git", ["show", `${receipt.source_commit}:${s.file}`]),
        ),
        s.sha256,
      );
      record.source_bindings.push({ source: receipt.source_commit, ...s });
    }
    for (const c of receipt.commands) {
      assert.equal(c.exit_code, 0);
      for (const s of c.streams) {
        assert.equal(sha(fs.readFileSync(s.file)), s.sha256);
        assert.equal(fs.statSync(s.file).size, s.bytes);
      }
    }
    for (const r of receipt.releases) {
      assert.equal(r.same_as_reviewed_release, true);
      assert.equal(r.object_type, "commit");
    }
  }
  run("protected", ["scripts/sprint05b-baseline.mjs"]);
  for (const file of [
    "spikes/envoy/sprint06a-c-audit.mjs",
    "spikes/envoy/sprint06a-c-package.mjs",
    "spikes/envoy/sprint06a-c-replay.mjs",
    "scripts/sprint06a-c-verify.mjs",
  ])
    run(`syntax-${path.basename(file)}`, ["--check", file]);
  const destination = path.join(stage, "package");
  run("materialize", ["spikes/envoy/sprint06a-c-package.mjs", destination]);
  const data = JSON.parse(
    fs.readFileSync(path.join(destination, "manifest.json")),
  );
  assert.deepEqual(data, packageData());
  assert.equal(data.vectors.length, 5);
  for (const v of data.vectors) {
    const bytes = fs.readFileSync(path.join(destination, `${v.id}.bin`));
    assert.equal(sha(bytes), v.sha256);
    assert.equal(bytes.toString("hex"), v.raw);
    assert.ok(v.expected);
  }
  record.package = {
    vectors: 5,
    manifest_sha256: sha(
      fs.readFileSync(path.join(destination, "manifest.json")),
    ),
    published: false,
  };
  record.complete = true;
} catch (e) {
  record.complete = false;
  record.error = e.stack;
  process.exitCode = 1;
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
  record.private_stage_removed = !fs.existsSync(stage);
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    fs
      .readdirSync(output)
      .sort()
      .filter((n) => n !== "SHA256SUMS")
      .map(
        (name) =>
          `${sha(fs.readFileSync(`${output}/${name}`))}  ${output}/${name}\n`,
      )
      .join(""),
  );
  console.log(
    JSON.stringify({
      output,
      complete: record.complete,
      artifact_hashes: record.artifact_hashes,
      vectors: record.package?.vectors,
    }),
  );
}
