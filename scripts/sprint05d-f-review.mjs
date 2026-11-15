import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const root = process.cwd();
const [mode, revision, relativeOutput] = process.argv.slice(2);
assert.ok(["a", "d", "b", "c"].includes(mode));
assert.match(relativeOutput ?? "", /^evidence\/sprint05d-f\/[a-z0-9-]+$/);
const output = path.resolve(relativeOutput);
assert.ok(!fs.existsSync(output));
const node =
  "/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node";
const go =
  "/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
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
const commit = git("rev-parse", `${revision}^{commit}`);
const stage = fs.mkdtempSync("/home/tiecont/.cache/aegisgate-sprint05d-f-");
const clone = path.join(stage, "source");
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(path.join(stage, "tmp"));
fs.mkdirSync(path.join(stage, "home"));
const environment = {
  PATH: `${path.dirname(node)}:${path.dirname(go)}:${process.env.PATH}`,
  TMPDIR: path.join(stage, "tmp"),
  HOME: path.join(stage, "home"),
  GOTOOLCHAIN: "local",
  GOWORK: "off",
  GOAMD64: "v1",
  GOFLAGS: "",
  GOPATH: "/home/tiecont/go",
  GOMODCACHE: "/home/tiecont/go/pkg/mod",
  GOCACHE: "/home/tiecont/.cache/go-build",
};
const record = {
  mode,
  argv: process.argv,
  reviewerCommit: git("rev-parse", "HEAD"),
  reviewerTree: git("rev-parse", "HEAD^{tree}"),
  collectorSha256: sha(fs.readFileSync(import.meta.filename)),
  sourceCommit: commit,
  sourceTree: git("rev-parse", `${commit}^{tree}`),
  clone,
  environment,
  started: new Date().toISOString(),
  commands: [],
  captures: [],
  hypotheses: {
    failure:
      "late invalidity, quota/crash/TLS omissions and false runtime attribution",
    hypothesis:
      "strict finite staging remains bounded; incomplete or forged correlation never establishes runtime PASS",
    mechanism:
      "clean committed source, unchanged protected oracle, F-only module imports and Go overlay",
    targetedInput:
      "independent quota/orphan/TLS cases and nonce/response/coverage mutations",
    positiveControl:
      "writer A29 and D full race suite, valid verified request and honest correlation fixture",
    stop: "retain streaming FAIL, distinguish correlation gaps from complete-runtime verdict; no original-case retuning",
  },
  observationsComplete: false,
  runtimePass: false,
  module01Pass: false,
};
const save = () =>
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
async function run(label, executable, args, options = {}) {
  assertLock();
  const resolved = path.isAbsolute(executable)
    ? executable
    : process.env.PATH.split(path.delimiter)
        .map((p) => path.join(p, executable))
        .find((p) => fs.existsSync(p));
  assert.ok(resolved, executable);
  const begun = new Date().toISOString();
  const child = spawn(resolved, args, {
    cwd: options.cwd ?? clone,
    env: { ...process.env, ...environment },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = [],
    stderr = [];
  child.stdout.on("data", (b) => stdout.push(b));
  child.stderr.on("data", (b) => stderr.push(b));
  let error,
    timedOut = false;
  child.on("error", (e) => {
    error = e.message;
  });
  const timer = setTimeout(() => {
    timedOut = true;
    process.kill(-child.pid, "SIGTERM");
  }, options.timeout ?? 240000);
  const [exit, signal] = await new Promise((resolve) =>
    child.once("close", (...args) => resolve(args)),
  );
  clearTimeout(timer);
  const streams = ["stdout", "stderr"].map((name, index) => {
    const bytes = Buffer.concat(index ? stderr : stdout),
      file = `${label}.${name}`;
    fs.writeFileSync(`${output}/${file}`, bytes);
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  record.commands.push({
    label,
    executable: resolved,
    executableSha256: sha(fs.readFileSync(resolved)),
    args,
    cwd: options.cwd ?? clone,
    begun,
    ended: new Date().toISOString(),
    exit,
    signal,
    error,
    timedOut,
    streams,
  });
  save();
  console.log(`${mode}/${label}: ${exit}`);
  assert.equal(error, undefined, label);
  assert.equal(signal, null, label);
  assert.ok(
    (options.allowedExits ?? [0]).includes(exit),
    `${label}: exit ${exit}`,
  );
  return Buffer.concat(stdout).toString();
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
const captures = [];
let beforeInventory;
try {
  record.tools = [
    node,
    go,
    "/usr/bin/flock",
    "/usr/bin/git",
    "/usr/bin/cc",
    "/usr/bin/openssl",
    "/usr/bin/curl",
  ].map((file) => ({
    file: fs.realpathSync(file),
    sha256: sha(fs.readFileSync(file)),
  }));
  assert.equal(
    record.tools[0].sha256,
    "0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b",
  );
  assert.equal(
    record.tools[1].sha256,
    "de0ae3e082ce7599eae4fb69fa2ef1e43b8f31ffd3fce62cdf81930aa9005050",
  );
  await run(
    "clone",
    "/usr/bin/git",
    ["clone", "--shared", "--no-checkout", root, clone],
    { cwd: root },
  );
  await run(
    "checkout",
    "/usr/bin/git",
    mode === "a"
      ? ["checkout", "-b", "feat/sprint05d-admission-policy", commit]
      : ["checkout", "--detach", commit],
  );
  record.cleanBefore = (
    await run("clean-before", "/usr/bin/git", ["status", "--porcelain"])
  ).trim();
  assert.equal(record.cleanBefore, "");
  const before = inventory();
  beforeInventory = before;
  record.inventorySha256 = sha(JSON.stringify(before));
  record.inventoryCount = before.length;
  const changedFiles = new Set(
    execFileSync("git", ["diff", "--name-only", "aa289da", commit], {
      cwd: clone,
      encoding: "utf8",
    })
      .trim()
      .split("\n"),
  );
  fs.writeFileSync(
    `${output}/source-inventory.json`,
    JSON.stringify(
      before.filter(
        (entry) =>
          changedFiles.has(entry.file) && !entry.file.startsWith("evidence/"),
      ),
    ) + "\n",
  );
  fs.mkdirSync(`${clone}/.local`, { recursive: true });
  fs.symlinkSync(
    "/home/tiecont/Projects/aegis-gate/.local/toolchains",
    `${clone}/.local/toolchains`,
  );
  record.protectedBefore = JSON.parse(
    await run("protected-before", node, ["scripts/sprint05b-baseline.mjs"]),
  ).protectedFiles;
  assert.equal(record.protectedBefore.length, 11);
  if (mode === "a") {
    captures.push(
      "evidence/sprint05d-a/run-901",
      "evidence/sprint05d-a/verify-901",
    );
    await run(
      "a-exact-proof",
      node,
      ["spikes/envoy/sprint05d-a-proof.mjs", captures[0]],
      { allowedExits: [0, 1] },
    );
    record.exactProofExit = record.commands.at(-1).exit;
    if (record.exactProofExit === 0) {
      const proof = JSON.parse(
        fs.readFileSync(`${clone}/${captures[0]}/receipt.json`),
      );
      const capture = JSON.parse(
        fs.readFileSync(`${clone}/${captures[0]}/command.json`),
      );
      assert.equal(proof.probes.length, 29);
      assert.equal(proof.completeValidationPass, true);
      assert.equal(proof.streamingPass, false);
      assert.equal(proof.streamingPositive.pass, false);
      assert.equal(proof.runtimeGO, false);
      assert.equal(proof.productionEligible, false);
      assert.deepEqual(proof.baselineBefore, proof.baselineAfter);
      assert.equal(proof.privateFixtureRemoved, true);
      for (const value of Object.values(proof.cleanup)) assert.equal(value, 0);
      assert.equal(capture.exit, 0);
      assert.equal(capture.signal, null);
      for (const name of ["stdout", "stderr"])
        assert.equal(
          capture[name],
          fs.readFileSync(`${clone}/${captures[0]}/run.${name}`, "utf8"),
        );
      for (const line of fs
        .readFileSync(`${clone}/${captures[0]}/SHA256SUMS`, "utf8")
        .trim()
        .split("\n")) {
        const [digest, file] = line.split("  ");
        assert.equal(sha(fs.readFileSync(`${clone}/${file}`)), digest);
      }
      record.proofSummary = {
        probes: 29,
        finitePass: true,
        streamingPass: false,
        cleanup: proof.cleanup,
      };
    }
    record.writerVerifierContext =
      "Fresh run output is untracked; writer verifier requires committing evidence first. F checks exact receipt/raw streams/hashes and immutable source directly without changing clone HEAD.";
    record.overlaySha256 = sha(
      fs.readFileSync(`${root}/scripts/sprint05d-f-admission.mjs`),
    );
    await run("a-independent-attacks", node, [
      `${root}/scripts/sprint05d-f-admission.mjs`,
      clone,
      `${output}/admission.json`,
    ]);
  } else if (mode === "d") {
    await run("go-version", go, ["version"]);
    await run("d-exact-proof", node, ["spikes/envoy/sprint05d-d-proof.mjs"]);
    const source = `${root}/scripts/sprint05d-f-runtime_test.go.txt`;
    const overlay = `${stage}/overlay.json`;
    fs.writeFileSync(
      overlay,
      JSON.stringify({
        Replace: {
          [`${clone}/spikes/envoy/sprint05c-attribution/sprint05d_f_review_test.go`]:
            source,
        },
      }) + "\n",
    );
    record.overlay = {
      source,
      sourceSha256: sha(fs.readFileSync(source)),
      overlaySha256: sha(fs.readFileSync(overlay)),
    };
    await run(
      "d-independent-attacks",
      go,
      [
        "test",
        "-race",
        "-json",
        `-overlay=${overlay}`,
        "./spikes/envoy/sprint05c-attribution",
        "-run",
        "^TestSprint05DF",
        "-count=1",
      ],
      { allowedExits: [0, 1] },
    );
    record.attackExit = record.commands.at(-1).exit;
  } else if (mode === "b") {
    captures.push("evidence/sprint05d-b/verify-901");
    await run("b-independent-verifier", node, [
      "spikes/envoy/sprint05d-b-verify.mjs",
      captures[0],
    ]);
  } else {
    throw new Error(
      "C has no new supported runtime mechanism; use F retained-source audit",
    );
  }
  record.protectedAfter = JSON.parse(
    await run("protected-after", node, ["scripts/sprint05b-baseline.mjs"]),
  ).protectedFiles;
  assert.deepEqual(record.protectedAfter, record.protectedBefore);
  assert.deepEqual(inventory(), before, "tracked bytes changed");
  record.cleanTrackedAfter = (
    await run("clean-tracked-after", "/usr/bin/git", [
      "status",
      "--porcelain",
      "--untracked-files=no",
    ])
  ).trim();
  assert.equal(record.cleanTrackedAfter, "");
  record.observationsComplete = true;
} catch (e) {
  record.error = e.stack;
  process.exitCode = 1;
} finally {
  assertLock();
  if (beforeInventory && !record.protectedAfter) {
    try {
      record.protectedAfter = JSON.parse(
        await run("protected-after", node, ["scripts/sprint05b-baseline.mjs"]),
      ).protectedFiles;
      assert.deepEqual(record.protectedAfter, record.protectedBefore);
      assert.deepEqual(inventory(), beforeInventory);
      record.cleanTrackedAfter = (
        await run("clean-tracked-after", "/usr/bin/git", [
          "status",
          "--porcelain",
          "--untracked-files=no",
        ])
      ).trim();
      assert.equal(record.cleanTrackedAfter, "");
      record.sourceIntegrityAfter = true;
    } catch (e) {
      record.postcheckError = e.stack;
      process.exitCode = 1;
    }
  }
  for (const [i, original] of captures.entries()) {
    if (!fs.existsSync(`${clone}/${original}`)) continue;
    const preserved = `capture-${i + 1}`;
    fs.cpSync(`${clone}/${original}`, `${output}/${preserved}`, {
      recursive: true,
    });
    record.captures.push({ original, preserved });
  }
  fs.rmSync(stage, { recursive: true, force: true });
  record.privateStageAbsent = !fs.existsSync(stage);
  record.lockHeldThroughCleanupAndHashes = true;
  record.ended = new Date().toISOString();
  save();
  const files = fs
    .readdirSync(output, { recursive: true })
    .filter((name) => fs.statSync(`${output}/${name}`).isFile())
    .sort();
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    files
      .map(
        (file) =>
          `${sha(fs.readFileSync(`${output}/${file}`))}  ${relativeOutput}/${file}\n`,
      )
      .join(""),
  );
  assertLock();
}
