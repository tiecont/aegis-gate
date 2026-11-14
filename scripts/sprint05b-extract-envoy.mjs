import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";
assertLock();
process.umask(0o077);
const output = process.argv[2];
assert.match(output ?? "", /^evidence\/sprint05b-root\/native-extract-\d+$/);
assert.ok(!fs.existsSync(output));
fs.mkdirSync(output, { recursive: true });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const image = JSON.parse(fs.readFileSync("spikes/envoy/image.lock.json")).image;
const name = `aegis-05b-extract-${process.pid}`;
const binary = path.resolve(".local/sprint05b-native/envoy");
fs.mkdirSync(path.dirname(binary), { recursive: true });
const record = {
  source_commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  source_tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"])
    .toString()
    .trim(),
  started_at: new Date().toISOString(),
  argv: process.argv,
  image,
  name,
  commands: [],
};
function run(label, program, args, timeout = 60000) {
  const started_at = new Date().toISOString();
  const p = spawnSync(program, args, { timeout, maxBuffer: 4 << 20 });
  const streams = ["stdout", "stderr"].map((s) => {
    const bytes = p[s] ?? Buffer.alloc(0),
      file = `${output}/${label}.${s}`;
    fs.writeFileSync(file, bytes);
    return { file, sha256: sha(bytes), bytes: bytes.length };
  });
  record.commands.push({
    label,
    program,
    args,
    started_at,
    ended_at: new Date().toISOString(),
    exit_code: p.status,
    signal: p.signal,
    error: p.error?.message,
    streams,
  });
  console.log(`${label}: ${p.status}`);
  return p;
}
try {
  assert.equal(
    run("image-identity", "docker", [
      "image",
      "inspect",
      image,
      "--format",
      "{{.Id}} {{json .RepoDigests}}",
    ]).status,
    0,
  );
  assert.equal(
    run("create", "docker", [
      "create",
      "--name",
      name,
      "--network",
      "none",
      "--entrypoint",
      "/usr/local/bin/envoy",
      image,
      "--version",
    ]).status,
    0,
  );
  assert.equal(
    run("copy", "docker", ["cp", `${name}:/usr/local/bin/envoy`, binary])
      .status,
    0,
  );
  fs.chmodSync(binary, 0o700);
  record.binary = { file: binary, sha256: sha(fs.readFileSync(binary)) };
  assert.equal(run("native-version", binary, ["--version"], 10000).status, 0);
  assert.equal(run("dynamic-libraries", "ldd", [binary], 10000).status, 0);
  record.complete = true;
} catch (error) {
  record.error = error.stack;
} finally {
  const removal = run("cleanup", "docker", ["rm", "--force", name]);
  const absent = run("remaining", "docker", [
    "ps",
    "-aq",
    "--filter",
    `name=^/${name}$`,
  ]);
  record.cleanup = {
    removal_exit: removal.status,
    absent: absent.status === 0 && !absent.stdout.toString().trim(),
    lock_held: true,
  };
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
}
process.exitCode = record.complete && record.cleanup.absent ? 0 : 1;
