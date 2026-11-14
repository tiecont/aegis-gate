# Sprint04-C D execution contract

Base a325b9ecc086e09467f61b49f17da241bf8e43ea. Add a test-only Go
Framer/HPACK decoder using the existing pinned golang.org/x/net v0.62.0;
no Go module or production parser change. Bound raw capture to128KiB per
connection/direction,2048 decoded frames,64KiB compressed header block,
8192 bytes/string,128 decoded fields and16KiB total decoded field text.

Run deliberate leak/partial/capture/mapping tests, immutable baseline check,
and fresh focused protocol diagnostics under the shared fixture lock through
setup, collection and cleanup. Do not repeat unchanged75 or relabel original23.
Every original source/evaluator/expectation and historical04B receipt remains
unchanged. Raw synthetic capture contains only local test identities/payloads.

Public HPACK decoder tracks state but does not expose a complete dynamic-table
mutation log. Real proxy dispatch-to-origin stream mappings, signed-generation
capture, authenticated tenant association and downstream native wire capture
are not available. Such evidence is explicitly INCONCLUSIVE, never security
PASS. Failed old tests and9 SETTINGS ACK bytes remain FAIL.

Commit sources before proof; retain exact commit/tree, argv/cwd/tool versions,
exits/raw streams/SHA256. Independent F must adversarially reproduce tests.
No upstream publication, architecture approval, Module04 or production action.
