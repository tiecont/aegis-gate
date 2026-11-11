import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import openapiTS, { astToString } from "openapi-typescript";
import SwaggerParser from "@apidevtools/swagger-parser";
import Ajv from "ajv";
import addFormats from "ajv-formats";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const source = path.join(root, "packages/contracts/openapi.json");
export async function schemaFor(name) {
  const spec = JSON.parse(await fs.readFile(source, "utf8"));
  const definitions = JSON.parse(
    JSON.stringify(spec.components.schemas).replaceAll(
      "#/components/schemas/",
      "#/definitions/",
    ),
  );
  for (const schema of Object.values(definitions)) {
    for (const property of Object.values(schema.properties ?? {})) {
      for (const key of Object.keys(property))
        if (key.startsWith("x-")) delete property[key];
    }
  }
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $ref: `#/definitions/${name}`,
    definitions,
  };
}
export async function validator(name = "ErrorEnvelope") {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(await schemaFor(name));
}
// Foundation compatibility rule is deliberately conservative: existing contract
// components and operations are immutable; additive names/paths are allowed.
export function assertCompatible(baseline, current) {
  for (const [name, schema] of Object.entries(baseline.components.schemas)) {
    if (
      JSON.stringify(schema) !==
      JSON.stringify(current.components.schemas[name])
    )
      throw new Error(
        `Breaking schema change: ${name}; version contract explicitly`,
      );
  }
  for (const [route, operations] of Object.entries(baseline.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      if (
        JSON.stringify(operation) !==
        JSON.stringify(current.paths[route]?.[method])
      )
        throw new Error(`Breaking operation change: ${method} ${route}`);
    }
  }
}
async function generate(write) {
  const spec = JSON.parse(await fs.readFile(source, "utf8"));
  await SwaggerParser.validate(structuredClone(spec));
  const baseline = JSON.parse(
    await fs.readFile(
      path.join(root, "packages/contracts/baseline.openapi.json"),
      "utf8",
    ),
  );
  assertCompatible(baseline, spec);
  const outputs = new Map();
  outputs.set(
    "packages/contracts/generated/api.ts",
    astToString(
      await openapiTS(
        new URL("../packages/contracts/openapi.json", import.meta.url),
      ),
    ),
  );
  outputs.set(
    "packages/contracts/generated/error.schema.json",
    JSON.stringify(await schemaFor("ErrorEnvelope"), null, 2) + "\n",
  );
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "aegis-contract-"));
  try {
    const target = path.join(temp, "api.gen.go");
    execFileSync(
      "go",
      [
        "tool",
        "oapi-codegen",
        "-generate",
        "types",
        "-package",
        "contracts",
        "-o",
        target,
        "packages/contracts/openapi.json",
      ],
      { cwd: root, stdio: "pipe" },
    );
    outputs.set(
      "internal/contracts/api.gen.go",
      await fs.readFile(target, "utf8"),
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
  for (const [relative, expected] of outputs) {
    const destination = path.join(root, relative);
    if (write) await fs.writeFile(destination, expected);
    else if ((await fs.readFile(destination, "utf8")) !== expected)
      throw new Error(
        `Generated contract drift: ${relative}; run make contracts-generate`,
      );
  }
  const valid = await validator();
  if (
    !valid(
      JSON.parse(
        await fs.readFile(
          path.join(root, "packages/contracts/fixtures/error.json"),
          "utf8",
        ),
      ),
    )
  )
    throw new Error(JSON.stringify(valid.errors));
  process.stdout.write(
    `Contracts ${write ? "generated" : "validated"}: OpenAPI, Go, TypeScript, JSON Schema, baseline, fixture\n`,
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (!["--write", "--check"].includes(process.argv[2]))
    throw new Error("Use --write or --check");
  await generate(process.argv[2] === "--write");
}
