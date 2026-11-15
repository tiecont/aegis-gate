// Offline synthetic maintainer package; never starts a listener or changes an oracle.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { frame } from "./wire-observer.mjs";

export function packageData() {
  const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const manifest = JSON.parse(
    fs.readFileSync("spikes/edge-comparison/manifest.json"),
  );
  const historical23 = JSON.parse(
    fs.readFileSync("evidence/sprint05a-root/candidate-02/original23.json"),
  );
  const alternate = JSON.parse(
    fs.readFileSync("evidence/sprint05c-c/attempt-04/original23.json"),
  );
  const requirements = JSON.parse(
    fs.readFileSync("spikes/envoy/sprint06a-c-capabilities.json"),
  );
  const vectors = [];
  for (const id of requirements.requirements[0].cases) {
    const item = manifest.negatives.find((p) => p.name === id);
    assert.ok(item, id);
    vectors.push({
      id,
      encoding: "hex",
      raw: Buffer.from(item.request).toString("hex"),
      sha256: sha(Buffer.from(item.request)),
      historical_result: "FAIL on accepted Envoy",
      expected: manifest.negative_contract,
    });
  }
  for (const id of requirements.requirements[2].cases) {
    const old = historical23.tests.find((p) => p.name === id);
    const alt = alternate.tests.find((p) => p.name === id);
    assert.ok(old && alt);
    const raw = old.observation?.sent_hex ?? alt.observation?.sent_hex;
    assert.ok(raw, id);
    const bytes = Buffer.from(raw, "hex");
    if (id.endsWith("unexpected-CONTINUATION"))
      assert.deepEqual(bytes, frame(9, 4, 1));
    vectors.push({
      id,
      encoding: "hex",
      raw,
      sha256: sha(bytes),
      historical_result: old.status,
      alternate_result: alt.status,
      expected:
        "Peer RST_STREAM or GOAWAY code1 under original assertions; no origin bytes/handlers; original deadline unchanged",
    });
  }
  return {
    schema: "aegisgate.maintainer-package/1",
    published: false,
    fresh_runtime_execution: false,
    requirements,
    vectors,
    h2_userinfo: {
      method: "GET",
      path: "/",
      authority: "user@edge-b.test",
      verified_sni: "edge-b.test",
      expected_http_status: [400, 421],
      actual_peer_rst_hex: "00000403000000000100000001",
      peer_capture: "evidence/sprint05d-b/attempt-02/peer.json",
      controls: [
        "individual-settled-Host-denial",
        "individual-settled-authority-denial",
        "valid-identity-and-pool-reuse-after-negative-frames",
      ],
    },
    observation: {
      aggregate_ack_hex: "000000040100000000",
      current_contract:
        "FAIL whenever these9 bytes exist in the original interval; never subtract them",
      research: "No complete authoritative runtime instrumentation",
    },
    immutable_references: [
      "spikes/envoy/image.lock.json",
      "spikes/envoy/config.mjs",
      "spikes/envoy/wire-probes.mjs",
      "spikes/edge-comparison/manifest.json",
      "evidence/sprint05d-b/attempt-02/bootstrap.json",
      "evidence/sprint05d-b/attempt-02/peer.json",
      "evidence/sprint05d-b/attempt-02/receipt.json",
      "evidence/sprint05d-c/audit-01/receipt.json",
      "evidence/sprint05a-root/candidate-02/original23.json",
      "evidence/sprint05c-c/attempt-04/original23.json",
    ].map((file) => ({ file, sha256: sha(fs.readFileSync(file)) })),
    reproduction: {
      h1: "The exact hex vectors may be sent over verified owned fixture TLS using the pinned native candidate; the complete historical runner/oracle remains unchanged.",
      h2: "Send client preface then empty SETTINGS before each frame vector. Userinfo uses maintained native H2 request API and the immutable peer capture includes actual compressed blocks/state.",
      historical_commands: [
        "spikes/envoy/sprint05d-b-run.mjs (five selected exact bodies, diagnostic relay, not full23)",
        "spikes/envoy/sprint05d-c-audit.mjs (source/API stop, no runtime)",
      ],
      resource_rule:
        "flock /tmp/aegisgate-sprint02-fixtures.lock for setup through capture/hash/cleanup; owned loopback only; no public target",
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const output = process.argv[2];
  assert.ok(
    path.isAbsolute(output ?? "") && !fs.existsSync(output),
    "fresh absolute package path",
  );
  const data = packageData();
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(output, "manifest.json"),
    JSON.stringify(data, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  for (const vector of data.vectors)
    fs.writeFileSync(
      path.join(output, `${vector.id}.bin`),
      Buffer.from(vector.raw, "hex"),
      { flag: "wx", mode: 0o600 },
    );
  console.log(
    JSON.stringify({
      vectors: data.vectors.length,
      published: false,
      runtime_executed: false,
    }),
  );
}
