import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { assertLock } from "./wire-fixtures.mjs";
import { decoder } from "./wire-observer.mjs";

process.umask(0o077);
assertLock();
const output = process.argv[2];
assert.match(output ?? "", /^evidence\/sprint05d-b\/verify-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync("git", args, { maxBuffer: 32 << 20 });
const sha = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(git("status", "--porcelain").toString().trim(), "");
fs.mkdirSync(output, { recursive: true });
let artifacts = 0,
  sourceBindings = 0;
for (const suffix of ["01", "02"]) {
  const dir = `evidence/sprint05d-b/attempt-${suffix}`;
  for (const line of fs
    .readFileSync(`${dir}/SHA256SUMS`, "utf8")
    .trim()
    .split("\n")) {
    const [expected, file] = line.split("  ");
    assert.ok(file.startsWith(`${dir}/`));
    assert.equal(sha(fs.readFileSync(file)), expected);
    artifacts++;
  }
  const r = JSON.parse(fs.readFileSync(`${dir}/receipt.json`));
  assert.equal(r.source_clean, true);
  assert.equal(
    git("rev-parse", `${r.source_commit}^{tree}`).toString().trim(),
    r.source_tree,
  );
  for (const s of r.sources) {
    assert.equal(sha(git("show", `${r.source_commit}:${s.file}`)), s.sha256);
    sourceBindings++;
  }
  for (const u of r.upstream) {
    assert.equal(sha(fs.readFileSync(path.join(dir, u.target))), u.sha256);
    assert.ok(u.url.includes("b2d89e0ae53916f28770771fbdd49c5c99c5c5a2"));
  }
  assert.equal(r.cleanup_complete, true);
  assert.deepEqual(r.owned_processes_remaining, []);
  assert.equal(r.lock_held_through_cleanup_hashing, true);
  assert.equal(r.security_pass, false);
  assert.equal(r.runtime_eligible, false);
  assert.deepEqual(Object.keys(r.experiment), [
    "failure",
    "hypothesis",
    "mechanism",
    "targeted_input",
    "positive_control",
    "stop",
  ]);
  if (suffix === "01") {
    assert.match(r.error, /404 !== 200/);
    assert.equal(r.commands.length, 0);
    continue;
  }
  assert.equal(r.recording_complete, true);
  assert.equal(
    r.commands.find((c) => c.label === "exact-selected").exit_code,
    1,
  );
  for (const label of ["protected-before", "protected-after"]) {
    const c = r.commands.find((c) => c.label === label);
    assert.equal(c.exit_code, 0);
    const protection = JSON.parse(
      fs.readFileSync(path.join(dir, c.streams[0].file)),
    );
    assert.equal(protection.protectedFiles.length, 11);
    for (const p of protection.protectedFiles)
      assert.equal(sha(fs.readFileSync(p.file)), p.sha256);
  }
}
const dir = "evidence/sprint05d-b/attempt-02";
const selection = JSON.parse(fs.readFileSync(`${dir}/selection.json`));
const original = fs.readFileSync("spikes/envoy/wire-probes.mjs", "utf8");
const anchor = "async function probe(name, fn) {";
assert.equal(sha(original), selection.original_sha256);
assert.equal(
  sha(original.replace(anchor, anchor + selection.single_insertion)),
  selection.transformed_sha256,
);
assert.equal(selection.selected.length, 5);
const suite = JSON.parse(fs.readFileSync(`${dir}/selected.json`));
assert.equal(suite.fatal, undefined);
assert.equal(suite.tests.length, 5);
assert.deepEqual(
  suite.tests.map((t) => t.name),
  selection.selected,
);
assert.deepEqual(suite.failures, [
  "settled-reuse-identity-and-three-authority-negatives",
  "individual-settled-userinfo-denial",
]);
for (const name of suite.failures) {
  const t = suite.tests.find((t) => t.name === name);
  assert.equal(t.observation.rst_code, 1);
  assert.deepEqual(t.observation.headers, { ":authority": "user@edge-b.test" });
}
const individual = suite.tests.find(
  (t) => t.name === "individual-settled-userinfo-denial",
);
for (const key of [
  "connections",
  "bytes",
  "handlers",
  "parser_errors",
  "transport_errors",
])
  assert.equal(individual.origin[key], 0);
const control = suite.tests.at(-1);
assert.equal(control.status, "pass");
assert.equal(control.samples.length, 2);
assert.equal(
  control.samples[0].native_connection,
  control.samples[1].native_connection,
);
for (const s of control.samples) {
  assert.equal(s.authority, "lab-origin.test");
  assert.equal(s.sni, "lab-origin.test");
  assert.equal(s.alpn, "h2");
}
assert.equal(suite.origin.wire.omitted_events, 0);
const peer = JSON.parse(fs.readFileSync(`${dir}/peer.json`));
assert.equal(peer.omitted, 0);
const resets = [];
for (const c of peer.connections) {
  assert.equal(c.upstream_authorized, true);
  assert.equal(c.upstream_alpn, "h2");
  assert.equal(c.upstream_sni, "edge-b.test");
  assert.equal(c.downstream_alpn, "h2");
  assert.equal(c.peer, "127.0.0.1");
  for (const direction of ["client-to-envoy", "envoy-to-client"]) {
    const actual = [];
    const consume = decoder({
      client: direction === "client-to-envoy",
      emit: (e) => actual.push(e),
    });
    for (const chunk of c.chunks.filter((b) => b.direction === direction)) {
      const bytes = Buffer.from(chunk.hex, "hex");
      assert.equal(bytes.length, chunk.bytes);
      assert.equal(sha(bytes), chunk.sha256);
      consume(bytes);
    }
    const recorded = c.frames
      .filter((e) => e.direction === direction)
      .map(({ time_ns, direction: ignored, ...e }) => e);
    assert.deepEqual(actual, recorded);
  }
  for (const rst of c.frames.filter(
    (f) => f.direction === "envoy-to-client" && f.type === 3,
  )) {
    assert.equal(rst.hex, "00000403000000000100000001");
    assert.ok(
      !c.frames.some(
        (f) =>
          f.direction === "client-to-envoy" &&
          f.type === 3 &&
          BigInt(f.time_ns) < BigInt(rst.time_ns),
      ),
    );
    assert.ok(
      !c.frames.some(
        (f) =>
          f.direction === "envoy-to-client" &&
          f.type === 1 &&
          f.stream === rst.stream,
      ),
    );
    resets.push({ connection: c.id, hex: rst.hex, sha256: rst.sha256 });
  }
}
assert.equal(resets.length, 2);
const commands = [];
const scanner =
  "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f";
const ownedFiles = git("ls-files", "spikes/envoy/sprint05d-b*.mjs")
  .toString()
  .trim()
  .split("\n");
for (const [label, program, args] of [
  [
    "format",
    process.execPath,
    [
      "/home/tiecont/Projects/aegis-gate/node_modules/prettier/bin/prettier.cjs",
      "--check",
      ...ownedFiles,
    ],
  ],
  [
    "scanner-image",
    "docker",
    ["image", "inspect", scanner, "--format", "{{.Id}} {{json .RepoDigests}}"],
  ],
  ...[
    ["source", "spikes/envoy"],
    ["evidence", "evidence/sprint05d-b"],
    ["report", "docs/reports/sprint05d-b-h2-identity.md"],
  ].map(([label, target]) => [
    `scan-${label}`,
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "none",
      "--name",
      `aegis-sprint05d-b-scan-${process.pid}-${label}`,
      "--user",
      `${process.getuid()}:${process.getgid()}`,
      "-v",
      `${process.cwd()}:/repo:ro`,
      "-v",
      `${path.resolve(output)}:/reports`,
      scanner,
      "dir",
      `/repo/${target}`,
      "--config",
      "/repo/.github/gitleaks.toml",
      "--redact",
      "--report-format",
      "json",
      "--report-path",
      `/reports/${label}-secrets.json`,
      "--no-banner",
    ],
  ]),
  ["protected", process.execPath, ["scripts/sprint05b-baseline.mjs"]],
  [
    "whitespace",
    "git",
    [
      "diff",
      "--check",
      "aa289da",
      "--",
      "spikes/envoy/sprint05d-b*",
      "docs/reports/sprint05d-b-h2-identity.md",
    ],
  ],
  ...git("ls-files", "spikes/envoy/sprint05d-b*.mjs")
    .toString()
    .trim()
    .split("\n")
    .map((file, i) => [`syntax-${i}`, process.execPath, ["--check", file]]),
]) {
  const c = spawnSync(program, args, { timeout: 30000 });
  const streams = ["stdout", "stderr"].map((name) => {
    const file = `${label}.${name}`,
      bytes = c[name] ?? Buffer.alloc(0);
    fs.writeFileSync(path.join(output, file), bytes);
    return { file, sha256: sha(bytes), bytes: bytes.length };
  });
  commands.push({
    label,
    program,
    args,
    exit_code: c.status,
    signal: c.signal,
    streams,
  });
  assert.equal(c.status, 0);
}
assertLock();
for (const label of ["source", "evidence", "report"])
  assert.deepEqual(
    JSON.parse(fs.readFileSync(`${output}/${label}-secrets.json`)),
    [],
  );
const toolIdentities = [
  "git",
  "openssl",
  "ldd",
  "prlimit",
  "flock",
  "docker",
].map((name) => {
  const file = execFileSync("which", [name], { encoding: "utf8" }).trim();
  return { name, file, sha256: sha(fs.readFileSync(file)) };
});
const result = {
  source_commit: git("rev-parse", "HEAD").toString().trim(),
  source_tree: git("rev-parse", "HEAD^{tree}").toString().trim(),
  node: process.version,
  node_sha256: sha(fs.readFileSync(process.execPath)),
  argv: process.argv,
  artifacts,
  sourceBindings,
  commands,
  tool_identities_observed_at_verification: toolIdentities,
  prettier: {
    version: "3.9.10",
    cli_sha256: sha(
      fs.readFileSync(
        "/home/tiecont/Projects/aegis-gate/node_modules/prettier/bin/prettier.cjs",
      ),
    ),
  },
  resets,
  capture_bytes: peer.captured_bytes,
  integrity_verified: true,
  semantic_security_pass: false,
  resource_eligible: false,
  runtime_eligible: false,
  lock_held_through_hashing: true,
  original75_or23_aggregate_rerun: false,
};
fs.writeFileSync(
  `${output}/receipt.json`,
  JSON.stringify(result, null, 2) + "\n",
);
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
console.log(JSON.stringify(result, null, 2));
