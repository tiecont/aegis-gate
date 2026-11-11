# SECURITY + ARCHITECTURE REVIEW PROMPT

Act as adversarial-but-defensive reviewer of the current AegisGate PR/module (authorized repository only). Read `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/CONFIG_PROTOCOL.md` and `docs/QUALITY_GATES.md`; compare claimed features to actual code, tests and configs.

Investigate: cross-tenant BOLA, config signature/replay, SNI/Host confusion, origin SSRF/DNS rebinding, JWT/JWKS alg and issuer/audience errors, header trust, request smuggling framing behavior, resource limits under slow clients, Redis fallback, TLS secrets leakage, billing idempotency, CI permissions, cluster isolation and rollback behaviors.

Output:

1. Findings grouped by critical/high/medium/low, exact file path/line and exploit preconditions (avoid unsupported speculation).
2. Tests actually run and results; for tests not run, state why and provide safe reproduction instructions using local fixtures only.
3. Proposed minimal repairs and missing regression tests.
4. Release-blocking verdict and evidence checklist. Do not approve unless all required gates have objective evidence.
