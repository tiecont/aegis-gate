# Dashboard foundation

A buildable Next.js App Router application for local foundation work. The public page contains build-time implementation facts only. There is no session, backend connection, tenant data, billing UI, or management action. Unknown resource/API paths return 404. Module 09 must implement the authenticated SaaS dashboard after its prerequisites pass.

Use Node **26.13.0** (root `.node-version`) and the committed lockfile:

```sh
cd apps/dashboard
npm ci --ignore-scripts
npm run fmt:check
npm run lint
npm run typecheck
npm test
npm run build
npm run integration
npm audit --audit-level=moderate
npm run dev
```

Development/start scripts bind `127.0.0.1` only. Integration tests start the actual built Next.js application on an ephemeral loopback port and always stop it. No external assets, fonts, remote images, or backend fetches are used.

Pinned dependencies were verified on 2026-11-11 against the [Next.js release](https://github.com/vercel/next.js/releases/tag/v16.4.6), [React versions](https://react.dev/versions), and the npm registry. Node 26.13.0 is the [Node LTS release](https://github.com/nodejs/node/releases/tag/v26.13.0). This machine initially supplied Node 26.9.0; checks use a downloaded Node 26.13.0 binary verified against the SHA256 file fetched from the official Node distribution host.

The explicit **minimatch 11.0.7 override** replaces affected 10.x versions in build/lint dependencies. [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) is fixed from 11.0.1. This crosses an upstream dependency major boundary; lint/typecheck/build and integration tests are required on dependency changes. Do not remove the override until upstream packages select a patched minimatch release. `npm audit` reports zero vulnerabilities with the committed lockfile as of the verification date.

Browser headers deny framing, MIME sniffing, external connections, and form submission. The static development page permits inline scripts/styles for Next.js bootstrap; module 09 must replace this with a nonce or hash policy before authenticated interactive functionality. HTTPS/HSTS and session cookies belong to the reviewed deployment/authentication configuration and are not claimed here.

Verification: formatter, ESLint, strict TypeScript, two unit checks, optimized build, and one local HTTP integration test. The integration test also checks that forged tenant headers/bearer tokens cannot expose API resources or appear in responses. This is foundation negative coverage, not proof of tenant isolation for the future API.
