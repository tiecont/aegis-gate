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
const { build } = await load("spikes/envoy/sprint06a-a-build.mjs");
const { Spool } = await load("spikes/envoy/sprint06a-a-spool.mjs");
const { runtime, limits } = await load("spikes/envoy/sprint06a-a-runtime.mjs");
assertLock();
const sha = (b) => createHash("sha256").update(b).digest("hex");
const record = {
  argv: process.argv,
  started: new Date().toISOString(),
  commands: [],
  probes: [],
  runtimePass: false,
  streamingPass: false,
};
const fixture = fs.mkdtempSync(
  path.join(clone, ".local/sprint06a-f-admission-"),
);
const sockets = new Set(),
  servers = [];
let front;
const signal = () => AbortSignal.timeout(6000);
const probe = async (name, action) => {
  assertLock();
  const row = { name };
  await action(row);
  row.pass = true;
  record.probes.push(row);
};
const erased = (stage, references) => {
  assert.equal(stage.key, null);
  assert.equal(stage.iv, null);
  assert.equal(stage.tag, null);
  assert.ok(references.filter(Boolean).every((b) => b.every((v) => v === 0)));
};
try {
  for (const kind of [
    "partial",
    "zero",
    "negative",
    "fractional",
    "excess",
    "ENOSPC",
    "EDQUOT",
    "EIO",
    "cancel-mid-write",
  ]) {
    await probe(`independent-write-${kind}`, async (row) => {
      const controller = new AbortController();
      let calls = 0;
      const io = {
        async write(handle, bytes, at, length, position) {
          calls++;
          if (["ENOSPC", "EDQUOT", "EIO"].includes(kind))
            throw Object.assign(new Error("synthetic write fault"), {
              code: kind,
            });
          if (kind === "zero") return { bytesWritten: 0 };
          if (kind === "negative") return { bytesWritten: -1 };
          if (kind === "fractional") return { bytesWritten: 0.5 };
          if (kind === "excess") return { bytesWritten: length + 1 };
          const result = await handle.write(
            bytes,
            at,
            Math.min(11, length),
            position,
          );
          if (kind === "cancel-mid-write")
            controller.abort(new Error("F cancellation"));
          return result;
        },
      };
      const spool = await Spool.open(
        path.join(fixture, kind),
        { peakDisk: 0 },
        io,
      );
      const stage = await spool.create(),
        references = [stage.key, stage.iv];
      try {
        const action = stage.append(
          Buffer.alloc(1037, 0x51),
          controller.signal,
        );
        if (kind === "partial") {
          await action;
          await stage.seal(signal());
          references.push(stage.tag);
          assert.ok(calls > 90);
        } else await assert.rejects(action);
        row.calls = calls;
      } finally {
        await stage.close();
        erased(stage, references);
        assert.equal(spool.bytes, 0);
        assert.equal(spool.files, 0);
        await spool.close();
      }
      row.released = true;
      row.keyBuffersZero = true;
    });
  }
  await probe("independent-exact-file-stage-aggregate", async (row) => {
    const spool = await Spool.open(path.join(fixture, "exact"), {
      peakDisk: 0,
    });
    const stages = [
      await spool.create(),
      await spool.create(),
      await spool.create(),
    ];
    try {
      await assert.rejects(spool.create(), { status: 503 });
      await stages[0].append(Buffer.alloc(limits.stageBytes), signal());
      await assert.rejects(stages[0].append(Buffer.from("x"), signal()), {
        status: 413,
      });
      await stages[1].append(
        Buffer.alloc(limits.diskBytes - limits.stageBytes),
        signal(),
      );
      await assert.rejects(stages[2].append(Buffer.from("x"), signal()), {
        status: 503,
      });
      assert.equal(spool.bytes, limits.diskBytes);
      row.bytes = spool.bytes;
      row.files = spool.files;
    } finally {
      for (const s of stages) await s.close();
      await spool.close();
    }
  });
  for (const kind of [
    "truncate",
    "tamper",
    "replace-inode",
    "hardlink",
    "mode",
  ]) {
    await probe(`independent-seal-${kind}`, async (row) => {
      const spool = await Spool.open(path.join(fixture, kind), { peakDisk: 0 });
      const stage = await spool.create(),
        refs = [stage.key, stage.iv],
        other = path.join(fixture, `other-${kind}`);
      try {
        await stage.append(Buffer.from("F-private-synthetic-body"), signal());
        if (kind === "truncate") fs.truncateSync(stage.file, 1);
        if (kind === "tamper") {
          const b = fs.readFileSync(stage.file);
          b[0] ^= 1;
          fs.writeFileSync(stage.file, b);
        }
        if (kind === "replace-inode") {
          fs.renameSync(stage.file, other);
          fs.writeFileSync(stage.file, Buffer.alloc(stage.size), {
            mode: 0o600,
          });
        }
        if (kind === "hardlink") fs.linkSync(stage.file, other);
        if (kind === "mode") fs.chmodSync(stage.file, 0o644);
        await assert.rejects(stage.seal(signal()));
        refs.push(stage.tag);
        row.rejectedBeforeReplay = true;
      } finally {
        await stage.close();
        erased(stage, refs);
        fs.rmSync(other, { force: true });
        await spool.close();
      }
    });
  }
  await probe(
    "inventory-validates-every-session-before-deleting",
    async (row) => {
      const root = path.join(fixture, "inventory");
      fs.mkdirSync(root, { mode: 0o700 });
      const valid = path.join(root, `sprint06a-a-session-${randomUUID()}`);
      fs.mkdirSync(valid, { mode: 0o700 });
      const orphan = path.join(valid, `sprint06a-a-stage-${randomUUID()}`);
      fs.writeFileSync(orphan, "F-orphan-ciphertext", { mode: 0o600 });
      fs.mkdirSync(path.join(root, "unexpected-entry"), { mode: 0o700 });
      await assert.rejects(Spool.open(root, { peakDisk: 0 }));
      assert.equal(fs.readFileSync(orphan, "utf8"), "F-orphan-ciphertext");
      row.validOrphanUntouched = true;
      fs.rmSync(root, { recursive: true });
    },
  );
  for (const kind of [
    "root-symlink",
    "session-symlink",
    "stage-symlink",
    "stage-hardlink",
    "stage-mode",
    "excess-sessions",
    "excess-files",
  ]) {
    await probe(`independent-startup-${kind}`, async () => {
      const root = path.join(fixture, `startup-${kind}`),
        outside = path.join(fixture, `sentinel-${kind}`);
      fs.mkdirSync(outside, { mode: 0o700 });
      const target = path.join(outside, "sentinel");
      fs.writeFileSync(target, "F-integrity", { mode: 0o600 });
      if (kind === "root-symlink") fs.symlinkSync(outside, root);
      else fs.mkdirSync(root, { mode: 0o700 });
      const session = path.join(root, `sprint06a-a-session-${randomUUID()}`);
      if (kind === "session-symlink") fs.symlinkSync(outside, session);
      else fs.mkdirSync(session, { mode: 0o700 });
      const file = path.join(session, `sprint06a-a-stage-${randomUUID()}`);
      if (kind === "stage-symlink") fs.symlinkSync(target, file);
      else if (kind === "stage-hardlink") fs.linkSync(target, file);
      else fs.writeFileSync(file, "orphan", { mode: 0o600 });
      if (kind === "stage-mode") fs.chmodSync(file, 0o644);
      if (kind === "excess-sessions")
        for (let i = 0; i < 16; i++)
          fs.mkdirSync(path.join(root, `sprint06a-a-session-${randomUUID()}`), {
            mode: 0o700,
          });
      if (kind === "excess-files")
        for (let i = 0; i < 3; i++)
          fs.writeFileSync(
            path.join(session, `sprint06a-a-stage-${randomUUID()}`),
            "",
            { mode: 0o600 },
          );
      await assert.rejects(Spool.open(root, { peakDisk: 0 }));
      assert.equal(fs.readFileSync(target, "utf8"), "F-integrity");
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true });
    });
  }
  const { addon } = await build(fixture, record);
  const certs = pki(path.join(fixture, "pki"));
  const serverTLS = (name) => ({
    key: certs.read(`${name}.key`),
    cert: certs.read(`${name}.pem`),
    ALPNProtocols: ["http/1.1"],
    minVersion: "TLSv1.2",
  });
  let originBytes = 0;
  const origin = tls.createServer(serverTLS("origin"), (peer) => {
    sockets.add(peer);
    peer.once("close", () => sockets.delete(peer));
    peer.on("error", () => {});
    peer.on("data", (b) => {
      originBytes += b.length;
      peer.end(
        "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK",
      );
    });
  });
  servers.push(origin);
  const port = await listen(origin),
    io = {
      mode: "normal",
      async write(handle, ...args) {
        if (io.mode === "ENOSPC")
          throw Object.assign(new Error("F ENOSPC"), { code: "ENOSPC" });
        return handle.write(...args);
      },
    };
  const edgeTLS = serverTLS("edge-a"),
    route = {
      tenant: "tenant-a",
      enabled: true,
      generation: 7,
      port,
      ca: certs.read("ca.pem"),
      originName: "lab-origin.test",
      edge: edgeTLS,
    };
  front = await runtime({
    addon,
    edgeTLS,
    routes: new Map([["edge-a.test", route]]),
    directory: path.join(fixture, "ingress"),
    spoolOptions: io,
  });
  async function request(wire, eof = true) {
    const peer = tls.connect({
      host: "127.0.0.1",
      port: front.port,
      servername: "edge-a.test",
      ca: certs.read("ca.pem"),
      rejectUnauthorized: true,
      ALPNProtocols: ["http/1.1"],
    });
    sockets.add(peer);
    peer.on("error", () => {});
    const chunks = [];
    peer.on("data", (b) => chunks.push(b));
    const done = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        peer.destroy();
        reject(new Error("F peer deadline"));
      }, 6000);
      peer.once("close", () => {
        clearTimeout(timer);
        sockets.delete(peer);
        resolve(Buffer.concat(chunks));
      });
    });
    await once(peer, "secureConnect");
    assert.equal(peer.authorized, true);
    if (eof) peer.end(wire);
    else peer.write(wire);
    const response = await done;
    await until(
      () =>
        front.metrics.activeContexts === 0 &&
        front.tcpConnections === 0 &&
        sockets.size === 0,
    );
    return [...response.toString().matchAll(/HTTP\/1\.1 (\d{3})/g)].map((m) =>
      Number(m[1]),
    );
  }
  const valid =
    "POST /independent HTTP/1.1\r\nHost: edge-a.test\r\nContent-Length: 3\r\nConnection: close\r\n\r\nabc";
  for (const [name, wire, status, fault] of [
    ["healthy-before-fault", valid, 200, "normal"],
    ["actual-ingress-injected-ENOSPC", valid, 503, "ENOSPC"],
    [
      "CL10-EOF",
      valid.replace("Content-Length: 3", "Content-Length: 10"),
      400,
      "normal",
    ],
    [
      "late-folded-trailer",
      "POST / HTTP/1.1\r\nHost: edge-a.test\r\nTransfer-Encoding: chunked\r\nTrailer: X-End\r\nConnection: close\r\n\r\n3\r\nabc\r\n0\r\nX-End: a\r\n b\r\n\r\n",
      400,
      "normal",
    ],
    [
      "Host-SNI",
      valid.replace("Host: edge-a.test", "Host: edge-b.test"),
      421,
      "normal",
    ],
    ["healthy-after-fault", valid, 200, "normal"],
  ]) {
    await probe(name, async (row) => {
      const before = { bytes: originBytes, dials: front.metrics.originDials };
      io.mode = fault;
      try {
        row.statuses = await request(wire);
      } finally {
        io.mode = "normal";
      }
      assert.deepEqual(row.statuses, [status]);
      row.originBytes = originBytes - before.bytes;
      row.originDials = front.metrics.originDials - before.dials;
      if (status !== 200) {
        assert.equal(row.originBytes, 0);
        assert.equal(row.originDials, 0);
      } else {
        assert.equal(row.originBytes, Buffer.byteLength(wire));
        assert.equal(row.originDials, 1);
      }
      assert.equal(front.quota.bytes, 0);
      assert.equal(front.quota.files, 0);
    });
  }
  record.metrics = { ...front.metrics };
  await front.close();
  front = undefined;
  assert.equal(addon.liveParsers(), 0);
  record.complete = true;
} catch (error) {
  record.error = error.stack;
  process.exitCode = 1;
} finally {
  assertLock();
  for (const peer of sockets) peer.destroy();
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
      socketCount: sockets.size,
    }),
  );
  assertLock();
}
