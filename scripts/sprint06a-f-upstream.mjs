import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const [clone, output] = process.argv.slice(2);
assert.equal(process.cwd(), clone);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, { cwd: clone, maxBuffer: 32 << 20 });
const { assertLock } = await import(
  pathToFileURL(`${clone}/spikes/envoy/wire-fixtures.mjs`)
);
assertLock();
const record = {
  source: git("rev-parse", "HEAD").toString().trim(),
  audits: [],
  runtimeExecuted: false,
  qualifyingNewCapability: false,
  runtimePass: false,
  module01Pass: false,
};
for (const audit of ["audit-01", "audit-02"]) {
  const base = path.join(clone, "evidence/sprint06a-c", audit);
  const receipt = JSON.parse(fs.readFileSync(`${base}/receipt.json`));
  const row = { audit, artifacts: 0, streams: 0, releases: [] };
  for (const line of fs
    .readFileSync(`${base}/SHA256SUMS`, "utf8")
    .trim()
    .split("\n")) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.ok(match);
    assert.equal(sha(fs.readFileSync(path.join(clone, match[2]))), match[1]);
    row.artifacts++;
  }
  for (const s of receipt.source_files)
    assert.equal(
      sha(git("show", `${receipt.source_commit}:${s.file}`)),
      s.sha256,
    );
  assert.equal(
    git("rev-parse", `${receipt.source_commit}^{tree}`).toString().trim(),
    receipt.source_tree,
  );
  for (const c of receipt.commands) {
    assert.equal(c.exit_code, 0);
    assert.equal(c.signal, null);
    for (const s of c.streams) {
      const b = fs.readFileSync(path.join(clone, s.file));
      assert.equal(sha(b), s.sha256);
      assert.equal(b.length, s.bytes);
      row.streams++;
    }
  }
  for (const [name, tag, commit, repository] of [
    [
      "envoy",
      "v1.40.2",
      "b2d89e0ae53916f28770771fbdd49c5c99c5c5a2",
      "envoyproxy/envoy",
    ],
    [
      "llhttp",
      "release/v9.4.4",
      "816485216511b86459b2e6478190e14c38c14891",
      "nodejs/llhttp",
    ],
  ]) {
    const latest = JSON.parse(fs.readFileSync(`${base}/${name}-latest.stdout`));
    const ref = JSON.parse(fs.readFileSync(`${base}/${name}-ref.stdout`));
    const c = receipt.commands.find((v) => v.label === `${name}-latest`);
    assert.deepEqual(c.args, ["api", `repos/${repository}/releases/latest`]);
    assert.equal(latest.tag_name, tag);
    assert.equal(latest.draft, false);
    assert.equal(latest.prerelease, false);
    assert.equal(
      latest.html_url,
      `https://github.com/${repository}/releases/tag/${tag}`,
    );
    assert.equal(ref.object.type, "commit");
    assert.equal(ref.object.sha, commit);
    const r = receipt.releases.find((v) => v.name === name);
    assert.equal(r.source, commit);
    assert.equal(r.same_as_reviewed_release, true);
    row.releases.push({ name, tag, commit, officialURL: latest.html_url });
  }
  assert.equal(receipt.passed, true);
  assert.equal(receipt.new_runtime_executed, false);
  assert.equal(receipt.full75_executed, false);
  assert.equal(receipt.full23_executed, false);
  assert.equal(receipt.qualifying_new_capability, false);
  assert.equal(receipt.module01_go, false);
  assert.equal(receipt.capability_results.length, 4);
  assert.ok(
    receipt.capability_results.every(
      (v) => !v.original_failure_repaired && !v.new_released_change,
    ),
  );
  const pack = fs.readFileSync(`${base}/maintainer-package.json`);
  assert.equal(sha(pack), receipt.maintainer_package_sha256);
  row.receiptSha256 = sha(fs.readFileSync(`${base}/receipt.json`));
  record.audits.push(row);
}
const { packageData } = await import(
  pathToFileURL(`${clone}/spikes/envoy/sprint06a-c-package.mjs`)
);
const pack = packageData();
assert.equal(pack.fresh_runtime_execution, false);
assert.equal(pack.published, false);
assert.equal(pack.vectors.length, 5);
const manifest = JSON.parse(
  fs.readFileSync(`${clone}/spikes/edge-comparison/manifest.json`),
);
for (const vector of pack.vectors) {
  const bytes = Buffer.from(vector.raw, "hex");
  assert.equal(sha(bytes), vector.sha256);
  const h1 = manifest.negatives.find((v) => v.name === vector.id);
  if (h1) {
    assert.deepEqual(bytes, Buffer.from(h1.request));
    assert.deepEqual(vector.expected, manifest.rejection_contract);
  }
}
for (const reference of pack.immutable_references)
  assert.equal(
    sha(fs.readFileSync(path.join(clone, reference.file))),
    reference.sha256,
  );
assert.equal(
  pack.h2_userinfo.actual_peer_rst_hex,
  "00000403000000000100000001",
);
assert.deepEqual(pack.h2_userinfo.expected_http_status, [400, 421]);
assert.equal(pack.observation.aggregate_ack_hex, "000000040100000000");
const replay = fs.readFileSync(
  `${clone}/spikes/envoy/sprint06a-c-replay.mjs`,
  "utf8",
);
assert.ok(replay.includes('assert.equal(spec.host, "127.0.0.1")'));
assert.ok(replay.includes("rejectUnauthorized: true"));
assert.ok(replay.includes("security_pass: false"));
assert.ok(replay.includes("original_evaluator_executed: false"));
assert.ok(replay.includes("origin_capture_complete: false"));
record.package = {
  vectors: 5,
  manifestSha256: sha(Buffer.from(JSON.stringify(pack, null, 2) + "\n")),
  materializedByF: false,
  protocolReplayExecutedByF: false,
};
record.replayLimits = [
  "Local verified TLS only; no original oracle or origin capture",
  "userinfo branch records maintained session status/reset but no bidirectional raw wire",
  "deadline/capture failure has explicit flags; process exit alone is insufficient",
  "package generation and retained historical bytes are not a fresh runtime repair",
];
assertLock();
fs.writeFileSync(output, JSON.stringify(record, null, 2) + "\n");
console.log(
  JSON.stringify({
    audits: record.audits.length,
    artifactHashes: record.audits.reduce((n, r) => n + r.artifacts, 0),
    vectors: 5,
    protocolReplayExecuted: false,
  }),
);
