import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import tls from "node:tls";
import { once } from "node:events";
import { randomUUID, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

process.umask(0o077);
const [clone, output] = process.argv.slice(2);
assert.equal(process.cwd(), clone);
const load = (file) => import(pathToFileURL(path.join(clone, file)).href);
const { assertLock, listen, until, pki } = await load(
  "spikes/envoy/wire-fixtures.mjs",
);
const { build } = await load("spikes/envoy/sprint05d-a-build.mjs");
const { Spool } = await load("spikes/envoy/sprint05d-a-spool.mjs");
const { runtime, limits } = await load("spikes/envoy/sprint05d-a-runtime.mjs");
assertLock();
const sha = (b) => createHash("sha256").update(b).digest("hex");
const record = {
  argv: process.argv,
  started: new Date().toISOString(),
  commands: [],
  probes: [],
  runtimePass: false,
};
const fixture = fs.mkdtempSync(
  path.join(clone, ".local/sprint05d-f-admission-"),
);
const sockets = new Set(),
  servers = [];
let front;
const signal = () => AbortSignal.timeout(5000);
const track = (socket) => {
  sockets.add(socket);
  socket.on("error", () => {});
  socket.once("close", () => sockets.delete(socket));
  return socket;
};
const probe = async (name, action) => {
  assertLock();
  const row = { name };
  await action(row);
  row.pass = true;
  record.probes.push(row);
};
const rejection = async (promise, status) =>
  assert.rejects(promise, (e) => e.status === status);
try {
  await probe("exact-stage-and-aggregate-boundaries", async (row) => {
    const metrics = { peakDisk: 0 },
      spool = await Spool.open(path.join(fixture, "quotas"), metrics);
    const one = await spool.create(),
      two = await spool.create(),
      three = await spool.create();
    await rejection(spool.create(), 503);
    await one.append(Buffer.alloc(limits.stageBytes, 0x71), signal());
    await rejection(one.append(Buffer.from("x"), signal()), 413);
    await two.append(
      Buffer.alloc(limits.diskBytes - limits.stageBytes, 0x72),
      signal(),
    );
    assert.equal(spool.bytes, limits.diskBytes);
    await rejection(three.append(Buffer.from("x"), signal()), 503);
    assert.equal(spool.bytes, limits.diskBytes);
    await one.seal(signal());
    await two.seal(signal());
    row.peakBytes = metrics.peakDisk;
    row.files = spool.files;
    assert.equal(metrics.peakDisk, limits.diskBytes);
    assert.equal(spool.files, limits.stageFiles);
    for (const stage of [one, two, three]) await stage.close();
    assert.equal(spool.bytes, 0);
    assert.equal(spool.files, 0);
    await spool.close();
  });
  await probe("ciphertext-truncation-before-seal", async () => {
    const spool = await Spool.open(path.join(fixture, "truncated"), {
      peakDisk: 0,
    });
    const stage = await spool.create();
    await stage.append(Buffer.from("private-fixture-only"), signal());
    fs.truncateSync(stage.file, 1);
    await rejection(stage.seal(signal()), 503);
    await stage.close();
    assert.equal(spool.bytes, 0);
    await spool.close();
  });
  await probe("injected-ENOSPC-accounting-release", async () => {
    const spool = await Spool.open(path.join(fixture, "enospc"), {
      peakDisk: 0,
    });
    const stage = await spool.create(),
      original = stage.handle.write;
    stage.handle.write = async () => {
      throw Object.assign(new Error("F injected disk-full write"), {
        code: "ENOSPC",
      });
    };
    await assert.rejects(
      stage.append(Buffer.from("bounded-failed-write"), signal()),
      { code: "ENOSPC" },
    );
    stage.handle.write = original;
    await stage.close();
    assert.equal(spool.bytes, 0);
    assert.equal(spool.files, 0);
    await spool.close();
  });
  const sentinel = path.join(fixture, "sentinel");
  fs.writeFileSync(sentinel, "F-sentinel", { mode: 0o600 });
  for (const kind of [
    "root-symlink",
    "root-permissions",
    "unknown-session",
    "session-symlink",
    "session-permissions",
    "unknown-stage",
    "stage-symlink",
    "stage-hardlink",
    "stage-permissions",
    "stage-oversize",
    "too-many-files",
    "too-many-sessions",
  ]) {
    await probe(`orphan-startup-${kind}`, async () => {
      const root = path.join(fixture, kind),
        session = path.join(root, `sprint05d-a-session-${randomUUID()}`);
      if (kind === "root-symlink") fs.symlinkSync(path.dirname(sentinel), root);
      else {
        fs.mkdirSync(root, {
          mode: kind === "root-permissions" ? 0o755 : 0o700,
        });
        if (kind === "unknown-session")
          fs.mkdirSync(path.join(root, "unknown"), { mode: 0o700 });
        else if (kind === "session-symlink")
          fs.symlinkSync(path.dirname(sentinel), session);
        else if (kind === "too-many-sessions")
          for (let i = 0; i < 17; i++)
            fs.mkdirSync(
              path.join(root, `sprint05d-a-session-${randomUUID()}`),
              { mode: 0o700 },
            );
        else if (kind !== "root-permissions") {
          fs.mkdirSync(session, {
            mode: kind === "session-permissions" ? 0o755 : 0o700,
          });
          const file = path.join(session, `sprint05d-a-stage-${randomUUID()}`);
          if (kind === "stage-symlink") fs.symlinkSync(sentinel, file);
          else if (kind === "stage-hardlink") fs.linkSync(sentinel, file);
          else if (kind === "too-many-files")
            for (let i = 0; i < 4; i++)
              fs.writeFileSync(
                path.join(session, `sprint05d-a-stage-${randomUUID()}`),
                "x",
                { mode: 0o600 },
              );
          else if (kind !== "session-permissions") {
            fs.writeFileSync(
              kind === "unknown-stage" ? path.join(session, "unknown") : file,
              "x",
              { mode: kind === "stage-permissions" ? 0o644 : 0o600 },
            );
            if (kind === "stage-oversize")
              fs.truncateSync(file, limits.stageBytes + 1);
          }
        }
      }
      await assert.rejects(Spool.open(root, { peakDisk: 0 }));
      assert.equal(fs.readFileSync(sentinel, "utf8"), "F-sentinel");
      fs.rmSync(root, { recursive: true, force: true });
    });
  }
  await probe("valid-orphan-reclamation-positive", async (row) => {
    const root = path.join(fixture, "valid-orphan"),
      session = path.join(root, `sprint05d-a-session-${randomUUID()}`);
    fs.mkdirSync(root, { mode: 0o700 });
    fs.mkdirSync(session, { mode: 0o700 });
    fs.writeFileSync(
      path.join(session, `sprint05d-a-stage-${randomUUID()}`),
      Buffer.alloc(12345, 0x43),
      { mode: 0o600 },
    );
    const spool = await Spool.open(root, { peakDisk: 0 });
    assert.equal(spool.reclaimedFiles, 1);
    assert.equal(spool.reclaimedBytes, 12345);
    row.reclaimedFiles = spool.reclaimedFiles;
    row.reclaimedBytes = spool.reclaimedBytes;
    await spool.close();
  });
  const { addon } = await build(fixture, record);
  const certificates = pki(path.join(fixture, "pki"));
  const serverTLS = (name) => ({
    key: certificates.read(`${name}.key`),
    cert: certificates.read(`${name}.pem`),
    minVersion: "TLSv1.2",
    ALPNProtocols: ["http/1.1"],
  });
  let originBytes = 0,
    originSecure = 0;
  const endpoints = {};
  for (const name of ["origin", "wrong", "expired", "untrusted"]) {
    const server = tls.createServer(serverTLS(name), (socket) => {
      track(socket);
      originSecure++;
      socket.on("data", (b) => {
        originBytes += b.length;
        socket.end(
          "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK",
        );
      });
    });
    server.on("connection", track);
    server.on("tlsClientError", (_e, socket) => socket.destroy());
    servers.push(server);
    endpoints[name] = await listen(server);
  }
  const edgeTLS = serverTLS("edge-a"),
    route = {
      tenant: "tenant-a",
      enabled: true,
      generation: 7,
      port: endpoints.origin,
      ca: certificates.read("ca.pem"),
      originName: "lab-origin.test",
      edge: edgeTLS,
    };
  const routes = new Map([["edge-a.test", route]]);
  front = await runtime({
    addon,
    edgeTLS,
    routes,
    directory: path.join(fixture, "runtime-spool"),
  });
  async function request(host = "edge-a.test", servername = "edge-a.test") {
    const socket = track(
      tls.connect({
        host: "127.0.0.1",
        port: front.port,
        servername,
        ca: certificates.read("ca.pem"),
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
        ALPNProtocols: ["http/1.1"],
      }),
    );
    const chunks = [];
    let failure;
    const done = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("F peer-close deadline"));
      }, 6000);
      socket.on("data", (b) => chunks.push(Buffer.from(b)));
      socket.on("error", (e) => {
        failure = e.code;
      });
      socket.once("close", () => {
        clearTimeout(timer);
        resolve({
          statuses: [
            ...Buffer.concat(chunks)
              .toString()
              .matchAll(/HTTP\/1\.1 (\d{3})/g),
          ].map((m) => Number(m[1])),
          error: failure,
        });
      });
    });
    socket.once("secureConnect", () => {
      assert.equal(socket.authorized, true);
      socket.end(
        `GET /f-tls HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`,
      );
    });
    const response = await done;
    await until(
      () =>
        front.tcpConnections === 0 &&
        front.metrics.activeContexts === 0 &&
        sockets.size === 0,
    );
    return response;
  }
  for (const name of ["origin", "wrong", "expired", "untrusted", "origin"]) {
    await probe(
      `verified-origin-${name}-${record.probes.length}`,
      async (row) => {
        route.port = endpoints[name];
        const before = {
          bytes: originBytes,
          secure: originSecure,
          dials: front.metrics.originDials,
        };
        row.response = await request();
        row.originBytes = originBytes - before.bytes;
        row.originSecure = originSecure - before.secure;
        row.dials = front.metrics.originDials - before.dials;
        assert.deepEqual(row.response.statuses, [
          name === "origin" ? 200 : 502,
        ]);
        assert.equal(row.dials, 1);
        if (name === "origin") {
          assert.ok(row.originBytes > 0);
          assert.equal(row.originSecure, 1);
        } else {
          assert.equal(row.originBytes, 0);
          assert.equal(row.originSecure, 0);
        }
      },
    );
  }
  for (const [name, host, sni] of [
    ["Host-SNI-mismatch", "edge-b.test", "edge-a.test"],
    ["unknown-SNI", "edge-a.test", "unknown.test"],
  ]) {
    await probe(name, async (row) => {
      const before = { bytes: originBytes, dials: front.metrics.originDials };
      row.response = await request(host, sni);
      row.originBytes = originBytes - before.bytes;
      row.dials = front.metrics.originDials - before.dials;
      assert.equal(row.originBytes, 0);
      assert.equal(row.dials, 0);
      if (name === "Host-SNI-mismatch")
        assert.deepEqual(row.response.statuses, [421]);
      else {
        assert.deepEqual(row.response.statuses, []);
        assert.ok(row.response.error);
      }
    });
  }
  record.metrics = { ...front.metrics };
  await front.close();
  front = undefined;
  record.complete = true;
} catch (e) {
  record.error = e.stack;
  process.exitCode = 1;
} finally {
  assertLock();
  for (const socket of sockets) socket.destroy();
  if (front) {
    try {
      await front.close();
    } catch (e) {
      record.cleanupError = e.stack;
      process.exitCode = 1;
    }
  }
  for (const server of servers)
    await new Promise((resolve) => server.close(resolve));
  await until(() => sockets.size === 0);
  fs.rmSync(fixture, { recursive: true, force: true });
  record.fixtureAbsent = !fs.existsSync(fixture);
  record.socketCount = sockets.size;
  record.ended = new Date().toISOString();
  fs.writeFileSync(output, JSON.stringify(record, null, 2) + "\n");
  console.log(
    JSON.stringify({
      complete: record.complete,
      probes: record.probes.length,
      error: record.error,
      fixtureAbsent: record.fixtureAbsent,
      socketCount: record.socketCount,
      sha256: sha(fs.readFileSync(output)),
    }),
  );
  assertLock();
}
