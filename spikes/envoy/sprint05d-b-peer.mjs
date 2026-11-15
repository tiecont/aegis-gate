// Diagnostic TLS relay only; retains synthetic raw bytes without rewriting traffic.
import fs from "node:fs";
import tls from "node:tls";
import http2 from "node:http2";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { createHash } from "node:crypto";
import { decoder } from "./wire-observer.mjs";

const originalSpawn = childProcess.spawn,
  originalConnect = http2.connect;
const connections = [],
  boundaries = [],
  sockets = new Set();
let proxy,
  readyPort,
  destination,
  omitted = 0,
  captured = 0;
const stamp = () => process.hrtime.bigint().toString();
const sha = (b) => createHash("sha256").update(b).digest("hex");
childProcess.spawn = function (program, args, ...rest) {
  const isLauncher = args?.[0]?.endsWith("recovery-launcher.mjs");
  if (isLauncher) {
    const manifest = JSON.parse(fs.readFileSync(args[1]));
    destination = Number(args[2]);
    const route = manifest.routes.find((r) => r.host === "edge-b.test");
    const ca = fs.readFileSync(manifest.ca_file);
    proxy = tls.createServer(
      {
        cert: fs.readFileSync(route.cert_file),
        key: fs.readFileSync(route.key_file),
        minVersion: "TLSv1.2",
        ALPNProtocols: ["h2"],
      },
      (client) => {
        client.pause();
        const upstream = tls.connect({
          host: "127.0.0.1",
          port: destination,
          servername: "edge-b.test",
          ca,
          rejectUnauthorized: true,
          minVersion: "TLSv1.2",
          ALPNProtocols: ["h2"],
        });
        sockets.add(client);
        sockets.add(upstream);
        const record = {
          id: connections.length + 1,
          frames: [],
          chunks: [],
          opened_ns: stamp(),
          peer: client.remoteAddress,
          downstream_alpn: client.alpnProtocol,
          downstream_sni: client.servername,
          downstream_tls: client.getProtocol(),
          downstream_authorized_by_original_client: true,
        };
        connections.push(record);
        const capture = (direction, isClient) => {
          const consume = decoder({
            client: isClient,
            emit(event) {
              if (record.frames.length < 512)
                record.frames.push({ time_ns: stamp(), direction, ...event });
              else omitted++;
            },
          });
          return (bytes) => {
            if (captured + bytes.length <= 256 * 1024) {
              captured += bytes.length;
              record.chunks.push({
                time_ns: stamp(),
                direction,
                bytes: bytes.length,
                sha256: sha(bytes),
                hex: bytes.toString("hex"),
              });
            } else omitted++;
            consume(bytes);
          };
        };
        client.on("data", capture("client-to-envoy", true));
        upstream.on("data", capture("envoy-to-client", false));
        upstream.on("secureConnect", () => {
          record.upstream_authorized = upstream.authorized;
          record.upstream_alpn = upstream.alpnProtocol;
          record.upstream_sni = upstream.servername;
          record.upstream_tls = upstream.getProtocol();
          if (!upstream.authorized || upstream.alpnProtocol !== "h2") {
            client.destroy();
            upstream.destroy();
            return;
          }
          client.pipe(upstream);
          upstream.pipe(client);
        });
        for (const socket of [client, upstream]) {
          socket.on("error", (e) => {
            record.error = e.code;
            client.destroy();
            upstream.destroy();
          });
          socket.on("close", () => sockets.delete(socket));
        }
        client.on("close", () => {
          record.closed_ns = stamp();
          upstream.destroy();
        });
        upstream.on("close", () => client.destroy());
      },
    );
    proxy.listen(0, "127.0.0.1", () => {
      readyPort = proxy.address().port;
    });
  }
  const child = originalSpawn.call(this, program, args, ...rest);
  if (isLauncher)
    child.on("exit", () => {
      for (const socket of sockets) socket.destroy();
      proxy.close();
    });
  return child;
};
http2.connect = function (authority, options, ...rest) {
  const url = new URL(authority);
  if (Number(url.port) === destination) {
    if (!readyPort) throw new Error("diagnostic relay not ready");
    url.port = String(readyPort);
    return originalConnect.call(this, url, options, ...rest);
  }
  return originalConnect.call(this, authority, options, ...rest);
};
syncBuiltinESMExports();
const log = console.log;
console.log = function (...args) {
  if (/^[\w-]+: (pass|fail)$/.test(String(args[0])))
    boundaries.push({ message: String(args[0]), time_ns: stamp() });
  return log.apply(this, args);
};
process.on("exit", () => {
  fs.writeFileSync(
    process.env.AEGIS_05D_B_PEER,
    JSON.stringify(
      {
        scope:
          "additional verified TLS transport; raw synthetic peer proof, not original timing acceptance",
        limits: { capture_bytes: 256 * 1024, frames_per_connection: 512 },
        captured_bytes: captured,
        omitted,
        boundaries,
        connections,
      },
      null,
      2,
    ) + "\n",
  );
});
