# Sprint04-B E A/D Independent Review

Verdicts: **ACCEPT A proposed architecture/design package only** at
`3348ca06a70e37b574f415bc359bec31c1bfb5af`, tree
`1b389e60d1a58cc783ca9d60d9f9c97562ade7ea`; **ACCEPT D local reliability
evidence** at `ab4e1f642e2bcbac1723d156390cc1cbebdad157`, tree
`339fa397bafdfd482d154699af31e5e1c6d9f6aa`. No blocking finding in these scopes.
Only D attempt03 is eligible. No runtime candidate, contract activation, human
owner appointment, architecture GO or production approval is granted.

## A Design Review

All four documents match source `9378c8f85e855358ec26ff33fbae5db06a699d7d`;
the final head adds only four source/whitespace/hash receipts. Their tree,
exits and stream/document hashes verify. The sixteen changed files are confined
to A's four documents and evidence. Both A and D retain the original75 baseline.

The memo correctly distinguishes no forbidden forwarding, no rejection-caused
new connection, no origin request HEADERS/DATA/HPACK effects, and aggregate
zero decrypted bytes. It explicitly rejects handler-only and connection-only
acceptance; asynchronous H2 control traffic prevents treating these as a simple
universal implication chain. Nine SETTINGS ACK bytes remain a failed current
assertion, with no subtraction or shifted interval. Source research is separate
from executable63/69/70 results. Alternatives expose maintenance, migration and
the new trust boundary introduced by a separate TLS-terminating front end.

The alternative observer design is acceptable as a specification for future
review: full bidirectional capture before warmup through cleanup, complete
stream/connection attribution, maintained H2/HPACK state handling, raw byte
retention, bounded resources, loss/incomplete-state failure, and adversarial
synthetic observer controls. Explicitly approved causal control transitions
must be proved; frame type alone cannot whitelist traffic. The design still
needs implementation, independent adversarial validation and formal contract
approval. This review does not assert any observer exists or is proven.

ADR012 is PROPOSED, not a superseding accepted ADR. Architecture/security owner,
runtime selection, contract revision and approval reference/date remain PENDING.
Session delegation authorizes the Envoy research choice only. Human decision,
technical proof and security/release acceptance remain separate prerequisites.

## D Evidence And Redaction Review

The286 changed files are confined to D report/evidence; product, dependency,
test, scanner and contract bytes equal baseline `cbb5f71`. Corrected source
`54e7ea06b7519e9e2a5aee1ba4b03488897ae355` matches all224 recorded source
hashes. Attempt03's132-entry manifest and64 commands/128 streams verify.
All required exits are0; five competing lock attempts and unsupported TS7
resolution deliberately exit1. All88 Go top-level tests/151 subtests across11
packages pass with no skips, including durable prune/archive and isolation.

Attempt01's13-entry manifest verifies and failed Go preflight stays failed.
Attempt02's original134-entry manifest deliberately lacks exactly
`compose-config.stdout.txt`; other retained bytes/log hashes verify. The
historical `complete=true` records runtime completion, not evidence eligibility.
The adjacent REDACTION and final report explicitly exclude this attempt. The
removed path has no tracked version in reachable Git history. It was not
reconstructed, printed or rebound to a new digest. Fresh attempt03 replaces it.

The recorder holds one exclusive flock around setup, services, regression and
finally cleanup. Attempt03 records competing-lock refusal through cleanup and
empty project container/network/volume inventories. Corrected source never
records rendered Compose; structured network/config inspection stays in memory.
The stale-volume probe validates actual configured/build image identity,
loopback bindings, dynamic project network, credential rejection and persisted
row recovery, then deletes its own container/volume. No authentication/TLS
weakening or shared-volume reset is present.

E compared all286 D changed files to current private fixture credential values
in memory: zero matches, no values logged; no private-key markers. Fresh pinned
offline Gitleaks scans of A/D evidence exit0 (D404.15KB). These scoped checks do
not replace root's full worktree/history/image/dependency scan.

The report properly limits `MinimumGeneration` to an injection/provisioning
API, not implemented external monotonic storage. Captured-generation drain is
not engine I/O/WS/gRPC drain. Archive checksum tests do not supply authenticated
custody or a backup service. TS7 remains excluded by released parser-family
peer range `>=4.8.4 <6.1.0`; strict resolution fails and supported pins/override
remain unchanged. No Module10 or production-security claim is introduced.

## Independent Proof

From clean committed E verifier `4bdcc5e`, against clean detached snapshots:

```sh
/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node evidence/sprint04b-e/ad-review.mjs /home/tiecont/Projects/aegis-gate-04b-e-a /home/tiecont/Projects/aegis-gate-04b-e-d /home/tiecont/Projects/aegis-gate-04b-d evidence/sprint04b-e/ad-02
```

Exit0,2026-11-13T17:14:35.961Z-17:14:43.488Z. Independently executed:

```sh
/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go test -race -v ./internal/configconsumer ./internal/configpublish -run '^TestRecovery' -count=1
```

Exit0: encrypted rollback/floor, graceful/deadline drain, disconnected expiry/
retirement and staged signer outage/restart tests pass. These use isolated
temporary fixtures, no shared service. E did not rerun D's PostgreSQL/Compose/
dashboard lifecycle; its complete receipts and source were inspected. Scanner
containers held the full shared flock lifetime and used no network.

`ad-02/verification.json` SHA256:
`ec501849725cc7c86db5544fde02e7485a65cb17d131f284a21e479a77504002`.
The first E audit `ad-01` exited1 on authentic retained Docker-log trailing
whitespace. It remains failed; corrected source-only whitespace scope leaves
raw logs unchanged and hashes still enforce their integrity. One missing-path
exploration command supplied no acceptance evidence.

## Agent Completion Report

- Module/status: Sprint04-B E A/D review complete for exact heads above.
- Changes: E-only verifier, report and raw audit receipts; owners untouched.
- Decisions/contracts: design ACCEPT only; owner PENDING and zero-byte contract
  retained. Module01 NO-GO,04-12 LOCKED, production BLOCKED.
- Tests: immutable75/source/receipt checks, independent recovery race tests,
  offline secret scans exit0; no performance/SLO or full-gate claim.
- Remaining work: exact C/B review and root helper/integration review; root
  owns full local/hosted gates and merge. Existing human approvals remain.
