# Sprint04-C E regression execution

Baseline: `a325b9ecc086e09467f61b49f17da241bf8e43ea`.

Commit this recorder before proof. Run the complete Module00/02/03 Go race
suite with actual authenticated PostgreSQL/NATS/mTLS fixtures, isolated Compose
identity and stale-volume checks, existing foundation and dashboard checks,
strict dependency resolution, frozen signature vector and dependency scans.
Use the official cached Go1.27.4 and pinned Node26.13.0. Keep current pins
unless a maintained released TypeScript-eslint peer range explicitly supports7.

The recorder takes the shared fixture lock before setup and holds it through
cleanup and evidence hashing. It stores exact commands and two append-only raw
stream files with byte ranges and individual hashes, avoiding hundreds of empty
duplicate log files. It never retains rendered Compose configuration, private
keys or image archives. Existing failed attempts remain immutable.

No runtime, policy, frozen snapshot-v1, original75/23 or Module10 changes are
planned. Root's complete integration check/scan and independent F review remain
separate gates. Module01 stays NO-GO,04-12 LOCKED, production BLOCKED.
