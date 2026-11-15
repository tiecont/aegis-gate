import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { assertLock } from "./wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const output = process.argv[2];
assert.match(output ?? "", /^evidence\/sprint05d-b\/attempt-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 << 20 }).trim();
const sha = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(
  git("status", "--porcelain"),
  "",
  "commit all source before execution",
);
assert.equal(
  sha(fs.readFileSync(process.execPath)),
  "0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b",
);
const extraction =
  "/home/tiecont/Projects/aegis-gate/evidence/sprint05b-root/native-extract-01/receipt.json";
const pin = JSON.parse(fs.readFileSync(extraction));
const image = JSON.parse(fs.readFileSync("spikes/envoy/image.lock.json"));
assert.equal(pin.complete, true);
assert.equal(pin.cleanup.absent, true);
assert.equal(pin.image, image.image);
assert.equal(
  sha(fs.readFileSync(pin.binary.file)),
  "1d64506e25c1844f146162ddb2ece7010fa4e784faddb40a079021491f1f03cc",
);
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(".local", { recursive: true });
const initial = new Set(fs.readdirSync(".local"));
const fixture = fs.mkdtempSync(path.resolve(".local/sprint05d-b-"));
const sources = git(
  "ls-files",
  "spikes/envoy",
  "spikes/edge-comparison",
  "scripts/sprint05b-baseline.mjs",
)
  .split("\n")
  .map((file) => ({ file, sha256: sha(fs.readFileSync(file)) }));
const environment = {
  TMPDIR: fixture,
  AEGIS_05A_D_POLICY: "stream-errors",
  AEGIS_05B_NATIVE_BINARY: pin.binary.file,
  AEGIS_05B_NATIVE_SHA256: pin.binary.sha256,
  AEGIS_05D_B_SELECTION: path.resolve(output, "selection.json"),
  AEGIS_05D_B_PEER: path.resolve(output, "peer.json"),
  NODE_OPTIONS: `--import=${path.resolve("spikes/envoy/sprint05d-b-select.mjs")}`,
};
const receipt = {
  source_commit: git("rev-parse", "HEAD"),
  source_tree: git("rev-parse", "HEAD^{tree}"),
  source_clean: true,
  argv: process.argv,
  cwd: process.cwd(),
  started_at: new Date().toISOString(),
  sources,
  node: process.version,
  node_sha256: sha(fs.readFileSync(process.execPath)),
  native_pin: pin.binary,
  extraction_sha256: sha(fs.readFileSync(extraction)),
  environment,
  commands: [],
  upstream: [],
  experiment: {
    failure:
      "Two original23 userinfo assertions require400/421, retained peer RST1 fails.",
    hypothesis:
      "A released public precodec validation/status hook could preserve rejection while returning required status.",
    mechanism:
      "Source/API investigation finds none: public error override selects reset scope; no new config experiment. Minimal baseline transport proof only.",
    targeted_input:
      "Exact unchanged compound identity negatives and individual userinfo original23 bodies; user@edge-b.test, original native client/deadlines.",
    positive_control:
      "Original individual Host/authority400/421 and encoded valid identity/pool reuse.",
    stop: "No supported precodec callback or targeted RST/no400/421 ends repair path; no full suite, Go rebuild or tuning.",
  },
  security_pass: false,
  resource_eligible: false,
  runtime_eligible: false,
};
const save = () =>
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(receipt, null, 2) + "\n",
  );
function run(label, program, args, expected = [0], env = {}) {
  assertLock();
  const started_at = new Date().toISOString();
  const r = spawnSync(program, args, {
    env: { ...process.env, TMPDIR: fixture, ...env },
    timeout: 90000,
    maxBuffer: 16 << 20,
  });
  const streams = ["stdout", "stderr"].map((name) => {
    const bytes = r[name] ?? Buffer.alloc(0),
      file = `${label}.${name}`;
    fs.writeFileSync(path.join(output, file), bytes);
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  receipt.commands.push({
    label,
    program,
    args,
    environment: { TMPDIR: fixture, ...env },
    started_at,
    ended_at: new Date().toISOString(),
    exit_code: r.status,
    signal: r.signal,
    error: r.error?.message,
    streams,
  });
  save();
  console.log(`${label}: exit=${r.status}`);
  assert.ok(expected.includes(r.status), label);
  return r;
}
try {
  save();
  for (const file of [
    "source/common/http/http2/codec_impl.cc",
    "source/common/http/conn_manager_impl.cc",
    "source/common/http/filter_manager.cc",
    "source/common/local_reply/local_reply.cc",
    "source/extensions/filters/network/http_connection_manager/config.cc",
    "source/extensions/http/header_validators/envoy_default/header_validator.cc",
    "source/extensions/http/header_validators/envoy_default/http2_header_validator.cc",
    "api/envoy/config/core/v3/protocol.proto",
    "api/envoy/extensions/filters/network/http_connection_manager/v3/http_connection_manager.proto",
    "api/envoy/extensions/http/header_validators/envoy_default/v3/header_validator.proto",
    "bazel/repository_locations.bzl",
  ]) {
    assertLock();
    const url = `https://raw.githubusercontent.com/envoyproxy/envoy/${image.source_commit}/${file}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length < 1024 * 1024);
    const target = `upstream-${file.replaceAll("/", "__")}`;
    fs.writeFileSync(path.join(output, target), bytes);
    receipt.upstream.push({
      file,
      url,
      status: response.status,
      bytes: bytes.length,
      sha256: sha(bytes),
      target,
    });
    save();
  }
  run("protected-before", process.execPath, ["scripts/sprint05b-baseline.mjs"]);
  run("envoy-version", pin.binary.file, ["--version"]);
  run("openssl", "openssl", ["version"]);
  run("native-libraries", "ldd", [pin.binary.file]);
  run(
    "exact-selected",
    process.execPath,
    [
      "--import",
      path.resolve("spikes/envoy/sprint05d-b-peer.mjs"),
      "spikes/envoy/wire-probes.mjs",
      path.resolve(output, "selected.json"),
      fixture,
    ],
    [1],
    environment,
  );
  const result = JSON.parse(fs.readFileSync(`${output}/selected.json`));
  assert.ok(!result.fatal);
  assert.equal(result.tests.length, 5);
  assert.deepEqual(result.failures, [
    "settled-reuse-identity-and-three-authority-negatives",
    "individual-settled-userinfo-denial",
  ]);
  for (const name of result.failures) {
    const t = result.tests.find((t) => t.name === name);
    assert.equal(t.observation.rst_code, 1);
  }
  const individual = result.tests.find(
    (t) => t.name === "individual-settled-userinfo-denial",
  );
  assert.equal(individual.origin.bytes, 0);
  assert.equal(individual.origin.handlers, 0);
  const peer = JSON.parse(fs.readFileSync(`${output}/peer.json`));
  assert.equal(peer.omitted, 0);
  const resets = peer.connections.flatMap((c) =>
    c.frames
      .filter((f) => f.direction === "envoy-to-client" && f.type === 3)
      .map((f) => ({ connection: c.id, ...f })),
  );
  assert.equal(resets.length, 2);
  for (const reset of resets) {
    assert.equal(reset.error_code, 1);
    const connection = peer.connections.find((c) => c.id === reset.connection);
    assert.ok(
      !connection.frames.some(
        (f) =>
          f.direction === "client-to-envoy" &&
          f.type === 3 &&
          BigInt(f.time_ns) < BigInt(reset.time_ns),
      ),
    );
  }
  for (const c of peer.connections) {
    assert.equal(c.peer, "127.0.0.1");
    assert.equal(c.upstream_authorized, true);
    assert.equal(c.upstream_alpn, "h2");
    assert.equal(c.upstream_sni, "edge-b.test");
    assert.equal(c.downstream_alpn, "h2");
  }
  receipt.observation = {
    selected_passed: 3,
    selected_failed: 2,
    aggregate_original23_run: false,
    peer_resets: resets,
    individual_origin: individual.origin,
    verdict:
      "No eligible supported status hook; both original assertions remain FAIL.",
  };
  run("protected-after", process.execPath, ["scripts/sprint05b-baseline.mjs"]);
  receipt.recording_complete = true;
} catch (error) {
  receipt.error = error.stack;
  process.exitCode = 1;
} finally {
  assertLock();
  const proc = execFileSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" });
  const owned = proc
    .split("\n")
    .filter(
      (line) =>
        line.includes(path.resolve(".local") + "/") &&
        (line.includes("sprint05b-native-run-") ||
          line.includes("sprint05d-b-")),
    );
  receipt.owned_processes_remaining = owned;
  receipt.resources = [];
  if (!owned.length)
    for (const entry of fs.readdirSync(".local")) {
      if (
        initial.has(entry) ||
        !/^(sprint05d-b-|sprint05b-native-run-)/.test(entry)
      )
        continue;
      const dir = path.resolve(".local", entry);
      for (const file of ["resources.jsonl", "bootstrap.json"])
        if (fs.existsSync(path.join(dir, file))) {
          const bytes = fs.readFileSync(path.join(dir, file));
          receipt.resources.push({
            directory: entry,
            file,
            bytes: bytes.length,
            sha256: sha(bytes),
          });
          if (file === "bootstrap.json")
            fs.writeFileSync(`${output}/bootstrap.json`, bytes);
        }
      fs.rmSync(dir, { recursive: true });
    }
  receipt.cleanup_complete = !owned.length && !fs.existsSync(fixture);
  if (!receipt.cleanup_complete) process.exitCode = 1;
  for (const entry of sources)
    assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256);
  receipt.lock_held_through_cleanup_hashing = true;
  receipt.ended_at = new Date().toISOString();
  save();
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    fs
      .readdirSync(output)
      .sort()
      .map(
        (file) =>
          `${sha(fs.readFileSync(path.join(output, file)))}  ${output}/${file}\n`,
      )
      .join(""),
  );
}
