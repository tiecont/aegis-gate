import { exercise } from "./sprint06a-a-extra.mjs";
import fs from "node:fs";
import path from "node:path";
import tls from "node:tls";
import https from "node:https";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fork } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { assertLock, listen, until } from "./sprint06a-a-fixtures.mjs";
import { build, command, hash } from "./sprint06a-a-build.mjs";
import { runtime, limits } from "./sprint06a-a-runtime.mjs";
import { write } from "./sprint05c-a-runtime.mjs";

process.umask(0o077);
assertLock();
assert.equal(
  fs.realpathSync(process.execPath),
  fs.realpathSync(
    "/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node",
  ),
);
const record = {
  started: new Date().toISOString(),
  argv: process.argv,
  cwd: process.cwd(),
  commands: [],
  probes: [],
  limits,
  hypothesis: {
    failure:
      "05C CL10/abc/EOF had89 origin bytes/one handler; late-fold may follow any chunk prefix",
    hypothesis:
      "complete validation before every admission eliminates these effects within finite staging bounds",
    API: "unchanged maintained llhttp9.4.4 callbacks; Node AES-256-GCM and private bounded FileHandles",
    minimumtest:
      "identical unfinished CL/chunk prefixes followed by valid completion, EOF and late-fold",
    positive:
      "exact raw-byte hashes, completed bodies/trailers, encoded targets, ordered pipeline, upload, restart",
    stop: "no pre-completion origin progress is an explicit streaming FAIL; no resource benchmark or runtime GO",
  },
  completeValidationPass: false,
  streamingPass: false,
  runtimeGO: false,
  productionEligible: false,
  unchangedOriginalResult: {
    original75: "73/75 historical, not rerun",
    original23: "19/23 historical, not rerun",
  },
};
const git = async (...args) =>
  (await command(record, ["/usr/bin/git", ...args])).trim();
assert.equal(
  await git("status", "--porcelain", "--untracked-files=all"),
  "",
  "commit source before evidence",
);
assert.equal(
  await git("branch", "--show-current"),
  "feat/sprint06a-finite-ingress",
);
record.sourceCommit = await git("rev-parse", "HEAD");
record.sourceTree = await git("rev-parse", "HEAD^{tree}");
record.sources = (
  await git(
    "ls-files",
    "spikes/envoy/sprint06a-a-*",
    "scripts/sprint06a-a-*",
    "spikes/envoy/sprint05c-a-runtime.mjs",
    "spikes/envoy/sprint05c-a-llhttp.c",
    "spikes/envoy/sprint05b-a-build.mjs",
    "spikes/envoy/wire-fixtures.mjs",
    "scripts/sprint05b-baseline.mjs",
    "evidence/sprint05a-b/source-01/sources.json",
    "spikes/edge-comparison/manifest.json",
    "spikes/envoy/sprint06a-a-fixtures.mjs",
  )
)
  .split("\n")
  .map((file) => ({ file, sha256: hash(fs.readFileSync(file)) }));
record.node = {
  file: process.execPath,
  version: process.version,
  sha256: hash(fs.readFileSync(process.execPath)),
};
const out = process.argv[2];
assert.match(out ?? "", /^evidence\/sprint06a-a\/run-\d+$/);
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(".local", { recursive: true });
const fixture = fs.mkdtempSync(path.resolve(".local/sprint06a-a-"));
fs.mkdirSync(path.join(fixture, "tmp"));
process.env.TMPDIR = path.join(fixture, "tmp");
record.tmpdir = process.env.TMPDIR;
const faultIO = { mode: "normal", writeCalls: 0 };
faultIO.write = async (handle, bytes, at, length, position) => {
  faultIO.writeCalls++;
  if (faultIO.mode === "zero") return { bytesWritten: 0 };
  if (faultIO.mode === "EIO")
    throw Object.assign(new Error("injected disk fault"), { code: "EIO" });
  return handle.write(
    bytes,
    at,
    faultIO.mode === "partial" ? Math.min(7, length) : length,
    position,
  );
};
const sockets = new Set(),
  servers = [],
  handlers = [],
  raw = [],
  children = new Set();
let front,
  addon,
  binary,
  connections = 0,
  rawBytes = 0,
  parserErrors = 0,
  tlsErrors = 0;
const track = (socket) => {
  sockets.add(socket);
  socket.on("error", () => {});
  socket.once("close", () => sockets.delete(socket));
  return socket;
};
try {
  record.baselineBefore = JSON.parse(
    await command(record, [process.execPath, "scripts/sprint05b-baseline.mjs"]),
  );
  await command(record, ["/usr/bin/uname", "-a"]);
  await command(record, ["/usr/bin/openssl", "version"]);
  record.tools = [
    "/usr/bin/cc",
    "/usr/bin/curl",
    "/usr/bin/openssl",
    "/usr/bin/git",
    "/usr/bin/flock",
  ].map((file) => ({
    file: fs.realpathSync(file),
    sha256: hash(fs.readFileSync(file)),
  }));
  ({ addon, output: binary } = await build(fixture, record));
  const pki = path.join(fixture, "pki");
  fs.mkdirSync(pki);
  const openssl = (...args) =>
    command(record, ["/usr/bin/openssl", ...args], { cwd: pki });
  await openssl(
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "ca.key",
    "-out",
    "ca.pem",
    "-days",
    "1",
    "-subj",
    "/CN=disposable Sprint06A A CA",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
  );
  for (const [name, host] of [
    ["edge", "edge-a.test"],
    ["origin", "lab-origin.test"],
    ["expired", "lab-origin.test"],
  ]) {
    await openssl(
      "req",
      "-new",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      `${name}.key`,
      "-out",
      `${name}.csr`,
      "-subj",
      `/CN=${host}`,
      "-addext",
      `subjectAltName=DNS:${host}`,
    );
    if (name === "expired") {
      fs.writeFileSync(path.join(pki, "index.txt"), "", { mode: 0o600 });
      fs.writeFileSync(path.join(pki, "serial"), "1000\n", { mode: 0o600 });
      fs.writeFileSync(
        path.join(pki, "ca.cnf"),
        "[ca]\ndefault_ca=lab\n[lab]\ndatabase=index.txt\nserial=serial\nnew_certs_dir=.\ncertificate=ca.pem\nprivate_key=ca.key\ndefault_md=sha256\ndefault_days=1\npolicy=policy\ncopy_extensions=copy\n[policy]\ncommonName=supplied\n",
        { mode: 0o600 },
      );
      await openssl(
        "ca",
        "-batch",
        "-config",
        "ca.cnf",
        "-in",
        `${name}.csr`,
        "-out",
        `${name}.pem`,
        "-notext",
        "-startdate",
        "20200101000000Z",
        "-enddate",
        "20200102000000Z",
      );
    } else
      await openssl(
        "x509",
        "-req",
        "-in",
        `${name}.csr`,
        "-CA",
        "ca.pem",
        "-CAkey",
        "ca.key",
        "-CAcreateserial",
        "-out",
        `${name}.pem`,
        "-days",
        "1",
        "-copy_extensions",
        "copy",
      );
  }
  await openssl(
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "untrusted.key",
    "-out",
    "untrusted.pem",
    "-days",
    "1",
    "-subj",
    "/CN=lab-origin.test",
    "-addext",
    "subjectAltName=DNS:lab-origin.test",
  );
  fs.unlinkSync(path.join(pki, "ca.key"));
  const read = (name) => fs.readFileSync(path.join(pki, name));
  const serverTLS = (name) => ({
    key: read(`${name}.key`),
    cert: read(`${name}.pem`),
    minVersion: "TLSv1.2",
    ALPNProtocols: ["http/1.1"],
  });
  const clientTLS = (port, servername = "edge-a.test") => ({
    host: "127.0.0.1",
    port,
    servername,
    ca: read("ca.pem"),
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
    ALPNProtocols: ["http/1.1"],
    highWaterMark: limits.highWaterMark,
  });
  const origin = https.createServer(
    serverTLS("origin"),
    (request, response) => {
      const digest = createHash("sha256"),
        row = {
          target: request.url,
          bodyBytes: 0,
          ended: false,
          aborted: false,
        };
      handlers.push(row);
      request.on("data", (b) => {
        row.bodyBytes += b.length;
        digest.update(b);
      });
      request.on("aborted", () => {
        row.aborted = true;
      });
      request.on("end", () => {
        row.ended = true;
        row.bodySha256 = digest.digest("hex");
        row.trailers = request.rawTrailers;
        if (request.url === "/hold") return;
        response.writeHead(200, { "content-length": 2 });
        response.end("OK");
      });
    },
  );
  origin.on("connection", track);
  origin.on("clientError", (_e, s) => {
    parserErrors++;
    s.destroy();
  });
  origin.on("tlsClientError", () => {
    tlsErrors++;
  });
  servers.push(origin);
  const handlerPort = await listen(origin);
  // Count every decrypted byte before the actual HTTP parser/handler sees it.
  const observer = tls.createServer(serverTLS("origin"), (down) => {
    track(down);
    connections++;
    down.pause();
    const digest = createHash("sha256"),
      row = {
        bytes: 0,
        sha256: null,
        sni: down.servername,
        alpn: down.alpnProtocol,
      };
    raw.push(row);
    const up = track(tls.connect(clientTLS(handlerPort, "lab-origin.test")));
    const close = () => {
      down.destroy();
      up.destroy();
    };
    down.on("data", (b) => {
      rawBytes += b.length;
      row.bytes += b.length;
      digest.update(b);
    });
    down.once("close", () => {
      row.sha256 = digest.digest("hex");
    });
    for (const socket of [down, up]) {
      socket.on("error", close);
      socket.once("close", close);
    }
    up.once("secureConnect", () => {
      assert.equal(up.authorized, true);
      down.pipe(up);
      up.pipe(down);
    });
  });
  observer.on("connection", track);
  observer.on("tlsClientError", () => {
    tlsErrors++;
  });
  servers.push(observer);
  const originPort = await listen(observer);
  const edgeTLS = serverTLS("edge");
  const routes = new Map([
    [
      "edge-a.test",
      {
        tenant: "tenant-a",
        enabled: true,
        generation: 7,
        port: originPort,
        ca: read("ca.pem"),
        originName: "lab-origin.test",
        edge: edgeTLS,
      },
    ],
  ]);
  front = await runtime({
    addon,
    edgeTLS,
    routes,
    directory: path.join(process.env.AEGIS06A_SPOOL_ROOT ?? fixture, "spool"),
    spoolOptions: faultIO,
  });
  const req = (extra = "", body = "", target = "/", close = true) =>
    `POST ${target} HTTP/1.1\r\nHost: edge-a.test\r\n${extra}${close ? "Connection: close\r\n" : ""}\r\n${body}`;
  const cl = (body = "abc", close = true, target = "/") =>
    req(`Content-Length: ${Buffer.byteLength(body)}\r\n`, body, target, close);
  const chunkPrefix = req(
    "Transfer-Encoding: chunked\r\nTrailer: X-End\r\n",
    "3\r\nabc\r\n",
  );
  const tail = "0\r\nX-End: yes\r\n\r\n",
    fold = "0\r\nX-End: first\r\n second\r\n\r\n";
  const snap = () => ({
    bytes: rawBytes,
    connections,
    handlers: handlers.length,
    raw: raw.length,
    parserErrors,
    tlsErrors,
    dials: front.metrics.originDials,
  });
  const delta = (before) => ({
    bytes: rawBytes - before.bytes,
    connections: connections - before.connections,
    handlers: handlers.slice(before.handlers),
    raw: raw.slice(before.raw),
    parserErrors: parserErrors - before.parserErrors,
    tlsErrors: tlsErrors - before.tlsErrors,
    dials: front.metrics.originDials - before.dials,
  });
  const zero = (d) => {
    assert.equal(d.bytes, 0);
    assert.equal(d.connections, 0);
    assert.equal(d.handlers.length, 0);
    assert.equal(d.parserErrors, 0);
    assert.equal(d.tlsErrors, 0);
    assert.equal(d.dials, 0);
  };
  const settled = async () => {
    await until(
      () =>
        sockets.size === 0 &&
        front.tcpConnections === 0 &&
        front.metrics.activeContexts === 0,
    );
  };
  const connect = async (port = front.port) => {
    const socket = track(tls.connect(clientTLS(port)));
    await once(socket, "secureConnect");
    assert.equal(socket.authorized, true);
    return socket;
  };
  function collect(socket) {
    const chunks = [];
    const begun = performance.now();
    socket.on("data", (b) => chunks.push(Buffer.from(b)));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("peer-close deadline"));
      }, 6000);
      socket.once("close", () => {
        clearTimeout(timer);
        const b = Buffer.concat(chunks);
        resolve({
          statuses: [...b.toString().matchAll(/HTTP\/1\.1 (\d{3})/g)].map((m) =>
            Number(m[1]),
          ),
          bytes: b.length,
          sha256: hash(b),
          peerClosed: true,
          elapsedMs: performance.now() - begun,
        });
      });
    });
  }
  async function send(socket, raw) {
    const b = Buffer.from(raw),
      signal = AbortSignal.timeout(4000);
    for (let at = 0; at < b.length; at += limits.readBytes)
      await write(socket, b.subarray(at, at + limits.readBytes), signal);
  }
  async function sendUntilRejection(socket, raw) {
    try {
      await send(socket, raw);
      return { writeInterrupted: false };
    } catch (error) {
      if (
        error.message !== "socket closed" &&
        !["EPIPE", "ECONNRESET", "ERR_STREAM_DESTROYED"].includes(error.code)
      )
        throw error;
      return { writeInterrupted: true, error: error.code ?? error.message };
    }
  }
  const exact = (d, parts) => {
    assert.equal(
      d.bytes,
      parts.reduce((n, p) => n + Buffer.byteLength(p), 0),
    );
    assert.deepEqual(
      d.raw.map((r) => r.sha256),
      parts.map((p) => hash(Buffer.from(p))),
    );
    assert.equal(d.handlers.length, parts.length);
    assert.ok(d.handlers.every((h) => h.ended && !h.aborted));
    assert.equal(d.parserErrors, 0);
    assert.equal(d.tlsErrors, 0);
  };
  async function probe(name, wire, statuses, options = {}) {
    await settled();
    const before = snap(),
      socket = await connect(),
      done = collect(socket);
    if (options.eof) socket.end(wire);
    else {
      try {
        await send(socket, wire);
      } catch (e) {
        if (!options.mayClose) throw e;
      }
    }
    const response = await done;
    await settled();
    const d = delta(before);
    assert.deepEqual(response.statuses, statuses, name);
    if (statuses.every((s) => s >= 400) && !options.allowOrigin) zero(d);
    if (options.parts) exact(d, options.parts);
    const row = {
      name,
      inputBytes: Buffer.byteLength(wire),
      inputSha256: hash(Buffer.from(wire)),
      response,
      origin: d,
    };
    record.probes.push(row);
    return row;
  }
  await probe("no-body-staged-positive", cl(""), [200], { parts: [cl("")] });
  const clPrefix = req("Content-Length: 10\r\n", "abc");
  for (const [name, prefix, suffix, status, eof] of [
    ["CL-common-prefix-valid", clPrefix, "1234567", 200, false],
    ["CL-common-prefix-EOF", clPrefix, "", 400, true],
    ["chunk-common-prefix-valid", chunkPrefix, tail, 200, false],
    ["chunk-common-prefix-EOF", chunkPrefix, "", 400, true],
    ["chunk-common-prefix-late-fold", chunkPrefix, fold, 400, false],
  ]) {
    await settled();
    const before = snap(),
      socket = await connect(),
      done = collect(socket);
    await send(socket, prefix);
    await until(() => front.quota.bytes === Buffer.byteLength(prefix));
    await delay(100);
    const beforeCompletion = delta(before);
    zero(beforeCompletion);
    const file = [...front.quota.stages][0].file,
      encrypted = fs.readFileSync(file);
    const stat = fs.statSync(file);
    assert.equal(stat.mode & 0o777, 0o600);
    assert.equal(fs.statSync(front.quota.directory).mode & 0o777, 0o700);
    assert.equal(fs.statSync(front.quota.root).mode & 0o777, 0o700);
    assert.equal(encrypted.length, Buffer.byteLength(prefix));
    assert.notEqual(hash(encrypted), hash(Buffer.from(prefix)));
    assert.equal(encrypted.includes(Buffer.from("abc")), false);
    if (eof) socket.end();
    else socket.write(suffix);
    const response = await done;
    await settled();
    const d = delta(before);
    assert.deepEqual(response.statuses, [status]);
    if (status === 200) exact(d, [prefix + suffix]);
    else zero(d);
    record.probes.push({
      name,
      commonPrefixSha256: hash(Buffer.from(prefix)),
      prefixBytes: Buffer.byteLength(prefix),
      beforeCompletion,
      ciphertextSha256: hash(encrypted),
      privateMode: "0700/0600",
      response,
      origin: d,
    });
  }
  await probe("complete-CL-write-EOF", cl(), [200], {
    eof: true,
    parts: [cl()],
  });
  const originals = JSON.parse(
    fs.readFileSync("spikes/edge-comparison/manifest.json"),
  ).negatives.filter((p) => /obsolete.fold/.test(p.name));
  for (const original of originals)
    await probe(original.name, original.request, [400]);
  await probe(
    "CL-TE-rejected",
    req("Content-Length: 3\r\nTransfer-Encoding: chunked\r\n", "abc"),
    [400],
  );
  await probe(
    "undeclared-trailer",
    chunkPrefix + "0\r\nX-Other: bad\r\n\r\n",
    [400],
  );
  for (const target of ["/a%2Fb?x=%23", "/a/../b?x=%00"]) {
    const wire = cl("encoded", true, target);
    const row = await probe(`encoded-target-${target}`, wire, [200], {
      parts: [wire],
    });
    assert.equal(row.origin.handlers[0].target, target);
  }
  const first = cl("pipeline", false),
    last = chunkPrefix + tail;
  await probe("ordered-CL-chunk-pipeline", first + last, [200, 200], {
    parts: [first, last],
  });
  await probe(
    "valid-late-fold-pipeline",
    first + chunkPrefix + fold,
    [200, 400],
    { parts: [first] },
  );
  await probe("invalid-valid-pipeline", chunkPrefix + fold + cl(), [400]);
  const body = "q".repeat(512 * 1024),
    largeCL = cl(body),
    largeChunk = req(
      "Transfer-Encoding: chunked\r\nTrailer: X-End\r\n",
      `${body.length.toString(16)}\r\n${body}\r\n${tail}`,
    );
  for (const [name, wire] of [
    ["finite-CL-upload", largeCL],
    ["finite-chunk-upload", largeChunk],
  ]) {
    const row = await probe(name, wire, [200], { parts: [wire] });
    assert.equal(row.origin.handlers[0].bodyBytes, body.length);
    assert.equal(row.origin.handlers[0].bodySha256, hash(Buffer.from(body)));
  }
  await probe(
    "declared-stage-oversize",
    req(`Content-Length: ${limits.stageBytes + 1}\r\n`),
    [413],
  );
  const tooLarge = "x".repeat(limits.stageBytes);
  await probe(
    "chunk-stage-oversize",
    req(
      "Transfer-Encoding: chunked\r\n",
      `${tooLarge.length.toString(16)}\r\n${tooLarge}\r\n0\r\n\r\n`,
    ),
    [413],
    { mayClose: true },
  );

  await settled();
  {
    const before = snap(),
      socket = await connect(),
      done = collect(socket);
    socket.write(clPrefix);
    await until(() => front.quota.files === 1);
    await delay(100);
    zero(delta(before));
    socket.destroy();
    await done;
    await settled();
    zero(delta(before));
    assert.equal(front.quota.files, 0);
    assert.equal(front.quota.bytes, 0);
    record.probes.push({
      name: "staged-CL-cancellation",
      origin: delta(before),
      released: true,
    });
  }
  await settled();
  {
    const before = snap(),
      peers = [],
      dones = [];
    for (let i = 0; i < limits.stageFiles; i++) {
      const socket = await connect();
      peers.push(socket);
      dones.push(collect(socket));
      socket.write(clPrefix);
    }
    await until(() => front.quota.files === limits.stageFiles);
    const socket = await connect(),
      done = collect(socket);
    socket.write(clPrefix);
    const response = await done;
    assert.deepEqual(response.statuses, [503]);
    for (const socket of peers) socket.destroy();
    await Promise.all(dones);
    await settled();
    zero(delta(before));
    assert.equal(front.quota.files, 0);
    assert.equal(front.quota.bytes, 0);
    record.probes.push({
      name: "aggregate-stage-file-quota",
      response,
      origin: delta(before),
      released: true,
    });
  }
  await settled();
  {
    const before = snap(),
      peers = [],
      dones = [];
    for (let i = 0; i < 2; i++) {
      const socket = await connect();
      peers.push(socket);
      dones.push(collect(socket));
      await send(
        socket,
        req("Content-Length: 1400000\r\n", "r".repeat(800000)),
      );
    }
    await until(() => front.quota.bytes >= 1600000);
    const socket = await connect(),
      done = collect(socket);
    const attempted = req("Content-Length: 1400000\r\n", "s".repeat(600000));
    const writeResult = await sendUntilRejection(socket, attempted);
    const response = await done;
    assert.deepEqual(response.statuses, [503]);
    for (const socket of peers) socket.destroy();
    await Promise.all(dones);
    await settled();
    zero(delta(before));
    assert.equal(front.quota.files, 0);
    assert.equal(front.quota.bytes, 0);
    record.probes.push({
      name: "aggregate-ciphertext-byte-quota",
      response,
      origin: delta(before),
      released: true,
      attemptedBytes: Buffer.byteLength(attempted),
      writeResult,
      writeScope:
        "attempted upload may stop at peer rejection; full delivery is not asserted",
    });
  }
  await settled();
  {
    const before = snap(),
      socket = await connect(),
      done = collect(socket);
    socket.write(clPrefix);
    await until(() => front.quota.bytes === Buffer.byteLength(clPrefix));
    const file = [...front.quota.stages][0].file,
      bytes = fs.readFileSync(file);
    bytes[0] ^= 1;
    const fd = fs.openSync(file, "r+");
    fs.writeSync(fd, bytes, 0, bytes.length, 0);
    fs.closeSync(fd);
    socket.write("1234567");
    const response = await done;
    await settled();
    assert.deepEqual(response.statuses, [503]);
    zero(delta(before));
    record.probes.push({
      name: "ciphertext-tamper-auth-before-dial",
      response,
      origin: delta(before),
    });
  }
  await probe("incomplete-chunk-waits-for-origin-progress", chunkPrefix, [408]);
  record.streamingPositive = {
    expected: "origin progress before client completes request",
    observed: "none;408",
    pass: false,
    reason:
      "strict finite staging necessarily withholds the entire request until completion",
  };
  await settled();
  {
    const before = snap(),
      socket = await connect(),
      done = collect(socket);
    socket.write(req("Content-Length: 100000\r\n"));
    const ticker = setInterval(() => {
      if (!socket.destroyed) socket.write("x");
    }, 150);
    const response = await done;
    clearInterval(ticker);
    await settled();
    assert.deepEqual(response.statuses, [408]);
    assert.ok(response.elapsedMs >= limits.requestMs - 100);
    zero(delta(before));
    record.probes.push({
      name: "absolute-incomplete-request-deadline",
      response,
      origin: delta(before),
    });
  }
  await probe("healthy-after-quotas-auth-timeouts", cl("healthy"), [200], {
    parts: [cl("healthy")],
  });

  async function startChild(directory) {
    const argv = [
      process.execPath,
      "spikes/envoy/sprint06a-a-child.mjs",
      fixture,
      binary,
      String(originPort),
      directory,
    ];
    const child = fork(argv[1], argv.slice(2), {
      execPath: process.execPath,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    children.add(child);
    const run = {
      argv,
      started: new Date().toISOString(),
      stdout: "",
      stderr: "",
    };
    record.children ??= [];
    record.children.push(run);
    child.stdout.on("data", (b) => {
      run.stdout += b;
    });
    child.stderr.on("data", (b) => {
      run.stderr += b;
    });
    child.once("exit", (exit, signal) => {
      run.exit = exit;
      run.signal = signal;
      run.ended = new Date().toISOString();
      children.delete(child);
    });
    const [ready] = await once(child, "message", {
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(ready.ready, true);
    run.ready = ready;
    return { child, ready };
  }
  await settled();
  {
    const before = snap(),
      directory = path.join(
        process.env.AEGIS06A_SPOOL_ROOT ?? fixture,
        "restart-spool",
      );
    const a = await startChild(directory),
      socket = await connect(a.ready.port),
      done = collect(socket);
    const prefix = req(
      "Content-Length: 100000\r\n",
      "crash-private-canary-".repeat(1000),
    );
    await send(socket, prefix);
    let file;
    await until(() => {
      const session = fs.readdirSync(directory)[0];
      const names = fs.readdirSync(path.join(directory, session));
      file = names[0] ? path.join(directory, session, names[0]) : undefined;
      return file && fs.statSync(file).size === Buffer.byteLength(prefix);
    });
    const ciphertext = fs.readFileSync(file);
    assert.equal(
      ciphertext.includes(Buffer.from("crash-private-canary-")),
      false,
    );
    zero(delta(before));
    const exited = once(a.child, "exit");
    a.child.kill("SIGKILL");
    const [, signal] = await exited;
    assert.equal(signal, "SIGKILL");
    await done;
    await settled();
    zero(delta(before));
    assert.ok(fs.existsSync(file));
    const orphan = {
      bytes: ciphertext.length,
      sha256: hash(ciphertext),
      mode: fs.statSync(file).mode & 0o777,
      keyPersisted: false,
    };
    const b = await startChild(directory);
    assert.equal(b.ready.reclaimedFiles, 1);
    assert.equal(b.ready.reclaimedBytes, ciphertext.length);
    assert.equal(fs.existsSync(file), false);
    const valid = cl("restart"),
      peer = await connect(b.ready.port),
      completed = collect(peer);
    await send(peer, valid);
    const response = await completed;
    await settled();
    assert.deepEqual(response.statuses, [200]);
    exact(delta(before), [valid]);
    const stopped = once(b.child, "message"),
      closed = once(b.child, "exit");
    b.child.send("stop");
    const [state] = await stopped;
    assert.equal(state.stopped, true);
    const [exit] = await closed;
    assert.equal(exit, 0);
    assert.equal(fs.existsSync(directory), false);
    record.probes.push({
      name: "SIGKILL-ciphertext-orphan-restart",
      orphan,
      recovery: b.ready,
      response,
      origin: delta(before),
      stopped: state,
    });
  }
  await exercise({
    record,
    front,
    fixture,
    addon,
    routes,
    edgeTLS,
    faultIO,
    probe,
    cl,
    clPrefix,
    chunkPrefix,
    req,
    snap,
    delta,
    zero,
    settled,
    connect,
    collect,
    send,
    sockets,
  });
  await probe("healthy-after-subprocess-restart", cl("final"), [200], {
    parts: [cl("final")],
  });
  record.completeValidationPass = true;
  record.metrics = structuredClone(front.metrics);
  record.baselineAfter = JSON.parse(
    await command(record, [process.execPath, "scripts/sprint05b-baseline.mjs"]),
  );
  assert.deepEqual(record.baselineAfter, record.baselineBefore);
} catch (error) {
  record.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  assertLock();
  for (const child of children) child.kill("SIGKILL");
  for (const socket of sockets) socket.destroy();
  try {
    if (front) await front.close();
    for (const server of servers.reverse())
      await new Promise((resolve) => server.close(resolve));
    await until(() => sockets.size === 0 && children.size === 0);
    if (addon) assert.equal(addon.liveParsers(), 0);
    record.cleanup = {
      sockets: sockets.size,
      children: children.size,
      liveParsers: addon?.liveParsers(),
      stageFiles: front?.quota.files,
      stageBytes: front?.quota.bytes,
      contexts: front?.metrics.activeContexts,
      originSlots: front?.slots.active,
      originQueue: front?.slots.queue.length,
      listeners: servers.filter((s) => s.listening).length,
    };
  } catch (e) {
    record.cleanupError = { message: e.message, stack: e.stack };
    process.exitCode = 1;
  }
  fs.rmSync(fixture, { recursive: true, force: true });
  record.privateFixtureRemoved = !fs.existsSync(fixture);
  record.lockHeldThroughCleanup = true;
  record.ended = new Date().toISOString();
  fs.writeFileSync(
    `${out}/receipt.json`,
    JSON.stringify(record, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      completeValidationPass: record.completeValidationPass,
      streamingPass: false,
      probes: record.probes.length,
      error: record.error,
      cleanupError: record.cleanupError,
      cleanup: record.cleanup,
    }),
  );
}
