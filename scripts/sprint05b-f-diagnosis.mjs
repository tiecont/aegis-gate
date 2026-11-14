import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";

const output = "evidence/sprint05b-f/diagnosis-01";
assert.ok(!fs.existsSync(output));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const source = "evidence/sprint05b-f/focused-03/lock-samples.jsonl";
const rows = fs.readFileSync(source, "utf8").trim().split("\n").map(JSON.parse);
const locks = rows.flatMap((row) => row.locks ?? []);
const waits = rows.flatMap((row) =>
  (row.locks ?? [])
    .filter(
      (lock) =>
        !lock.granted && lock.classid === 0 && lock.objid === 4122026002,
    )
    .map((lock) => ({ time: row.time, ...lock })),
);
const record = {
  scope:
    "Offline aggregation; controlled lock coupling is distinct from attribution of natural HTTP timeout failures",
  source: { file: source, sha256: sha(fs.readFileSync(source)) },
  samples: rows.length,
  observed_locks: locks.length,
  all_waiters: locks.filter((lock) => !lock.granted).length,
  migration_wait_samples: waits.length,
  maximum_migration_query_age_ms: Math.max(
    0,
    ...waits.map((lock) => lock.query_age_ms),
  ),
  migration_waiters: [...new Set(waits.map((lock) => lock.pid))],
  receipts: [],
};
for (const attempt of [
  "focused-01",
  "focused-02",
  "focused-03",
  "focused-04",
  "focused-05",
  "focused-06",
]) {
  const file = `evidence/sprint05b-f/${attempt}/receipt.json`;
  const receipt = JSON.parse(fs.readFileSync(file));
  record.receipts.push({
    file,
    sha256: sha(fs.readFileSync(file)),
    source_commit: receipt.source_commit,
    complete: receipt.complete,
    error: receipt.error?.split("\n")[0],
    commands: receipt.commands.map(({ label, exit_code }) => ({
      label,
      exit_code,
    })),
    private_output_matches: receipt.private_output_matches,
    private_material_removed: receipt.private_material_removed,
    go: receipt.go,
  });
}
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(
  `${output}/receipt.json`,
  JSON.stringify(record, null, 2) + "\n",
);
fs.writeFileSync(
  `${output}/SHA256SUMS`,
  `${sha(fs.readFileSync(`${output}/receipt.json`))}  ${output}/receipt.json\n`,
);
console.log(JSON.stringify(record));
