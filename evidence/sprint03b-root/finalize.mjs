import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";

const root = "evidence/sprint03b-root";
const hash = (data) => crypto.createHash("sha256").update(data).digest("hex");
function seal() {
  const files = [];
  function walk(directory) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) walk(file);
      else if (file !== path.join(root, "SHA256SUMS")) files.push(file);
    }
  }
  walk(root);
  files.push("docs/reports/sprint03b-completion.md", "IMPLEMENTATION_STATUS.md", "README.md", "docs/DECISIONS.md", "docs/RISK_REGISTER.md", "docs/SECURITY_COVERAGE.md");
  fs.writeFileSync(path.join(root, "SHA256SUMS"), files.sort().map((file) => `${hash(fs.readFileSync(file))}  ${file}\n`).join(""));
}
if (process.argv.includes("--seal-only")) {
  seal();
  process.exit(0);
}
if (fs.existsSync(path.join(root, "final/scanner-output-inventory.json"))) {
  throw new Error("Original scanner archive already exists; use --seal-only to hash later evidence.");
}
function run(command, args) {
  const result = spawnSync(command, args, { maxBuffer: 32 << 20 });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.status}`);
  return result.stdout;
}
function writeJSON(file, value) {
  fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + "\n");
}

const manifests = [
  ["evidence/sprint03b-a/SHA256SUMS"],
  ["evidence/sprint03b-a/SOURCE-SHA256SUMS", "84df9d8b17808f6c6177337814bd3b735fd51f1b"],
  ["evidence/sprint03b-b/SHA256SUMS"],
  ["evidence/sprint03b-c/final/SHA256SUMS", "4bef7e58f0f23ddbbb2d8054851ac2bd13e9f10c"],
  ["evidence/sprint03b-d/SHA256SUMS", "4d0295b"],
  ["evidence/sprint03b-e/SHA256SUMS"],
  ["evidence/sprint03b-e/SOURCE-SHA256SUMS"],
  ["evidence/sprint03b-f/SHA256SUMS"],
];
const verification = [];
for (const [manifest, source] of manifests) {
  const entries = [];
  for (const line of fs.readFileSync(manifest, "utf8").trim().split("\n")) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match) throw new Error(`Invalid manifest: ${manifest}`);
    const [, expected, file] = match;
    const observed = hash(fs.readFileSync(file));
    const entry = { file, expected, current_sha256: observed, current_match: expected === observed };
    if (!entry.current_match) {
      if (!source) throw new Error(`Unexpected changed evidence: ${file}`);
      entry.historical_commit = run("git", ["rev-parse", source]).toString().trim();
      entry.historical_sha256 = hash(run("git", ["show", `${entry.historical_commit}:${file}`]));
      if (entry.historical_sha256 !== expected) throw new Error(`Historical source mismatch: ${file}`);
      entry.historical_match = true;
    }
    entries.push(entry);
  }
  verification.push({ manifest, entries });
}
writeJSON("manifest-verification.json", verification);

const runtimeDiff = run("git", ["diff", "ce7c9b2", "da3598c", "--", "apps", "internal", "packages", "go.mod", "go.sum"]);
if (runtimeDiff.length) throw new Error("Reviewed runtime source differs from integrated runtime");
writeJSON("review-binding.json", {
  reviewed_source: run("git", ["rev-parse", "ce7c9b2"]).toString().trim(),
  integrated_implementation: run("git", ["rev-parse", "da3598c"]).toString().trim(),
  exact_runtime_directories: ["apps", "internal", "packages", "go.mod", "go.sum"],
  diff_bytes: runtimeDiff.length,
  note: "Additional integrated files are the separately reproduced Module01 research and the formatted D evidence runner, plus reports/evidence.",
});
const commits = run("git", ["log", "--reverse", "--format=%H%x09%s", "771b006..HEAD"]).toString().trim().split("\n").map((line) => {
  const tab = line.indexOf("\t");
  return { commit: line.slice(0, tab), subject: line.slice(tab + 1) };
});
writeJSON("commit-map.json", commits);

const scannerDirectory = ".local/evidence/security";
const target = path.join(root, "final/scanner-details");
fs.mkdirSync(target, { recursive: true });
const inventory = [];
for (const name of fs.readdirSync(scannerDirectory).sort()) {
  // Exclude rendered Compose environments, exported images and unrelated old runs.
  if (!(/\.log$|\.cdx\.json$|-vulnerabilities\.json$|^image-inventory\.tsv$|^fixture-images\.lock\.json$|^history-secrets\.json$|^secrets\.json$/.test(name))) continue;
  if (/^(precommit|sprint02)/.test(name)) continue;
  const file = path.join(scannerDirectory, name);
  const data = fs.readFileSync(file);
  const destination = path.join(target, name + (name.endsWith(".json") ? ".gz" : ""));
  fs.writeFileSync(destination, name.endsWith(".json") ? zlib.gzipSync(data) : data);
  inventory.push({ source: file, bytes: data.length, sha256: hash(data), preserved_at: destination });
}
writeJSON("final/scanner-output-inventory.json", {
  source_commit: "da3598c0a048e6c1e479ccd1f54729efb63a8efc",
  note: "Preserved before any closeout scanner rerun; JSON is losslessly gzip-compressed. No Compose environment or private key file is copied.",
  files: inventory,
});
writeJSON("hosted-implementation.json", JSON.parse(run("gh", ["run", "view", "43052478453", "--json", "headSha,conclusion,status,url,jobs,event,createdAt,updatedAt"]).toString()));
writeJSON("hosted-initial-failure.json", JSON.parse(run("gh", ["run", "view", "43050815764", "--json", "headSha,conclusion,status,url,jobs,event,createdAt,updatedAt"]).toString()));

seal();
console.log(`Verified ${verification.length} manifests, runtime review binding and ${inventory.length} scanner outputs.`);
