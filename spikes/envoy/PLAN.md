# Sprint03-A Agent B execution plan

Scope: isolated `spikes/envoy`, `evidence/sprint03a-b`, and B reports only.
No production architecture decision or gate is changed.

1. Read module01, ADR011, Sprint02 evidence and root's unchanged75-case contract.
2. Pin supported Envoy image by digest; implement executable manifest-path/port
   adapter using maintained Envoy protocol engines, file CDS/RDS/SDS and bounded
   fixture validation. Bind only127.0.0.1; verify both TLS hops.
3. Test adapter validation and run root's absolute shared runner under fixture
   flock. Preserve all tests and failures. Sample the actual Envoy process.
4. Scan immutable image, record exact inputs/hashes/results, document xDS/SDS,
   Module03 gaps, migration, diagram and precise GO/NO-GO.
5. Commit reviewable evidence and implementation for independent root review.
