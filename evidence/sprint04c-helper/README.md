# Gate cleanup fault injection

## Independent F repair verification

The current harness pins repair `578d78f3465d5a4cbb9587a0e03be975b33cd1c9`.
It preserves the three original cases and extends them to 33 synthetic cases.
F's exact-source receipt, raw streams and manifest are in
`../sprint04c-f/cleanup-01/`; the scoped verdict and limitations are in
`../../docs/reports/sprint04c-f-cleanup-review.md`. No real shared fixture or
scanner is used; VM lock assertions do not establish an actual flock lifecycle.
The historical proof below remains evidence only for the old helper.

## Historical proof-01

This isolated in-memory test executes the unchanged helper at
`cb9c30904e3430793d9847d9b9bf3eec3a8d052f` with synthetic filesystem and
child-process modules. It performs no actual gate, Docker, proxy, scanner or
fixture action and grants no security acceptance.

The first invocation at test source34246e8 exited1 because the test incorrectly
expected at least15 lock assertions; the actual helper calls its guard13 times.
No helper defect was observed. Corrected test asserts exactly13.

Cases cover clean completion, deliberate synthetic fixture-value leakage and a
synthetic private-key marker. Both deliberate failures must retain failed exit,
execute all eight owned cleanup paths, check empty network/volume inventories,
close descriptors and expose no synthetic value in receipt or console output.

Reproduce using Node26.13.0:

```sh
node --check evidence/sprint04c-helper/cleanup-test.mjs
node --experimental-vm-modules evidence/sprint04c-helper/cleanup-test.mjs
```
