import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { packageData } from "./sprint06a-c-package.mjs";

process.umask(0o077);
const output = process.argv[2];
assert.match(output ?? "", /^evidence\/sprint06a-c\/audit-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const files = git("ls-files", "spikes/envoy/sprint06a-c-*").split("\n");
const receipt = {
  source_commit: git("rev-parse", "HEAD"),
  source_tree: git("rev-parse", "HEAD^{tree}"),
  started: new Date().toISOString(),
  argv: process.argv,
  node: {
    version: process.version,
    binary: process.execPath,
    sha256: sha(fs.readFileSync(process.execPath)),
  },
  source_files: files.map((file) => ({
    file,
    sha256: sha(fs.readFileSync(file)),
  })),
  commands: [],
  new_runtime_executed: false,
  full75_executed: false,
  full23_executed: false,
  qualifying_new_capability: false,
  module01_go: false,
};
fs.mkdirSync(output, { recursive: true });
function run(label, command, args) {
  const binary = fs.realpathSync(
    command.includes("/")
      ? command
      : execFileSync("which", [command], { encoding: "utf8" }).trim(),
  );
  const began = new Date().toISOString();
  const child = spawnSync(command, args, {
    timeout: 45000,
    maxBuffer: 4 << 20,
  });
  const streams = ["stdout", "stderr"].map((name) => {
    const file = `${output}/${label}.${name}`,
      bytes = child[name] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes, { flag: "wx" });
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  receipt.commands.push({
    label,
    command,
    binary,
    binary_sha256: sha(fs.readFileSync(binary)),
    args,
    began,
    ended: new Date().toISOString(),
    exit_code: child.status,
    signal: child.signal,
    error: child.error?.message,
    streams,
  });
  assert.equal(child.status, 0, label);
  return child.stdout;
}
try {
  const before = JSON.parse(
    run("protected-before", process.execPath, [
      "scripts/sprint05b-baseline.mjs",
    ]),
  );
  assert.equal(
    before.protected_inventory_sha256,
    "85de42e7d2ac54b0f199bcced46760bec41b7687dd7c7016dd580ea4a300c1fa",
  );
  run("gh-version", "gh", ["--version"]);
  receipt.releases = [];
  for (const [name, repo, expected, source] of [
    [
      "envoy",
      "envoyproxy/envoy",
      "v1.40.2",
      "b2d89e0ae53916f28770771fbdd49c5c99c5c5a2",
    ],
    [
      "llhttp",
      "nodejs/llhttp",
      "release/v9.4.4",
      "816485216511b86459b2e6478190e14c38c14891",
    ],
  ]) {
    const latest = JSON.parse(
      run(`${name}-latest`, "gh", ["api", `repos/${repo}/releases/latest`]),
    );
    const recent = JSON.parse(
      run(`${name}-recent`, "gh", ["api", `repos/${repo}/releases?per_page=6`]),
    );
    assert.equal(latest.draft, false);
    assert.equal(latest.prerelease, false);
    assert.ok(Date.parse(latest.published_at) <= Date.now());
    const ref = JSON.parse(
      run(`${name}-ref`, "gh", [
        "api",
        `repos/${repo}/git/ref/tags/${latest.tag_name}`,
      ]),
    );
    const changed = latest.tag_name !== expected || ref.object.sha !== source;
    receipt.releases.push({
      name,
      tag: latest.tag_name,
      source: ref.object.sha,
      object_type: ref.object.type,
      expected_tag: expected,
      expected_source: source,
      published_at: latest.published_at,
      official_url: latest.html_url,
      same_as_reviewed_release: !changed,
      recent_releases: recent.map((r) => ({
        tag: r.tag_name,
        published_at: r.published_at,
        prerelease: r.prerelease,
        draft: r.draft,
      })),
    });
    assert.equal(
      ref.object.type,
      "commit",
      "annotated/new tags need explicit source review",
    );
    if (changed)
      throw new Error(
        "New release requires targeted API diff; no unsupported automatic PASS or runtime run",
      );
  }
  const data = packageData();
  fs.writeFileSync(
    `${output}/maintainer-package.json`,
    JSON.stringify(data, null, 2) + "\n",
    { flag: "wx" },
  );
  receipt.maintainer_package_sha256 = sha(
    fs.readFileSync(`${output}/maintainer-package.json`),
  );
  receipt.capability_results = data.requirements.requirements.map((r) => ({
    id: r.id,
    state:
      r.id === "C1"
        ? "LLHTTP_CAPABILITY_ONLY_COMPLETE_RUNTIME_MISSING"
        : "MISSING_SUPPORTED_API",
    new_released_change: false,
    original_failure_repaired: false,
  }));
  const after = JSON.parse(
    run("protected-after", process.execPath, [
      "scripts/sprint05b-baseline.mjs",
    ]),
  );
  assert.deepEqual(after.protectedFiles, before.protectedFiles);
  receipt.protected_inventory_sha256 = before.protected_inventory_sha256;
  receipt.passed = true;
} catch (error) {
  receipt.passed = false;
  receipt.error = error.stack;
  process.exitCode = 1;
} finally {
  receipt.ended = new Date().toISOString();
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(receipt, null, 2) + "\n",
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
      complete: receipt.passed,
      new_runtime_executed: false,
    }),
  );
}
