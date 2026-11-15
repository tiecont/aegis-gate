import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

process.umask(0o077);
assertLock();
const [output, ...pairs] = process.argv.slice(2);
assert.match(output ?? "", /^evidence\/sprint06a-f\/[a-z0-9-]+$/);
assert.equal(pairs.length % 2, 0);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync("git", args, { maxBuffer: 32 << 20 });
const str = (...args) =>
  git(...args)
    .toString()
    .trim();
const show = (revision, file) => git("show", `${revision}:${file}`);
const sha = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(str("status", "--porcelain"), "");
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(".local/tmp", { recursive: true });
const stage = fs.mkdtempSync(path.resolve(".local/sprint06a-f-audit-"));
const record = {
  reviewer: str("rev-parse", "HEAD"),
  reviewerTree: str("rev-parse", "HEAD^{tree}"),
  argv: process.argv,
  collectorSha256: sha(fs.readFileSync(import.meta.filename)),
  started: new Date().toISOString(),
  reviews: [],
  commands: [],
  module01Pass: false,
  runtimePass: false,
};
function run(label, executable, args) {
  assertLock();
  const child = spawnSync(executable, args, {
    timeout: 180000,
    maxBuffer: 16 << 20,
  });
  const streams = ["stdout", "stderr"].map((name) => {
    const b = child[name] ?? Buffer.alloc(0),
      file = `${label}.${name}`;
    fs.writeFileSync(`${output}/${file}`, b);
    return { file, bytes: b.length, sha256: sha(b) };
  });
  record.commands.push({
    label,
    executable,
    executableSha256: sha(fs.readFileSync(executable)),
    args,
    exit: child.status,
    signal: child.signal,
    error: child.error?.message,
    streams,
  });
  assert.equal(child.status, 0, label);
  assert.equal(child.signal, null, label);
  assert.equal(child.error, undefined, label);
  return child.stdout;
}
function checkManifest(revision, file) {
  let count = 0;
  for (const line of show(revision, file).toString().trim().split("\n")) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.ok(match, file);
    assert.ok(match[2].startsWith(path.dirname(file) + "/"));
    assert.equal(sha(show(revision, match[2])), match[1], match[2]);
    count++;
  }
  return count;
}
try {
  record.protected = JSON.parse(
    run("protected", process.execPath, ["scripts/sprint05b-baseline.mjs"]),
  );
  assert.equal(
    record.protected.protected_inventory_sha256,
    "85de42e7d2ac54b0f199bcced46760bec41b7687dd7c7016dd580ea4a300c1fa",
  );
  for (let i = 0; i < pairs.length; i += 2) {
    const [track, revision] = pairs.slice(i, i + 2);
    assert.ok(["a", "b", "c", "d", "e"].includes(track));
    const commit = str("rev-parse", `${revision}^{commit}`),
      row = {
        track,
        commit,
        tree: str("rev-parse", `${revision}^{tree}`),
        manifests: [],
        sources: [],
      };
    for (const pin of record.protected.protectedFiles)
      assert.equal(sha(show(commit, pin.file)), pin.sha256);
    const changes = str("diff", "--name-only", "8929adf", commit).split("\n");
    row.changes = changes;
    const allowed =
      track === "b"
        ? /^(?:spikes\/sprint06a-admission\/|scripts\/sprint06a-b-|evidence\/sprint06a-b\/|docs\/reports\/sprint06a-b-|internal\/configsnapshot\/sprint06a_experimental\.go$)/
        : track === "c"
          ? /^(?:spikes\/envoy\/sprint06a-c-|scripts\/sprint06a-c-|evidence\/sprint06a-c\/|docs\/reports\/sprint06a-c-|docs\/upstream\/sprint06a-)/
          : track === "d"
            ? /^(?:spikes\/envoy\/sprint05c-attribution\/sprint06a_runtime_test\.go$|scripts\/sprint06a-d-|evidence\/sprint06a-d\/|docs\/reports\/sprint06a-d-)/
            : track === "e"
              ? /^docs\/(?:ADR-012-sprint06a-|contracts\/sprint06a-|reports\/sprint06a-e-)/
              : /^(?:spikes\/envoy\/sprint06a-a-|scripts\/sprint06a-a-|evidence\/sprint06a-a\/|docs\/reports\/sprint06a-a-)/;
    assert.ok(
      changes.every((f) => allowed.test(f)),
      `unexpected ${track} scope`,
    );
    for (const file of changes.filter((f) => !f.startsWith("evidence/"))) {
      const b = show(commit, file);
      row.sources.push({ file, bytes: b.length, sha256: sha(b) });
      const dest = path.join(stage, track, file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, b);
    }
    for (const file of str(
      "ls-tree",
      "-r",
      "--name-only",
      commit,
      `evidence/sprint06a-${track}`,
    )
      .split("\n")
      .filter((f) => f.endsWith("/SHA256SUMS")))
      row.manifests.push({
        file,
        sha256: sha(show(commit, file)),
        artifacts: checkManifest(commit, file),
      });
    if (track === "c") {
      const base = "evidence/sprint06a-c/instrumentation-01",
        r = JSON.parse(show(commit, `${base}/receipt.json`));
      assert.equal(r.complete, true);
      assert.equal(r.new_runtime_executed, false);
      assert.equal(r.qualifying_capability, false);
      assert.equal(r.same_as_inspected, true);
      assert.equal(str("rev-parse", `${r.source}^{tree}`), r.tree);
      assert.equal(
        sha(show(r.source, "spikes/envoy/sprint06a-c-go-release.mjs")),
        r.collector_sha256,
      );
      for (const command of r.commands) {
        assert.equal(command.exit_code, 0);
        assert.equal(command.signal, null);
        for (const s of command.streams) {
          const b = show(commit, `${base}/${s.file}`);
          assert.equal(b.length, s.bytes);
          assert.equal(sha(b), s.sha256);
        }
      }
      const go = JSON.parse(show(commit, `${base}/go-stable.stdout`)).find(
          (v) => v.stable,
        ),
        net = JSON.parse(show(commit, `${base}/net-latest.stdout`));
      assert.equal(go.version, "go1.27.4");
      assert.equal(net.Version, "v0.62.0");
      assert.equal(net.Origin.URL, "https://go.googlesource.com/net");
      assert.equal(net.Origin.Hash, "3de643db506517b3e652a13cc0b56034cea6b8e6");
      assert.deepEqual(
        r.releases.go_source,
        go.files.find((v) => v.kind === "source"),
      );
      assert.deepEqual(r.releases.net, net);
      row.instrumentation = r.releases;
    }
    if (track === "e") {
      const manifest = JSON.parse(
        show(
          commit,
          "docs/contracts/sprint06a-finite-admission-research-v1.json",
        ),
      );
      assert.equal(manifest.status, "PROPOSED_NOT_EFFECTIVE");
      assert.equal(manifest.production_enabled, false);
      assert.equal(manifest.opens_module01, false);
      assert.equal(manifest.original75_23_authoritative, true);
      for (const field of [
        "architecture_owner",
        "security_owner",
        "approval_reference",
      ])
        assert.equal(manifest[field], "PENDING");
      assert.equal(
        manifest.protected_inventory_sha256,
        record.protected.protected_inventory_sha256,
      );
      for (const item of [
        "precompletion_origin_streaming",
        "indefinite_streaming",
        "websocket",
        "grpc",
        "complete_h2_runtime",
        "production_ssrf_dial_policy",
        "production_key_custody",
        "complete_authoritative_runtime_attribution",
      ])
        assert.ok(manifest.unsupported_in_limited_component.includes(item));
      assert.equal(
        manifest.on_incomplete_or_unknown,
        "DENY_OR_INCOMPLETE_NEVER_PASS",
      );
      row.proposal = manifest;
    }
    record.reviews.push(row);
  }
  const own = str(
    "ls-files",
    "scripts/sprint06a-f-*",
    "docs/reports/sprint06a-f-security-review.md",
    "evidence/sprint06a-f",
  ).split("\n");
  record.ownFiles = own.map((file) => {
    const b = fs.readFileSync(file),
      dest = path.join(stage, "f", file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, b);
    return { file, bytes: b.length, sha256: sha(b) };
  });
  run("secrets", "/usr/bin/docker", [
    "run",
    "--rm",
    "--pull=never",
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--user",
    `${process.getuid()}:${process.getgid()}`,
    "--mount",
    `type=bind,src=${stage},dst=/scan,readonly`,
    "--mount",
    `type=bind,src=${path.resolve(output)},dst=/reports`,
    "--mount",
    `type=bind,src=${path.resolve(".github/gitleaks.toml")},dst=/policy.toml,readonly`,
    "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f",
    "dir",
    "/scan",
    "--config",
    "/policy.toml",
    "--redact",
    "--report-format=json",
    "--report-path=/reports/secrets.json",
    "--no-banner",
  ]);
  assert.deepEqual(JSON.parse(fs.readFileSync(`${output}/secrets.json`)), []);
  record.complete = true;
} catch (error) {
  record.error = error.stack;
  process.exitCode = 1;
} finally {
  assertLock();
  fs.rmSync(stage, { recursive: true, force: true });
  record.privateStageAbsent = !fs.existsSync(stage);
  record.lockHeldThroughCleanupAndHashes = true;
  record.ended = new Date().toISOString();
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    fs
      .readdirSync(output)
      .sort()
      .map((f) => `${sha(fs.readFileSync(`${output}/${f}`))}  ${output}/${f}\n`)
      .join(""),
  );
  console.log(
    JSON.stringify({
      complete: record.complete,
      error: record.error,
      reviews: record.reviews.map((r) => ({
        track: r.track,
        commit: r.commit,
        manifests: r.manifests.length,
        artifacts: r.manifests.reduce((n, m) => n + m.artifacts, 0),
      })),
    }),
  );
  assertLock();
}
