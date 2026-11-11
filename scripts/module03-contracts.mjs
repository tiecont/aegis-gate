import fs from "node:fs/promises";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const source = new URL("packages/contracts/openapi.json", root);
const spec = JSON.parse(await fs.readFile(source, "utf8"));
const snapshot = JSON.parse(
  await fs.readFile(
    new URL("internal/configsnapshot/schema-v1.json", root),
    "utf8",
  ),
);
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const names = Object.fromEntries(
  Object.keys(snapshot.$defs).map((key) => [
    key,
    `SnapshotV1${key[0].toUpperCase()}${key.slice(1)}`,
  ]),
);
function convert(value) {
  if (Array.isArray(value)) return value.map(convert);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref") out.$ref = ref(names[child.split("/").at(-1)]).$ref;
    else if (key === "const") out.enum = [child];
    else if (key === "type" && Array.isArray(child)) {
      out.type = child.find((type) => type !== "null");
      out.nullable = true;
    } else out[key] = convert(child);
  }
  return out;
}
const generation = { type: "integer", minimum: 1, maximum: 9007199254740991 };
const digest = { type: "string", pattern: "^[0-9a-f]{64}$" };
const ttl = { type: "integer", minimum: 60, maximum: 86400 };
const schemas = Object.fromEntries(
  Object.entries(snapshot.$defs).map(([key, value]) => [
    names[key],
    convert(value),
  ]),
);
schemas.SnapshotV1Payload = convert(snapshot.properties.payload);
schemas.PublicationPreview = {
  type: "object",
  additionalProperties: false,
  required: ["payload", "digest"],
  properties: { payload: ref("SnapshotV1Payload"), digest },
};
schemas.Publication = {
  type: "object",
  additionalProperties: false,
  required: ["deployment_id", "generation", "payload_digest"],
  properties: {
    deployment_id: { type: "string", format: "uuid", "x-go-type": "string" },
    generation,
    payload_digest: digest,
    rollback_of: generation,
  },
};
schemas.PublicationRequest = {
  type: "object",
  additionalProperties: false,
  required: ["digest", "ttl_seconds"],
  properties: { digest, ttl_seconds: ttl },
};
schemas.PublicationRollbackRequest = {
  type: "object",
  additionalProperties: false,
  required: ["generation", "ttl_seconds"],
  properties: { generation, ttl_seconds: ttl },
};
const project = {
  name: "project",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid", "x-go-type": "string" },
};
const mutation = [
  {
    name: "Idempotency-Key",
    in: "header",
    required: true,
    schema: { type: "string", minLength: 8, maxLength: 128 },
  },
  {
    name: "X-CSRF-Token",
    in: "header",
    required: true,
    schema: { type: "string", minLength: 43, maxLength: 43 },
  },
  {
    name: "Origin",
    in: "header",
    required: true,
    schema: { type: "string", format: "uri" },
  },
];
function operation(id, response, request) {
  const out = {
    operationId: id,
    servers: [{ url: "https://127.0.0.1:8443" }],
    security: [{ AdminSession: [] }],
    parameters: [project, ...(request ? mutation : [])],
    responses: {
      200: {
        description: "Authorized local configuration publication operation",
        content: { "application/json": { schema: ref(response) } },
      },
    },
  };
  for (const code of [400, 401, 404, 409, 429, 503])
    out.responses[code] = { $ref: "#/components/responses/Unavailable" };
  if (request)
    out.requestBody = {
      required: true,
      content: { "application/json": { schema: ref(request) } },
    };
  return out;
}
const paths = {
  "/v1/projects/{project}/publications/preview": {
    get: operation("previewConfigurationPublication", "PublicationPreview"),
  },
  "/v1/projects/{project}/publications": {
    post: operation(
      "approveConfigurationPublication",
      "Publication",
      "PublicationRequest",
    ),
  },
  "/v1/projects/{project}/publications/rollback": {
    post: operation(
      "rollbackConfigurationPublication",
      "Publication",
      "PublicationRollbackRequest",
    ),
  },
};
if (process.argv[2] === "--write") {
  Object.assign(spec.components.schemas, schemas);
  Object.assign(spec.paths, paths);
  await fs.writeFile(source, JSON.stringify(spec, null, 2) + "\n");
} else {
  assert.equal(process.argv[2], "--check");
  for (const [key, value] of Object.entries(schemas))
    assert.deepEqual(
      spec.components.schemas[key],
      value,
      `Module03 schema drift: ${key}`,
    );
  for (const [key, value] of Object.entries(paths))
    assert.deepEqual(spec.paths[key], value, `Module03 path drift: ${key}`);
}
console.log("Module03 contract synchronized with shared snapshot schema");
