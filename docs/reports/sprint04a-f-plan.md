# Sprint04-A F local recovery plan

Baseline: 3e03940848c81751c87bbcec131238abb7d28e1b. Frozen configuration v1
and accepted gates stay unchanged. No production custody, HA, or edge claim.

1. Exercise encrypted full-state rollback against authenticated external
   MinimumGeneration provisioning, including equal-floor restore, lost disk,
   missing key, restart replay and the explicit no-external-anchor limitation.
2. Exercise real worker Signer failures, retry without key fallback, recovery
   of an exactly staged artifact while signer is down, and retirement refusal.
3. Add bounded local capture drain; deny admission immediately, retain coherent
   captures during grace, refuse access after deadline, and require new startup.
4. Add conservative explicit maintenance pruning under PostgreSQL table locks;
   retain outbox, rollout, audit and external references. Exercise archive
   round-trip validation, restart, lock conflict and missing-table refusal.
5. Commit source before proof. Record every proof attempt, argv, exit, source
   hash and log SHA256. Hold the fixture lock through startup, tests and cleanup.
   Run targeted race/vet and existing Module03 integration acceptance. E owns
   independent reproduction; root owns repository-wide gates and integration.
