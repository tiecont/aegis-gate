// Complete-message admission experiment; finite staging is mandatory for every request.
import tls from "node:tls";
import assert from "node:assert/strict";
import { assertLock, listen } from "./sprint06a-a-fixtures.mjs";
import {
  Reader,
  write,
  identify,
  limits,
  Rejection,
} from "./sprint05c-a-runtime.mjs";
import { Spool } from "./sprint06a-a-spool.mjs";
export { limits };
const reject = (status, reason) => {
  throw new Rejection(status, reason);
};
const check = (signal) => {
  if (signal.aborted) throw signal.reason;
};
function secure(socket, signal) {
  check(signal);
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      socket.off("secureConnect", yes);
      socket.off("error", no);
      socket.off("close", closed);
      signal.removeEventListener("abort", abort);
      error ? reject(error) : resolve();
    };
    const yes = () => finish(),
      no = (e) => finish(e),
      closed = () => finish(new Error("origin closed"));
    const abort = () => finish(signal.reason);
    socket.once("secureConnect", yes);
    socket.once("error", no);
    socket.once("close", closed);
    signal.addEventListener("abort", abort, { once: true });
  });
}
class Slots {
  constructor(metrics) {
    this.metrics = metrics;
    this.active = 0;
    this.queue = [];
  }
  async acquire(signal) {
    check(signal);
    if (this.active < limits.originActive) this.active++;
    else {
      if (this.queue.length >= limits.originQueue)
        reject(503, "origin queue quota");
      await new Promise((resolve, reject) => {
        const item = {
          resolve: () => {
            signal.removeEventListener("abort", abort);
            resolve();
          },
        };
        const abort = () => {
          this.queue.splice(this.queue.indexOf(item), 1);
          reject(signal.reason);
        };
        signal.addEventListener("abort", abort, { once: true });
        this.queue.push(item);
        this.metrics.peakOriginQueue = Math.max(
          this.metrics.peakOriginQueue,
          this.queue.length,
        );
      });
    }
    this.metrics.peakOriginActive = Math.max(
      this.metrics.peakOriginActive,
      this.active,
    );
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const item = this.queue.shift();
      if (item) item.resolve();
      else this.active--;
    };
  }
}
export async function runtime({
  addon,
  edgeTLS,
  routes,
  directory,
  spoolOptions,
}) {
  assertLock();
  const metrics = {
    peakDisk: 0,
    peakOriginActive: 0,
    peakOriginQueue: 0,
    peakConnections: 0,
    activeContexts: 0,
    originDials: 0,
    requests: 0,
    staged: 0,
    admitted: 0,
    rejections: {},
  };
  const spool = await Spool.open(directory, metrics, spoolOptions),
    slots = new Slots(metrics);
  const sockets = new Set(),
    tasks = new Set(),
    handshakes = new Map();
  const socketKey = (socket) => `${socket.remoteAddress}:${socket.remotePort}`;
  async function serve(client) {
    metrics.activeContexts++;
    const controller = new AbortController(),
      signal = controller.signal;
    const abort = (e) => {
      if (!signal.aborted) controller.abort(e);
    };
    client.on("error", () => {});
    client.once("close", () => abort(new Error("client cancelled")));
    client.on("timeout", () => abort(new Rejection(408, "idle deadline")));
    const reader = new Reader(client, metrics),
      parser = addon.createParser();
    let timer,
      originTimer,
      upstream,
      stage,
      release,
      responseStarted = false;
    const cancel = () => upstream?.destroy();
    signal.addEventListener("abort", cancel);
    try {
      for (let number = 0; number < limits.messages; number++) {
        timer = setTimeout(
          () => abort(new Rejection(408, "absolute request deadline")),
          limits.requestMs,
        );
        client.setTimeout(limits.idleMs);
        let wire = 0,
          identity,
          completed = false,
          keepAlive = true;
        responseStarted = false;
        while (!completed) {
          const b = await reader.next(signal);
          if (b === null) {
            const eof = parser.finish();
            if (!wire && eof.error === "HPE_OK") return;
            reject(400, "truncated request");
          }
          if (!stage) {
            stage = await spool.create();
            metrics.staged++;
          }
          let offset = 0,
            resumeHeader = false;
          while ((offset < b.length || resumeHeader) && !completed) {
            resumeHeader = false;
            const parsed = parser.feed(b.subarray(offset));
            const part = b.subarray(offset, offset + parsed.consumed);
            offset += parsed.consumed;
            wire += part.length;
            if (wire > limits.stageBytes || parsed.bodyBytes > limits.bodyBytes)
              reject(413, "message size");
            if (
              !parsed.complete &&
              !parsed.headersReady &&
              parsed.error !== "HPE_OK"
            )
              reject(
                parsed.error === "HPE_USER" ? 413 : 400,
                parsed.reason || parsed.error,
              );
            if (!identity) {
              if (wire > limits.headerWireBytes)
                reject(413, "wire header size");
              if (parsed.headersReady) {
                identity = identify(parsed, client.servername, routes);
                resumeHeader = true;
                if (
                  !parsed.chunked &&
                  wire + parsed.contentLength > limits.stageBytes
                )
                  reject(413, "declared stage size");
              }
            }
            await stage.append(part, signal);
            if (parsed.complete) {
              assert.ok(identity);
              for (const [name] of parsed.trailers)
                if (!identity.declared.has(name.toLowerCase()))
                  reject(400, "undeclared trailer");
              completed = true;
              keepAlive = parsed.keepAlive;
            } else
              assert.ok(
                parsed.consumed || parsed.headersReady || offset === b.length,
                "llhttp progress",
              );
          }
          if (offset < b.length) reader.unread(b.subarray(offset));
        }
        await stage.seal(signal);
        check(signal);
        metrics.admitted++;
        client.setTimeout(0);
        release = await slots.acquire(signal);
        check(signal);
        originTimer = setTimeout(
          () => abort(new Rejection(504, "origin deadline")),
          limits.originMs,
        );
        metrics.originDials++;
        upstream = tls.connect({
          host: "127.0.0.1",
          port: identity.port,
          ca: identity.ca,
          servername: identity.originName,
          rejectUnauthorized: true,
          minVersion: "TLSv1.2",
          ALPNProtocols: ["http/1.1"],
          highWaterMark: limits.highWaterMark,
        });
        upstream.on("error", () => {});
        await secure(upstream, signal);
        assert.equal(upstream.authorized, true);
        assert.equal(upstream.alpnProtocol, "http/1.1");
        await stage.replay(upstream, signal, metrics);
        await stage.close();
        stage = undefined;
        const response = addon.createResponseParser(identity.method === "HEAD");
        try {
          const originReader = new Reader(upstream, metrics);
          let ended = false;
          while (!ended) {
            const b = await originReader.next(signal);
            if (b === null) reject(502, "origin incomplete response");
            let offset = 0;
            while (offset < b.length) {
              const parsed = response.feed(b.subarray(offset));
              if (parsed.error !== "HPE_OK" && !parsed.complete)
                reject(502, "origin response framing");
              responseStarted = true;
              await write(
                client,
                b.subarray(offset, offset + parsed.consumed),
                signal,
                metrics,
              );
              offset += parsed.consumed;
              if (parsed.complete && parsed.status >= 200) {
                ended = true;
                break;
              }
              if (!parsed.consumed) reject(502, "origin no progress");
            }
          }
        } finally {
          response.close();
        }
        upstream.destroy();
        upstream = undefined;
        clearTimeout(originTimer);
        originTimer = undefined;
        release();
        release = undefined;
        clearTimeout(timer);
        timer = undefined;
        metrics.requests++;
        if (!keepAlive) return;
      }
      responseStarted = false;
      reject(503, "connection request quota");
    } catch (error) {
      const status =
        error.status ??
        (signal.aborted ? signal.reason.status : undefined) ??
        (["ENOSPC", "EDQUOT", "EMFILE", "ENFILE", "EACCES", "EIO"].includes(
          error.code,
        )
          ? 503
          : 502);
      metrics.rejections[status] = (metrics.rejections[status] ?? 0) + 1;
      upstream?.destroy();
      if (!client.destroyed && !responseStarted)
        client.end(
          `HTTP/1.1 ${status} Rejected\r\nContent-Length: 0\r\nConnection: close\r\n\r\n`,
        );
    } finally {
      clearTimeout(timer);
      clearTimeout(originTimer);
      client.setTimeout(0);
      parser.close();
      signal.removeEventListener("abort", cancel);
      upstream?.destroy();
      release?.();
      try {
        if (stage) await stage.close();
      } finally {
        if (!client.destroyed) {
          client.end();
          client.destroySoon();
        }
        metrics.activeContexts--;
      }
    }
  }
  const contexts = new Map(
    [...routes].map(([name, route]) => [
      name,
      tls.createSecureContext(route.edge),
    ]),
  );
  const server = tls.createServer(
    {
      ...edgeTLS,
      allowHalfOpen: true,
      minVersion: "TLSv1.2",
      ALPNProtocols: ["http/1.1"],
      handshakeTimeout: limits.handshakeMs,
      highWaterMark: limits.highWaterMark,
      SNICallback(name, cb) {
        const context = contexts.get(name);
        cb(context ? null : new Error("unknown SNI"), context);
      },
    },
    (client) => {
      const key = socketKey(client);
      clearTimeout(handshakes.get(key));
      handshakes.delete(key);
      const task = serve(client).catch(() => {
        metrics.cleanupError = true;
        client.destroy();
      });
      tasks.add(task);
      task.finally(() => tasks.delete(task));
    },
  );
  server.on("connection", (socket) => {
    if (sockets.size >= limits.connections) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    const key = socketKey(socket),
      timer = setTimeout(() => socket.destroy(), limits.handshakeMs);
    handshakes.set(key, timer);
    socket.once("close", () => {
      clearTimeout(timer);
      handshakes.delete(key);
    });
    metrics.peakConnections = Math.max(metrics.peakConnections, sockets.size);
  });
  server.on("tlsClientError", (_error, socket) => socket.destroy());
  try {
    const port = await listen(server);
    return {
      port,
      metrics,
      quota: spool,
      slots,
      get tcpConnections() {
        return sockets.size;
      },
      async close() {
        assertLock();
        for (const socket of sockets) socket.destroy();
        await new Promise((resolve) => server.close(resolve));
        await Promise.all(tasks);
        assert.equal(metrics.cleanupError, undefined);
        assert.equal(metrics.activeContexts, 0);
        assert.equal(slots.active, 0);
        assert.equal(slots.queue.length, 0);
        await spool.close();
      },
    };
  } catch (e) {
    await spool.close();
    throw e;
  }
}
