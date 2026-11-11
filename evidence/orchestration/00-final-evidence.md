# Foundation gate evidence

Gate accepted on 2026-11-11 for local foundation only. No production security
signoff, service readiness, tenant isolation or Pingora feasibility is implied.

| Evidence | Result | SHA256 |
|---|---|---|
| `00-root-final-check.log` | `make check` exit0 | `8e36fbfc9717e3cae246ab60c55bb3e598672edd223d1dc8502e9512e8cc29eb` |
| `00-root-derived-integration.log` | Final artifact integration exit0 | `01b58e97aa8678ffd9f5044542de165533286ce897502a1ae6692229a1b530c0` |
| `00-root-final-scans.log` | Complete scans/SBOM/identity exit0 | `cdadfb3f9b7d953a48a6ad006c6e973d2d0ec02fbbb09c70601be2fcb6dc8c2c` |
| `.local/evidence/security/repository.cdx.json` | Repository SBOM generated | `67d7a21d76cb34fe4139870d6c158e6aade41cced5e57df997c6d72180f8058a` |

Raw redacted scan JSON and SBOMs remain in ignored local evidence, not fixture
keys or service credentials. Historical failed attempts are retained separately;
the final logs above supersede their interim verdicts. Each final image scan
reported zero HIGH/CRITICAL findings using the downloaded advisory database.

Independent review: `docs/reports/00-independent-review.md`. Root gate and closed
finding details: `docs/reports/00-security-review.md`. Signed production images,
full provenance, remote branch protection and human release reviews remain later
requirements in the original quality gates.
