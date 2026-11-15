import fs from "node:fs";
import assert from "node:assert/strict";
import { assertLock } from "../spikes/envoy/wire-fixtures.mjs";
import {
  command,
  hash,
  rawCommand,
} from "../spikes/envoy/sprint05d-a-build.mjs";

process.umask(0o077);
assertLock();
const out = process.argv[2];
assert.match(out ?? "", /^evidence\/sprint06a-a\/run-\d+$/);
assert.ok(!fs.existsSync(out));
const record = {
  started: new Date().toISOString(),
  argv: process.argv,
  commands: [],
  pass: false,
  parent: process.ppid,
  wrapperPID: process.pid,
};
const source = await command(record, ["/usr/bin/git", "rev-parse", "HEAD"]);
record.sourceCommit = source.trim();
assert.equal(
  (
    await command(record, [
      "/usr/bin/git",
      "status",
      "--porcelain",
      "--untracked-files=all",
    ])
  ).trim(),
  "",
);
try {
  record.positiveLockCheck = await rawCommand([
    process.execPath,
    "scripts/sprint06a-a-container.mjs",
    "--lock-check",
  ]);
  assert.equal(record.positiveLockCheck.exit, 0);
  const holder = JSON.parse(record.positiveLockCheck.stdout);
  assert.notEqual(holder.pid, process.pid);
  assert.equal(holder.immediateParent, process.pid);
  record.fakeHolder = await rawCommand([
    process.execPath,
    "scripts/sprint06a-a-container.mjs",
    "--lock-check",
    String(process.pid),
  ]);
  assert.equal(record.fakeHolder.exit, 1);
  assert.match(
    record.fakeHolder.stderr,
    /supplied holder is not the live ancestor FLOCK owner/,
  );
  record.noAncestorHolder = await rawCommand([
    "/usr/bin/docker",
    "run",
    "--rm",
    "--pull=never",
    "--network=none",
    "--pid=host",
    "--name",
    `aegisgate-sprint06a-a-no-holder-${process.pid}`,
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--user",
    `${process.getuid()}:${process.getgid()}`,
    "--mount",
    `type=bind,src=${process.cwd()},dst=${process.cwd()},readonly`,
    "--mount",
    "type=bind,src=/tmp/aegisgate-sprint02-fixtures.lock,dst=/tmp/aegisgate-sprint02-fixtures.lock,readonly",
    "--env",
    `AEGIS06A_HOST_LOCK_PID=${holder.pid}`,
    "--workdir",
    process.cwd(),
    "--entrypoint",
    "/usr/local/bin/node",
    "sha256:582460f614631b59b824ac6020533b9bf339c7fdf3a6d7db31abb6b4065f0212",
    "scripts/sprint06a-a-container.mjs",
    "--lock-check",
  ]);
  assert.equal(record.noAncestorHolder.exit, 1);
  assert.match(
    record.noAncestorHolder.stderr,
    /fixture lifetime must be under the shared flock/,
  );
  record.run = await rawCommand(
    [process.execPath, "scripts/sprint06a-a-container.mjs", out],
    { timeout: 240000 },
  );
  assert.equal(record.run.exit, 0, record.run.stderr || record.run.stdout);
  assert.equal(record.run.error, undefined);
  const collector = JSON.parse(fs.readFileSync(`${out}/collector.json`));
  assert.equal(collector.lockPID, holder.pid);
  assert.equal(collector.lockHolder.immediateParent, process.pid);
  assert.notEqual(collector.lockPID, collector.lockHolder.immediateParent);
  assert.equal(collector.finiteControlsPass, true);
  assert.equal(
    collector.inspectBefore.Config.Env.find((s) =>
      s.startsWith("AEGIS06A_HOST_LOCK_PID="),
    ),
    `AEGIS06A_HOST_LOCK_PID=${holder.pid}`,
  );
  record.pass = true;
} catch (e) {
  record.error = { message: e.message, stack: e.stack };
  process.exitCode = 1;
} finally {
  assertLock();
  fs.mkdirSync(out, { recursive: true });
  record.ended = new Date().toISOString();
  record.lockHeldThroughCaptureAndHashes = true;
  fs.writeFileSync(
    `${out}/wrapper.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
  fs.writeFileSync(
    `${out}/SHA256SUMS`,
    fs
      .readdirSync(out)
      .filter((n) => n !== "SHA256SUMS")
      .sort()
      .map(
        (name) =>
          `${hash(fs.readFileSync(`${out}/${name}`))}  ${out}/${name}\n`,
      )
      .join(""),
  );
  console.log(JSON.stringify({ out, pass: record.pass, error: record.error }));
}
