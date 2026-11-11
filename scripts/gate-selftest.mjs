// Prove checks reject deliberate defects without editing the repository.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { validator, assertCompatible, root, source } from "./contracts.mjs";

const prettier = root + "/node_modules/prettier/bin/prettier.cjs";
function prettierCheck(input) {
  return spawnSync(
    process.execPath,
    [prettier, "--check", "--stdin-filepath", "gate-selftest.json"],
    {
      cwd: root,
      input,
      encoding: "utf8",
    },
  );
}
const brokenFormatting = prettierCheck('{"bad":true}');
assert.equal(brokenFormatting.status, 1, brokenFormatting.stderr);
const fixedFormatting = prettierCheck('{ "bad": true }\n');
assert.equal(fixedFormatting.status, 0, fixedFormatting.stderr);

const vetInput =
  'package selftest\nimport "fmt"\nfunc main() { fmt.Printf("%d", "not-a-number") }\n';
const cleanInput =
  'package selftest\nimport "fmt"\nfunc main() { fmt.Printf("%s", "a-string") }\n';
const os = await import("node:os");
const path = await import("node:path");
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "aegis-gate-selftest-"));
try {
  await fs.writeFile(
    path.join(temp, "go.mod"),
    "module aegisgate.dev/selftest\ngo 1.27.4\n",
  );
  await fs.writeFile(path.join(temp, "main.go"), vetInput);
  const brokenLint = spawnSync("go", ["vet", "./..."], {
    cwd: temp,
    encoding: "utf8",
  });
  assert.notEqual(
    brokenLint.status,
    0,
    "go vet accepted known format mismatch",
  );
  assert.match(brokenLint.stderr, /format %d.*string/);
  await fs.writeFile(path.join(temp, "main.go"), cleanInput);
  const fixedLint = spawnSync("go", ["vet", "./..."], {
    cwd: temp,
    encoding: "utf8",
  });
  assert.equal(fixedLint.status, 0, fixedLint.stderr);
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}

const spec = JSON.parse(await fs.readFile(source, "utf8"));
const brokenSchema = structuredClone(spec);
delete brokenSchema.components.schemas.ErrorDetail.required;
assert.throws(
  () => assertCompatible(spec, brokenSchema),
  /Breaking schema change/,
);
assert.doesNotThrow(() => assertCompatible(spec, structuredClone(spec)));
const valid = await validator();
const fixture = JSON.parse(
  await fs.readFile(root + "/packages/contracts/fixtures/error.json", "utf8"),
);
assert.equal(valid({ ...fixture, tenant_id: "injected" }), false);
assert.equal(valid(fixture), true);
console.log(
  "PASS: formatting, Go vet, schema compatibility and negative fixture reject deliberate defects; restored inputs pass",
);

// A synthetic local OSV database proves scanner findings produce a failing gate.
// This checks the gate mechanism, not a third-party service or actual exploit.
if (process.argv.includes("--scanner")) {
  const scanner = root + "/.local/bin/govulncheck";
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "aegis-scanner-selftest-"),
  );
  const database = path.join(directory, "db");
  const modified = "2026-11-01T00:00:00Z";
  const id = "GO-2099-0001";
  try {
    await fs.mkdir(path.join(database, "index"), { recursive: true });
    await fs.mkdir(path.join(database, "ID"));
    await fs.writeFile(
      path.join(directory, "go.mod"),
      "module aegisgate.dev/scanner-fixture\ngo 1.27.4\n",
    );
    await fs.writeFile(
      path.join(directory, "main.go"),
      'package main\nimport "fmt"\nfunc main() { fmt.Println("local scanner fixture") }\n',
    );
    await fs.writeFile(
      path.join(database, "index", "db.json"),
      JSON.stringify({ modified }),
    );
    const moduleIndex = [
      { path: "stdlib", vulns: [{ id, modified, fixed: "999.0.0" }] },
    ];
    await fs.writeFile(
      path.join(database, "index", "modules.json"),
      JSON.stringify(moduleIndex),
    );
    await fs.writeFile(
      path.join(database, "ID", id + ".json"),
      JSON.stringify({
        schema_version: "1.3.1",
        id,
        modified,
        published: modified,
        summary: "Synthetic local scanner gate fixture; not a real advisory",
        database_specific: {
          url: "https://example.invalid/synthetic-local-fixture",
        },
        details: "Only verifies that scanner findings block the gate.",
        affected: [
          {
            package: { name: "stdlib", ecosystem: "Go" },
            ranges: [
              {
                type: "SEMVER",
                events: [{ introduced: "0" }, { fixed: "999.0.0" }],
              },
            ],
            ecosystem_specific: { packages: [{ path: "fmt" }] },
          },
        ],
      }),
    );
    const args = ["-db=file://" + database, "-scan=module"];
    const toolchain = spawnSync("go", ["env", "GOROOT"], {
      encoding: "utf8",
      env: { ...process.env, GOTOOLCHAIN: "go1.27.4" },
    });
    assert.equal(toolchain.status, 0, toolchain.stderr);
    const options = {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH:
          path.join(toolchain.stdout.trim(), "bin") +
          path.delimiter +
          process.env.PATH,
        GOTOOLCHAIN: "local",
        GOPROXY: "off",
        GOSUMDB: "off",
      },
    };
    const detected = spawnSync(scanner, args, options);
    assert.equal(detected.status, 3, detected.stderr + detected.stdout);
    assert.match(detected.stdout, /GO-2099-0001/);
    await fs.writeFile(path.join(database, "index", "modules.json"), "[]");
    const restored = spawnSync(scanner, args, options);
    assert.equal(restored.status, 0, restored.stderr + restored.stdout);
    console.log(
      "PASS: govulncheck text gate rejects synthetic local advisory with exit3; clean database passes",
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
