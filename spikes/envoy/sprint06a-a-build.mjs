import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { assertLock } from "./sprint06a-a-fixtures.mjs";
import { command, hash, rawCommand } from "./sprint05d-a-build.mjs";
export { command, hash, rawCommand };

export async function build(directory, record) {
  assertLock();
  assert.ok(process.env.TMPDIR.startsWith("/home/"));
  const pins = JSON.parse(
    fs.readFileSync("evidence/sprint05a-b/source-01/sources.json"),
  );
  const upstream = path.join(directory, "upstream");
  fs.mkdirSync(upstream);
  record.upstream = [];
  for (const name of [
    "include/llhttp.h",
    "src/api.c",
    "src/http.c",
    "src/llhttp.c",
    "LICENSE-MIT",
  ]) {
    const pin = pins.downloads.find((p) => p.name === `llhttp/${name}`);
    assert.ok(pin.url.includes("/816485216511b86459b2e6478190e14c38c14891/"));
    const source = path.resolve(
      ".local/sprint06a-a-sources",
      path.basename(name),
    );
    assert.equal(fs.lstatSync(source).isSymbolicLink(), false);
    const bytes = fs.readFileSync(source);
    assert.equal(hash(bytes), pin.sha256);
    fs.writeFileSync(path.join(upstream, path.basename(name)), bytes, {
      mode: 0o600,
    });
    record.upstream.push({
      name,
      url: pin.url,
      sha256: pin.sha256,
      bytes: bytes.length,
    });
  }
  const include = path.resolve(
    path.dirname(process.execPath),
    "../include/node",
  );
  record.nodeApiHeader = {
    file: path.join(include, "node_api.h"),
    sha256: hash(fs.readFileSync(path.join(include, "node_api.h"))),
  };
  record.compiler = await command(record, ["/usr/bin/cc", "--version"]);
  record.addonSource = {
    file: "spikes/envoy/sprint05c-a-llhttp.c",
    sha256: hash(fs.readFileSync("spikes/envoy/sprint05c-a-llhttp.c")),
  };
  const output = path.join(directory, "sprint06a-a-llhttp.node");
  await command(record, [
    "/usr/bin/cc",
    "-std=c11",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-fsyntax-only",
    `-I${include}`,
    `-I${upstream}`,
    record.addonSource.file,
  ]);
  await command(
    record,
    [
      "/usr/bin/cc",
      "-std=c11",
      "-O2",
      "-shared",
      "-fPIC",
      "-Wall",
      "-Werror",
      `-I${include}`,
      `-I${upstream}`,
      record.addonSource.file,
      ...["api.c", "http.c", "llhttp.c"].map((name) =>
        path.join(upstream, name),
      ),
      "-o",
      output,
    ],
    { timeout: 90000 },
  );
  record.addonSha256 = hash(fs.readFileSync(output));
  const addon = createRequire(import.meta.url)(output);
  assert.deepEqual(
    [
      addon.llhttpVersionMajor,
      addon.llhttpVersionMinor,
      addon.llhttpVersionPatch,
    ],
    [9, 4, 4],
  );
  return { addon, output };
}
