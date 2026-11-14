import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http2 from "node:http2";
import { pathToFileURL } from "node:url";
import { once } from "node:events";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  assertLock,
  pki,
  listen,
  freePort,
  until,
} from "../spikes/envoy/wire-fixtures.mjs";

assertLock();
process.umask(0o077);
const [source, output] = process.argv.slice(2);
assert.ok(path.isAbsolute(source));
assert.match(output ?? "", /^evidence\/sprint05b-f\/cause-\d+$/);
assert.ok(!fs.existsSync(output));
fs.mkdirSync(output, { recursive: true });
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sourceCommit = git("-C", source, "rev-parse", "HEAD");
assert.equal(sourceCommit, git("rev-parse", "f7ce126^{commit}"));
assert.equal(
  git("-C", source, "status", "--porcelain", "--untracked-files=no"),
  "",
);
const upstream = "/home/tiecont/Projects/aegis-gate";
const binary = `${upstream}/.local/sprint05b-native/envoy`;
const binarySha =
  "1d64506e25c1844f146162ddb2ece7010fa4e784faddb40a079021491f1f03cc";
assert.equal(sha(fs.readFileSync(binary)), binarySha);
const record = {
  reviewer_commit: git("rev-parse", "HEAD"),
  argv: process.argv,
  started_at: new Date().toISOString(),
  source_commit: sourceCommit,
  source_tree: git("-C", source, "rev-parse", "HEAD^{tree}"),
  binary_sha256: binarySha,
  scope:
    "Independent causal diagnostic; no original oracle or timing replacement",
  tests: [],
  semantic_security_pass: false,
  sources: [
    "spikes/envoy/sprint05b-b-native-launcher.mjs",
    "spikes/envoy/sprint05a-combined-config.mjs",
    "spikes/edge-comparison/tls-observer.mjs",
  ].map((file) => ({
    file,
    sha256: sha(fs.readFileSync(path.join(source, file))),
  })),
};
const fixture = fs.mkdtempSync(path.resolve(".local/sprint05b-f-cause-"));
const { createTlsObserver } = await import(
  pathToFileURL(`${source}/spikes/edge-comparison/tls-observer.mjs`)
);
const sessions = new Set(),
  clients = new Set(),
  sockets = new Set();
let origin,
  observer,
  child,
  log,
  bytes = 0,
  handlers = 0,
  accepts = 0,
  peer,
  initialAck;
const chunks = [],
  snapshot = () => ({ bytes, handlers, accepts, chunks: chunks.length });
async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Error("5s causal diagnostic deadline")),
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function check(name, operation) {
  const detail = await operation();
  record.tests.push({ name, detail });
  console.log(`PASS ${name}`);
}
try {
  const material = pki(fixture),
    ca = material.read("ca.pem");
  origin = http2.createSecureServer({
    cert: material.read("origin.pem"),
    key: material.read("origin.key"),
    minVersion: "TLSv1.2",
  });
  origin.on("session", (session) => {
    sessions.add(session);
    peer = session;
    initialAck = once(session, "localSettings");
    session.on("error", () => {});
    session.once("close", () => sessions.delete(session));
  });
  origin.on("stream", (stream) => {
    handlers++;
    stream.on("error", () => {});
    stream.respond({ ":status": 200 });
    stream.end("OK");
  });
  origin.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.once("close", () => sockets.delete(socket));
  });
  observer = createTlsObserver({
    cert: material.read("origin.pem"),
    key: material.read("origin.key"),
    ca,
    port: await listen(origin),
    onBytes: (n) => {
      bytes += n;
    },
  });
  observer.on("connection", () => accepts++);
  observer.on("secureConnection", (socket) =>
    socket.on("data", (b) => chunks.push(b.toString("hex"))),
  );
  const originPort = await listen(observer),
    edgePort = await freePort();
  const route = (host, name) => ({
    host,
    h2: true,
    origin_port: originPort,
    origin_name: "lab-origin.test",
    cert_file: material.file(`${name}.pem`),
    key_file: material.file(`${name}.key`),
  });
  const manifest = material.file("manifest.json");
  fs.writeFileSync(
    manifest,
    JSON.stringify({
      generation: 1,
      ca_file: material.file("ca.pem"),
      routes: [route("edge-a.test", "edge-a"), route("edge-b.test", "edge-b")],
    }),
  );
  const args = [
    `${source}/spikes/envoy/sprint05b-b-native-launcher.mjs`,
    manifest,
    String(edgePort),
  ];
  const environment = {
    AEGIS_05A_D_POLICY: "stream-errors",
    AEGIS_05B_B_BINARY: binary,
    AEGIS_05B_B_BINARY_SHA256: binarySha,
  };
  log = fs.openSync(`${output}/proxy.log`, "wx");
  child = spawn(process.execPath, args, {
    cwd: source,
    env: { ...process.env, ...environment },
    stdio: ["ignore", log, log],
  });
  record.launch = {
    program: process.execPath,
    args,
    environment,
    pid: child.pid,
  };
  await until(() =>
    fs
      .readFileSync(`${output}/proxy.log`, "utf8")
      .includes("sprint05b-b-native-diagnostic"),
  );
  await new Promise((resolve) => setTimeout(resolve, 250));
  const connect = async () => {
    const client = http2.connect(`https://127.0.0.1:${edgePort}`, {
      servername: "edge-b.test",
      ca,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      ALPNProtocols: ["h2"],
    });
    clients.add(client);
    client.on("error", () => {});
    client.once("close", () => clients.delete(client));
    await bounded(once(client, "connect"));
    assert.equal(client.socket.authorized, true);
    return client;
  };
  const request = async (client, extra = {}) => {
    const stream = client.request({
      ":path": "/",
      ":authority": "edge-b.test",
      ...extra,
    });
    let status;
    stream.on("response", (h) => {
      status = h[":status"];
    });
    stream.resume();
    stream.end();
    await bounded(once(stream, "end"));
    return status;
  };
  let client = await connect();
  await check("cold-host-denial-zero-origin", async () => {
    assert.equal(await request(client, { host: "edge-a.test" }), 421);
    assert.deepEqual(snapshot(), {
      bytes: 0,
      handlers: 0,
      accepts: 0,
      chunks: 0,
    });
    return snapshot();
  });
  client.destroy();
  client = await connect();
  await check("valid-pool-prime-and-initial-settings-ack", async () => {
    const statuses = [
      await request(client),
      await request(client),
      ...(await Promise.all(Array.from({ length: 4 }, () => request(client)))),
    ];
    assert.ok(statuses.every((status) => status === 200));
    await bounded(initialAck);
    assert.equal(accepts, 1);
    assert.equal(handlers, 6);
    return snapshot();
  });
  await check("idle-peer-settings-alone-exact-nine-byte-ack", async () => {
    const before = snapshot();
    await bounded(
      new Promise((resolve, reject) =>
        peer.settings({ maxConcurrentStreams: 31 }, (error) =>
          error ? reject(error) : resolve(),
        ),
      ),
    );
    const after = snapshot(),
      hex = chunks.slice(before.chunks).join("");
    assert.equal(hex, "000000040100000000");
    assert.equal(after.bytes - before.bytes, 9);
    assert.equal(after.handlers, before.handlers);
    assert.equal(after.accepts, before.accepts);
    return { before, after, hex, downstream_requests_during_interval: 0 };
  });
  await check("same-pool-remains-usable", async () => {
    assert.equal(await request(client), 200);
    assert.equal(accepts, 1);
    assert.equal(handlers, 7);
    return snapshot();
  });
  record.complete = true;
} catch (error) {
  record.error = error.stack;
} finally {
  assertLock();
  for (const client of clients) client.destroy();
  for (const session of sessions) session.destroy();
  observer?.closeAllConnections();
  for (const socket of sockets) socket.destroy();
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await bounded(once(child, "exit"));
  }
  for (const server of [observer, origin])
    if (server?.listening)
      await bounded(new Promise((resolve) => server.close(resolve)));
  if (log !== undefined) fs.closeSync(log);
  for (const name of fs.readdirSync(`${source}/.local`))
    if (name.startsWith("sprint05b-b-native-run-"))
      fs.rmSync(`${source}/.local/${name}`, { recursive: true });
  fs.rmSync(fixture, { recursive: true });
  record.cleanup = {
    fixture_removed: !fs.existsSync(fixture),
    launcher_exit: child?.exitCode,
    origin_sockets: sockets.size,
    lock_held: true,
  };
  record.ended_at = new Date().toISOString();
  fs.writeFileSync(
    `${output}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
  fs.writeFileSync(
    `${output}/SHA256SUMS`,
    fs
      .readdirSync(output)
      .sort()
      .map(
        (file) =>
          `${sha(fs.readFileSync(`${output}/${file}`))}  ${output}/${file}\n`,
      )
      .join(""),
  );
}
process.exitCode = record.complete ? 0 : 1;
