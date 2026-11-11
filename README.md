# AegisGate — API Gateway & Security Platform

**Architecture + execution-ready multi-agent plan** (Go control plane / Rust Pingora data plane / Next.js dashboard).

> Status: product & engineering blueprint, not a claim of security certification or deployable production software. Any deployment must pass the release gates in `docs/QUALITY_GATES.md`.

## Local implementation

Module 00 provides a local Go/Rust/Next.js foundation, generated transport contracts, disposable PKI/JWT fixtures and a loopback-only Compose lab. Tenant traffic remains unavailable and the default administrative listener exposes only foundation health. Follow [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for actual gate evidence and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for commands.

Current checkpoint: the isolated Pingora feasibility spike is **No-Go** because
one strict malformed-request test fails; see [ADR-011](docs/ADR-011-pingora-evaluation.md).
Module02 has an explicit local HTTPS management mode with real OIDC/PostgreSQL
tests, but remains partial and is not enabled by default. Details and remaining
acceptance work: [management checkpoint](docs/reports/02-management-checkpoint.md).

```sh
make bootstrap
make dev-up
make check
make security-scan
make dev-down
```

`make check` and `make security-scan` are separate required checks; compilation alone never opens a gate. Scanner findings fail the check and remain blockers until repaired or explicitly reviewed under the release policy. No production deployment is performed by these commands.

## Cách sử dụng

1. Đọc `MASTER_AGENT_PLAN.md` để hiểu phases, dependency graph, stop conditions, prompt chạy agent.
2. Đọc `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/CONFIG_PROTOCOL.md` trước khi code.
3. Yêu cầu coding agent đọc `prompts/AGENT_OPERATING_RULES.md` và thực thi **một** `agents/XX-*.md` mỗi lần; hoặc cho orchestration agent đọc `prompts/ORCHESTRATOR_PROMPT.md` để chạy tuần tự.
4. Không deploy vào public Internet cho tới khi hoàn tất `agents/11-security-hardening.md`, `agents/12-production-validation.md` và review thủ công bởi người phụ trách.

## Tài liệu

- `MASTER_AGENT_PLAN.md` — kế hoạch tổng, dependency, tiến độ, Definition of Done.
- `docs/PRODUCT_SCOPE.md` — personas, MVP, phase 2, tenant + usage.
- `docs/ARCHITECTURE.md` — runtime, boundaries, flows, data model, topology.
- `docs/THREAT_MODEL.md` — assets, threats, hardening, controls, negative tests.
- `docs/CONFIG_PROTOCOL.md` — snapshot schema, publication, trust, caching, rollback.
- `docs/QUALITY_GATES.md` — CI, SLO targets, test matrix, release gates.
- `docs/OPERATIONS.md` — production deploy, incident response, backup, disaster recovery.
- `docs/DECISIONS.md` — ADRs and trade-offs.
- `agents/00-*.md` đến `agents/12-*.md` — từng execution module.
- `prompts/*` — các prompt có thể copy cho agent.
- `examples/gateway-snapshot.json` — bản mẫu config **không có secret**, không dùng trực tiếp để deploy.

## Nguyên tắc thiết kế

- **Hot path không phụ thuộc control plane hoặc PostgreSQL.** Config được push/sync xuống edge, validate và atomic swap; edge chạy bằng last-known-good (LKG) khi control plane gián đoạn.
- **Default deny** đối với domain chưa được xác minh, missing auth config và policy không hợp lệ.
- TLS phải bảo vệ **client → edge**, **edge → origin** và **control plane → edge** tùy trust boundary. Không disable TLS verification cho upstream.
- **Không tự nhận bảo vệ volumetric L3/L4 DDoS** trên một VPS đơn lẻ: cần bảo vệ upstream/network-level.
- Chia **MVP** (working secure product) và **GA** (operational maturity), tránh đòi implement mọi loại WAF ở phiên bản đầu.

## Tham chiếu chính

- Pingora: https://github.com/cloudflare/pingora
- Pingora core docs: https://docs.rs/pingora-core/latest/pingora_core/
- RFC 9110 (HTTP semantics): https://www.rfc-editor.org/rfc/rfc9110
- RFC 9112 (HTTP/1.1 framing): https://www.rfc-editor.org/rfc/rfc9112
- OWASP API Security Top 10 (2023): https://owasp.org/www-project-api-security/
- Let's Encrypt challenge types: https://letsencrypt.org/docs/challenge-types/
- cert-manager: https://cert-manager.io/docs/
- OpenTelemetry HTTP semantics: https://opentelemetry.io/docs/specs/semconv/http/
- Cloudflare DDoS protection: https://developers.cloudflare.com/magic-transit/ddos/
- SPIFFE: https://spiffe.io/docs/latest/deploying/svids/
