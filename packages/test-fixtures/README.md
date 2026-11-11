# Disposable local fixtures

These fixtures support owned local tests only. They are not production PKI, a configured IdP, a public origin or an authorization service. `make dev-up` prepares local secrets and a disposable PKI before starting Compose. All published ports bind `127.0.0.1`, and the Compose lab network is a dedicated bridge with ordinary outbound connectivity.

The Go generator can also run explicitly from the repository root after creating the ignored parent `.local` directory:

```sh
go run ./packages/test-fixtures/cmd/fixtures -out .local/pki
```

Generation requires a **new** output directory and refuses overwrites. It writes the `UNSAFE_LOCAL_ONLY` marker and uses `crypto/rand`, Go's standard X.509/RSA primitives and the maintained JWT library. No custom cryptographic algorithm is implemented.

## Files and limits

| Files                                            | Meaning                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `ca.pem`                                         | Disposable local CA certificate, valid for 48 hours. It is not installed into global trust.                              |
| `origin-a.pem` / `.key`, `origin-b.pem` / `.key` | Different server certificates for `origin-a.test` and `origin-b.test`, valid for 24 hours.                               |
| `wrong-host.pem` / `.key`                        | Deliberately wrong-host server certificate for hostname verification negatives.                                          |
| `expired.pem` / `.key`                           | Deliberately expired certificate for fail-closed negatives.                                                              |
| `jwt.key`, `jwks.json`, `valid.jwt`              | Disposable RSA fixture issuer key, public JWKS and short-lived RS256 token. Fixed issuer/audience identify the lab only. |

The CA signing key is held during generation and is not written to disk. Output directories use mode `0700`; all files use `0600`, including certificates and public JWKS, to keep the fixture directory private. `.local/`, `*.key` and `*.pem` are ignored by Git; JWT tokens remain inside ignored `.local`. Do not print private keys/tokens, paste them into reports, check them in, mount them into unrelated workloads or trust the lab CA outside the test client.

`scripts/dev-secrets.py` creates random PostgreSQL/Redis/NATS credentials under `.local` with restrictive permissions and generates ignored service configuration. It never prints material. Reusing persisted service volumes with newly generated credentials can require deliberate local teardown/reinitialization; do not present this as production credential rotation or backup recovery.

`origin.py` serves a bounded synthetic HTTPS response using the mounted `origin-a` fixture. The local Compose origin publishes `127.0.0.1:18443`. Test clients connect to loopback while verifying the certificate chain against **only** `.local/pki/ca.pem` and the expected DNS identity `origin-a.test`; no TLS-verification disable flag is used. The lab permits a loopback destination specifically as a fixture, not as a bypass for future public-origin SSRF policy.

## Evidence boundaries

The fixture unit tests exercise permissions, overwrite refusal, certificate profiles and dummy JWT signature/claims. Compose integration must exercise positive TLS and wrong-host/untrusted issuer rejection against the actual local server, plus authenticated dependencies. Consult the current module report for exact commands actually executed. Fixture correctness does not prove Pingora SNI selection, hot rotation, gRPC behavior, upstream TLS enforcement, tenant isolation or production certification.

Expired fixtures should be replaced deliberately in a fresh ignored directory after stopping their consumers. Production certificates, keys, issuer accounts and secret delivery require their own reviewed lifecycle in modules 05/10/11.
