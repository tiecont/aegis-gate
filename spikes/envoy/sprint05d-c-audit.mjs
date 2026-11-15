import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { assertLock } from "./wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const output = process.argv[2];
assert.match(output ?? "", /^evidence\/sprint05d-c\/audit-\d+$/);
assert.ok(!fs.existsSync(output));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
const pin = JSON.parse(fs.readFileSync("spikes/envoy/image.lock.json"));
assert.equal(pin.source_commit, "b2d89e0ae53916f28770771fbdd49c5c99c5c5a2");
const extractionFile =
  "/home/tiecont/Projects/aegis-gate/evidence/sprint05b-root/native-extract-01/receipt.json";
const extraction = JSON.parse(fs.readFileSync(extractionFile));
assert.equal(extraction.complete, true);
assert.equal(extraction.cleanup.absent, true);
assert.equal(pin.image, extraction.image);
assert.equal(
  sha(fs.readFileSync(extraction.binary.file)),
  extraction.binary.sha256,
);
assert.equal(
  extraction.binary.sha256,
  "1d64506e25c1844f146162ddb2ece7010fa4e784faddb40a079021491f1f03cc",
);
assert.equal(
  sha(fs.readFileSync(process.execPath)),
  "0adde40d1b7dfa57c8bc83cbc319758c3ec6ebba21363bb2fa752ea6b267ad1b",
);
const hypothesisFile = "spikes/envoy/sprint05d-c-hypothesis.json";
const hypothesis = JSON.parse(fs.readFileSync(hypothesisFile));
assert.deepEqual(Object.keys(hypothesis).sort(), [
  "failure",
  "hypothesis",
  "mechanism",
  "positive_control",
  "stop",
  "targeted_input",
]);
fs.mkdirSync(output, { recursive: true });
const receipt = {
  source_commit: git("rev-parse", "HEAD"),
  source_tree: git("rev-parse", "HEAD^{tree}"),
  source_clean: true,
  argv: process.argv,
  started_at: new Date().toISOString(),
  pin,
  hypothesis,
  hypothesis_sha256: sha(fs.readFileSync(hypothesisFile)),
  source_files: ["spikes/envoy/sprint05d-c-audit.mjs", hypothesisFile].map(
    (file) => ({ file, sha256: sha(fs.readFileSync(file)) }),
  ),
  extraction: {
    file: extractionFile,
    sha256: sha(fs.readFileSync(extractionFile)),
    binary: extraction.binary,
  },
  node: {
    version: process.version,
    binary: process.execPath,
    sha256: sha(fs.readFileSync(process.execPath)),
  },
  environment: { TMPDIR: process.env.TMPDIR ?? null },
  commands: [],
  upstream: [],
  checks: [],
  fixture_executed: false,
  targeted3_executed: false,
  full23_executed: false,
  semantic_security_pass: false,
  resource_eligible: false,
  supported_candidate_found: false,
};
const save = () =>
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(receipt, null, 2) + "\n",
  );
function run(label, program, args) {
  assertLock();
  const started = new Date().toISOString();
  const result = spawnSync(program, args, {
    timeout: 45000,
    maxBuffer: 2 << 20,
  });
  const streams = ["stdout", "stderr"].map((name) => {
    const file = `${output}/${label}.${name}`,
      bytes = result[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes);
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  receipt.commands.push({
    label,
    program,
    args,
    started_at: started,
    ended_at: new Date().toISOString(),
    exit_code: result.status,
    signal: result.signal,
    error: result.error?.message,
    streams,
  });
  save();
  assert.equal(result.status, 0, label);
  return result.stdout;
}
function check(name, condition, boundary) {
  receipt.checks.push({ name, pass: Boolean(condition), boundary });
  assert.ok(condition, name);
}
try {
  run("protected-before", process.execPath, ["scripts/sprint05b-baseline.mjs"]);
  run("node-version", process.execPath, ["--version"]);
  run("envoy-version", extraction.binary.file, ["--version"]);
  run("openssl-version", "openssl", ["version"]);
  run("curl-version", "curl", ["--version"]);
  const oldReceipt = JSON.parse(
    fs.readFileSync("evidence/sprint05b-c/source-01/receipt.json"),
  );
  const files = [
    "source/common/http/http2/codec_impl.cc",
    "source/common/http/conn_manager_impl.cc",
    "source/common/http/http2/codec_impl.h",
    "envoy/http/codec.h",
    "envoy/network/connection.h",
    "api/envoy/config/core/v3/protocol.proto",
    "api/envoy/extensions/filters/network/http_connection_manager/v3/http_connection_manager.proto",
  ];
  const sources = new Map();
  for (const [index, file] of files.entries()) {
    const url = `https://raw.githubusercontent.com/envoyproxy/envoy/${pin.source_commit}/${file}`;
    const bytes = run(`upstream-${index}`, "curl", [
      "--fail",
      "--silent",
      "--show-error",
      "--max-time",
      "30",
      url,
    ]);
    assert.ok(bytes.length > 100 && bytes.length < 1 << 20);
    const prior = oldReceipt.files.find((entry) => entry.file === file);
    if (prior) assert.equal(sha(bytes), prior.sha256, file);
    receipt.upstream.push({
      file,
      url,
      artifact: `${output}/upstream-${index}.stdout`,
      bytes: bytes.length,
      sha256: sha(bytes),
      prior_sha256_verified: prior?.sha256 ?? null,
    });
    sources.set(file, bytes.toString());
  }
  const codec = sources.get(files[0]),
    hcm = sources.get(files[1]),
    header = sources.get(files[2]);
  const dispatch = codec.slice(
    codec.indexOf("Http::Status ConnectionImpl::dispatch("),
    codec.indexOf(
      "const ConnectionImpl::StreamImpl* ConnectionImpl::getStream(",
    ),
  );
  check(
    "dispatch-error-before-adapter-send",
    dispatch.includes("return codec_callback_status_;") &&
      dispatch.indexOf("return codecProtocolError(codecStrError(rc));") <
        dispatch.indexOf("return sendPendingFrames();"),
    "Static ordering only; no claim that this exact callback/return executed for historical CONTINUATION",
  );
  check(
    "hcm-assumes-goaway-already-sent",
    /HTTP\/2 codec has already sent\s*\/\/ GOAWAY\.[\s\S]{0,160}FlushWriteAndDelay/.test(
      hcm,
    ),
    "Network-buffer flush is not adapter Send",
  );
  check(
    "ordinary-goaway-is-no-error",
    /void ConnectionImpl::goAway\(\)[\s\S]{0,220}HTTP2_NO_ERROR/.test(codec),
    "Does not satisfy original PROTOCOL_ERROR=1",
  );
  check(
    "protocol-error-helper-explicitly-for-tests",
    /Status protocolErrorForTest\(\); \/\/ Used in tests to simulate errors\./.test(
      header,
    ) &&
      /Status ConnectionImpl::protocolErrorForTest\(\)[\s\S]{0,220}PROTOCOL_ERROR[\s\S]{0,80}sendPendingFrames\(\)/.test(
        codec,
      ),
    "Concrete test method is not a configurable production error hook",
  );
  check(
    "send-blocked-during-dispatch",
    /Status ConnectionImpl::sendPendingFrames\(\)[\s\S]{0,100}dispatching_[\s\S]{0,150}adapter_->Send\(\)/.test(
      codec,
    ),
    "No claim of a queued GOAWAY in the historical failure",
  );
  check(
    "invalid-frame-callback-fatal-return",
    /case ERR_PROTO:[\s\S]{0,600}return ERR_CALLBACK_FAILURE;/.test(codec),
    "Static potential path only",
  );
  check(
    "hidden-codec-field-excluded",
    /not-implemented-hide:[\s\S]{0,400}use_oghttp2_codec = 16/.test(
      sources.get(files[5]),
    ),
    "No hidden/WIP field is configured or accepted",
  );
  const api = sources.get(files[6]);
  check(
    "public-close-and-stream-timeout-boundaries",
    api.includes("write buffer") &&
      api.includes("remaining stream data") &&
      api.includes("google.protobuf.Duration delayed_close_timeout = 26;") &&
      api.includes("google.protobuf.Duration stream_flush_timeout = 59;"),
    "Timeout APIs do not connect ProcessBytes failure to SubmitGoAway/Send",
  );
  const historical = "evidence/sprint05c-c/attempt-04/original23.json";
  const previous = JSON.parse(fs.readFileSync(historical));
  receipt.historical_reference = {
    file: historical,
    sha256: sha(fs.readFileSync(historical)),
    fresh_execution: false,
    tests: previous.tests.filter((test) =>
      hypothesis.targeted_input.includes(test.name),
    ),
  };
  assert.equal(receipt.historical_reference.tests.length, 3);
  run("protected-after", process.execPath, ["scripts/sprint05b-baseline.mjs"]);
  receipt.technical_stop =
    "No supported configurable error emission/adapter flush hook identified in the pinned released interfaces. Do not execute unchanged historical codec mechanism again.";
  receipt.recording_complete = true;
} catch (error) {
  receipt.error = error.stack;
  process.exitCode = 1;
} finally {
  assertLock();
  for (const entry of receipt.source_files)
    assert.equal(sha(fs.readFileSync(entry.file)), entry.sha256);
  receipt.cleanup = {
    fixture_created: false,
    listeners_created: false,
    private_material_created: false,
    native_runtime_started: false,
    lock_held_through_hashing: true,
  };
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
