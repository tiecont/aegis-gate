# ADR-012: Maintained Strict Ingress And Origin Isolation

- Status: **PROPOSED / decision PENDING**. Amendment proposal to ADR011/ADR002,
  not a superseding accepted decision.
- Baseline: main `cbb5f71db84b9489bf4a6260696bbba29ab4a561`,2026-11-13.
- Human architecture/security owner: **not supplied / assignment PENDING**.
- Formal approval reference/date: **none**.
- Research authorization: requesting human's current-session delegated choice;
  root selects maintained Envoy API research as described in the A report.

## Decision Requested

Appoint accountable human architecture/security ownership; confirm a bounded
maintained upstream track and explicitly select an origin-isolation contract.
All alternatives and evidence requirements are in
[the decision package](reports/sprint04b-a-architecture.md). The current
recommendation is Envoy upstream strict-ingress research while retaining the
unchanged all-byte requirement. No runtime is selected for production.

Option1: retain aggregate zero decrypted origin bytes in the original rejection
interval on every existing connection. A candidate must satisfy the unchanged
75-case evaluator as written, with no control-byte subtraction or timing shift.

Option2, proposed only: adopt a separately versioned request-isolation property
after formal human architecture/security review. Require no rejected request
stream/header block/data/parser/handler activity or rejection-caused origin
connection. Retain every raw byte and separately attribute pre-existing valid
connection control activity. See [security-contract memo](reports/sprint04b-security-contract.md)
and [alternative test design](reports/sprint04b-alternative-test-design.md).
This proposal is not effective until explicit recorded approval and validated
observer/test implementation; the original75 and its FAIL history stay intact.

No third option reducing acceptance to handler-only or connection-only checks
is recommended. A separately maintained strict-ingress front end is a NEW
TLS/identity/protocol architecture boundary, requiring a separate full review.

## Consequences And Stop Conditions

Envoy's public parsed-map filters cannot recover normalized folded syntax;
the inspected release exposes no proven maintained rejection hook before that
loss. Pingora target/framing/pipeline and maintenance gaps, Hyper incoming
CL/TE/fragment gaps, and the dual-ingress boundary remain explicit alternatives.
New releases, merged upstream patches or75/75 alone do not authorize migration.

Resume candidate work only after exact released supported capability and targeted
old-failure evidence exist. Then require unchanged75, mandatory protocol/TLS/
identity/cancellation/pool/config/resource proof, maintained dependencies,
independent security reproduction, full local/hosted gates and affirmative
human architecture approval. Otherwise preserve Module01 NO-GO,04-12 LOCKED,
production BLOCKED and stop unnecessary candidate rebuilds. No private production
codec/parser fork, policy waiver or public maintainer request is authorized here.

## Approval Form

| Field | Actual record |
| --- | --- |
| Accountable human architecture owner / role | PENDING; not supplied |
| Accountable human security owner / role | PENDING; not supplied |
| Maintained research direction | Envoy API research, root choice under session authorization |
| Runtime architecture selection | PENDING; none accepted |
| Origin-isolation contract | Existing zero-byte contract retained; revision PENDING |
| Exact eligible source and independent review | PENDING; no eligible runtime |
| Formal decision / approval reference and date | PENDING; none supplied |
| Production signoff | BLOCKED; separate release requirements |

Completing research or integrating this proposal cannot fill these approval
fields. Only supplied/formally recorded human decisions may do so.

## Sprint 04-C proposed decision handoff

The [proposed addendum](ADR-012-sprint04c-decision-addendum-proposed.md),
[security comparison](reports/sprint04c-a-architecture.md) and
[human checklist](reports/sprint04c-human-approval-checklist.md) recommend
retaining Option1 and make the owner/approval fields explicit. They do not
activate Option2 or a substitute runtime. Original75/23 and every failed
assertion remain unchanged. Formal named owners and approval remain PENDING.
