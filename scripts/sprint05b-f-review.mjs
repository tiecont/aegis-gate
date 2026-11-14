import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const [mode, revision, output] = process.argv.slice(2);
assert.ok(["a", "b", "c", "d", "e", "root"].includes(mode));
assert.match(output ?? "", /^evidence\/sprint05b-f\/[a-z0-9-]+$/);
assert.ok(!fs.existsSync(output));
const root = process.cwd();
const upstream = "/home/tiecont/Projects/aegis-gate";
const node = `${upstream}/.local/toolchains/node/bin/node`;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (...args) => execFileSync("git", args, { maxBuffer: 16 << 20 });
assert.equal(
  git("status", "--porcelain", "--untracked-files=no").toString().trim(),
  "",
);
const commit = git("rev-parse", `${revision}^{commit}`).toString().trim();
const clone = path.resolve(
  ".local/sprint05b-f-sources",
  `${mode}-${commit.slice(0, 12)}`,
);
assert.ok(!fs.existsSync(clone), "fresh source checkout required");
fs.mkdirSync(output, { recursive: true });
const record = {
  reviewer_commit: git("rev-parse", "HEAD").toString().trim(),
  reviewer_tree: git("rev-parse", "HEAD^{tree}").toString().trim(),
  argv: process.argv,
  started_at: new Date().toISOString(),
  mode,
  source_commit: commit,
  source_tree: git("rev-parse", `${commit}^{tree}`).toString().trim(),
  clone,
  node: {
    file: node,
    sha256: sha(fs.readFileSync(node)),
    version: process.version,
  },
  fixture_lock: "/tmp/aegisgate-sprint02-fixtures.lock",
  commands: [],
  complete: false,
  semantic_security_pass: false,
};
const save = () =>
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
async function run(
  label,
  program,
  args,
  cwd = clone,
  env = {},
  timeout = 300000,
) {
  assertLock();
  const started_at = new Date().toISOString();
  const child = spawn(program, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdout = [],
    stderr = [];
  child.stdout.on("data", (b) => stdout.push(b));
  child.stderr.on("data", (b) => stderr.push(b));
  let error;
  child.on("error", (e) => {
    error = e.message;
  });
  const timer = setTimeout(() => {
    error = "F command deadline";
    child.kill("SIGTERM");
  }, timeout);
  const [exit_code, signal] = await new Promise((resolve) =>
    child.once("close", (...args) => resolve(args)),
  );
  clearTimeout(timer);
  const streams = ["stdout", "stderr"].map((name, i) => {
    const bytes = Buffer.concat(i ? stderr : stdout),
      file = `${output}/${label}.${name}`;
    fs.writeFileSync(file, bytes);
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  record.commands.push({
    label,
    program,
    args,
    cwd,
    environment: env,
    started_at,
    ended_at: new Date().toISOString(),
    exit_code,
    signal,
    error,
    streams,
  });
  save();
  console.log(`${mode}/${label}: exit=${exit_code}`);
  return { exit_code, stdout: Buffer.concat(stdout).toString() };
}
const protect = [
  "spikes/pingora/lab.mjs",
  "spikes/edge-comparison/manifest.json",
  "spikes/edge-comparison/contract.mjs",
  "spikes/edge-comparison/supplemental.mjs",
  "spikes/edge-comparison/evaluate.mjs",
  "spikes/edge-comparison/run.mjs",
  "spikes/edge-comparison/tls-observer.mjs",
  "spikes/edge-comparison/extract-baseline.mjs",
  "spikes/envoy/wire-probes.mjs",
  "spikes/envoy/wire-observer.mjs",
  "spikes/envoy/wire-fixtures.mjs",
];
try {
  fs.mkdirSync(path.dirname(clone), { recursive: true });
  assert.equal(
    (
      await run(
        "clone",
        "git",
        ["clone", "--shared", "--no-checkout", root, clone],
        root,
      )
    ).exit_code,
    0,
  );
  const checkout =
    mode === "a"
      ? ["checkout", "-b", "feat/sprint05b-llhttp-admission", commit]
      : ["checkout", "--detach", commit];
  assert.equal((await run("checkout", "git", checkout)).exit_code, 0);
  fs.mkdirSync(`${clone}/.local`, { recursive: true });
  fs.symlinkSync(`${upstream}/.local/toolchains`, `${clone}/.local/toolchains`);
  record.protected = protect.map((file) => {
    const expected = git("show", `8758b1c:${file}`),
      actual = fs.readFileSync(`${clone}/${file}`);
    assert.deepEqual(actual, expected, file);
    return { file, sha256: sha(actual), bytes: actual.length };
  });
  if (["b", "c", "root"].includes(mode)) {
    const npm = path.join(path.dirname(node), "npm");
    assert.equal(
      (
        await run("strict-spike-install", npm, [
          "--prefix",
          "spikes/pingora",
          "ci",
          "--ignore-scripts",
          "--strict-peer-deps",
        ])
      ).exit_code,
      0,
    );
  }
  const child = async (label, file, args, env = {}) =>
    run(label, node, [file, ...args], clone, env, 900000);
  const generated = [];
  if (mode === "a") {
    generated.push("evidence/sprint05b-a/run-901");
    record.child = await child("proof", "spikes/envoy/sprint05b-a-proof.mjs", [
      generated[0],
    ]);
    record.verifier = await child(
      "verify",
      "spikes/envoy/sprint05b-a-verify.mjs",
      [generated[0]],
    );
  } else if (mode === "b") {
    generated.push("evidence/sprint05b-b/f-native-tap");
    record.child = await child("matrix", "spikes/envoy/sprint05b-b-run.mjs", [
      generated[0],
      "tap",
      "native",
    ]);
    generated.push("evidence/sprint05b-b/analysis-f");
    record.verifier = await child(
      "analyze",
      "spikes/envoy/sprint05b-b-analyze.mjs",
      generated,
    );
  } else if (mode === "c") {
    for (const [i, setting, capture] of [
      [901, "untapped", "events"],
      [902, "baseline", "relay"],
    ]) {
      const dir = `evidence/sprint05b-c/attempt-${i}`;
      generated.push(dir);
      await child(`matrix-${i}`, "spikes/envoy/sprint05b-c-run.mjs", [
        dir,
        setting,
        "native",
        capture,
      ]);
    }
  } else if (mode === "d") {
    const a = git("rev-parse", "dbb2153^{commit}").toString().trim();
    const aClone = path.resolve(
      ".local/sprint05b-f-sources",
      `d-parser-${a.slice(0, 12)}`,
    );
    assert.equal(
      (
        await run(
          "parser-clone",
          "git",
          ["clone", "--shared", "--no-checkout", root, aClone],
          root,
        )
      ).exit_code,
      0,
    );
    assert.equal(
      (await run("parser-checkout", "git", ["checkout", "--detach", a], aClone))
        .exit_code,
      0,
    );
    generated.push("evidence/sprint05b-f/d-independent");
    record.child = await child(
      "streaming",
      "spikes/envoy/sprint05b-d-streaming.mjs",
      [aClone, generated[0]],
    );
  } else if (mode === "e") {
    generated.push("evidence/sprint05b-e/attempt-901");
    record.child = await child(
      "regressions",
      "scripts/sprint05b-e-regressions.mjs",
      [generated[0]],
    );
  } else {
    generated.push("evidence/sprint05b-f/candidate-901");
    record.child = await child(
      "matrix",
      "spikes/envoy/sprint05a-combined-run.mjs",
      [generated[0]],
      {
        AEGIS_05B_NATIVE_BINARY: `${upstream}/.local/sprint05b-native/envoy`,
      },
    );
  }
  record.outputs = [];
  for (const [i, dir] of generated.entries())
    if (fs.existsSync(`${clone}/${dir}`)) {
      const destination = `${output}/capture-${i + 1}`;
      fs.cpSync(`${clone}/${dir}`, destination, { recursive: true });
      record.outputs.push({ original: dir, preserved: destination });
    }
  record.source_after = (
    await run("source-after", "git", [
      "status",
      "--porcelain",
      "--untracked-files=no",
    ])
  ).stdout.trim();
  assert.equal(record.source_after, "");
  record.complete = true;
} catch (error) {
  record.error = error.stack;
} finally {
  assertLock();
  record.lock_held_through_capture_hashing = true;
  record.ended_at = new Date().toISOString();
  save();
  const files = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const file = `${dir}/${name}`;
      if (fs.statSync(file).isDirectory()) walk(file);
      else files.push(file);
    }
  }
  walk(output);
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    files.map((file) => `${sha(fs.readFileSync(file))}  ${file}\n`).join(""),
  );
}
process.exitCode = record.complete ? 0 : 1;
