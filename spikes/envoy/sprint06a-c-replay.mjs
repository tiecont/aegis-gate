// Single synthetic loopback diagnostic, not an original acceptance evaluator.
import fs from "node:fs";
import tls from "node:tls";
import http2 from "node:http2";
import path from "node:path";
import assert from "node:assert/strict";
import { once } from "node:events";
import { assertLock } from "./wire-fixtures.mjs";
import { frame } from "./wire-observer.mjs";
import { packageData } from "./sprint06a-c-package.mjs";

process.umask(0o077);
assertLock();
const [specFile, id, output] = process.argv.slice(2);
assert.ok(
  path.isAbsolute(specFile ?? "") &&
    path.isAbsolute(output ?? "") &&
    !fs.existsSync(output),
);
const spec = JSON.parse(fs.readFileSync(specFile));
assert.equal(spec.synthetic_owned_fixture, true);
assert.equal(spec.host, "127.0.0.1");
assert.ok(Number.isInteger(spec.port) && spec.port > 1024 && spec.port < 65536);
assert.ok(["edge-a.test", "edge-b.test"].includes(spec.servername));
assert.ok(path.isAbsolute(spec.ca_file));
const data = packageData(),
  vector = data.vectors.find((v) => v.id === id);
assert.ok(vector || id === "individual-settled-userinfo-denial");
const record = {
  schema: "aegisgate.minimal-peer-diagnostic/1",
  id,
  owned_loopback: true,
  tls_verified: false,
  fixture_observation_only: true,
  original_evaluator_executed: false,
  origin_capture_complete: false,
  security_pass: false,
  deadline_ms: 3000,
  complete: false,
  raw_peer_hex: [],
  raw_peer_bytes: 0,
};
const sockets = new Set();
let session, timer, failure;
try {
  const socket = tls.connect({
    host: spec.host,
    port: spec.port,
    ca: fs.readFileSync(spec.ca_file),
    servername: spec.servername,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
    ALPNProtocols: [id.startsWith("raw-H2") || !vector ? "h2" : "http/1.1"],
  });
  sockets.add(socket);
  socket.on("error", () => {});
  timer = setTimeout(() => {
    record.deadline_expired = true;
    socket.destroy(new Error("diagnostic deadline"));
    session?.destroy();
  }, 3000);
  await once(socket, "secureConnect");
  assert.equal(socket.authorized, true);
  record.tls_verified = true;
  record.alpn = socket.alpnProtocol;
  if (!vector) {
    assert.equal(socket.alpnProtocol, "h2");
    // The maintained native H2 implementation owns framing/HPACK for authority.
    session = http2.connect(`https://127.0.0.1:${spec.port}`, {
      createConnection: () => socket,
    });
    session.on("error", () => {});
    const stream = session.request({
      ":method": "GET",
      ":path": "/",
      ":authority": "user@edge-b.test",
    });
    stream.on("error", (error) => {
      record.stream_error = error.code;
    });
    stream.on("response", (headers) => {
      record.http_status = headers[":status"];
    });
    stream.resume();
    stream.end();
    await new Promise((resolve) => stream.once("close", resolve));
    record.peer_reset_code = stream.rstCode;
  } else {
    socket.on("data", (bytes) => {
      if (record.raw_peer_bytes + bytes.length > 65536) {
        record.capture_lost = true;
        socket.destroy();
        return;
      }
      record.raw_peer_bytes += bytes.length;
      record.raw_peer_hex.push(bytes.toString("hex"));
    });
    const bytes = Buffer.from(vector.raw, "hex");
    record.sent_hex = bytes.toString("hex");
    socket.write(
      id.startsWith("raw-H2")
        ? Buffer.concat([
            Buffer.from("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"),
            frame(4, 0, 0),
            bytes,
          ])
        : bytes,
    );
    await new Promise((resolve) => socket.once("close", resolve));
  }
  record.complete = !record.deadline_expired && !record.capture_lost;
} catch (error) {
  failure = error;
  record.error_code = error.code ?? error.name;
} finally {
  clearTimeout(timer);
  session?.destroy();
  for (const socket of sockets) socket.destroy();
  assertLock();
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
}
if (failure) process.exitCode = 1;
