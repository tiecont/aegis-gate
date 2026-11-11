import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { validator, assertCompatible, source, root } from "./contracts.mjs";

test("foundation error fixture follows generated JSON schema", async () => {
  const valid = await validator();
  assert.equal(
    valid(
      JSON.parse(
        await fs.readFile(
          root + "/packages/contracts/fixtures/error.json",
          "utf8",
        ),
      ),
    ),
    true,
  );
});
test("negative: unknown fields, tenant header injection, malformed IDs and unbounded errors rejected", async () => {
  const valid = await validator();
  const good = JSON.parse(
    await fs.readFile(root + "/packages/contracts/fixtures/error.json", "utf8"),
  );
  const inputs = [
    { ...good, tenant_id: "tenant-b" },
    { error: { ...good.error, token: "unsafe" } },
    { error: { ...good.error, request_id: "../../tenant-a" } },
    {
      error: {
        ...good.error,
        request_id: "00000000-0000-1000-8000-000000000001",
      },
    },
    { error: { ...good.error, message: "x".repeat(257) } },
    { error: { ...good.error, code: "hello\r\nHeader: injected" } },
    { error: { ...good.error, message: "" } },
    { error: { ...good.error, message: "secret\nleak" } },
  ];
  for (const input of inputs)
    assert.equal(valid(input), false, JSON.stringify(input));
});
test("negative: intentionally broken schema and operation changes fail compatibility", async () => {
  const spec = JSON.parse(await fs.readFile(source, "utf8"));
  const schemaBreak = structuredClone(spec);
  delete schemaBreak.components.schemas.ErrorDetail.required;
  assert.throws(
    () => assertCompatible(spec, schemaBreak),
    /Breaking schema change/,
  );
  const operationBreak = structuredClone(spec);
  delete operationBreak.paths["/healthz"];
  assert.throws(
    () => assertCompatible(spec, operationBreak),
    /Breaking operation/,
  );
  assert.doesNotThrow(() => assertCompatible(spec, structuredClone(spec)));
});
