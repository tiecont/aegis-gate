# F gate/source binding plan

Review target4855552ffb7e46b48aac9d668ff459cbfc270ed5 against tested
dd5b48441982bf76a53982a16c53b948e59b175e and helper acceptancec8fd9b9.

1. Read immutable Git objects; verify trees, ancestor relationships, exact
   executable equality, all56 gate manifest entries and eight command streams.
   Classify the root status Markdown exception explicitly.
2. Audit retained scanner reports, history counts, pinned scanner policy,
   SBOM/image/source bindings and helper acceptance receipts.
3. Under the shared fixture lifetime flock, inspect the original gate clone
   read-only, all eight private paths and isolated Docker resource inventories.
   Collect current tool versions, without treating them as historical receipts.
4. Run only offline pinned secret scans of the target history and a committed
   reviewer snapshot. Exclude later integration-review commits by explicit
   revision, never merge their branch. Retain raw streams and compact manifests.
5. Report exact scope and limitations; commit only this plan, verifier, new
   receipts and the scoped report. No full gates, original75/23, push, fixtures
   or public endpoint tests. Module01 NO-GO; human owners PENDING.
