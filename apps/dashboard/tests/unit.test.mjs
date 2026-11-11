import test from "node:test";
import assert from "node:assert/strict";
import config from "../next.config.mjs";
import { foundation } from "../lib/foundation.mjs";

test("unconfigured dashboard never advertises live tenant services", () => {
  assert.equal(foundation.management, "Not configured");
  assert.equal(foundation.traffic, "Disabled");
  assert.equal(Object.isFrozen(foundation), true);
});

test("browser security policy blocks framing and external connections on every path", async () => {
  const rules = await config.headers();
  assert.equal(rules[0].source, "/:path*");
  const headers = Object.fromEntries(
    rules[0].headers.map(({ key, value }) => [key.toLowerCase(), value]),
  );
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["referrer-policy"], "no-referrer");
  assert.equal(headers["x-frame-options"], "DENY");
  assert.match(headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.match(headers["content-security-policy"], /connect-src 'self'/);
  assert.match(headers["content-security-policy"], /form-action 'none'/);
  assert.equal(config.poweredByHeader, false);
});
