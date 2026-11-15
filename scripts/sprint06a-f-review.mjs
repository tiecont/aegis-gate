import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const root = process.cwd();
const [revision, relativeOutput] = process.argv.slice(2);
assert.match(relativeOutput ?? "", /^evidence\/sprint06a-f\/[a-z0-9-]+$/);
const output = path.resolve(relativeOutput);
assert.ok(!fs.existsSync(output));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 << 20,
  }).trim();
assert.equal(
  git("status", "--porcelain"),
  "",
  "commit F source before capture",
);
const source = git("rev-parse", `${revision}^{commit}`);
const node =
  "/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node";
const go =
  "/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go";
fs.mkdirSync(path.resolve(".local/tmp"), { recursive: true });
const stage = fs.mkdtempSync(path.resolve(".local/sprint06a-f-"));
const clone = path.join(stage, "source");
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(path.join(stage, "tmp"));
const environment = {
  TMPDIR: path.join(stage, "tmp"),
  GOTOOLCHAIN: "local",
  GOWORK: "off",
  GOAMD64: "v1",
  GOFLAGS: "",
  GOPATH: "/home/tiecont/go",
  GOMODCACHE: "/home/tiecont/go/pkg/mod",
  GOCACHE: "/home/tiecont/.cache/go-build",
};
const record = {
  reviewerCommit: git("rev-parse", "HEAD"),
  reviewerTree: git("rev-parse", "HEAD^{tree}"),
  sourceCommit: source,
  sourceTree: git("rev-parse", `${source}^{tree}`),
  argv: process.argv,
  nodeVersion: process.version,
  collectorSha256: sha(fs.readFileSync(import.meta.filename)),
  environment,
  started: new Date().toISOString(),
  commands: [],
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
function run(label, executable, args, options = {}) {
  assertLock();
  const begun = new Date().toISOString();
  const child = spawnSync(executable, args, {
    cwd: options.cwd ?? clone,
    env: { ...process.env, ...environment },
    timeout: options.timeout ?? 110000,
    maxBuffer: 32 << 20,
  });
  const streams = ["stdout", "stderr"].map((name) => {
    const b = child[name] ?? Buffer.alloc(0),
      file = `${label}.${name}`;
    fs.writeFileSync(`${output}/${file}`, b, { flag: "wx" });
    return { file, bytes: b.length, sha256: sha(b) };
  });
  record.commands.push({
    label,
    executable,
    executableSha256: sha(fs.readFileSync(executable)),
    args,
    cwd: options.cwd ?? clone,
    begun,
    ended: new Date().toISOString(),
    exit: child.status,
    signal: child.signal,
    error: child.error?.message,
    streams,
  });
  save();
  console.log(
    JSON.stringify({ label, exit: child.status, signal: child.signal }),
  );
  assert.equal(child.error, undefined, label);
  assert.equal(child.signal, null, label);
  assert.ok((options.allowedExits ?? [0]).includes(child.status), label);
  return child.stdout.toString();
}
function inventory() {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: clone,
    maxBuffer: 32 << 20,
  })
    .toString()
    .split("\0")
    .filter(Boolean)
    .map((file) => ({
      file,
      sha256: sha(fs.readFileSync(path.join(clone, file))),
    }));
}
let before;
try {
  run(
    "clone",
    "/usr/bin/git",
    ["clone", "--shared", "--no-checkout", root, clone],
    { cwd: root },
  );
  run("checkout", "/usr/bin/git", ["checkout", "--detach", source]);
  assert.equal(
    run("clean-before", "/usr/bin/git", ["status", "--porcelain"]).trim(),
    "",
  );
  before = inventory();
  record.inventoryCount = before.length;
  record.inventorySha256 = sha(JSON.stringify(before));
  record.dependencyChanges = execFileSync(
    "git",
    ["diff", "--name-only", "8929adf", source],
    { cwd: clone, encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter((f) =>
      /(?:^|\/)(?:go\.(?:mod|sum)|Cargo\.(?:toml|lock)|package(?:-lock)?\.json|security-scan\.sh|gitleaks\.toml)$/.test(
        f,
      ),
    );
  assert.deepEqual(record.dependencyChanges, []);
  record.protectedBefore = JSON.parse(
    run("protected-before", node, ["scripts/sprint05b-baseline.mjs"]),
  );
  assert.equal(record.protectedBefore.protectedFiles.length, 11);
  assert.equal(
    record.protectedBefore.protected_inventory_sha256,
    "85de42e7d2ac54b0f199bcced46760bec41b7687dd7c7016dd580ea4a300c1fa",
  );
  run("go-version", go, ["version"]);
  run("d-exact-proof", node, [
    "scripts/sprint06a-d-proof.mjs",
    "evidence/sprint06a-d/f-replay-01",
  ]);
  const proof = JSON.parse(
    fs.readFileSync(`${clone}/evidence/sprint06a-d/f-replay-01/receipt.json`),
  );
  assert.equal(proof.checksComplete, true);
  assert.equal(proof.runtimeComplete, false);
  assert.equal(proof.runtimePass, false);
  assert.equal(proof.module01Pass, false);
  const replace = {};
  for (const [virtual, file] of [
    [
      "sprint06af_preserved05c_test.go",
      "scripts/sprint05c-f-observer_test.go.txt",
    ],
    [
      "sprint06af_preserved05d_test.go",
      "scripts/sprint05d-f-runtime_test.go.txt",
    ],
    [
      "sprint06af_independent_test.go",
      "scripts/sprint06a-f-attribution_test.go.txt",
    ],
  ]) {
    const original = path.join(
      file.includes("sprint06a-f") ? root : clone,
      file,
    );
    replace[path.join(clone, "spikes/envoy/sprint05c-attribution", virtual)] =
      original;
  }
  record.overlays = Object.values(replace).map((file) => ({
    file,
    sha256: sha(fs.readFileSync(file)),
  }));
  const overlay = path.join(stage, "overlay.json"),
    binary = path.join(stage, "independent.test");
  fs.writeFileSync(overlay, JSON.stringify({ Replace: replace }));
  record.overlaySha256 = sha(fs.readFileSync(overlay));
  run("f-compile", go, [
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
  run(
    "f-full-proof",
    binary,
    ["-test.v", "-test.timeout=80s", "-test.count=1"],
    { allowedExits: [0, 1] },
  );
  record.independentAttackExit = record.commands.at(-1).exit;
  record.checksComplete = true;
} catch (error) {
  record.failure = error.stack;
  process.exitCode = 1;
} finally {
  assertLock();
  if (before) {
    try {
      record.protectedAfter = JSON.parse(
        run("protected-after", node, ["scripts/sprint05b-baseline.mjs"]),
      );
      assert.deepEqual(record.protectedAfter, record.protectedBefore);
      assert.deepEqual(inventory(), before);
      assert.equal(
        run("clean-tracked-after", "/usr/bin/git", [
          "status",
          "--porcelain",
          "--untracked-files=no",
        ]).trim(),
        "",
      );
      record.sourceIntegrityAfter = true;
    } catch (error) {
      record.postcheckFailure = error.stack;
      process.exitCode = 1;
    }
  }
  const retained = `${clone}/evidence/sprint06a-d/f-replay-01`;
  if (fs.existsSync(retained))
    fs.cpSync(retained, `${output}/d-replay`, { recursive: true });
  fs.rmSync(stage, { recursive: true, force: true });
  record.privateStageAbsent = !fs.existsSync(stage);
  record.lockHeldThroughCleanupAndHashes = true;
  record.ended = new Date().toISOString();
  save();
  const files = fs
    .readdirSync(output, { recursive: true })
    .filter((f) => fs.statSync(`${output}/${f}`).isFile())
    .sort();
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    files
      .map(
        (f) =>
          `${sha(fs.readFileSync(`${output}/${f}`))}  ${relativeOutput}/${f}\n`,
      )
      .join(""),
  );
  assertLock();
}
