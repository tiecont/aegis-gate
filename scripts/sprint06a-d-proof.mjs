import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const [output] = process.argv.slice(2);
assert.match(output ?? "", /^evidence\/sprint06a-d\/[a-z0-9-]+$/);
assert.ok(!fs.existsSync(output), "fresh evidence directory required");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const go =
  "/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go";
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(".local/tmp", { recursive: true });
const stage = fs.mkdtempSync(path.resolve(".local/sprint06a-d-"));
const record = {
  sourceCommit: git("rev-parse", "HEAD"),
  sourceTree: git("rev-parse", "HEAD^{tree}"),
  argv: process.argv,
  nodeVersion: process.version,
  started: new Date().toISOString(),
  environment: {
    TMPDIR: path.resolve(".local/tmp"),
    GOTOOLCHAIN: "local",
    GOAMD64: "v1",
    GOWORK: "off",
    GOFLAGS: "",
  },
  tools: [process.execPath, go, "/usr/bin/flock", "/usr/bin/git"].map(
    (file) => ({ file, sha256: sha(fs.readFileSync(file)) }),
  ),
  commands: [],
  sources: [],
  publicAPISources: [],
  checksComplete: false,
  runtimeComplete: false,
  runtimePass: false,
  module01Pass: false,
};
const save = () =>
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
function run(label, command, args) {
  assertLock();
  const child = spawnSync(command, args, {
    env: { ...process.env, ...record.environment },
    timeout: 90000,
    maxBuffer: 24 << 20,
  });
  const streams = ["stdout", "stderr"].map((name) => {
    const bytes = child[name] ?? Buffer.alloc(0),
      file = `${label}.${name}`;
    fs.writeFileSync(`${output}/${file}`, bytes, { flag: "wx" });
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  record.commands.push({
    label,
    command,
    args,
    exit: child.status,
    signal: child.signal,
    error: child.error?.message,
    streams,
  });
  save();
  console.log(
    JSON.stringify({ label, exit: child.status, signal: child.signal }),
  );
  assert.equal(child.signal, null, label);
  assert.equal(child.status, 0, label);
}
try {
  const sources = [
    ...git("ls-files", "spikes/envoy/sprint05c-attribution").split("\n"),
    "scripts/sprint05c-f-observer_test.go.txt",
    "scripts/sprint05d-f-runtime_test.go.txt",
    "scripts/sprint06a-d-proof.mjs",
    "docs/reports/sprint06a-d-capability-v1.json",
  ];
  record.sources = sources.map((file) => ({
    file,
    sha256: sha(fs.readFileSync(file)),
  }));
  record.publicAPISources = [
    "/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/src/net/http/httptrace/trace.go",
    "/home/tiecont/go/pkg/mod/golang.org/x/net@v0.62.0/http2/transport.go",
    "/home/tiecont/go/pkg/mod/golang.org/x/net@v0.62.0/http2/hpack/hpack.go",
    "/home/tiecont/go/pkg/mod/golang.org/x/net@v0.62.0/http2/frame.go",
  ].map((file) => ({ file, sha256: sha(fs.readFileSync(file)) }));
  run("protected-before", process.execPath, ["scripts/sprint05b-baseline.mjs"]);
  run("go-version", go, ["version"]);
  for (const [label, target] of [
    ["trace-api", "net/http/httptrace.ClientTrace"],
    ["transport-api", "golang.org/x/net/http2.Transport"],
    ["clientconn-api", "golang.org/x/net/http2.ClientConn"],
    ["decoder-api", "golang.org/x/net/http2/hpack.Decoder"],
  ])
    run(label, go, ["doc", target]);
  const replace = {};
  for (const [virtual, source] of [
    [
      "sprint06a_preserved05c_f_test.go",
      "scripts/sprint05c-f-observer_test.go.txt",
    ],
    [
      "sprint06a_preserved05d_f_test.go",
      "scripts/sprint05d-f-runtime_test.go.txt",
    ],
  ])
    replace[path.resolve("spikes/envoy/sprint05c-attribution", virtual)] =
      path.resolve(source);
  const overlay = path.join(stage, "overlay.json"),
    binary = path.join(stage, "attribution.test");
  fs.writeFileSync(overlay, JSON.stringify({ Replace: replace }));
  run("compile", go, [
    "test",
    "-c",
    "-race",
    "-overlay",
    overlay,
    "-o",
    binary,
    "./spikes/envoy/sprint05c-attribution",
  ]);
  record.testBinarySha256 = sha(fs.readFileSync(binary));
  run("proof", binary, ["-test.v", "-test.timeout=70s", "-test.count=1"]);
  run("protected-after", process.execPath, ["scripts/sprint05b-baseline.mjs"]);
  assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
  record.checksComplete = true;
} catch (error) {
  record.failure = error.stack;
  process.exitCode = 1;
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
  record.privateStageAbsent = !fs.existsSync(stage);
  record.ended = new Date().toISOString();
  assertLock();
  save();
  const names = fs.readdirSync(output).sort();
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    names
      .map(
        (name) =>
          `${sha(fs.readFileSync(`${output}/${name}`))}  ${output}/${name}\n`,
      )
      .join(""),
  );
}
