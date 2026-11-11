import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  await new Promise((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
  return address.port;
}

test(
  "local Next.js app serves public status and denies tenant-resource paths",
  { timeout: 30000 },
  async (t) => {
    const port = await unusedPort();
    const process = spawn(
      globalThis.process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        env: { ...globalThis.process.env, NEXT_TELEMETRY_DISABLED: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let diagnostics = "";
    process.stdout.on("data", (data) => {
      diagnostics = (diagnostics + data.toString()).slice(-8000);
    });
    process.stderr.on("data", (data) => {
      diagnostics = (diagnostics + data.toString()).slice(-8000);
    });
    t.after(async () => {
      if (process.exitCode === null) {
        const exited = new Promise((resolve) => process.once("exit", resolve));
        process.kill("SIGTERM");
        await exited;
      }
    });
    const base = `http://127.0.0.1:${port}`;
    let response;
    for (let attempt = 0; attempt < 100; attempt++) {
      assert.equal(process.exitCode, null, diagnostics);
      try {
        response = await fetch(base, { signal: AbortSignal.timeout(1000) });
        break;
      } catch {
        await delay(100);
      }
    }
    assert.ok(response, diagnostics);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(
      response.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
    const html = await response.text();
    assert.match(html, /Not configured/);
    assert.match(html, /Disabled/);
    assert.doesNotMatch(html, /tenant-secret-sentinel/);
    for (const path of [
      "/api/projects/tenant-a",
      "/v1/projects/tenant-a",
      "/api/keys",
    ]) {
      const denied = await fetch(base + path, {
        headers: {
          "x-tenant-id": "tenant-secret-sentinel",
          authorization: "Bearer tenant-secret-sentinel",
        },
        signal: AbortSignal.timeout(1000),
      });
      assert.equal(denied.status, 404, path);
      assert.doesNotMatch(await denied.text(), /tenant-secret-sentinel/);
    }
  },
);
