import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

const root = "c117d96a0216de301c2a8033e79edee21a936f4a";
const base = "541d1d915ce6a3b679dc3fed3ea0a98f908ce001";
const clone = "/tmp/aegisgate-05a-gates";
const bad = [
  "551591395880ce87863b4e861c05d266c719b91f",
  "cd8f4a760239086616809db8b55a651d3cc28d8e",
];
const [mode, output] = process.argv.slice(2);
assert.ok(["audit", "scan"].includes(mode));
assert.match(
  output ?? "",
  /^evidence\/sprint05a-gate-review\/(audit|scan)-\d+$/,
);
assert.ok(!fs.existsSync(output), "fresh output required");
assertLock();
process.umask(0o077);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) => execFileSync("git", args, { maxBuffer: 64 << 20 });
const txt = (...args) =>
  git(...args)
    .toString()
    .trim();
const cg = (...args) => txt("-C", clone, ...args);
const read = (f) => fs.readFileSync(f);
const json = (f) => JSON.parse(read(f));
assert.equal(txt("status", "--porcelain", "--untracked-files=no"), "");
fs.mkdirSync(output, { recursive: true });
const receipt = {
  source_commit: txt("rev-parse", "HEAD"),
  source_tree: txt("rev-parse", "HEAD^{tree}"),
  reviewed_commit: root,
  reviewed_tree: txt("rev-parse", `${root}^{tree}`),
  mode,
  argv: process.argv,
  cwd: process.cwd(),
  node: process.version,
  node_sha256: sha(read(process.execPath)),
  started_at: new Date().toISOString(),
  checks: [],
  commands: [],
};
async function check(name, action) {
  try {
    const result = await action();
    receipt.checks.push({ name, passed: true, result });
  } catch (e) {
    receipt.checks.push({ name, passed: false, error: e.message });
    process.exitCode = 1;
  }
}
function run(label, argv, expected = 0) {
  assertLock();
  const started_at = new Date().toISOString();
  const p = spawnSync(argv[0], argv.slice(1), {
    timeout: 60000,
    maxBuffer: 16 << 20,
  });
  const streams = ["stdout", "stderr"].map((s) => {
    const file = `${output}/${label}.${s}.log`;
    const bytes = p[s] ?? Buffer.alloc(0);
    fs.writeFileSync(file, bytes, { flag: "wx" });
    return { file, bytes: bytes.length, sha256: sha(bytes) };
  });
  receipt.commands.push({
    label,
    argv,
    started_at,
    ended_at: new Date().toISOString(),
    exit_code: p.status,
    signal: p.signal,
    error: p.error?.code,
    streams,
  });
  assert.equal(p.status, expected, label);
  assert.equal(p.signal, null, label);
  return p.stdout.toString().trim();
}
const files = txt("ls-tree", "-r", "--name-only", root).split("\n");
const tracked = new Set(files);
const resolveFile = (name, manifest) => {
  const relocations = [
    [
      "evidence/sprint05a-b/llhttp-90/",
      "evidence/sprint05a-f/extended-01/b-llhttp/",
    ],
    [
      "evidence/sprint05a-f/candidate-90/",
      "evidence/sprint05a-f/extended-01/combined/",
    ],
  ];
  for (const [from, to] of relocations)
    if (name.startsWith(from)) return to + name.slice(from.length);
  return name.startsWith("evidence/") ||
    name.startsWith("docs/") ||
    name.startsWith("spikes/") ||
    name.startsWith("scripts/")
    ? name
    : path.join(path.dirname(manifest), name);
};
function verifyManifest(file, reader = read, resolve = resolveFile) {
  const bytes = reader(file);
  const entries = file.endsWith(".json")
    ? JSON.parse(bytes)
    : bytes
        .toString()
        .trim()
        .split("\n")
        .map((line) => {
          const m = /^([0-9a-f]{64})  (.+)$/.exec(line);
          assert.ok(m, file);
          return { file: m[2], sha256: m[1] };
        });
  for (const p of entries) {
    const target = resolve(p.file, file);
    assert.equal(sha(reader(target)), p.sha256, target);
  }
  return { file, sha256: sha(bytes), entries: entries.length };
}

try {
  if (mode === "audit") {
    await check("baseline-and-scope", () => {
      const inventory = txt("ls-tree", "-r", base).split("\n");
      const current = new Set(txt("ls-tree", "-r", root).split("\n"));
      const changed = inventory
        .filter((s) => !current.has(s))
        .map((s) => s.split("\t")[1]);
      assert.equal(inventory.length, 4003);
      assert.deepEqual(changed, [
        "IMPLEMENTATION_STATUS.md",
        "README.md",
        "docs/RISK_REGISTER.md",
        "scripts/sprint04c-gates.mjs",
      ]);
      const protectedPaths = [
        "spikes/edge-comparison",
        "spikes/pingora/lab.mjs",
        "spikes/envoy/config.mjs",
        "spikes/envoy/recovery-config.mjs",
        "spikes/envoy/recovery-launcher.mjs",
        "spikes/envoy/wire-probes.mjs",
        "spikes/envoy/wire-fixtures.mjs",
        "docs/THREAT_MODEL.md",
        "docs/QUALITY_GATES.md",
        "docs/ARCHITECTURE.md",
        "docs/CONFIG_PROTOCOL.md",
        ".github",
        "scripts/security-scan.sh",
        "scripts/history_scan_evidence.py",
      ];
      const protectedInventory = git(
        "ls-tree",
        "-r",
        base,
        "--",
        ...protectedPaths,
      );
      assert.deepEqual(
        git("ls-tree", "-r", root, "--", ...protectedPaths),
        protectedInventory,
      );
      const additions = txt(
        "diff",
        "--name-only",
        "--diff-filter=A",
        base,
        root,
      ).split("\n");
      for (const f of additions)
        assert.match(
          f,
          /^(evidence\/sprint05a-|docs\/(reports\/sprint05a-|sprints\/05a-execution\.md)|scripts\/sprint05a-|spikes\/envoy\/sprint05a-)/,
          f,
        );
      for (const f of txt("diff", "--name-only", base, root).split("\n")) {
        assert.ok(tracked.has(f), f);
        const bytes = read(f);
        assert.ok(!bytes.includes(0), `binary/NUL: ${f}`);
        assert.doesNotMatch(
          bytes.toString(),
          /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
          f,
        );
        assert.doesNotMatch(
          f,
          /(^|\/)(node_modules|target|\.local|\.next)(\/|$)|\.(exe|so|tar|zip|pem|key)$/i,
        );
      }
      run("immutable75", [
        process.execPath,
        "spikes/edge-comparison/extract-baseline.mjs",
        "--check",
      ]);
      return {
        baseline_objects: 4003,
        identical: 3999,
        reviewed_exceptions: changed,
        additions: additions.length,
        protected_inventory_sha256: sha(protectedInventory),
        baseline_inventory_sha256: sha(git("ls-tree", "-r", base)),
      };
    });
    await check("ancestry-and-clone", () => {
      assert.equal(cg("rev-parse", "HEAD"), root);
      assert.equal(cg("rev-parse", "HEAD^{tree}"), receipt.reviewed_tree);
      assert.equal(cg("status", "--porcelain", "--untracked-files=no"), "");
      assert.equal(cg("rev-parse", "--is-shallow-repository"), "false");
      assert.equal(
        fs.existsSync(path.join(clone, ".git/objects/info/alternates")),
        false,
      );
      const ancestry = txt("rev-list", root).split("\n");
      assert.deepEqual(
        cg("rev-list", "--all").split("\n").sort(),
        [...ancestry].sort(),
      );
      assert.deepEqual(
        cg("rev-list", "HEAD").split("\n").sort(),
        [...ancestry].sort(),
      );
      const results = bad.map((commit) => {
        const p = spawnSync("git", [
          "merge-base",
          "--is-ancestor",
          commit,
          root,
        ]);
        assert.equal(p.status, 1);
        const remote_refs = txt(
          "for-each-ref",
          "--format=%(refname)",
          "--contains",
          commit,
          "refs/remotes",
        );
        assert.equal(remote_refs, "");
        const oldLocalRefs = txt(
          "for-each-ref",
          "--format=%(refname)",
          "--contains",
          commit,
          "refs/heads",
        )
          .split("\n")
          .filter(Boolean);
        assert.ok(oldLocalRefs.length > 0);
        assert.ok(!ancestry.includes(commit));
        return {
          commit,
          root_ancestor: false,
          remote_refs: [],
          retained_local_refs: oldLocalRefs,
        };
      });
      // --no-hardlinks is verified on actual common loose/pack files, without reading their contents.
      const common = txt(
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      );
      let compared = 0;
      function walk(directory) {
        for (const e of fs.readdirSync(directory, { withFileTypes: true })) {
          const f = path.join(directory, e.name);
          if (e.isDirectory()) walk(f);
          else {
            const original = path.join(
              common,
              "objects",
              path.relative(path.join(clone, ".git/objects"), f),
            );
            if (!fs.existsSync(original)) continue;
            const a = fs.statSync(f),
              b = fs.statSync(original);
            assert.ok(
              a.dev !== b.dev || a.ino !== b.ino,
              "shared object hardlink",
            );
            compared++;
          }
        }
      }
      walk(path.join(clone, ".git/objects"));
      assert.ok(compared > 0);
      return {
        clone,
        tree_equal: true,
        full_ancestry_commits: ancestry.length,
        clone_refs: cg("for-each-ref", "--format=%(refname)").split("\n"),
        common_object_files_not_hardlinked: compared,
        rejected_commits: results,
        remote_scope: "locally available refs/remotes; no live fetch",
      };
    });
    await check("formatting-and-receipt-helper", async () => {
      const parserFile = path.join(
        clone,
        "node_modules/prettier/plugins/acorn.mjs",
      );
      const { parsers } = await import(parserFile);
      const clean = (v) => {
        if (Array.isArray(v)) return v.map(clean);
        if (v && typeof v === "object")
          return Object.fromEntries(
            Object.entries(v)
              .filter(
                ([k]) =>
                  ![
                    "start",
                    "end",
                    "loc",
                    "range",
                    "raw",
                    "comments",
                    "tokens",
                    "__contentEnd",
                  ].includes(k),
              )
              .map(([k, x]) => [k, clean(x)]),
          );
        return v;
      };
      const ast = async (b) =>
        clean(await parsers.acorn.parse(b.toString(), {}));
      const formatted = txt(
        "diff-tree",
        "--no-commit-id",
        "--name-only",
        "-r",
        "2993cc0",
      ).split("\n");
      assert.deepEqual(formatted, [
        "scripts/sprint04c-gates.mjs",
        "scripts/sprint05a-f-final-scan.mjs",
        "scripts/sprint05a-f-final-verify.mjs",
      ]);
      for (const f of formatted) {
        assert.deepEqual(
          await ast(git("show", `2993cc0^:${f}`)),
          await ast(git("show", `2993cc0:${f}`)),
          f,
        );
        assert.deepEqual(
          git("show", `2993cc0:${f}`),
          git("show", `${root}:${f}`),
          f,
        );
      }
      const helper = "scripts/sprint05a-receipt.mjs";
      assert.deepEqual(
        git("show", `cda448e:${helper}`),
        git("show", `${root}:${helper}`),
      );
      assert.deepEqual(
        await ast(git("show", `cda448e:${helper}`)),
        await ast(read(helper)),
      );
      return {
        formatted,
        pure_ast_equal: true,
        ast_parser_file: parserFile,
        ast_parser_sha256: sha(read(parserFile)),
        helper_unchanged_since: txt("rev-parse", "cda448e"),
        helper_sha256: sha(read(helper)),
        helper_scope:
          "static command receipt only; no implicit fixture lock, redaction or hosted acceptance",
      };
    });
    await check("all-sprint05a-manifests", () => {
      const manifests = files.filter(
        (f) =>
          /^evidence\/sprint05a-/.test(f) && /\/SHA256(SUMS|\.json)$/.test(f),
      );
      const results = manifests.map((f) => verifyManifest(f));
      return {
        manifests: results,
        total_entries: results.reduce((n, p) => n + p.entries, 0),
      };
    });
    await check("receipt-sources-streams-withheld", () => {
      const withheld = new Map();
      for (const n of ["01", "02"])
        for (const s of json(`evidence/sprint05a-a/attempt-${n}/withheld.json`)
          .streams) {
          assert.ok(!fs.existsSync(s.file) && !tracked.has(s.file));
          withheld.set(s.file, s);
        }
      assert.equal(withheld.size, 4);
      const used = new Set(),
        cache = new Map(),
        sources = [],
        trees = new Map(),
        unavailableTrees = [];
      let streamCount = 0;
      for (const f of files.filter(
        (p) =>
          /^evidence\/sprint05a-/.test(p) &&
          /\/(commands|receipt)\.json$/.test(p),
      )) {
        const r = json(f);
        let source = r.source_commit;
        // A's retired unsafe capture commit is deliberately unrecoverable.
        // Only its recorded implementation hashes can be checked against1626bf4.
        if (f === "evidence/sprint05a-a/attempt-02/commands.json") {
          assert.equal(source, "02b0a6582997aeb8ed7992ae4c6f9af34d6a0d11");
          assert.notEqual(
            spawnSync("git", ["cat-file", "-e", source]).status,
            0,
          );
          unavailableTrees.push({
            file: f,
            source_commit: source,
            source_tree: r.source_tree,
            eligible: false,
          });
          source = "1626bf4249554dfc6a6721aa3a3702630a1ca50b";
        }
        if (r.source_commit && r.source_tree) {
          if (source !== r.source_commit) {
            assert.match(
              read("evidence/sprint05a-a/CAPTURE-CORRECTION.md").toString(),
              /1626bf4249554dfc6a6721aa3a3702630a1ca50b/,
            );
          } else {
            if (!trees.has(r.source_commit))
              trees.set(
                r.source_commit,
                txt("rev-parse", `${r.source_commit}^{tree}`),
              );
            assert.equal(trees.get(r.source_commit), r.source_tree, f);
          }
        }
        for (const p of r.sources ?? r.source_hashes ?? []) {
          const spec = `${source}:${p.file}`;
          if (!cache.has(spec)) cache.set(spec, sha(git("show", spec)));
          assert.equal(cache.get(spec), p.sha256, `${f}: ${p.file}`);
          sources.push(spec);
        }
        for (const c of r.commands ?? [r]) {
          if (c.streams && !Array.isArray(c.streams)) {
            for (const [name, p] of Object.entries(c.streams)) {
              assert.ok(["stdout", "stderr"].includes(name));
              assert.ok(
                Number.isInteger(p.offset) && Number.isInteger(p.length),
              );
              const bytes = read(
                path.join(path.dirname(f), `${name}.log`),
              ).subarray(p.offset, p.offset + p.length);
              assert.equal(bytes.length, p.length, f);
              assert.equal(sha(bytes), p.sha256, `${f}: ${c.label}/${name}`);
              streamCount++;
            }
          }
          const streams = Array.isArray(c.streams)
            ? c.streams
            : [c.stdout, c.stderr].filter((p) => p?.file);
          for (const p of streams) {
            if (!p?.file || !p.sha256) continue;
            const target = resolveFile(p.file, f);
            if (withheld.has(target)) {
              const w = withheld.get(target);
              assert.equal(w.sha256, p.sha256);
              assert.equal(w.bytes, p.bytes);
              used.add(target);
              continue;
            }
            const bytes = read(target);
            assert.equal(sha(bytes), p.sha256, `${f}: ${target}`);
            if (p.bytes !== undefined)
              assert.equal(bytes.length, p.bytes, target);
            streamCount++;
          }
        }
      }
      assert.equal(used.size, 4);
      return {
        source_hashes: sources.length,
        unique_source_blobs: cache.size,
        source_trees: trees.size,
        unavailable_source_trees: unavailableTrees,
        verified_streams: streamCount,
        withheld: [...withheld.values()],
        withheld_eligible: false,
      };
    });
    await check("completed-root-gates02", () => {
      const dir = "evidence/sprint05a-root/gates-02";
      const r = JSON.parse(
        fs.readFileSync(path.join(clone, dir, "commands.json")),
      );
      assert.ok(
        r.ended_at && r.lock_held_through_cleanup,
        "root gate run must finish first",
      );
      assert.equal(r.source_commit, root);
      assert.equal(r.source_tree, receipt.reviewed_tree);
      assert.equal(r.tracked_clean, true);
      const manifests = verifyManifest(
        `${dir}/SHA256SUMS`,
        (f) => fs.readFileSync(path.join(clone, f)),
        (f) => f,
      );
      assert.deepEqual(
        r.commands.map((p) => [p.label, p.command, p.args]),
        [
          ["check", "make", ["check"]],
          ["security-scan", "make", ["security-scan"]],
          ["cleanup", "make", ["dev-down"]],
          [
            "cleanup-volumes",
            "docker",
            [
              "compose",
              "--env-file",
              ".local/compose.env",
              "--env-file",
              ".local/fixture-images.env",
              "-f",
              "infra/compose/compose.yaml",
              "down",
              "--volumes",
              "--remove-orphans",
            ],
          ],
        ],
      );
      for (const c of r.commands) {
        assert.equal(c.exit_code, 0, c.label);
        assert.equal(c.signal, null, c.label);
        for (const s of c.streams)
          assert.equal(
            sha(fs.readFileSync(path.join(clone, s.file))),
            s.sha256,
            s.file,
          );
      }
      assert.equal(r.passed, true);
      assert.ok(!r.error && !r.cleanup_errors?.length);
      for (const k of ["containers", "networks", "volumes"])
        assert.deepEqual(r[`remaining_project_${k}`], []);
      assert.equal(r.private_material_check.matches, 0);
      for (const p of r.private_fixture_cleanup) {
        assert.equal(p.exists, false);
        assert.equal(fs.existsSync(path.join(clone, p.file)), false, p.file);
      }
      const security = path.join(clone, dir, "security");
      for (const f of ["secrets.json", "history-secrets.json"])
        assert.deepEqual(
          JSON.parse(fs.readFileSync(path.join(security, f))),
          [],
        );
      const history = fs.readFileSync(
        path.join(security, "history-gitleaks.log"),
        "utf8",
      );
      assert.match(history, /[1-9][0-9]* commits scanned/);
      assert.match(history, /no leaks found/);
      assert.doesNotMatch(history, /leaks found: [1-9]/);
      const scan = fs.readFileSync(
        path.join(clone, dir, "security-scan.stdout.log"),
        "utf8",
      );
      assert.doesNotMatch(scan, /FAIL/);
      for (const label of [
        "worktree-secrets",
        "history-git-preflight",
        "history-secrets",
        "repository-sbom",
        "filesystem-vulnerabilities",
        "envoy-spike-vulnerabilities",
        "envoy-spike-sbom",
        ...[1, 2, 3, 4].flatMap((n) => [
          `image-${n}-vulnerabilities`,
          `image-${n}-sbom`,
        ]),
      ])
        assert.ok(scan.includes(`PASS ${label}`), label);
      const reports = fs
        .readdirSync(security)
        .filter((f) => /vulnerabilities\.json$/.test(f));
      let highCritical = 0;
      for (const f of reports)
        for (const item of JSON.parse(fs.readFileSync(path.join(security, f)))
          .Results ?? [])
          for (const v of item.Vulnerabilities ?? [])
            if (["HIGH", "CRITICAL"].includes(v.Severity)) highCritical++;
      assert.equal(highCritical, 0);
      const old = json("evidence/sprint05a-root/gates-01/commands.json");
      assert.equal(old.passed, false);
      const oldFindings = json(
        "evidence/sprint05a-root/gates-01/security/history-secrets.json",
      );
      assert.deepEqual(
        oldFindings.map((p) => p.Commit).sort(),
        [...bad].sort(),
      );
      return {
        source_commit: r.source_commit,
        source_tree: r.source_tree,
        started_at: r.started_at,
        ended_at: r.ended_at,
        receipt_sha256: sha(
          fs.readFileSync(path.join(clone, dir, "commands.json")),
        ),
        manifest: manifests,
        exits: r.commands.map((p) => ({
          label: p.label,
          exit_code: p.exit_code,
        })),
        history_log_sha256: sha(Buffer.from(history)),
        history_available: fs
          .readFileSync(
            path.join(security, "history-git-preflight.log"),
            "utf8",
          )
          .trim(),
        vulnerability_reports: reports.length,
        high_critical_findings: highCritical,
        private_cleanup_paths: r.private_fixture_cleanup.length,
        earlier_gate_rejected: true,
        local_gates_accept: true,
      };
    });
    await check("post-gate-owned-inventories", () => {
      const inventories = [];
      for (const kind of ["container", "network", "volume"])
        for (const label of [
          "com.docker.compose.project",
          "aegisgate.fixture.owner",
        ]) {
          const ids = run(`inventory-${kind}-${label}`, [
            "docker",
            kind,
            "ls",
            "-q",
            "--filter",
            `label=${label}=aegisgate-05a-root`,
          ]);
          assert.equal(ids, "");
          inventories.push({ kind, label, remaining: [] });
        }
      return inventories;
    });
  }
  await check("independent-worktree-secret-scan", () => {
    const scanner =
      "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f";
    const name = `aegisgate-05a-gate-audit-${process.pid}`;
    run("gitleaks", [
      "docker",
      "run",
      "--rm",
      "--pull",
      "never",
      "--network",
      "none",
      "--name",
      name,
      "--user",
      `${process.getuid()}:${process.getgid()}`,
      "-v",
      `${process.cwd()}:/repo:ro`,
      scanner,
      "dir",
      "/repo",
      "--config",
      "/repo/.github/gitleaks.toml",
      "--redact",
      "--no-banner",
    ]);
    assert.equal(
      run("scanner-cleanup", [
        "docker",
        "ps",
        "-aq",
        "--filter",
        `name=^/${name}$`,
      ]),
      "",
    );
    return {
      scanner,
      container_absent: true,
      scope: "review worktree files; retained bad history evaluated separately",
    };
  });
} finally {
  assertLock();
  receipt.ended_at = new Date().toISOString();
  receipt.lock_held_through_scanner_inventory_hashing = true;
  receipt.passed = receipt.checks.every((p) => p.passed);
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(receipt, null, 2) + "\n",
  );
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    fs
      .readdirSync(output)
      .sort()
      .map((f) => `${sha(read(`${output}/${f}`))}  ${output}/${f}\n`)
      .join(""),
  );
}
console.log(
  JSON.stringify({
    evidence: output,
    passed: receipt.passed,
    checks: receipt.checks.map(({ name, passed, error }) => ({
      name,
      passed,
      error,
    })),
  }),
);
