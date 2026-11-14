import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";

// Adapted from the accepted 04C E collector; its source and evidence stay intact.
const attempt = process.argv[2];
assert.match(attempt ?? "", /^attempt-[0-9]{2}$/);
const lock = "/tmp/aegisgate-sprint02-fixtures.lock";
if (process.argv[3] !== "--locked") {
  console.log(`Waiting for exclusive fixture lock: ${lock}`);
  const p = spawnSync(
    "flock",
    [
      "--exclusive",
      lock,
      process.execPath,
      import.meta.filename,
      attempt,
      "--locked",
      new Date().toISOString(),
    ],
    { stdio: "inherit" },
  );
  process.exit(p.status ?? 1);
}
assertLock();
const cwd = process.cwd();
const out = path.join(cwd, "evidence/sprint05a-e", attempt);
const baseline = "541d1d915ce6a3b679dc3fed3ea0a98f908ce001";
const start = "8e77a4f";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (...args) => {
  const p = spawnSync("git", args, { encoding: "utf8" });
  assert.equal(p.status, 0);
  return p.stdout.trim();
};
assert.equal(git("status", "--porcelain"), "", "Commit source before proof");
assert.ok(!fs.existsSync(out), "fresh attempt required");
const privateNames = [
  "postgres-password",
  "redis-password",
  "nats-token",
  "compose.env",
  "redis.conf",
  "nats.conf",
];
for (const name of [...privateNames, "pki"])
  assert.ok(
    !fs.existsSync(path.join(cwd, ".local", name)),
    "Existing private fixture state must not be overwritten",
  );
fs.mkdirSync(out);
const node = process.execPath,
  npm = path.join(path.dirname(node), "npm");
const env = {
  ...process.env,
  PATH: `${path.dirname(node)}:/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin:${process.env.PATH}`,
  AEGIS_NODE_BIN: node,
  GOTOOLCHAIN: "go1.27.4",
  COMPOSE_PROJECT_NAME: `aegisgate-05a-e-${attempt}-${randomBytes(6).toString("hex")}`,
};
const safeEnv = Object.fromEntries(
  ["PATH", "AEGIS_NODE_BIN", "GOTOOLCHAIN", "COMPOSE_PROJECT_NAME"].map((k) => [
    k,
    env[k],
  ]),
);
const receipt = {
  baseline_commit: baseline,
  source_commit: git("rev-parse", "HEAD"),
  source_tree: git("rev-parse", "HEAD^{tree}"),
  tracked_clean: true,
  cwd,
  argv: process.argv,
  queue_started_at: process.argv[4],
  started_at: new Date().toISOString(),
  node: process.version,
  fixture_lock: lock,
  compose_project: env.COMPOSE_PROJECT_NAME,
  environment: safeEnv,
  tools: {},
  commands: [],
};
const write = () =>
  fs.writeFileSync(
    path.join(out, "commands.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
for (const name of ["stdout.log", "stderr.log"])
  fs.writeFileSync(path.join(out, name), "", { flag: "wx" });
const inventory = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? inventory(path.join(dir, e.name))
        : [path.join(dir, e.name)],
    );
function run(label, argv, options = {}) {
  assertLock();
  const started_at = new Date().toISOString();
  const p = spawnSync(argv[0], argv.slice(1), {
    cwd,
    env,
    maxBuffer: 32 << 20,
    timeout: 600000,
    ...options,
  });
  const streams = {};
  for (const stream of ["stdout", "stderr"]) {
    const file = `${stream}.log`,
      bytes = p[stream] ?? Buffer.alloc(0),
      offset = fs.statSync(path.join(out, file)).size;
    fs.appendFileSync(path.join(out, file), bytes);
    streams[stream] = {
      file,
      offset,
      length: bytes.length,
      sha256: sha(bytes),
    };
  }
  receipt.commands.push({
    label,
    argv,
    cwd: options.cwd ?? cwd,
    started_at,
    ended_at: new Date().toISOString(),
    exit_code: p.status,
    environment: {
      ...safeEnv,
      ...(options.env?.AEGIS_TENANCY_INTEGRATION
        ? { AEGIS_TENANCY_INTEGRATION: options.env.AEGIS_TENANCY_INTEGRATION }
        : {}),
    },
    signal: p.signal,
    error_code: p.error?.code ?? null,
    streams,
  });
  write();
  assertLock();
  console.log(`${label}: ${p.status}`);
  return p;
}
function pass(label, argv, options) {
  const p = run(label, argv, options);
  assert.equal(p.status, 0, label);
  return p;
}
function held(label) {
  assert.equal(
    run(`lock-${label}`, ["flock", "--nonblock", lock, "true"]).status,
    1,
  );
}
function bindTool(tool) {
  const found = spawnSync("which", [tool], { env, encoding: "utf8" });
  assert.equal(found.status, 0, `Missing tool: ${tool}`);
  const executable = fs.realpathSync(found.stdout.trim());
  receipt.tools[tool] = {
    executable,
    sha256: sha(fs.readFileSync(executable)),
  };
}
function ownSource() {
  const files = git("diff", "--name-only", start, "HEAD")
    .split("\n")
    .filter(Boolean);
  assert.ok(
    files.every(
      (f) =>
        f.startsWith("evidence/sprint05a-e/") ||
        /^scripts\/sprint05a-e-[\w.-]+$/.test(f) ||
        f === "docs/reports/sprint05a-e-regressions.md",
    ),
    "Unowned change",
  );
  const protectedPaths = [
    "spikes/edge-comparison",
    "spikes/pingora/lab.mjs",
    "spikes/envoy/config.mjs",
    "spikes/envoy/recovery-config.mjs",
    "spikes/envoy/recovery-launcher.mjs",
    "spikes/envoy/wire-probes.mjs",
    "spikes/envoy/wire-fixtures.mjs",
  ];
  const objects = git("ls-tree", "-r", baseline, "--", ...protectedPaths);
  assert.equal(git("ls-tree", "-r", "HEAD", "--", ...protectedPaths), objects);
  assert.equal(
    objects,
    fs
      .readFileSync(
        "evidence/sprint05a-root/baseline-objects/stdout.log",
        "utf8",
      )
      .trim(),
  );
  receipt.protected_objects_sha256 = sha(Buffer.from(objects + "\n"));
}
function verifyStreams() {
  const streams = Object.fromEntries(
    ["stdout", "stderr"].map((s) => [
      s,
      fs.readFileSync(path.join(out, s + ".log")),
    ]),
  );
  const offsets = { stdout: 0, stderr: 0 };
  for (const c of receipt.commands) {
    const expected =
      c.label.startsWith("lock-") || c.label === "typescript7-strict-resolution"
        ? 1
        : 0;
    assert.equal(c.exit_code, expected, c.label);
    assert.equal(c.signal, null);
    assert.equal(c.error_code, null);
    for (const [s, part] of Object.entries(c.streams)) {
      assert.equal(part.offset, offsets[s]);
      const bytes = streams[s].subarray(part.offset, part.offset + part.length);
      assert.equal(bytes.length, part.length);
      assert.equal(sha(bytes), part.sha256);
      offsets[s] += part.length;
    }
  }
  for (const s of Object.keys(streams))
    assert.equal(offsets[s], streams[s].length);
  receipt.verified_stream_slices = receipt.commands.length * 2;
}
const compose = [
  "docker",
  "compose",
  "--env-file",
  ".local/compose.env",
  "--env-file",
  ".local/fixture-images.env",
  "-f",
  "infra/compose/compose.yaml",
];
const oldLockPath = "evidence/sprint04c-e/attempt-02/fixture-images.lock.json";
const oldLock = JSON.parse(fs.readFileSync(oldLockPath));
let up = false,
  passed = false;
const priorImages = new Map();
try {
  held("setup");
  ownSource();
  for (const tool of [
    "node",
    "npm",
    "go",
    "gofmt",
    "rustc",
    "cargo",
    "python3",
    "docker",
    "git",
    "make",
    "bash",
    "curl",
    "gh",
    "flock",
  ])
    bindTool(tool);
  for (const [label, argv] of [
    ["go", ["go", "version"]],
    ["rust", ["rustc", "+1.99.1", "--version"]],
    ["python", ["python3", "--version"]],
    ["git", ["git", "--version"]],
    ["npm", [npm, "--version"]],
    [
      "docker",
      [
        "docker",
        "version",
        "--format",
        "{{.Client.Version}} {{.Server.Version}}",
      ],
    ],
    ["compose", ["docker", "compose", "version"]],
  ])
    pass(`${label}-version`, argv);
  pass("immutable-baseline", [
    node,
    "spikes/edge-comparison/extract-baseline.mjs",
    "--check",
  ]);
  pass("source-scope", [
    "git",
    "diff",
    "--exit-code",
    start,
    "HEAD",
    "--",
    ".",
    ":!scripts/sprint05a-e-*",
    ":!evidence/sprint05a-e",
    ":!docs/reports/sprint05a-e-regressions.md",
  ]);
  for (const [label, dir] of [
    ["root", cwd],
    ["dashboard", path.join(cwd, "apps/dashboard")],
    ["spike", path.join(cwd, "spikes/pingora")],
  ])
    pass(
      `${label}-install`,
      [npm, "ci", "--ignore-scripts", "--strict-peer-deps"],
      { cwd: dir },
    );
  for (const pkg of [
    "typescript",
    "typescript-eslint",
    "@typescript-eslint/parser",
    "@typescript-eslint/eslint-plugin",
    "@typescript-eslint/typescript-estree",
  ])
    pass(`metadata-${pkg}`, [
      npm,
      "view",
      pkg,
      "version",
      "peerDependencies",
      "engines",
      "dist.integrity",
      "--json",
    ]);
  const revision = pass("official-compatibility-revision", [
    "gh",
    "api",
    "repos/typescript-eslint/typescript-eslint/commits/main",
    "--jq",
    ".sha",
  ])
    .stdout.toString()
    .trim();
  assert.match(revision, /^[a-f0-9]{40}$/);
  pass("official-compatibility-doc", [
    "curl",
    "--fail",
    "--silent",
    "--show-error",
    "--location",
    `https://raw.githubusercontent.com/typescript-eslint/typescript-eslint/${revision}/docs/users/Dependency_Versions.mdx`,
  ]);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aegisgate-05a-e-ts7-"));
  try {
    for (const f of ["package.json", "package-lock.json"])
      fs.copyFileSync(path.join(cwd, "apps/dashboard", f), path.join(temp, f));
    const p = run(
      "typescript7-strict-resolution",
      [
        npm,
        "install",
        "typescript@7.0.2",
        "--package-lock-only",
        "--dry-run",
        "--ignore-scripts",
        "--strict-peer-deps",
      ],
      { cwd: temp },
    );
    assert.equal(p.status, 1, "Changed compatibility requires scoped review");
    assert.match(p.stderr.toString(), /ERESOLVE/);
    assert.match(p.stderr.toString(), />=4\.8\.4 <6\.1\.0/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  pass("dependency-tree", [
    npm,
    "--prefix",
    "apps/dashboard",
    "ls",
    "typescript",
    "typescript-eslint",
    "@typescript-eslint/parser",
    "@typescript-eslint/eslint-plugin",
    "minimatch",
    "--all",
  ]);
  for (const service of ["postgres", "demo-origin"]) {
    const image = oldLock[service].image_id;
    const p = pass(`cached-image-${service}`, [
      "docker",
      "image",
      "inspect",
      image,
      "--format",
      "{{.Id}}",
    ]);
    assert.equal(p.stdout.toString().trim(), image);
    priorImages.set(service, image);
  }
  pass("fixture-images", ["make", "fixture-images"]);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(".local/fixture-images.lock.json")),
    oldLock,
    "Changed image requires new image scan",
  );
  fs.copyFileSync(
    ".local/fixture-images.lock.json",
    path.join(out, "fixture-images.lock.json"),
  );
  const refs = git(
    "ls-files",
    "evidence/sprint04c-root/gates-01/security",
    oldLockPath,
    "evidence/sprint04c-e/attempt-02/commands.json",
    "evidence/sprint05a-root/baseline-objects",
    "evidence/sprint05a-root/baseline-tests",
  )
    .split("\n")
    .filter(Boolean);
  fs.writeFileSync(
    path.join(out, "baseline-references.json"),
    JSON.stringify(
      {
        commit: baseline,
        reason:
          "Unchanged source/image identity. Historical image/SBOM results are references, not current advisory clearance; dependency audits below are fresh.",
        files: refs.map((file) => {
          const bytes = fs.readFileSync(file);
          const exists =
            spawnSync("git", ["cat-file", "-e", `${baseline}:${file}`])
              .status === 0;
          const commit = exists ? baseline : receipt.source_commit;
          assert.equal(
            git("rev-parse", `${commit}:${file}`),
            git("hash-object", file),
          );
          return {
            file,
            commit,
            bytes: bytes.length,
            sha256: sha(bytes),
            blob: git("hash-object", file),
          };
        }),
      },
      null,
      2,
    ) + "\n",
  );
  for (const kind of ["container", "network", "volume"]) {
    const p = pass(`initial-${kind}`, [
      "docker",
      kind,
      "ls",
      "--filter",
      `label=com.docker.compose.project=${env.COMPOSE_PROJECT_NAME}`,
      "--format",
      "{{.ID}}",
    ]);
    assert.equal(p.stdout.toString().trim(), "");
  }
  up = true;
  pass("compose-up", [
    ...compose,
    "up",
    "-d",
    "--wait",
    "--wait-timeout",
    "90",
  ]);
  pass("fixture-tls-credentials", ["python3", "scripts/integration.py"]);
  pass("fixture-fresh-restart", [
    "python3",
    "scripts/fixture-image-integration.py",
  ]);
  pass("fixture-stale-volume-image-network", [
    "python3",
    "scripts/sprint05a-e-fixtures.py",
  ]);
  held("regression");
  pass("format", ["make", "fmt-check"]);
  const packages = [
    "./apps/control-api/...",
    "./apps/config-publisher/...",
    "./internal/...",
    "./packages/test-fixtures/...",
  ];
  pass("go-vet", ["go", "vet", ...packages]);
  const go = pass(
    "go-full-race-integration",
    ["go", "test", "-race", "-v", ...packages, "-count=1"],
    { env: { ...env, AEGIS_TENANCY_INTEGRATION: "1" } },
  ).stdout.toString();
  assert.ok(!/--- (FAIL|SKIP):/.test(go));
  receipt.go = {
    packages: (go.match(/^ok\s/gm) ?? []).length,
    top_level: (go.match(/^--- PASS:/gm) ?? []).length,
    subtests: (go.match(/^\s+--- PASS:/gm) ?? []).length,
    skipped: 0,
  };
  assert.deepEqual(receipt.go, {
    packages: 11,
    top_level: 88,
    subtests: 151,
    skipped: 0,
  });
  pass("edge-test", [
    "cargo",
    "+1.99.1",
    "test",
    "--workspace",
    "--locked",
    "--manifest-path",
    "apps/edge/Cargo.toml",
  ]);
  for (const f of [
    "dev-secrets.test.py",
    "image_identity_test.py",
    "git_history_preflight_test.py",
  ])
    pass(f, ["python3", `scripts/${f}`, "-v"]);
  pass("contracts-check", [npm, "run", "contracts:check"]);
  pass("contracts-test", [npm, "run", "contracts:test"]);
  pass("contracts-integration", [node, "scripts/contract-integration.mjs"]);
  pass("golden", [node, "internal/configsnapshot/testdata/verify-vector.mjs"]);
  for (const s of ["lint", "typecheck", "test", "build", "integration"])
    pass(`dashboard-${s}`, [npm, "--prefix", "apps/dashboard", "run", s]);
  for (const dest of [
    ".local/bin/govulncheck",
    ".local/tools/bin/cargo-audit",
  ]) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join("/home/tiecont/Projects/aegis-gate", dest), dest);
    fs.chmodSync(dest, 0o755);
    receipt.tools[dest] = {
      executable: path.resolve(dest),
      sha256: sha(fs.readFileSync(dest)),
    };
  }
  pass("govulncheck-version", [".local/bin/govulncheck", "-version"]);
  pass("cargo-audit-version", [".local/tools/bin/cargo-audit", "--version"]);
  const dependencies = run("dependency-scans", [
    "bash",
    "scripts/security-scan.sh",
    "dependencies",
  ]);
  fs.mkdirSync(path.join(out, "dependencies"));
  for (const f of fs.readdirSync(".local/evidence/security"))
    if (/\.(log|json)$/.test(f))
      fs.copyFileSync(
        path.join(".local/evidence/security", f),
        path.join(out, "dependencies", f),
      );
  assert.equal(dependencies.status, 0, "dependency-scans");
  pass("source-unchanged", ["git", "diff", "--exit-code", "HEAD"]);
  ownSource();
  passed = true;
} catch (error) {
  receipt.error = error.stack;
  console.error(error.message);
} finally {
  const cleanup = (label, fn) => {
    try {
      fn();
    } catch (error) {
      passed = false;
      (receipt.cleanup_errors ??= []).push({ label, error: error.message });
      console.error(`${label}: ${error.message}`);
    }
  };
  if (up)
    cleanup("compose", () =>
      pass("cleanup", [...compose, "down", "--volumes", "--remove-orphans"]),
    );
  for (const kind of ["container", "network", "volume"])
    for (const label of [
      "com.docker.compose.project",
      "aegisgate.fixture.owner",
    ])
      cleanup(`${kind}-${label}`, () => {
        const p = pass(`cleanup-${kind}-${label}`, [
          "docker",
          kind,
          "ls",
          "--filter",
          `label=${label}=${env.COMPOSE_PROJECT_NAME}`,
          "--format",
          "{{.ID}}",
        ]);
        assert.equal(p.stdout.toString().trim(), "");
      });
  cleanup("image-retention", () => {
    for (const [service, image] of priorImages) {
      const p = pass(`cleanup-cached-image-${service}`, [
        "docker",
        "image",
        "inspect",
        image,
        "--format",
        "{{.Id}}",
      ]);
      assert.equal(p.stdout.toString().trim(), image);
    }
    receipt.image_cleanup =
      "No image/tag created: exact pre-existing immutable cached images reused and retained";
  });
  cleanup("secret-values", () => {
    const secrets = [
      "postgres-password",
      "redis-password",
      "nats-token",
      "pki/valid.jwt",
    ]
      .map((f) => path.join(cwd, ".local", f))
      .filter((f) => fs.existsSync(f))
      .map((f) => fs.readFileSync(f).toString().trim())
      .filter(Boolean);
    for (const f of [
      ...inventory(path.join(cwd, "evidence/sprint05a-e")),
      path.join(cwd, "scripts/sprint05a-e-regressions.mjs"),
      path.join(cwd, "scripts/sprint05a-e-fixtures.py"),
      path.join(cwd, "docs/reports/sprint05a-e-regressions.md"),
    ]) {
      const b = fs.readFileSync(f);
      assert.ok(
        !secrets.some((value) => b.includes(value)),
        "Generated private value in owned additions",
      );
      assert.ok(
        !/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(b.toString()),
        "Private key marker",
      );
    }
    receipt.credential_matches = 0;
    receipt.private_key_matches = 0;
    receipt.private_values_checked = secrets.length;
  });
  cleanup("private-cleanup", () => {
    for (const f of privateNames)
      fs.rmSync(path.join(cwd, ".local", f), { force: true });
    fs.rmSync(path.join(cwd, ".local/pki"), { recursive: true, force: true });
    assert.ok(
      [...privateNames, "pki"].every(
        (f) => !fs.existsSync(path.join(cwd, ".local", f)),
      ),
    );
    receipt.owned_private_material_removed = true;
  });
  cleanup("owned-gitleaks", () => {
    const stage = path.join(cwd, ".local/sprint05a-e-secret-scan");
    assert.ok(!fs.existsSync(stage));
    fs.mkdirSync(stage, { recursive: true });
    try {
      const files = [
        ...inventory(path.join(cwd, "evidence/sprint05a-e")),
        ...git(
          "ls-files",
          "scripts/sprint05a-e-*",
          "docs/reports/sprint05a-e-regressions.md",
        )
          .split("\n")
          .filter(Boolean)
          .map((f) => path.join(cwd, f)),
      ];
      receipt.secret_scan_input_files = files.length;
      for (const file of files) {
        const dest = path.join(stage, path.relative(cwd, file));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(file, dest);
      }
      const image =
        "ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f";
      pass("owned-gitleaks", [
        "docker",
        "run",
        "--rm",
        "--name",
        env.COMPOSE_PROJECT_NAME + "-gitleaks",
        "--network",
        "none",
        "-v",
        stage + ":/input:ro",
        "-v",
        path.join(cwd, ".github/gitleaks.toml") + ":/config:ro",
        "-v",
        out + ":/reports",
        image,
        "dir",
        "/input",
        "--config",
        "/config",
        "--redact",
        "--report-format",
        "json",
        "--report-path",
        "/reports/secrets.json",
        "--no-banner",
      ]);
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(out, "secrets.json"))),
        [],
      );
    } finally {
      fs.rmSync(stage, { recursive: true, force: true });
      receipt.secret_scan_stage_removed = !fs.existsSync(stage);
    }
  });
  cleanup("final-verification", () => {
    held("after-cleanup");
    verifyStreams();
    ownSource();
    assertLock();
  });
  receipt.passed = passed;
  receipt.lock_held_through_cleanup = true;
  receipt.ended_at = new Date().toISOString();
  write();
  fs.writeFileSync(
    path.join(out, "SHA256SUMS"),
    inventory(out)
      .sort()
      .map((f) => `${sha(fs.readFileSync(f))}  ${path.relative(cwd, f)}\n`)
      .join(""),
  );
  for (const line of fs
    .readFileSync(path.join(out, "SHA256SUMS"), "utf8")
    .trim()
    .split("\n")) {
    const [expected, file] = line.split("  ");
    assert.equal(sha(fs.readFileSync(file)), expected);
  }
  assertLock();
}
process.exitCode = passed ? 0 : 1;
