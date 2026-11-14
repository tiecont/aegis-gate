# Sprint05A B executable plan

Scope: additive local parser PoCs only; Module01 remains NO-GO and no production
substitution is authorized. Baseline 541d1d915ce6a3b679dc3fed3ea0a98f908ce001.

1. Pin official released Envoy 1.40.2 Balsa source, public codec/header-validator
   options and image; execute strict-option header/trailer controls first.
2. Inspect and pin llhttp 9.4.4 released generated C/API, then compile unmodified
   upstream code with a small callback-only test driver. Exercise a bounded
   complete-message admission adapter with verified loopback TLS on both hops.
3. Inspect Nginx 1.30.6 released parser/body/proxy source and pinned existing
   image; execute buffering-enabled header/trailer controls. No more alternatives.
4. For each: valid fields/trailers, SP/HTAB folds, encoded targets, ordered
   pipeline, invalid pipeline suffix, fragmented and delayed trailers, fresh and
   reused downstream where supported. Count all origin plaintext bytes before
   its native parser, connections, handlers and parser/transport errors.
5. Retain unsuccessful outcomes and exact raw inputs/responses/callback events;
   run immutable baseline check and verify every baseline Git object unchanged.
   Commit source before runtime, compact evidence after runtime, then final report.

Every fixture lifecycle (setup through evidence hashing and cleanup) holds
/tmp/aegisgate-sprint02-fixtures.lock. Unique process-scoped containers, loopback
listeners only, bounded requests/memory/deadlines, disposable local PKI. No raw
HTTP scanner, parser repair, private fork, original-test edits or public probes.
