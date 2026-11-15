import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

const output = process.argv[2];
assert.match(output ?? "", /^evidence\/sprint06a-c\/instrumentation-\d+$/);
assert.ok(!fs.existsSync(output));
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const receipt = {
  source: git("rev-parse", "HEAD"),
  tree: git("rev-parse", "HEAD^{tree}"),
  argv: process.argv,
  started: new Date().toISOString(),
  node: process.version,
  node_sha256: sha(fs.readFileSync(process.execPath)),
  collector_sha256: sha(fs.readFileSync(process.argv[1])),
  commands: [],
  new_runtime_executed: false,
  qualifying_capability: false,
};
fs.mkdirSync(output, { recursive: true });
function fetchJSON(label, url) {
  const binary = fs.realpathSync(
    execFileSync("which", ["curl"], { encoding: "utf8" }).trim(),
  );
  const args = [
    "--fail",
    "--silent",
    "--show-error",
    "--max-time",
    "30",
    "--proto",
    "=https",
    url,
  ];
  const result = spawnSync(binary, args, {
    timeout: 35000,
    maxBuffer: 2 << 20,
  });
  const streams = ["stdout", "stderr"].map((name) => {
    const file = `${label}.${name}`,
      bytes = result[name] ?? Buffer.alloc(0);
    fs.writeFileSync(`${output}/${file}`, bytes, { flag: "wx" });
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  receipt.commands.push({
    command: binary,
    binary_sha256: sha(fs.readFileSync(binary)),
    args,
    exit_code: result.status,
    signal: result.signal,
    streams,
  });
  assert.equal(result.status, 0);
  assert.equal(result.signal, null);
  return JSON.parse(result.stdout);
}
try {
  const go = fetchJSON("go-stable", "https://go.dev/dl/?mode=json").find(
    (r) => r.stable,
  );
  const net = fetchJSON(
    "net-latest",
    "https://proxy.golang.org/golang.org/x/net/@latest",
  );
  assert.equal(go.version, "go1.27.4");
  assert.equal(net.Version, "v0.62.0");
  assert.equal(net.Origin.URL, "https://go.googlesource.com/net");
  assert.equal(net.Origin.Hash, "3de643db506517b3e652a13cc0b56034cea6b8e6");
  assert.ok(fs.readFileSync("go.mod", "utf8").includes("go 1.27.4"));
  assert.ok(
    fs.readFileSync("go.mod", "utf8").includes("golang.org/x/net v0.62.0"),
  );
  receipt.releases = {
    go: go.version,
    go_source: go.files.find((f) => f.kind === "source"),
    net,
  };
  receipt.same_as_inspected = true;
  receipt.complete = true;
} catch (e) {
  receipt.error = e.stack;
  receipt.complete = false;
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
      complete: receipt.complete,
      new_runtime_executed: false,
    }),
  );
}
